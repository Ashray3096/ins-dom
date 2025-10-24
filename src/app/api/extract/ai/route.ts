/**
 * AI Extraction API Endpoint
 *
 * POST /api/extract/ai
 * Extracts structured data from documents using Claude API
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractWithAI } from '@/lib/ai';
import type { ExtractionField } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, mediaType, prompt, fields } = body;

    // Validation
    if (!fileBase64 || !mediaType || !prompt || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: fileBase64, mediaType, prompt, fields' },
        { status: 400 }
      );
    }

    // Validate media type
    if (!['application/pdf', 'text/html'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'Invalid mediaType. Must be "application/pdf" or "text/html"' },
        { status: 400 }
      );
    }

    // Validate fields array
    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: 'fields must be a non-empty array' },
        { status: 400 }
      );
    }

    // Perform extraction
    const result = await extractWithAI({
      fileBase64,
      mediaType,
      prompt,
      fields: fields as ExtractionField[]
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('AI extraction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
