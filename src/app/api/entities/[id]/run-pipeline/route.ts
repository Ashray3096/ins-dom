/**
 * Entity Pipeline Run API
 *
 * POST /api/entities/[id]/run-pipeline - Extract data from source and load into entity table
 *
 * This is a placeholder that will trigger Dagster components in the future.
 * For now, it returns a success message to enable UI testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

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

    // Get entity
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Verify table is created
    if (entity.table_status !== 'created') {
      return NextResponse.json({
        error: 'Table not created',
        message: 'Please create the database table first',
      }, { status: 400 });
    }

    // Get template
    if (!entity.template_id) {
      return NextResponse.json({
        error: 'No template linked',
        message: 'This entity needs a template for extraction',
      }, { status: 400 });
    }

    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', entity.template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get source from template's sample artifact
    let sourceId: string | null = null;
    if (template.sample_artifact_id) {
      const { data: artifact } = await supabase
        .from('artifacts')
        .select('source_id')
        .eq('id', template.sample_artifact_id)
        .single();

      sourceId = artifact?.source_id || null;
    }

    if (!sourceId) {
      return NextResponse.json({
        error: 'No source found',
        message: 'Could not determine source from template',
      }, { status: 400 });
    }

    const { data: source } = await supabase
      .from('sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    console.log(`\n========== PIPELINE RUN REQUEST ==========`);
    console.log(`Entity: ${entity.name} (${entity.entity_type})`);
    console.log(`Template: ${template.name} (${template.extraction_method})`);
    console.log(`Source: ${source.name} (${source.source_type})`);
    console.log(`==========================================\n`);

    // Execute Dagster extraction component
    const pythonPath = path.join(process.cwd(), 'dagster_pipelines', 'venv', 'bin', 'python3');
    const scriptPath = path.join(process.cwd(), 'dagster_pipelines', 'run_extraction.py');

    const command = `${pythonPath} ${scriptPath} --entity-id ${entity.id} --template-id ${template.id} --source-id ${sourceId} --artifact-type ${template.artifact_type}`;

    console.log('Executing:', command);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr && !stderr.includes('WARNING')) {
      console.error('Pipeline stderr:', stderr);
    }

    console.log('Pipeline stdout:', stdout);

    // Parse result
    const result = JSON.parse(stdout.trim());

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Pipeline execution failed',
        details: result.error_type || 'Unknown error',
      }, { status: 500 });
    }

    console.log('✅ Pipeline completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: `Pipeline completed successfully`,
      ...result,
    });

  } catch (error) {
    console.error('Error running pipeline:', error);
    return NextResponse.json(
      {
        error: 'Failed to run pipeline',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
