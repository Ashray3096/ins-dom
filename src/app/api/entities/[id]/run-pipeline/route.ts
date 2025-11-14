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
import { spawn } from 'child_process';
import path from 'path';

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

    // Get artifact count for progress tracking
    const { count: artifactCount } = await supabase
      .from('artifacts')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('artifact_type', template.artifact_type);

    // Create pipeline job record
    const { data: job, error: jobError } = await supabase
      .from('pipeline_jobs')
      .insert({
        entity_id: entity.id,
        status: 'queued',
        progress_current: 0,
        progress_total: artifactCount || 0,
        progress_message: 'Initializing pipeline...',
        created_by: user.id
      })
      .select()
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to create pipeline job' }, { status: 500 });
    }

    // Update job to running status immediately
    await supabase
      .from('pipeline_jobs')
      .update({ status: 'running', progress_message: 'Starting extraction...' })
      .eq('id', job.id);

    // Start Python process in background (don't wait for completion)
    const pythonPath = path.join(process.cwd(), 'dagster_pipelines', 'venv', 'bin', 'python3');
    const scriptPath = path.join(process.cwd(), 'dagster_pipelines', 'run_extraction.py');

    const pythonProcess = spawn(pythonPath, [
      '-B',  // Don't use bytecode cache - always run latest code
      scriptPath,
      '--entity-id', entity.id,
      '--template-id', template.id,
      '--source-id', sourceId,
      '--artifact-type', template.artifact_type,
      '--job-id', job.id
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',  // Prevent creating .pyc files
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      }
    });

    // Log output for debugging
    pythonProcess.stdout?.on('data', (data) => {
      console.log(`Pipeline stdout: ${data}`);
    });

    pythonProcess.stderr?.on('data', (data) => {
      console.error(`Pipeline stderr: ${data}`);
    });

    pythonProcess.on('error', (error) => {
      console.error(`Pipeline process error:`, error);
    });

    // Detach the process so it continues after API returns
    pythonProcess.unref();

    console.log(`✅ Pipeline job ${job.id} started in background`);

    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: 'Pipeline started in background. Check progress in the Pipeline tab.',
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
