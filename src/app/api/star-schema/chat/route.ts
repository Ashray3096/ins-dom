/**
 * Star Schema AI Chat API
 *
 * POST /api/star-schema/chat - Conversational AI for schema design
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, entities, interim_entities, conversation_history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get full details of INTERIM entities with fields
    // Use explicit relationship name to avoid ambiguity
    const { data: interimData } = await supabase
      .from('entities')
      .select('*, entity_fields!entity_fields_entity_id_fkey(*)')
      .eq('entity_type', 'INTERIM')
      .eq('table_status', 'created');

    // Build context from INTERIM entities
    const interimContext = (interimData || []).map(entity => {
      const fields = entity.entity_fields || [];
      return {
        name: entity.name,
        display_name: entity.display_name,
        fields: fields.map((f: any) => ({
          name: f.name,
          type: f.data_type,
          is_pk: f.is_primary_key
        }))
      };
    });

    // Get sample data from tables for better context
    const sampleData: Record<string, any> = {};
    for (const entity of interimData || []) {
      try {
        const { data: samples } = await supabase
          .from(entity.name)
          .select('*')
          .limit(3);

        if (samples && samples.length > 0) {
          sampleData[entity.name] = samples[0]; // First record as example
        }
      } catch (err) {
        // Table might not exist yet
      }
    }

    // Build AI prompt
    const prompt = `You are a data modeling expert helping design a star schema for analytics.

Current INTERIM entities (raw staging data):
${interimContext.map(e => `
${e.name}:
  Fields: ${e.fields.map(f => `${f.name} (${f.type})`).join(', ')}
  Sample: ${JSON.stringify(sampleData[e.name] || {}, null, 2).substring(0, 300)}
`).join('\n')}

Current entities in schema:
${entities.map((e: any) => `- ${e.name} (${e.entity_type})`).join('\n')}

User question: "${message}"

IMPORTANT GUIDELINES:
1. Unless the user explicitly asks for only dimensions OR only facts, provide BOTH dimensions AND facts in your suggestions to create a complete star schema.
2. If the user asks to modify previous suggestions (e.g., "combine X and Y", "remove Z", "add field W"), MODIFY the previous schema design rather than creating a completely new one.
3. Maintain consistency with what was discussed earlier in the conversation.
4. If creating modified suggestions, include ALL entities (modified ones + unchanged ones) so the user has the complete picture.

Provide helpful guidance on dimensional modeling. When suggesting schema designs, provide specific recommendations in this format:

For dimensions, return:
{
  "message": "Your response text",
  "suggestions": [
    {
      "type": "dimension",
      "name": "dim_brand",
      "description": "Brand dimension for product analysis",
      "fields": [
        {"name": "brand_id", "type": "UUID"},
        {"name": "brand_name", "type": "TEXT", "source": "raw_html.brand_name"}
      ],
      "reasoning": "Brands appear in both raw_html and raw_csv. Creating a dimension enables consistent brand analysis."
    }
  ]
}

CRITICAL: For dimension fields, keep the EXACT SAME field names as in the source table to enable joins.
Example: If source is "raw_html.applicant_address", name the field "applicant_address" NOT "primary_address".
This ensures join conditions work correctly.

For facts, return:
{
  "message": "Your response",
  "suggestions": [
    {
      "type": "fact",
      "name": "fact_sales",
      "description": "Sales transactions fact table",
      "fields": [
        {"name": "sale_id", "type": "UUID"},
        {"name": "brand_id", "type": "UUID", "source": "dim_brand.brand_id", "join_on": "brand_name"},
        {"name": "amount", "type": "NUMERIC", "source": "raw_html.sales_amount"}
      ],
      "reasoning": "Grain: one row per sale. Connects to brand and product dimensions."
    }
  ]
}

IMPORTANT: For foreign key fields in facts:
- Always include "join_on" to specify the natural key field to join on
- The source field MUST be the actual PK field in the dimension table
- Dimension PK pattern: {dimension_name}_id (e.g., "dim_product.dim_product_id", NOT "dim_product.product_id")
- Example: {"name": "product_id", "source": "dim_product.dim_product_id", "join_on": "brand_name"}
- This tells the system to:
  1. Join: raw_table.brand_name = dim_product.brand_name
  2. SELECT: dim_product.dim_product_id as product_id
- Common patterns:
  * product_id FK → source: "dim_product.dim_product_id", join_on: "brand_name" or "product_type"
  * location_id FK → source: "dim_location.dim_location_id", join_on: "plant_registry" or "applicant_address"
  * applicant_id FK → source: "dim_applicant.dim_applicant_id", join_on: "applicant_address"

Return JSON only.`;

    console.log('Star schema AI chat request:', message);

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({ apiKey });

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    // Add conversation history if available
    if (conversation_history && conversation_history.length > 0) {
      // Skip the initial auto-analysis message, include only real conversation
      const realConversation = conversation_history.filter((m: any) =>
        !m.content.includes('Analysis complete')
      );

      if (realConversation.length > 0) {
        // Insert conversation history before the current prompt
        messages.unshift({
          role: 'user',
          content: 'Previous conversation context:\n' +
            realConversation.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
        });
      }
    }

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages
    });

    // Extract response
    const content = aiResponse.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const text = content.text;

    // Try to parse as JSON
    let result;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                       text.match(/```\s*([\s\S]*?)\s*```/) ||
                       text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        result = JSON.parse(jsonText);
      } else {
        // Plain text response
        result = {
          message: text,
          suggestions: []
        };
      }
    } catch (err) {
      // Fallback to plain text
      result = {
        message: text,
        suggestions: []
      };
    }

    console.log(`AI chat response with ${result.suggestions?.length || 0} suggestions`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Star schema chat error:', error);
    return NextResponse.json(
      {
        error: 'AI chat failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
