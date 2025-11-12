/**
 * Source Configuration Detail API Routes
 *
 * Per spec section 3: Sources define WHERE data comes from
 *
 * GET /api/sources/[id] - Get a specific source configuration
 * PUT /api/sources/[id] - Update a source configuration
 * DELETE /api/sources/[id] - Delete a source configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SourceUpdateData, SourceType } from '@/types/sources';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('sources')
      .select(`
        *,
        provider:providers(id, name, type)
      `)
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }
      console.error('Error fetching source:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/sources/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SourceUpdateData = await request.json();

    // Build update object with only provided fields
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.configuration !== undefined) {
      updateData.configuration = body.configuration;
    }

    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('sources')
      .update(updateData)
      .eq('id', id)
      .eq('created_by', user.id)
      .select(`
        *,
        provider:providers(id, name, type)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }
      console.error('Error updating source:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in PUT /api/sources/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify source exists and belongs to user
    const { data: source, error: fetchError } = await supabase
      .from('sources')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }
      console.error('Error fetching source:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Check if source has any artifacts
    // (CASCADE delete will remove them, but we want to warn the user)
    const { data: artifacts, error: artifactsError } = await supabase
      .from('artifacts')
      .select('id')
      .eq('source_id', id)
      .limit(1);

    if (artifactsError) {
      console.error('Error checking artifacts:', artifactsError);
      return NextResponse.json({ error: artifactsError.message }, { status: 500 });
    }

    if (artifacts && artifacts.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete source with existing artifacts. Delete artifacts first.',
        },
        { status: 400 }
      );
    }

    // Delete from database (CASCADE will handle related records)
    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id);

    if (error) {
      console.error('Error deleting source:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Source deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/sources/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
