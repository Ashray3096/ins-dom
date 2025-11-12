/**
 * Pipeline Code Generation API Route
 *
 * POST /api/pipelines/[id]/generate-code - Generate Dagster Python code
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDagsterPipeline, PipelineConfig } from '@/lib/pipelines/code-generator';

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

    console.log(`\n=== PIPELINE CODE GENERATION START ===`);
    console.log(`Pipeline ID: ${id}`);

    // Get pipeline configuration
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

    console.log(`Pipeline: ${pipeline.name}`);
    console.log(`Is Multi-Entity: ${pipeline.is_multi_entity}`);

    // Determine target entity ID (single-entity vs multi-entity)
    let targetEntityId: string | undefined;
    let pipelineName: string;

    if (pipeline.is_multi_entity) {
      // Multi-entity pipeline - use first entity for compatibility
      const firstEntityName = pipeline.target_entities?.[0];
      console.log(`Multi-entity pipeline with ${pipeline.target_entities?.length} entities`);
      console.log(`First entity: ${firstEntityName}`);

      // Fetch first entity to get its ID
      if (firstEntityName) {
        const { data: firstEntity } = await supabase
          .from('entities')
          .select('id')
          .eq('name', firstEntityName)
          .single();

        targetEntityId = firstEntity?.id;
      }
    } else {
      // Single-entity pipeline
      targetEntityId = config.target_entity_id;
      console.log(`Target Entity ID: ${targetEntityId}`);
    }

    // Prepare pipeline config for code generator
    const pipelineConfig: PipelineConfig = {
      pipeline_id: id,
      target_entity_id: targetEntityId!,
      source_ids: config.source_ids || [],
      template_id: pipeline.template_id,
      extraction_strategy: pipeline.template_id ? 'template' : 'ai',
    };

    // Generate Dagster Python code
    console.log(`\nGenerating Dagster Python code...`);
    const generatedPipeline = await generateDagsterPipeline(pipelineConfig);

    console.log(`\nCode generation successful!`);
    console.log(`- Extraction assets: ${generatedPipeline.config.extraction_assets.length}`);
    console.log(`- Transformation assets: ${generatedPipeline.config.transformation_assets.length}`);
    console.log(`- Load assets: ${generatedPipeline.config.load_assets.length}`);
    console.log(`- Python code length: ${generatedPipeline.python_code.length} characters`);

    // Check if a deployment already exists
    const { data: existingDeployments } = await supabase
      .from('pipeline_deployments')
      .select('version')
      .eq('pipeline_id', id)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingDeployments && existingDeployments.length > 0
      ? existingDeployments[0].version + 1
      : 1;

    // Get entity details for pipeline name
    let entity: any = null;
    if (pipeline.is_multi_entity) {
      // Multi-entity pipeline - use descriptive name
      pipelineName = `nabca_all_tables_v${nextVersion}`;
    } else {
      // Single-entity pipeline - use entity name
      const { data: entityData } = await supabase
        .from('entities')
        .select('*')
        .eq('id', targetEntityId)
        .single();

      entity = entityData;
      pipelineName = `${entity?.table_name || entity?.name || 'pipeline'}_v${nextVersion}`;
    }

    // Save to pipeline_deployments table
    const { data: deployment, error: deploymentError } = await supabase
      .from('pipeline_deployments')
      .insert({
        pipeline_id: id,
        version: nextVersion,
        pipeline_name: pipelineName,
        description: pipeline.is_multi_entity
          ? `Auto-generated multi-entity pipeline for ${pipeline.target_entities?.length || 8} NABCA tables`
          : `Auto-generated pipeline for ${entity?.display_name || entity?.name}`,
        python_code: generatedPipeline.python_code,
        config: generatedPipeline.config,
        dagster_code_location: 'inspector_dom',
        deployment_status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (deploymentError) {
      console.error('Failed to save deployment:', deploymentError);
      return NextResponse.json(
        { error: 'Failed to save generated code', details: deploymentError.message },
        { status: 500 }
      );
    }

    console.log(`\nDeployment saved: ${deployment.id}`);
    console.log(`Pipeline name: ${pipelineName}`);
    console.log(`Version: ${nextVersion}`);
    console.log(`=== CODE GENERATION COMPLETE ===\n`);

    // Generate entity SQL and Dagster config
    let entitySql: string;
    let dagsterConfig: string;

    if (pipeline.is_multi_entity) {
      // Multi-entity pipelines: tables already created, provide reference info
      entitySql = `-- Multi-entity pipeline: 8 NABCA tables
-- Tables were auto-created by the template generator:
${pipeline.target_entities?.map(name => `-- - ${name}`).join('\n') || ''}

-- Tables are already created and configured with RLS policies.
-- No additional SQL execution needed.`;

      dagsterConfig = generateDagsterConfig(pipelineName, 'nabca_all_tables');
    } else {
      // Single-entity pipeline: generate SQL for the specific entity
      entitySql = generateEntityTableSQL(entity, generatedPipeline.config.entity_model.fields);
      dagsterConfig = generateDagsterConfig(pipelineName, entity?.table_name || 'pipeline');
    }

    return NextResponse.json({
      success: true,
      deployment_id: deployment.id,
      pipeline_name: pipelineName,
      version: nextVersion,
      pipeline_code: generatedPipeline.python_code, // Match UI expectation
      python_code: generatedPipeline.python_code,   // Keep for backward compat
      entity_sql: entitySql,
      dagster_config: dagsterConfig,
      config: generatedPipeline.config,
      lines_of_code: generatedPipeline.python_code.split('\n').length,
    });

  } catch (error) {
    console.error('Error generating pipeline code:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate pipeline code',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate SQL for creating the entity table
 */
