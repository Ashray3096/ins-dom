/**
 * Auto-Analysis API for Star Schema
 *
 * GET /api/star-schema/auto-analyze - Automatically analyze INTERIM entities and generate suggestions
 *
 * Runs when user clicks "Generate Schema with AI" tab
 * Returns data-driven quick start cards and schema recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { selected_entity = null } = body;

    const supabase = await createClient();

    // Step 1: Get INTERIM entities with fields
    // Filter by selected entity if specified
    let query = supabase
      .from('entities')
      .select('*, entity_fields!entity_fields_entity_id_fkey(*)')
      .eq('entity_type', 'INTERIM')
      .eq('table_status', 'created'); // Only analyze entities with tables

    if (selected_entity) {
      query = query.eq('name', selected_entity);
    }

    const { data: interimEntities, error: entitiesError } = await query;

    console.log('Auto-analysis query result:', {
      count: interimEntities?.length || 0,
      error: entitiesError
    });

    if (!interimEntities || interimEntities.length === 0) {
      return NextResponse.json({
        success: true,
        cards: [],
        message: 'No INTERIM entities with data found. Create and load some INTERIM entities first.'
      });
    }

    // Step 2: Fetch sample data from each table
    const entitiesWithData = await Promise.all(
      interimEntities.map(async (entity) => {
        try {
          const { data: samples, count } = await supabase
            .from(entity.name)
            .select('*', { count: 'exact' })
            .limit(5);

          return {
            ...entity,
            sample_data: samples || [],
            record_count: count || 0
          };
        } catch (err) {
          return {
            ...entity,
            sample_data: [],
            record_count: 0
          };
        }
      })
    );

    // Step 3: Build context for AI analysis
    const entityContext = entitiesWithData.map(e => {
      const fields = e.entity_fields || [];
      return {
        name: e.name,
        display_name: e.display_name,
        record_count: e.record_count,
        fields: fields.map((f: any) => f.name),
        sample: e.sample_data[0] || {}
      };
    });

    // Step 4: Call AI to generate intelligent quick start cards
    const contextNote = selected_entity
      ? `Focus ONLY on the "${selected_entity}" entity. Generate suggestions exclusively from this data source.`
      : 'Consider all INTERIM entities for a comprehensive star schema.';

    const prompt = `Analyze these INTERIM data entities and generate 5-7 intelligent quick start suggestions for dimensional modeling.

${contextNote}

INTERIM Entities:
${entityContext.map(e => `
${e.name} (${e.record_count} records):
  Fields: ${e.fields.join(', ')}
  Sample: ${JSON.stringify(e.sample, null, 2).substring(0, 400)}
`).join('\n')}

Generate quick start cards that:
1. Suggest specific REFERENCE (dimension) tables based on actual data patterns
2. Suggest MASTER (fact) tables for analytics
3. ${selected_entity ? `Use data ONLY from ${selected_entity}` : 'Identify natural join keys between entities'}
4. Include data insights (unique counts, detected values)

Return JSON array of cards:
[
  {
    "icon": "🏢",
    "title": "Brand Dimension (N unique brands)",
    "description": "Create dim_brand from unique brands: X, Y, Z...",
    "prompt": "Detailed prompt to create this entity",
    "category": "dimension",
    "data_insight": "Found 15 unique brands across raw_html and raw_csv"
  },
  ...
]

Focus on actionable, data-driven suggestions. Include actual numbers and examples from the data.`;

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

    // Parse AI response
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
    const cards = JSON.parse(jsonText);

    console.log(`Auto-analysis generated ${cards.length} quick start cards`);

    return NextResponse.json({
      success: true,
      cards,
      analysis_summary: {
        entities_analyzed: entitiesWithData.length,
        total_records: entitiesWithData.reduce((sum, e) => sum + e.record_count, 0),
        cards_generated: cards.length
      }
    });

  } catch (error) {
    console.error('Auto-analysis error:', error);
    return NextResponse.json(
      {
        error: 'Auto-analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
