/**
 * AI Email Field Suggestion API
 *
 * POST /api/extract/email-ai/suggest-fields - AI suggests fields to extract from email
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email_text, extraction_prompt } = body;

    if (!email_text) {
      return NextResponse.json({ error: 'Email text required' }, { status: 400 });
    }

    if (!extraction_prompt) {
      return NextResponse.json({ error: 'Extraction prompt required' }, { status: 400 });
    }

    // Build AI prompt to suggest fields
    const prompt = `Based on this email content and the user's extraction instructions, suggest relevant field names to extract.

User wants to extract:
"${extraction_prompt}"

Email content (first 3000 chars):
${email_text.substring(0, 3000)}

Analyze the email and suggest 3-8 field names that match the user's instructions. For each field:
- Provide a descriptive field_name (lowercase, underscores)
- Provide a sample value from this email
- Provide a brief description

Return ONLY a JSON array:
[
  {
    "name": "field_name",
    "value": "sample value from email",
    "description": "what this field contains"
  },
  ...
]

Example: If user wants "company names and amounts", suggest fields like:
[
  {"name": "company_name", "value": "Acme Corp", "description": "Company mentioned"},
  {"name": "investment_amount", "value": "$50M", "description": "Investment amount"}
]`;

    console.log('Generating email field suggestions...');

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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
                     text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const suggestedFields = JSON.parse(jsonText);

    console.log(`AI suggested ${suggestedFields.length} fields`);

    return NextResponse.json({
      success: true,
      suggested_fields: suggestedFields,
    });

  } catch (error) {
    console.error('Error generating field suggestions:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate fields',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
