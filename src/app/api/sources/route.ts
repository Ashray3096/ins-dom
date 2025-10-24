/**
 * Sources API Route
 *
 * Per spec section 3: Sources define WHERE data comes from
 * (URL, S3, API, File Upload) - this is the CONFIGURATION layer
 *
 * GET /api/sources - List source configurations
 * POST /api/sources - Create a new source configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SourceCreateData, SourceType } from '@/types/sources';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get('provider_id');
    const sourceType = searchParams.get('source_type') as SourceType | null;
    const isActive = searchParams.get('is_active');

    // Build query - join with providers to enforce RLS
    let query = supabase
      .from('sources')
      .select(`
        *,
        provider:providers(id, name, type)
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sources' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const body: SourceCreateData = await request.json();

    // Validate required fields
    if (!body.provider_id || !body.name || !body.source_type || !body.configuration) {
      return NextResponse.json(
        { error: 'Missing required fields: provider_id, name, source_type, configuration' },
        { status: 400 }
      );
    }

    // Validate source_type
    const validSourceTypes: SourceType[] = ['url', 's3_bucket', 'api', 'file_upload'];
    if (!validSourceTypes.includes(body.source_type)) {
      return NextResponse.json(
        { error: `Invalid source_type. Must be one of: ${validSourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify user owns the provider
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id')
      .eq('id', body.provider_id)
      .eq('created_by', user.id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: 'Provider not found or access denied' },
        { status: 404 }
      );
    }

    // Create source
    const { data: source, error: insertError } = await supabase
      .from('sources')
      .insert({
        provider_id: body.provider_id,
        name: body.name,
        source_type: body.source_type,
        configuration: body.configuration,
        is_active: body.is_active ?? true,
        created_by: user.id,
      })
      .select(`
        *,
        provider:providers(id, name, type)
      `)
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create source' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: source,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating source:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
