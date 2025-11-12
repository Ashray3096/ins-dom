/**
 * Pipeline Deployment API Route
 *
 * POST /api/pipelines/[id]/deploy - Deploy a pipeline to Dagster
 * GET /api/pipelines/[id]/deploy - Get deployment status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deployPipeline, checkDeploymentStatus } from '@/lib/dagster/deployment';

/**
 * POST - Deploy a pipeline deployment to Dagster
 */
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

    // Get the pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Parse request body for optional deployment_id
    const body = await request.json().catch(() => ({}));
    const deploymentIdFromBody = body.deployment_id;

    // Get the latest deployment (or specific deployment if provided)
    let deploymentQuery = supabase
      .from('pipeline_deployments')
      .select('*')
      .eq('pipeline_id', id);

    if (deploymentIdFromBody) {
      deploymentQuery = deploymentQuery.eq('id', deploymentIdFromBody);
    } else {
      deploymentQuery = deploymentQuery
        .order('version', { ascending: false })
        .limit(1);
    }

    const { data: deployments, error: deploymentError } = await deploymentQuery;

    if (deploymentError || !deployments || deployments.length === 0) {
      return NextResponse.json(
        { error: 'No deployment found. Generate code first.' },
        { status: 404 }
      );
    }

    const deployment = deployments[0];

    // Check if already deployed
    if (deployment.deployment_status === 'active' || deployment.deployment_status === 'deploying') {
      return NextResponse.json({
        success: false,
        error: `Deployment is already ${deployment.deployment_status}`,
        deployment_status: deployment.deployment_status,
      });
    }

    console.log(`\n=== STARTING DEPLOYMENT FOR PIPELINE: ${pipeline.name} ===`);
    console.log(`Deployment ID: ${deployment.id}`);
    console.log(`Version: ${deployment.version}`);
    console.log(`Pipeline Name: ${deployment.pipeline_name}`);

    // Update status to deploying
    await supabase
      .from('pipeline_deployments')
      .update({
        deployment_status: 'deploying',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deployment.id);

    // Deploy the pipeline
    const deploymentResult = await deployPipeline({
      deployment_id: deployment.id,
      pipeline_name: deployment.pipeline_name,
      python_code: deployment.python_code,
      dagster_location: deployment.dagster_code_location,
    });

    if (!deploymentResult.success) {
      // Update status to failed
      await supabase
        .from('pipeline_deployments')
        .update({
          deployment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deployment.id);

      console.error(`Deployment failed: ${deploymentResult.error}`);

      return NextResponse.json({
        success: false,
        error: deploymentResult.error,
        deployment_id: deployment.id,
      }, { status: 500 });
    }

    // Update deployment with success info
    const updateData: any = {
      deployment_status: 'active',
      deployed_at: new Date().toISOString(),
      deployed_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (deploymentResult.dagster_deployment_id) {
      updateData.dagster_deployment_id = deploymentResult.dagster_deployment_id;
    }
    if (deploymentResult.dagster_code_location) {
      updateData.dagster_code_location = deploymentResult.dagster_code_location;
    }

    await supabase
      .from('pipeline_deployments')
      .update(updateData)
      .eq('id', deployment.id);

    // Also activate the pipeline
    await supabase
      .from('pipelines')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    console.log(`Deployment successful!`);
    console.log(`Dagster Code Location: ${deploymentResult.dagster_code_location}`);
    console.log(`=== DEPLOYMENT COMPLETE ===\n`);

    return NextResponse.json({
      success: true,
      deployment_id: deployment.id,
      dagster_deployment_id: deploymentResult.dagster_deployment_id,
      dagster_code_location: deploymentResult.dagster_code_location,
      deployment_status: 'active',
      message: 'Pipeline deployed successfully',
    });

  } catch (error) {
    console.error('Error deploying pipeline:', error);
    return NextResponse.json(
      {
        error: 'Failed to deploy pipeline',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get deployment status
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

    // Get the latest deployment
    const { data: deployments, error: deploymentError } = await supabase
      .from('pipeline_deployments')
      .select('*')
      .eq('pipeline_id', id)
      .order('version', { ascending: false })
      .limit(1);

    if (deploymentError || !deployments || deployments.length === 0) {
      return NextResponse.json({
        deployed: false,
        message: 'No deployment found',
      });
    }

    const deployment = deployments[0];

    // If deployed to Dagster Cloud, check live status
    if (deployment.dagster_deployment_id && process.env.DAGSTER_DEPLOYMENT_MODE === 'cloud') {
      try {
        const status = await checkDeploymentStatus(deployment.dagster_deployment_id);

        // Update status in database if changed
        if (status.status !== deployment.deployment_status) {
          await supabase
            .from('pipeline_deployments')
            .update({
              deployment_status: status.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', deployment.id);
        }

        return NextResponse.json({
          deployed: status.status === 'deployed' || status.status === 'running',
          deployment_status: status.status,
          deployment_id: deployment.id,
          dagster_deployment_id: deployment.dagster_deployment_id,
          dagster_code_location: deployment.dagster_code_location,
          deployed_at: deployment.deployed_at,
          error: status.error,
        });
      } catch (error) {
        console.error('Error checking Dagster Cloud status:', error);
        // Fall through to return database status
      }
    }

    // Return status from database
    return NextResponse.json({
      deployed: deployment.deployment_status === 'active' || deployment.deployment_status === 'running',
      deployment_status: deployment.deployment_status,
      deployment_id: deployment.id,
      dagster_deployment_id: deployment.dagster_deployment_id,
      dagster_code_location: deployment.dagster_code_location,
      deployed_at: deployment.deployed_at,
      version: deployment.version,
    });

  } catch (error) {
    console.error('Error getting deployment status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get deployment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
