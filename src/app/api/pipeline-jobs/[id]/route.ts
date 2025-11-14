/**
 * Pipeline Job Status API
 *
 * GET /api/pipeline-jobs/[id] - Get job status and progress
 * DELETE /api/pipeline-jobs/[id] - Cancel running job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch job status
    const { data: job, error } = await supabase
      .from('pipeline_jobs')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update job status to cancelled
    const { error } = await supabase
      .from('pipeline_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error: 'Cancelled by user'
      })
      .eq('id', id)
      .eq('created_by', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