function generateEntityTableSQL(entity: any, entityFields: any[]): string {
  const tableName = entity.table_name || entity.name.toLowerCase().replace(/\s+/g, '_');

  const fieldDefinitions = entityFields.map((field: any) => {
    let sqlType = 'TEXT';
    switch (field.data_type) {
      case 'INTEGER':
        sqlType = 'INTEGER';
        break;
      case 'FLOAT':
      case 'DECIMAL':
        sqlType = 'DECIMAL(10, 2)';
        break;
      case 'BOOLEAN':
        sqlType = 'BOOLEAN';
        break;
      case 'DATE':
        sqlType = 'DATE';
        break;
      case 'TIMESTAMP':
        sqlType = 'TIMESTAMPTZ';
        break;
      case 'JSON':
        sqlType = 'JSONB';
        break;
      default:
        sqlType = 'TEXT';
    }

    const notNull = field.is_required ? ' NOT NULL' : '';
    return `  ${field.name} ${sqlType}${notNull}`;
  }).join(',\n');

  return `-- Auto-generated table schema for ${entity.display_name || entity.name}
CREATE TABLE IF NOT EXISTS ${tableName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
${fieldDefinitions},
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at);

-- Enable Row Level Security
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own data
CREATE POLICY "${tableName}_isolation" ON ${tableName}
  FOR ALL USING (created_by = auth.uid());`;
}

/**
 * Generate Dagster workspace configuration
 */
function generateDagsterConfig(pipelineName: string, moduleName: string): string {
  return `# Dagster Workspace Configuration
# Add this to your workspace.yaml

load_from:
  - python_module:
      module_name: inspector_dom.pipelines.${moduleName}
      location_name: ${pipelineName}

# Environment variables needed:
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - ANTHROPIC_API_KEY (for AI extraction)

# Deploy to Dagster Cloud:
# dagster-cloud workspace add-location \\
#   --location-name ${pipelineName} \\
#   --module-name inspector_dom.pipelines.${moduleName}`;
}

/**
 * GET endpoint to retrieve existing deployments
 */
export async function GET(
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

    // Get all deployments for this pipeline
    const { data: deployments, error: deploymentsError } = await supabase
      .from('pipeline_deployments')
      .select('*')
      .eq('pipeline_id', id)
      .order('version', { ascending: false });

    if (deploymentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch deployments', details: deploymentsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deployments: deployments || [],
      count: deployments?.length || 0,
    });

  } catch (error) {
    console.error('Error fetching deployments:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch deployments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
