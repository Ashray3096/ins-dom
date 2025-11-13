/**
 * AI-Based HTML Extraction API
 *
 * POST /api/extract/html-ai - Extract data from HTML using Claude AI
 *
 * Uses AI to understand HTML structure and extract field values
 * Works for any HTML format - forms, tables, web pages, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractFieldsWithAI } from '@/lib/ai-html-extractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { html, template } = body;

    if (!html) {
      return NextResponse.json({ error: 'HTML content required' }, { status: 400 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template required' }, { status: 400 });
    }

    // Get field names from template
    const fieldNames = template.fields || [];

    if (fieldNames.length === 0) {
      return NextResponse.json({ error: 'No fields defined in template' }, { status: 400 });
    }

    console.log(`AI extraction requested for ${fieldNames.length} fields`);

    // Extract using AI
    const extractedData = await extractFieldsWithAI({
      html,
      fieldNames,
      selectors: template.selectors || {}
    });

    return NextResponse.json({
      success: true,
      data: extractedData,
      fieldsExtracted: Object.keys(extractedData).length,
      fieldsWithValues: Object.values(extractedData).filter(v => v !== null).length
    });

  } catch (error) {
    console.error('Error in AI HTML extraction:', error);
    return NextResponse.json(
      {
        error: 'AI extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
