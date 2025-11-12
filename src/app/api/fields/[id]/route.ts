/**
 * Field Library Individual Field API Routes
 * GET /api/fields/[id] - Get field by ID
 * PUT /api/fields/[id] - Update field
 * DELETE /api/fields/[id] - Soft delete field (mark as deprecated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UpdateFieldLibraryInput } from '@/types/field-library';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get field
    const { data, error } = await supabase
      .from('field_library')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/fields/[id]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing field
    const { data: existing, error: fetchError } = await supabase
      .from('field_library')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    // Check ownership
    if (existing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'You can only update your own fields' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: UpdateFieldLibraryInput = await request.json();

    // Build update object (only include provided fields)
    const updates: any = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.description !== undefined) updates.description = body.description;
    if (body.field_type !== undefined) updates.field_type = body.field_type;
    if (body.classification !== undefined) updates.classification = body.classification;
    if (body.category !== undefined) updates.category = body.category;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.validation_rules !== undefined) updates.validation_rules = body.validation_rules;
    if (body.transformations !== undefined) updates.transformations = body.transformations;
    if (body.is_deprecated !== undefined) {
      updates.is_deprecated = body.is_deprecated;
      if (body.is_deprecated && body.deprecated_reason) {
        updates.deprecated_reason = body.deprecated_reason;
      }
    }

    // Increment version
    updates.version = existing.version + 1;

    // Update field
    const { data, error } = await supabase
      .from('field_library')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating field:', error);
      return NextResponse.json(
        { error: 'Failed to update field', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      message: 'Field updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/fields/[id]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get existing field
    const { data: existing, error: fetchError } = await supabase
      .from('field_library')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    // Check ownership
    if (existing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own fields' },
        { status: 403 }
      );
    }

    // Check if field is being used
    if (existing.usage_count > 0) {
      // Soft delete (mark as deprecated) instead of hard delete
      const { error: deprecateError } = await supabase
        .from('field_library')
        .update({
          is_deprecated: true,
          deprecated_reason: 'Deleted by user (field is in use by templates)',
        })
        .eq('id', id);

      if (deprecateError) {
        return NextResponse.json(
          { error: 'Failed to deprecate field', details: deprecateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Field marked as deprecated (cannot delete - in use by templates)',
        usage_count: existing.usage_count,
      });
    }

    // Hard delete if not in use
    const { error: deleteError } = await supabase
      .from('field_library')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting field:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete field', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Field deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/fields/[id]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
