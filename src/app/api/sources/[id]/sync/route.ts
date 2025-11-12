/**
 * S3 Source Sync API Route
 *
 * POST /api/sources/[id]/sync - Sync files from S3 to artifacts
 * Body:
 *   - dryRun: boolean (preview only, don't create artifacts)
 *   - limit: number (max files to sync, respects test_mode)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createS3Client, listS3Objects, getS3Object } from '@/lib/s3-client';
import type { S3SourceConfig } from '@/types/sources';
import * as cheerio from 'cheerio';

// Helper to determine artifact type from key/content
function determineArtifactType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    'pdf': 'pdf',
    'html': 'html',
    'htm': 'html',
    'eml': 'email',
    'msg': 'email',
    'json': 'json',
  };
  return typeMap[ext || ''] || 'html'; // Default to html
}

// Helper to extract text content from HTML
function extractTextFromHtml(html: string): string {
  try {
    const $ = cheerio.load(html);
    // Remove script and style elements
    $('script, style').remove();
    // Get text content
    return $('body').text().trim();
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get request body
    const body = await request.json();
    const { dryRun = false, limit } = body;

    // Get source configuration
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    if (source.source_type !== 's3_bucket') {
      return NextResponse.json(
        { error: 'Source is not an S3 bucket' },
        { status: 400 }
      );
    }

    const config = source.configuration as S3SourceConfig;

    // Determine max files to process
    let maxFiles = limit;
    if (!maxFiles) {
      maxFiles = config.test_mode && config.test_limit
        ? config.test_limit
        : 1000; // Default max
    }

    // Remove leading slashes from prefix as S3 keys don't start with /
    let s3Prefix = config.prefix || '';
    if (s3Prefix.startsWith('/')) {
      s3Prefix = s3Prefix.substring(1);
    }

    console.log(`Syncing S3 source ${id}: bucket=${config.bucket}, prefix=${s3Prefix}, maxFiles=${maxFiles}`);

    // Create S3 client
    const s3Client = createS3Client({
      bucket: config.bucket,
      prefix: s3Prefix,
      region: config.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // List objects in S3
    const objectsResult = await listS3Objects(s3Client, config.bucket, {
      prefix: s3Prefix,
      pattern: config.pattern,
      maxKeys: maxFiles,
    });

    const files = objectsResult.objects.filter(obj => !obj.key.endsWith('/')); // Exclude folders

    console.log(`Found ${files.length} files in S3`);

    if (files.length === 0) {
      return NextResponse.json({
        message: 'No files found matching criteria',
        filesProcessed: 0,
        filesSkipped: 0,
        filesFailed: 0,
      });
    }

    // Check which files already exist in artifacts
    const fileKeys = files.map(f => f.key);
    const { data: existingArtifacts } = await supabase
      .from('artifacts')
      .select('original_filename, metadata')
      .eq('source_id', id);

    const existingS3Keys = new Set(
      (existingArtifacts || [])
        .map(a => a.metadata?.s3_key)
        .filter(Boolean)
    );

    const newFiles = files.filter(f => !existingS3Keys.has(f.key));

    console.log(`${existingS3Keys.size} files already synced, ${newFiles.length} new files to process`);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalFilesInS3: files.length,
        newFilesToSync: newFiles.length,
        filesAlreadySynced: existingS3Keys.size,
        preview: newFiles.slice(0, 10).map(f => ({
          key: f.key,
          size: f.size,
          lastModified: f.lastModified.toISOString(),
        })),
      });
    }

    // Sync new files to artifacts
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const file of newFiles) {
      try {
        console.log(`Processing S3 object: ${file.key}`);

        const artifactType = determineArtifactType(file.key);

        // Prepare raw_content
        let rawContent: any = null;
        let filePath: string | null = null;

        // For PDFs: Skip download, store only metadata (S3 reference)
        // For HTML/JSON: Download and store content (small files)
        if (artifactType === 'pdf') {
          console.log(`  Skipping PDF download, storing metadata only`);
          rawContent = null; // No content stored for S3 PDFs
          filePath = null;   // No Supabase storage path
        } else {
          // Download content for HTML/JSON files (small)
          console.log(`  Downloading ${artifactType} content`);
          const content = await getS3Object(s3Client, config.bucket, file.key);

          if (artifactType === 'html') {
            const htmlContent = content.toString('utf-8');
            rawContent = {
              html: htmlContent,
              text: extractTextFromHtml(htmlContent),
            };
          } else {
            // Store text content for other file types
            rawContent = {
              content: content.toString('utf-8'),
            };
          }

          filePath = file.key; // Store S3 key as file path for non-PDFs
        }

        // Create artifact
        const { error: artifactError } = await supabase
          .from('artifacts')
          .insert({
            source_id: id,
            original_filename: file.key.split('/').pop() || file.key,
            artifact_type: artifactType,
            file_size: file.size,
            file_path: filePath, // NULL for PDFs, S3 key for HTML/JSON
            raw_content: rawContent, // NULL for PDFs, content for HTML/JSON
            extraction_status: 'completed', // Mark as completed so pipelines can process it
            metadata: {
              s3_key: file.key,
              s3_bucket: config.bucket,
              s3_region: config.region,
              s3_last_modified: file.lastModified.toISOString(),
              s3_etag: file.etag,
            },
            created_by: user.id,
          });

        if (artifactError) {
          console.error(`Failed to create artifact for ${file.key}:`, artifactError);
          errors.push(`${file.key}: ${artifactError.message}`);
          failed++;
        } else {
          processed++;
          console.log(`✓ Created artifact for ${file.key}`);
        }
      } catch (error) {
        console.error(`Error processing ${file.key}:`, error);
        errors.push(`${file.key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }

    // Update source last_sync_at
    await supabase
      .from('sources')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      message: `Sync completed: ${processed} files processed, ${failed} failed`,
      filesProcessed: processed,
      filesSkipped: existingS3Keys.size,
      filesFailed: failed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('Error syncing S3 source:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync S3 source',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
