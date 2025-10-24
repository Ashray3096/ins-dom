/**
 * Source File Download API Route
 *
 * GET /api/sources/[id]/download - Download a source file from Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get source file metadata
    const { data: sourceFile, error: fetchError } = await supabase
      .from('source_files')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
      }
      console.error('Error fetching source file:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!sourceFile.storage_path) {
      return NextResponse.json(
        { error: 'Source file has no storage path' },
        { status: 400 }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('source-files')
      .download(sourceFile.storage_path);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      return NextResponse.json(
        { error: `Failed to download file: ${downloadError.message}` },
        { status: 500 }
      );
    }

    // Convert Blob to Buffer for Response
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Determine content type
    const contentType = sourceFile.metadata?.mime_type || 'application/octet-stream';

    // Return file as response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${sourceFile.filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/sources/[id]/download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
