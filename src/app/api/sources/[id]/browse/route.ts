/**
 * S3 Source Browser API Route
 *
 * GET /api/sources/[id]/browse - Browse S3 bucket contents
 * Query params:
 *   - prefix: folder prefix to browse
 *   - pattern: file pattern to match (e.g., "*.pdf")
 *   - limit: max number of files to return
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createS3Client, listS3Objects, listS3Prefixes } from '@/lib/s3-client';
import type { S3SourceConfig } from '@/types/sources';

export async function GET(
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const prefix = searchParams.get('prefix') || '';
    const pattern = searchParams.get('pattern') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');

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

    // Create S3 client
    const s3Client = createS3Client({
      bucket: config.bucket,
      prefix: config.prefix,
      region: config.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // List prefixes (folders) at current level
    // Remove leading slashes as S3 keys don't start with /
    let fullPrefix = config.prefix
      ? `${config.prefix}${prefix}`
      : prefix;

    // Strip leading slash if present
    if (fullPrefix.startsWith('/')) {
      fullPrefix = fullPrefix.substring(1);
    }

    console.log(`Browsing S3: bucket=${config.bucket}, prefix='${fullPrefix}', pattern=${pattern || config.pattern}`);

    const [prefixes, objectsResult] = await Promise.all([
      listS3Prefixes(s3Client, config.bucket, fullPrefix),
      listS3Objects(s3Client, config.bucket, {
        prefix: fullPrefix,
        pattern: pattern || config.pattern,
        maxKeys: limit,
      }),
    ]);

    // Format response
    const folders = prefixes.map(p => {
      const folderName = p
        .replace(config.prefix || '', '')
        .replace(prefix, '')
        .replace(/\/$/, '');
      return {
        name: folderName,
        fullPath: p,
        type: 'folder' as const,
      };
    });

    const files = objectsResult.objects
      .filter(obj => !obj.key.endsWith('/')) // Exclude folder markers
      .map(obj => ({
        name: obj.key.split('/').pop() || obj.key,
        fullPath: obj.key,
        size: obj.size,
        lastModified: obj.lastModified.toISOString(),
        type: 'file' as const,
      }));

    return NextResponse.json({
      bucket: config.bucket,
      prefix: fullPrefix,
      folders,
      files,
      totalFiles: files.length,
      hasMore: objectsResult.isTruncated,
    });
  } catch (error) {
    console.error('Error browsing S3 source:', error);
    return NextResponse.json(
      {
        error: 'Failed to browse S3 bucket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
