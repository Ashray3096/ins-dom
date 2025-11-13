/**
 * Schema Check API
 *
 * Check current values in database tables
 * Access: GET /api/check-schema
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
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

    // Check distinct artifact_type values
    const { data: artifactTypes, error: artifactError } = await supabase
      .from('artifacts')
      .select('artifact_type')
      .limit(1000);

    // Check distinct extraction_method values
    const { data: extractionMethods, error: templateError } = await supabase
      .from('templates')
      .select('extraction_method, id, name')
      .limit(1000);

    const uniqueArtifactTypes = artifactTypes
      ? [...new Set(artifactTypes.map(a => a.artifact_type))]
      : [];

    const uniqueExtractionMethods = extractionMethods
      ? [...new Set(extractionMethods.map(t => t.extraction_method))]
      : [];

    return NextResponse.json({
      success: true,
      artifactTypes: {
        unique: uniqueArtifactTypes,
        count: artifactTypes?.length || 0,
        error: artifactError?.message
      },
      extractionMethods: {
        unique: uniqueExtractionMethods,
        count: extractionMethods?.length || 0,
        templates: extractionMethods,
        error: templateError?.message
      }
    });
  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json(
      {
        error: 'Schema check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
