/**
 * File Upload API Route
 *
 * POST /api/sources/upload - Upload a file to Supabase Storage and create source file record
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';
import type { SourceFileType } from '@/types/providers';

// Map MIME types to SourceFileType
const MIME_TO_FILE_TYPE: Record<string, SourceFileType> = {
  'application/pdf': 'PDF',
  'text/html': 'HTML',
  'message/rfc822': 'EMAIL',
  'application/vnd.ms-outlook': 'MSG',
  'text/csv': 'CSV',
  'application/vnd.ms-excel': 'EXCEL',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'EXCEL',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const providerId = formData.get('provider_id') as string | null;
    const sourceUrl = formData.get('source_url') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > config.upload.maxFileSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size of ${config.upload.maxFileSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Determine file type from MIME type
    const fileType = MIME_TO_FILE_TYPE[file.type];
    if (!fileType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Supported types: ${config.upload.allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // If provider_id is provided, verify it exists and belongs to user
    if (providerId) {
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('id', providerId)
        .eq('created_by', user.id)
        .single();

      if (providerError || !provider) {
        return NextResponse.json(
          { error: 'Invalid provider_id or provider not found' },
          { status: 400 }
        );
      }
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${user.id}/${timestamp}_${sanitizedFilename}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('source-files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create source file record
    const { data, error } = await supabase
      .from('source_files')
      .insert({
        provider_id: providerId,
        filename: file.name,
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        source_url: sourceUrl,
        status: 'UPLOADED',
        uploaded_by: user.id,
        metadata: {
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
        },
      })
      .select(`
        *,
        provider:providers(id, name, type)
      `)
      .single();

    if (error) {
      console.error('Error creating source file record:', error);

      // Try to clean up uploaded file
      await supabase.storage
        .from('source-files')
        .remove([storagePath]);

      return NextResponse.json(
        { error: `Failed to create source file record: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/sources/upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Configure Next.js to allow large file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
