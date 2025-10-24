import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/templates/[id]
 * Get a single template by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Fetch template
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Unexpected error in GET /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/templates/[id]
 * Update a template
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Parse request body
    const body = await request.json();
    const { name, description, provider_id, prompt, fields, status } = body;

    // Validate at least one field is provided
    if (!name && !description && !provider_id && !prompt && !fields && !status) {
      return NextResponse.json(
        { error: 'At least one field must be provided to update' },
        { status: 400 }
      );
    }

    // Validate fields if provided
    if (fields && !Array.isArray(fields)) {
      return NextResponse.json(
        { error: 'fields must be an array' },
        { status: 400 }
      );
    }

    // If provider_id is being updated, verify it exists and belongs to user
    if (provider_id) {
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('id', provider_id)
        .eq('created_by', user.id)
        .single();

      if (providerError || !provider) {
        return NextResponse.json(
          { error: 'Provider not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (provider_id !== undefined) updateData.provider_id = provider_id;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (fields !== undefined) updateData.fields = fields;
    if (status !== undefined) updateData.status = status;

    // Update template
    const { data: template, error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id]
 * Delete a template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check for dependent extractions
    const { data: extractions, error: extractionsError } = await supabase
      .from('extractions')
      .select('id')
      .eq('template_id', id)
      .limit(1);

    if (extractionsError) {
      console.error('Error checking for dependent extractions:', extractionsError);
      return NextResponse.json(
        { error: 'Failed to check dependencies' },
        { status: 500 }
      );
    }

    if (extractions && extractions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete template with existing extractions' },
        { status: 400 }
      );
    }

    // Delete template
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
