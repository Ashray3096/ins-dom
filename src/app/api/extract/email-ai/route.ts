/**
 * AI Email Extraction API
 *
 * POST /api/extract/email-ai - Extract fields from email using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseEmailContent } from '@/lib/email-parser';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email_content, template } = body;

    if (!email_content) {
      return NextResponse.json({ error: 'Email content required' }, { status: 400 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template required' }, { status: 400 });
    }

    // Parse email
    const parsed = await parseEmailContent(email_content);

    // Get extraction prompt from template
    const extractionPrompt = template.selectors?.extraction_prompt ||
                            'Extract relevant information from the email';

    // Get field names
    const fieldNames = template.fields || [];

    // Build AI prompt
    const prompt = `Extract the following fields from this email:

User's extraction instructions:
"${extractionPrompt}"

Fields to extract:
${fieldNames.map(f => `- ${f}`).join('\n')}

Email:
From: ${parsed.headers.from}
To: ${parsed.headers.to}
Subject: ${parsed.headers.subject}
Date: ${parsed.headers.date?.toISOString()}

Email Body:
${parsed.body.text.substring(0, 15000)}

Return ONLY a JSON object with the extracted field values. Use null for fields not found.

Example format:
{
  "${fieldNames[0]}": "extracted value or null",
  ...
}`;

    console.log('AI email extraction for fields:', fieldNames);

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extract JSON from response
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const text = content.text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                     text.match(/```\s*([\s\S]*?)\s*```/) ||
                     text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const extractedData = JSON.parse(jsonText);

    const fieldsWithValues = Object.values(extractedData).filter(v => v !== null).length;

    console.log(`AI extracted ${fieldsWithValues}/${fieldNames.length} fields`);

    return NextResponse.json({
      success: true,
      data: extractedData,
      fieldsExtracted: Object.keys(extractedData).length,
      fieldsWithValues,
    });

  } catch (error) {
    console.error('Error in AI email extraction:', error);
    return NextResponse.json(
      {
        error: 'AI extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
