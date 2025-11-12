/**
 * Debug endpoint to inspect artifact data structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get a few HTML artifacts
    const { data: artifacts, error } = await supabase
      .from('artifacts')
      .select('*')
      .ilike('original_filename', '%certificate.html%')
      .limit(2);

    if (error) throw error;

    // Return full structure for debugging
    return NextResponse.json({
      count: artifacts?.length || 0,
      artifacts: artifacts?.map(a => ({
        id: a.id,
        filename: a.original_filename,
        extraction_status: a.extraction_status,
        has_raw_content: !!a.raw_content,
        has_metadata: !!a.metadata,
        raw_content_type: typeof a.raw_content,
        raw_content_keys: a.raw_content && typeof a.raw_content === 'object' ? Object.keys(a.raw_content) : [],
        raw_content_sample: a.raw_content,
        metadata_keys: a.metadata && typeof a.metadata === 'object' ? Object.keys(a.metadata) : [],
        metadata_sample: a.metadata,
      })),
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifacts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
