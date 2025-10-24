/**
 * Artifacts API Route
 *
 * GET /api/artifacts - List artifacts with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const sourceId = searchParams.get('source_id');
    const providerId = searchParams.get('provider_id');
    const artifactType = searchParams.get('artifact_type');
    const extractionStatus = searchParams.get('extraction_status');

    // Build query - join with sources and providers
    let query = supabase
      .from('artifacts')
      .select(`
        *,
        source:sources(
          id,
          name,
          source_type,
          provider:providers(id, name, type)
        )
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    // Filter by provider through sources relationship
    if (providerId) {
      // This requires a more complex query
      const { data: sources } = await supabase
        .from('sources')
        .select('id')
        .eq('provider_id', providerId);

      if (sources && sources.length > 0) {
        const sourceIds = sources.map(s => s.id);
        query = query.in('source_id', sourceIds);
      }
    }

    if (artifactType) {
      query = query.eq('artifact_type', artifactType);
    }

    if (extractionStatus) {
      query = query.eq('extraction_status', extractionStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch artifacts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
