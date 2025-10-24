/**
 * Provider Detail API Routes
 *
 * GET /api/providers/[id] - Get a specific provider
 * PATCH /api/providers/[id] - Update a provider
 * DELETE /api/providers/[id] - Delete a provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProviderType, ProviderCadence } from '@/types/providers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }
      console.error('Error fetching provider:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/providers/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, description, cadence } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      const validTypes: ProviderType[] = ['NABCA', 'TTB', 'CUSTOM'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.type = type;
    }
    if (description !== undefined) updateData.description = description;
    if (cadence !== undefined) {
      const validCadences: ProviderCadence[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ADHOC'];
      if (!validCadences.includes(cadence)) {
        return NextResponse.json(
          { error: `Invalid cadence. Must be one of: ${validCadences.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.cadence = cadence;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('providers')
      .update(updateData)
      .eq('id', params.id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }
      console.error('Error updating provider:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in PATCH /api/providers/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if provider has any source files
    const { data: files, error: filesError } = await supabase
      .from('source_files')
      .select('id')
      .eq('provider_id', params.id)
      .limit(1);

    if (filesError) {
      console.error('Error checking source files:', filesError);
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }

    if (files && files.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete provider with existing source files. Delete source files first.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', params.id)
      .eq('created_by', user.id);

    if (error) {
      console.error('Error deleting provider:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/providers/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
