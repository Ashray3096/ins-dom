/**
 * Individual Pipeline API Route
 *
 * GET /api/pipelines/[id] - Get pipeline details
 * PATCH /api/pipelines/[id] - Update pipeline
 * DELETE /api/pipelines/[id] - Delete pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get pipeline with all related data
    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .select(`
        *,
        provider:providers(id, name, type),
        template:templates(id, name, description, fields, prompt)
      `)
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) throw error;

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await request.json();
    const updates: any = {};

    // Only allow certain fields to be updated
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.schedule !== undefined) updates.schedule = body.schedule;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.config !== undefined) updates.config = body.config;

    updates.updated_at = new Date().toISOString();

    // Update pipeline
    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .update(updates)
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) throw error;

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error('Error updating pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // First, fetch deployed pipeline files to delete them
    const { data: deployments } = await supabase
      .from('pipeline_deployments')
      .select('pipeline_name')
      .eq('pipeline_id', id);

    // Delete deployed Python files from filesystem
    if (deployments && deployments.length > 0) {
      const fs = require('fs');
      const path = require('path');

      for (const deployment of deployments) {
        const filePath = path.join(
          process.cwd(),
          'dagster_home/pipelines',
          `${deployment.pipeline_name}.py`
        );

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ Deleted deployed file: ${deployment.pipeline_name}.py`);
          }
        } catch (fileError) {
          console.error(`⚠️ Failed to delete file ${deployment.pipeline_name}.py:`, fileError);
          // Continue with deletion even if file removal fails
        }
      }
    }

    // Delete pipeline_deployments first (foreign key constraint)
    await supabase
      .from('pipeline_deployments')
      .delete()
      .eq('pipeline_id', id);

    // Delete pipeline
    const { error } = await supabase
      .from('pipelines')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Pipeline and deployed files deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    );
  }
}
