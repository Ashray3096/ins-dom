/**
 * Pipeline Code Generation API Route
 *
 * POST /api/pipelines/[id]/generate - Generate Dagster code for pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generatePipelineCode,
  generateEntityTableSQL,
  generateDagsterConfig,
} from '@/lib/pipeline-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pipeline with config
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const config = pipeline.config as any;

    // Get entity details
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', config.target_entity_id)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Get entity fields
    const { data: entityFields, error: fieldsError } = await supabase
      .from('entity_fields')
      .select('*')
      .eq('entity_id', entity.id)
      .order('sort_order');

    if (fieldsError) throw fieldsError;

    // Get template if linked
    let template = null;
    if (pipeline.template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .eq('id', pipeline.template_id)
        .single();

      if (!templateError && templateData) {
        template = templateData;
      }
    }

    // Get sources
    const sourceIds = config.source_ids || [];
    let sources = [];
    if (sourceIds.length > 0) {
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('sources')
        .select('*')
        .in('id', sourceIds);

      if (!sourcesError && sourcesData) {
        sources = sourcesData;
      }
    }

    // Generate pipeline code
    const pipelineCode = generatePipelineCode({
      name: pipeline.name,
      description: pipeline.description,
      entity,
      entityFields: entityFields || [],
      template,
      sources,
      schedule: pipeline.schedule,
    });

    // Generate entity table SQL
    const entitySQL = generateEntityTableSQL(entity, entityFields || []);

    // Generate Dagster config
    const dagsterConfig = generateDagsterConfig(pipeline.name, pipeline.schedule);

    return NextResponse.json({
      pipeline_code: pipelineCode,
      entity_sql: entitySQL,
      dagster_config: dagsterConfig,
    });
  } catch (error) {
    console.error('Error generating pipeline code:', error);
    return NextResponse.json(
      { error: 'Failed to generate pipeline code' },
      { status: 500 }
    );
  }
}
