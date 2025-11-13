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
function determineArtifactType(key: string, content?: Buffer): string {
  // Try extension first
  const ext = key.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    'pdf': 'pdf',
    'html': 'html',
    'htm': 'html',
    'eml': 'email',
    'msg': 'email',
    'json': 'json',
    'csv': 'csv',
  };

  if (ext && typeMap[ext]) {
    return typeMap[ext];
  }

  // Content-based detection for files without extension
  if (content) {
    const preview = content.toString('utf-8', 0, 1000);

    // Check for email headers (RFC822 format)
    if (preview.includes('Return-Path:') ||
        (preview.includes('From:') && preview.includes('Subject:') && preview.includes('Date:')) ||
        preview.includes('MIME-Version:') ||
        preview.includes('Message-ID:')) {
      return 'email';
    }

    // Check for JSON
    const trimmed = preview.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed.substring(0, 100));
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    // Check for PDF magic bytes
    if (preview.startsWith('%PDF')) {
      return 'pdf';
    }

    // Check for CSV (comma-separated with multiple lines)
    const lines = preview.split('\n');
    if (lines.length > 1 && lines[0].includes(',')) {
      return 'csv';
    }
  }

  // Default fallback
  return 'html';
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

    console.log(`\n========== S3 SYNC START ==========`);
    console.log(`Source ID: ${id}`);
    console.log(`Bucket: '${config.bucket}' (length: ${config.bucket.length})`);
    console.log(`Prefix: '${s3Prefix}' (length: ${s3Prefix.length})`);
    console.log(`Pattern: '${config.pattern}'`);
    console.log(`Region: ${config.region || 'us-east-1'}`);
    console.log(`Max Files: ${maxFiles}`);
    console.log(`===================================\n`);

    // Create S3 client
    const s3Client = createS3Client({
      bucket: config.bucket,
      prefix: s3Prefix,
      region: config.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // List objects in S3
    // Request more than maxFiles to account for folder markers that will be filtered out
    const objectsResult = await listS3Objects(s3Client, config.bucket, {
      prefix: s3Prefix,
      pattern: config.pattern,
      maxKeys: maxFiles + 10, // Request extra to account for folders
    });

    // Filter out folder markers first
    const files = objectsResult.objects.filter(obj => !obj.key.endsWith('/')); // Exclude folders

    console.log(`Found ${files.length} files in S3 (after filtering ${objectsResult.objects.length - files.length} folders)`);

    // Now limit to maxFiles
    const limitedFiles = files.slice(0, maxFiles);

    if (files.length === 0) {
      return NextResponse.json({
        message: 'No files found matching criteria',
        filesProcessed: 0,
        filesSkipped: 0,
        filesFailed: 0,
      });
    }

    // Check which files already exist in artifacts
    const fileKeys = limitedFiles.map(f => f.key);
    const { data: existingArtifacts } = await supabase
      .from('artifacts')
      .select('original_filename, metadata')
      .eq('source_id', id);

    const existingS3Keys = new Set(
      (existingArtifacts || [])
        .map(a => a.metadata?.s3_key)
        .filter(Boolean)
    );

    const newFiles = limitedFiles.filter(f => !existingS3Keys.has(f.key));

    console.log(`${existingS3Keys.size} files already synced, ${newFiles.length} new files to process`);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalFilesInS3: limitedFiles.length,
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

        // Download content first for type detection
        let content: Buffer | null = null;
        let artifactType = determineArtifactType(file.key); // Try extension first

        // For non-PDFs, download content
        if (artifactType !== 'pdf') {
          content = await getS3Object(s3Client, config.bucket, file.key);
          // Re-detect type with content (for extensionless files)
          artifactType = determineArtifactType(file.key, content);
          console.log(`  Detected type: ${artifactType}`);
        }

        // Prepare raw_content
        let rawContent: any = null;
        let filePath: string | null = null;

        // For PDFs: Skip download, store only metadata (S3 reference)
        if (artifactType === 'pdf') {
          console.log(`  Skipping PDF download, storing metadata only`);
          rawContent = null;
          filePath = null;
        } else if (content) {
          // Store content for non-PDF files
          console.log(`  Storing ${artifactType} content`);

          if (artifactType === 'html') {
            const htmlContent = content.toString('utf-8');
            rawContent = {
              html: htmlContent,
              text: extractTextFromHtml(htmlContent),
            };
          } else if (artifactType === 'email') {
            // Store email as-is for parsing later
            rawContent = {
              content: content.toString('utf-8'),
            };
          } else {
            // Store text content for other file types (JSON, CSV)
            rawContent = {
              content: content.toString('utf-8'),
            };
          }

          filePath = file.key; // Store S3 key as file path
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
