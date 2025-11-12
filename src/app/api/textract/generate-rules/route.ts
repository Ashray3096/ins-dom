/**
 * AI Rule Generation API
 *
 * POST /api/textract/generate-rules
 * Uses AI to analyze Textract results and generate extraction rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import type { TextractAnalysisResult } from '@/lib/textract-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractionRule {
  extractionType: 'table' | 'keyValue' | 'position' | 'pattern';
  location: any;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  pattern?: string;
  sampleValue: string;
  confidence?: number;
  description?: string;
}

export interface GeneratedRules {
  fields: Record<string, ExtractionRule>;
  metadata: {
    aiModel: string;
    generatedAt: string;
    tablesAnalyzed: number;
    keyValuePairsAnalyzed: number;
  };
}

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

    // Get request body
    const body = await request.json();
    const { textract_data, user_prompt } = body as {
      textract_data: TextractAnalysisResult;
      user_prompt?: string;
    };

    if (!textract_data) {
      return NextResponse.json(
        { error: 'textract_data is required' },
        { status: 400 }
      );
    }

    console.log('🤖 Generating extraction rules with AI...');

    // Prepare data for AI analysis
    const analysisContext = prepareAnalysisContext(textract_data);

    // Build AI prompt
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(analysisContext, user_prompt);

    console.log(`📤 Sending to Claude API (${userMessage.length} chars)...`);

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    console.log(`📥 Received AI response (${responseText.length} chars)`);

    // Parse JSON from response
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                     responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('Failed to parse JSON from AI response');
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const rulesJson = jsonMatch[1] || jsonMatch[0];
    const generatedRules: GeneratedRules = JSON.parse(rulesJson);

    // Add metadata
    generatedRules.metadata = {
      aiModel: message.model,
      generatedAt: new Date().toISOString(),
      tablesAnalyzed: textract_data.tables.length,
      keyValuePairsAnalyzed: textract_data.keyValuePairs.length,
    };

    console.log(`✅ Generated rules for ${Object.keys(generatedRules.fields).length} fields`);

    return NextResponse.json({
      success: true,
      rules: generatedRules,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('❌ Error generating rules with AI:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate rules',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Prepare Textract data for AI analysis
 */
function prepareAnalysisContext(data: TextractAnalysisResult): string {
  let context = 'TEXTRACT ANALYSIS RESULTS\n';
  context += '========================\n\n';

  // Document metadata
  context += `Document: ${data.documentMetadata.pages} page(s)\n`;
  context += `Tables found: ${data.tables.length}\n`;
  context += `Key-value pairs found: ${data.keyValuePairs.length}\n`;
  context += `Text blocks: ${data.textBlocks.length}\n\n`;

  // Tables (detailed)
  if (data.tables.length > 0) {
    context += 'TABLES:\n';
    context += '-------\n';
    data.tables.forEach((table, idx) => {
      context += `\nTable ${idx} (Page ${table.page}):\n`;
      context += `  Size: ${table.rows} rows × ${table.columns} columns\n`;
      context += `  Location: top=${table.boundingBox.top.toFixed(3)}, left=${table.boundingBox.left.toFixed(3)}\n`;
      context += `  Data:\n`;

      // Show all rows (or limit if too many)
      const maxRows = 20;
      const rowsToShow = table.data.slice(0, maxRows);
      rowsToShow.forEach((row, rowIdx) => {
        context += `    Row ${rowIdx}: [${row.join(' | ')}]\n`;
      });

      if (table.data.length > maxRows) {
        context += `    ... and ${table.data.length - maxRows} more rows\n`;
      }
    });
    context += '\n';
  }

  // Key-Value Pairs
  if (data.keyValuePairs.length > 0) {
    context += 'KEY-VALUE PAIRS:\n';
    context += '----------------\n';
    data.keyValuePairs.forEach((pair, idx) => {
      context += `  ${idx}. "${pair.key}" = "${pair.value}" (confidence: ${pair.confidence.toFixed(1)}%, page ${pair.page})\n`;
    });
    context += '\n';
  }

  // Text blocks (sample)
  const lineBlocks = data.textBlocks
    .filter(b => b.blockType === 'LINE')
    .slice(0, 30);

  if (lineBlocks.length > 0) {
    context += 'TEXT BLOCKS (sample of first 30 lines):\n';
    context += '--------------------------------------\n';
    lineBlocks.forEach((block, idx) => {
      context += `  ${idx}. [Page ${block.page}] ${block.text}\n`;
    });

    if (data.textBlocks.length > 30) {
      context += `  ... and ${data.textBlocks.length - 30} more lines\n`;
    }
  }

  return context;
}

/**
 * Build system prompt for AI
 */
function buildSystemPrompt(): string {
  return `You are an expert at analyzing document structure to create extraction rules.

Your task is to analyze AWS Textract results from a PDF document and generate extraction rules that can be used to automatically extract data from similar documents.

EXTRACTION TYPES:

1. **table** - Extract data from tables
   location: {
     tableIndex: number,
     searchStrategy: "header_match" | "position" | "find_cell_with_text",
     searchText?: string,
     headerName?: string,
     rowRange?: [number, number],
     columnIndex?: number,
     columnMapping?: {fieldName: columnIndex}
   }

2. **keyValue** - Extract form fields (key-value pairs)
   location: {
     keyName: string,
     keyPattern?: string (regex)
   }

3. **position** - Extract by position on page
   location: {
     page: number,
     boundingBox: {top, left, width, height}
   }

4. **pattern** - Extract using regex pattern
   location: {
     searchText: string,
     pattern: string (regex)
   }

GUIDELINES:
- Identify the most important fields that should be extracted
- Choose the most reliable extraction strategy for each field
- For tables with headers, use header_match strategy
- For repeating data, use arrays with column mappings
- Provide sample values from the actual document
- Set appropriate data types (string, number, date, boolean, array)
- Mark fields as required if they appear essential
- Include confidence scores based on data quality

Output ONLY valid JSON in this format (no other text):

{
  "fields": {
    "field_name": {
      "extractionType": "table" | "keyValue" | "position" | "pattern",
      "location": {...},
      "dataType": "string" | "number" | "date" | "boolean" | "array",
      "required": boolean,
      "pattern": "optional regex for validation",
      "sampleValue": "example from document",
      "confidence": 0.0-1.0,
      "description": "brief description"
    }
  }
}`;
}

/**
 * Build user message for AI
 */
function buildUserMessage(
  analysisContext: string,
  userPrompt?: string
): string {
  let message = analysisContext;

  message += '\n\nTASK:\n';
  message += '-----\n';

  if (userPrompt) {
    message += `${userPrompt}\n\n`;
  }

  message += 'Analyze this document and generate extraction rules for the key data fields.\n';
  message += 'Focus on:\n';
  message += '1. Identifying meaningful fields (not just every piece of text)\n';
  message += '2. Creating reliable extraction strategies\n';
  message += '3. Handling repeating data (tables with multiple rows)\n';
  message += '4. Using actual sample values from the document\n\n';
  message += 'Return ONLY the JSON rules object, no explanatory text.';

  return message;
}
