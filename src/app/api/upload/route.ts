/**
 * Upload API Route
 *
 * Handles artifact file uploads to Supabase Storage and creates database records
 * Based on spec section 4: Key User Flows
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateFile } from '@/lib/storage/upload';
import type { ArtifactUploadData } from '@/types/artifacts';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for large file uploads

/**
 * POST /api/upload
 *
 * Upload artifact file and create database record
 */
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceId = formData.get('sourceId') as string | null;
    const providerId = formData.get('providerId') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Must provide either sourceId or providerId
    if (!sourceId && !providerId) {
      return NextResponse.json(
        { error: 'Either sourceId or providerId is required' },
        { status: 400 }
      );
    }

    let finalSourceId: string;

    // If sourceId provided, verify it exists and belongs to user
    if (sourceId) {
      const { data: source, error: sourceError } = await supabase
        .from('sources')
        .select('id, provider_id')
        .eq('id', sourceId)
        .eq('created_by', user.id)
        .single();

      if (sourceError || !source) {
        return NextResponse.json(
          { error: 'Source not found or access denied' },
          { status: 403 }
        );
      }

      finalSourceId = sourceId;
    }
    // If only providerId provided, find or create a file_upload source
    else if (providerId) {
      // Verify provider exists and belongs to user
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('id', providerId)
        .eq('created_by', user.id)
        .single();

      if (providerError || !provider) {
        return NextResponse.json(
          { error: 'Provider not found or access denied' },
          { status: 403 }
        );
      }

      // Find existing file_upload source for this provider
      const { data: existingSource } = await supabase
        .from('sources')
        .select('id')
        .eq('provider_id', providerId)
        .eq('source_type', 'file_upload')
        .eq('created_by', user.id)
        .single();

      if (existingSource) {
        finalSourceId = existingSource.id;
      } else {
        // Create a new file_upload source
        const { data: newSource, error: createError } = await supabase
          .from('sources')
          .insert({
            provider_id: providerId,
            name: 'Manual File Uploads',
            source_type: 'file_upload',
            configuration: { upload_type: 'manual' },
            created_by: user.id,
          })
          .select('id')
          .single();

        if (createError || !newSource) {
          return NextResponse.json(
            { error: 'Failed to create source' },
            { status: 500 }
          );
        }

        finalSourceId = newSource.id;
      }
    } else {
      return NextResponse.json(
        { error: 'Either sourceId or providerId is required' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Upload to Supabase Storage (using authenticated server client)
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
    const filePath = `${finalSourceId}/${timestamp}-${randomId}/${sanitizedFileName}`;

    // Upload file to storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artifacts')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('artifacts')
      .getPublicUrl(filePath);

    const uploadResult = {
      success: true,
      filePath: uploadData.path,
      publicUrl: urlData.publicUrl,
      artifactType: validation.artifactType!,
      metadata: {
        mime_type: file.type,
        file_type: validation.artifactType,
        original_size: file.size,
        uploaded_at: new Date().toISOString(),
      },
    };

    // Create artifact record in database
    const artifactData: ArtifactUploadData = {
      source_id: finalSourceId, // ✅ Now using source_id
      artifact_type: uploadResult.artifactType,
      original_filename: file.name,
      file_size: file.size,
      file_path: uploadResult.filePath,
      metadata: {
        ...uploadResult.metadata,
        public_url: uploadResult.publicUrl,
      },
    };

    // DEBUG: Log what we're trying to insert
    console.log('=== UPLOAD DEBUG ===');
    console.log('User ID:', user.id);
    console.log('Source ID:', finalSourceId);
    console.log('Artifact data:', artifactData);

    const { data: artifact, error: dbError } = await supabase
      .from('artifacts')
      .insert({
        ...artifactData,
        created_by: user.id,
        extraction_status: 'pending',
      })
      .select(`
        *,
        source:sources(
          id,
          name,
          source_type,
          provider:providers(id, name, type)
        )
      `)
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      console.error('Error details:', JSON.stringify(dbError, null, 2));

      // If DB insert fails, try to clean up uploaded file
      supabase.storage
        .from('artifacts')
        .remove([uploadResult.filePath])
        .catch(console.error);

      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      artifact,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
