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

    // Determine document type for rule generation
    const documentType = artifact.artifact_type || 'unknown';

    // Prepare the prompt - GENERATES CASCADE EXTRACTION RULES!
    const systemPrompt = `You are a data extraction assistant that generates MULTI-LAYER REUSABLE EXTRACTION RULES.

CRITICAL MISSION: Generate rules that will be applied to THOUSANDS of similar documents WITHOUT calling AI again.
Your rules must be:
1. PRECISE - Work on exact structure matches (Layer 1: Structural)
2. FLEXIBLE - Work when structure changes but patterns stay same (Layer 2: Patterns)
3. WELL-DOCUMENTED - Include locations, validation, and notes

═══════════════════════════════════════════════════════════════

RULE GENERATION STRATEGY - TWO LAYERS:

Layer 1: STRUCTURAL (XPath/CSS selectors)
- Fastest extraction (< 1ms)
- Works when HTML structure is identical
- Prefer specific selectors (IDs > classes > tags)

Layer 2: PATTERNS (Regex)
- Fallback when structure changes (< 10ms)
- Works on text content regardless of HTML structure
- Include primary + fallback patterns for robustness

═══════════════════════════════════════════════════════════════

${documentType === 'html' ? `
FOR HTML DOCUMENTS - Generate BOTH layers:

Required Response Format:
{
  "fields": ["field1", "field2"],
  "data": [{"field1": "value1", "field2": "value2"}],
  "selectors": {
    "fields": {
      "field1": {
        "structural": {
          "xpath": "//div[@id='content']//span[@class='field1']",
          "cssSelector": "#content .field1",
          "sampleValue": "value1",
          "elementInfo": {
            "tagName": "span",
            "className": "field1",
            "id": ""
          }
        },
        "pattern": {
          "primary": "Field 1:\\\\s*([A-Za-z0-9]+)",
          "fallback": "field1[:\\\\s]+([^\\\\n]+)",
          "location": "Describe where this field appears in the document",
          "extractionType": "regex",
          "group": 1
        },
        "validation": {
          "format": "alphanumeric|numeric|text|email|url",
          "required": true,
          "minLength": 5,
          "maxLength": 50
        }
      }
    }
  }
}

IMPORTANT FOR HTML:
- Generate XPath that works across browser engines
- Use CSS selectors that are widely supported
- Regex patterns must escape special characters properly
- Include field location descriptions for debugging
- Specify regex capture group numbers
` : ''}

${documentType === 'pdf' ? `
FOR PDF DOCUMENTS - Generate table rules + patterns:

Required Response Format:
{
  "fields": ["field1", "field2"],
  "data": [{"field1": "value1", "field2": "value2"}],
  "selectors": {
    "structural": {
      "tableRules": {
        "pageNumber": 1,
        "tableIndex": 0,
        "hasHeader": true,
        "columnMappings": {
          "field1": {
            "columnIndex": 0,
            "columnHeader": "Field 1 Header"
          }
        },
        "startRow": 1,
        "notes": "Description of table structure"
      }
    },
    "patterns": {
      "field1": {
        "primary": "Field 1[:\\\\s]+([^\\\\n]+)",
        "fallback": "(?:field1|Field1)[:\\\\s]*([A-Za-z0-9 ]+)",
        "location": "Page 1, section heading",
        "extractionType": "regex",
        "group": 1
      }
    }
  }
}

IMPORTANT FOR PDF:
- Specify exact page numbers and table indices
- Map columns by both index AND header name
- Include patterns for non-table data
- Note any multi-page table spans
` : ''}

═══════════════════════════════════════════════════════════════

VALIDATION RULES (include when applicable):
- format: "numeric", "alphanumeric", "email", "url", "date", "text"
- required: true/false
- minLength, maxLength: for strings
- allowedValues: array of valid options
- pattern: regex pattern for validation

═══════════════════════════════════════════════════════════════

Return ONLY valid JSON. No explanations before or after.`;


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
      selectors: extractedData.selectors || null, // Extraction rules for reuse!
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
