/**
 * Field Library API Routes
 * GET /api/fields - List/search fields
 * POST /api/fields - Create new field
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CreateFieldLibraryInput, FieldLibraryFilters } from '@/types/field-library';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const field_type = searchParams.get('field_type');
    const classification = searchParams.get('classification');
    const search = searchParams.get('search');
    const is_deprecated = searchParams.get('is_deprecated');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('field_library')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (field_type) {
      query = query.eq('field_type', field_type);
    }

    if (classification) {
      query = query.eq('classification', classification);
    }

    if (is_deprecated !== null) {
      query = query.eq('is_deprecated', is_deprecated === 'true');
    }

    // Search in name, label, description, or tags
    if (search) {
      query = query.or(`name.ilike.%${search}%,label.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching fields:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fields', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/fields:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: CreateFieldLibraryInput = await request.json();

    // Validate required fields
    if (!body.name || !body.label || !body.field_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, label, field_type' },
        { status: 400 }
      );
    }

    // Validate name format (snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(body.name)) {
      return NextResponse.json(
        { error: 'Field name must be snake_case (lowercase letters, numbers, underscores only)' },
        { status: 400 }
      );
    }

    // Check if field with same name already exists
    const { data: existing } = await supabase
      .from('field_library')
      .select('id')
      .eq('name', body.name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Field with name "${body.name}" already exists` },
        { status: 409 }
      );
    }

    // Create field
    const { data, error } = await supabase
      .from('field_library')
      .insert({
        name: body.name,
        label: body.label,
        description: body.description || null,
        field_type: body.field_type,
        classification: body.classification || null,
        category: body.category || null,
        tags: body.tags || [],
        validation_rules: body.validation_rules || {},
        transformations: body.transformations || [],
        created_by: user.id,
        version: 1,
        usage_count: 0,
        is_deprecated: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating field:', error);
      return NextResponse.json(
        { error: 'Failed to create field', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      message: 'Field created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/fields:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
