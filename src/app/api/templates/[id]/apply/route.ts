/**
 * Template Application API Route
 *
 * POST /api/templates/[id]/apply - Apply template to an artifact
 * Uses the saved template prompt and fields to extract data from a new artifact
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { extractWithRules } from '@/lib/rule-extraction';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for AI extraction

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id: templateId } = await context.params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { artifact_id } = body;

    if (!artifact_id) {
      return NextResponse.json(
        { error: 'artifact_id is required' },
        { status: 400 }
      );
    }

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .eq('created_by', user.id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Fetch artifact with raw content
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .select('*, source:sources(*, provider:providers(*))')
      .eq('id', artifact_id)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this artifact (via provider ownership)
    if (artifact.source?.provider?.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied to this artifact' },
        { status: 403 }
      );
    }

    // Check if artifact has raw content
    if (!artifact.raw_content || !artifact.raw_content.text) {
      return NextResponse.json(
        { error: 'Artifact content not extracted yet. Please extract content first.' },
        { status: 400 }
      );
    }

    // STEP 1: Try rule-based extraction first (fast, cheap)
    let extractionMethod: 'rules' | 'ai' | 'fallback' = 'ai';
    let extractedData: any = null;
    let fields: string[] = [];

    if (template.selectors && Object.keys(template.selectors).length > 0) {
      console.log('Attempting rule-based extraction...');

      const ruleResult = await extractWithRules(
        artifact.raw_content.text,
        artifact.artifact_type,
        template.selectors
      );

      if (ruleResult.success && ruleResult.data && ruleResult.data.length > 0) {
        // Rules worked! No need for AI call
        console.log('✅ Rule-based extraction successful!');
        extractionMethod = 'rules';
        extractedData = ruleResult.data;
        fields = ruleResult.fields || [];

        // Return immediately without calling AI
        const { data: extraction, error: extractionError } = await supabase
          .from('extractions')
          .insert({
            artifact_id,
            template_id: templateId,
            extracted_data: extractedData,
            metadata: {
              extraction_method: 'rules',
              template_version: template.version,
              cost: 0, // Free!
            },
            created_by: user.id,
          })
          .select()
          .single();

        return NextResponse.json({
          success: true,
          data: extractedData,
          fields,
          extraction_id: extraction?.id,
          method: 'rules',
          message: 'Extracted using saved rules (no AI cost!)',
          template: {
            id: template.id,
            name: template.name,
            version: template.version,
          },
        });
      } else {
        console.log('⚠️  Rule-based extraction failed, falling back to AI:', ruleResult.error);
        extractionMethod = 'fallback';
      }
    }

    // STEP 2: Fallback to AI extraction if rules don't exist or failed
    const systemPrompt = `You are a precise data extraction assistant. Extract structured data from documents exactly as instructed.

Return your response as a JSON object with this structure:
{
  "data": [ /* array of extracted records */ ],
  "fields": [ /* array of field names extracted */ ]
}

Each record in the data array should be an object with the requested fields.`;

    const userPrompt = `${template.prompt}

Document content to extract from:
${artifact.raw_content.text}

Expected fields (as defined in template):
${JSON.stringify(template.fields, null, 2)}

Extract the data and return it as a JSON array of objects with the specified field names.`;

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonText = textContent.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const aiExtractedData = JSON.parse(jsonText);
    extractedData = aiExtractedData.data || [];
    fields = aiExtractedData.fields || Object.keys(extractedData[0] || {});

    // Calculate usage and cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    // Pricing for claude-sonnet-4-20250514
    // $3 per million input tokens, $15 per million output tokens
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;

    // Create extraction record (for AI fallback)
    const { data: extraction, error: extractionError } = await supabase
      .from('extractions')
      .insert({
        artifact_id,
        template_id: templateId,
        extracted_data: extractedData,
        metadata: {
          extraction_method: extractionMethod,
          model: 'claude-sonnet-4-20250514',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost: totalCost,
          template_version: template.version,
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (extractionError) {
      console.error('Error saving extraction:', extractionError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
      fields,
      extraction_id: extraction?.id,
      method: extractionMethod,
      message: extractionMethod === 'fallback'
        ? 'Rules failed, used AI fallback'
        : 'Extracted using AI (no rules available)',
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        estimated_cost: totalCost.toFixed(6),
      },
      template: {
        id: template.id,
        name: template.name,
        version: template.version,
      },
    });
  } catch (error) {
    console.error('Template application error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Template application failed',
      },
      { status: 500 }
    );
  }
}
