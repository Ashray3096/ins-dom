/**
 * AI Extraction API Route
 *
 * POST /api/ai-extract - Extract structured data from artifacts using AI
 *
 * Uses Claude AI to analyze document content and extract structured data
 * based on user instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for AI processing

/**
 * POST /api/ai-extract
 *
 * Body: {
 *   artifact_id: string,
 *   instructions: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { artifact_id, instructions } = body;

    if (!artifact_id || !instructions) {
      return NextResponse.json(
        { error: 'artifact_id and instructions are required' },
        { status: 400 }
      );
    }

    // Get artifact from database
    const { data: artifact, error: fetchError } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifact_id)
      .eq('created_by', user.id)
      .single();

    if (fetchError || !artifact) {
      return NextResponse.json(
        { error: 'Artifact not found or access denied' },
        { status: 404 }
      );
    }

    // Check if content has been extracted
    if (!artifact.raw_content || !artifact.raw_content.text) {
      return NextResponse.json(
        { error: 'Artifact content not extracted yet. Please extract content first.' },
        { status: 400 }
      );
    }

    // Check for Anthropic API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set ANTHROPIC_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Prepare the prompt
    const systemPrompt = `You are a data extraction assistant. Your task is to analyze document content and extract structured data based on user instructions.

Rules:
1. Extract data exactly as it appears in the document
2. Return data as a JSON array of objects
3. Each object represents one row/record
4. Use consistent field names across all records
5. If a field is not found, use null
6. Be precise and accurate

Return your response in this exact JSON format:
{
  "fields": ["field1", "field2", "field3"],
  "data": [
    {"field1": "value1", "field2": "value2", "field3": "value3"},
    {"field1": "value4", "field2": "value5", "field3": "value6"}
  ]
}`;

    const userPrompt = `Document Content:
${artifact.raw_content.text.substring(0, 50000)}

Extraction Instructions:
${instructions}

Please extract the requested data and return it in the specified JSON format.`;

    // Call Claude AI
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    let extractedData;
    try {
      // Try to find JSON in markdown code blocks
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                        responseText.match(/```\n([\s\S]*?)\n```/);

      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response. The AI may not have returned valid JSON.'
        },
        { status: 500 }
      );
    }

    // Validate response structure
    if (!extractedData.fields || !Array.isArray(extractedData.fields)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid AI response: missing or invalid fields array'
        },
        { status: 500 }
      );
    }

    if (!extractedData.data || !Array.isArray(extractedData.data)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid AI response: missing or invalid data array'
        },
        { status: 500 }
      );
    }

    // Calculate token usage and cost
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    // Claude Sonnet 4.5 pricing
    // Input: $3 per million tokens
    // Output: $15 per million tokens
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;

    return NextResponse.json({
      success: true,
      fields: extractedData.fields,
      data: extractedData.data,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        estimated_cost: totalCost.toFixed(4),
      },
    });
  } catch (error) {
    console.error('AI extraction error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          success: false,
          error: `AI service error: ${error.message}`,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
