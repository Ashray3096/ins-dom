/**
 * Artifact Download API Route
 *
 * GET /api/artifacts/[id]/download - Download artifact file (PDF, HTML, etc.)
 * Handles authentication and proxies file from Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get artifact from database
    const { data: artifact, error: fetchError } = await supabase
      .from('artifacts')
      .select('*, source:sources(*, provider:providers(*))')
      .eq('id', id)
      .single();

    if (fetchError || !artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Check if user has access (RLS will handle this, but double check)
    if (artifact.source?.provider?.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine content type based on artifact type
    let contentType = artifact.metadata?.mime_type;
    if (!contentType) {
      // Infer from artifact type if mime_type not set
      const typeMap: Record<string, string> = {
        'html': 'text/html',
        'pdf': 'application/pdf',
        'json': 'application/json',
        'email': 'message/rfc822',
      };
      contentType = typeMap[artifact.artifact_type] || 'application/octet-stream';
    }

    let fileData: Blob | Buffer;

    // Check if content is stored in raw_content (S3-synced HTML/JSON files)
    if (artifact.raw_content) {
      console.log('Serving content from raw_content field');

      // Handle HTML content
      if (artifact.raw_content.html) {
        fileData = Buffer.from(artifact.raw_content.html, 'utf-8');
      }
      // Handle generic content (JSON, text, etc.)
      else if (artifact.raw_content.content) {
        fileData = Buffer.from(artifact.raw_content.content, 'utf-8');
      }
      // Fallback: stringify the entire raw_content object
      else {
        fileData = Buffer.from(JSON.stringify(artifact.raw_content, null, 2), 'utf-8');
      }
    }
    // Otherwise, download from Supabase Storage (manually uploaded files)
    else if (artifact.file_path) {
      console.log('Downloading from Supabase Storage:', artifact.file_path);

      const { data: storageData, error: downloadError } = await supabase.storage
        .from('artifacts')
        .download(artifact.file_path);

      if (downloadError || !storageData) {
        console.error('Storage download error:', downloadError);
        return NextResponse.json(
          { error: 'Failed to download file from storage' },
          { status: 500 }
        );
      }

      fileData = storageData;
    }
    // No content available
    else {
      return NextResponse.json(
        { error: 'No content available for this artifact' },
        { status: 404 }
      );
    }

    // Return file as response
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `inline; filename="${artifact.original_filename}"`);
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Allow iframe embedding (remove X-Frame-Options restrictions)
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    // Allow same-origin iframe embedding
    headers.set('Content-Security-Policy', "frame-ancestors 'self'");

    return new NextResponse(fileData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
