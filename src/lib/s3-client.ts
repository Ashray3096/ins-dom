/**
 * S3 Client Utility
 *
 * Provides S3 operations for bucket browsing and file sync
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

export interface S3Config {
  bucket: string;
  prefix?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

/**
 * Create S3 client with credentials
 */
export function createS3Client(config: S3Config): S3Client {
  const region = config.region || process.env.AWS_REGION || 'us-east-1';

  return new S3Client({
    region,
    credentials: config.accessKeyId && config.secretAccessKey ? {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    } : undefined,
  });
}

/**
 * List objects in S3 bucket with prefix and pattern matching
 */
export async function listS3Objects(
  client: S3Client,
  bucket: string,
  options: {
    prefix?: string;
    pattern?: string;
    maxKeys?: number;
    continuationToken?: string;
  } = {}
): Promise<{
  objects: S3Object[];
  continuationToken?: string;
  isTruncated: boolean;
}> {
  const { prefix = '', pattern, maxKeys = 1000, continuationToken } = options;

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    let objects = (response.Contents || []).map(obj => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag || '',
    }));

    // Filter by pattern if provided (e.g., "*.pdf", "*.html")
    if (pattern) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`, 'i');

      objects = objects.filter(obj => {
        const filename = obj.key.split('/').pop() || '';
        return regex.test(filename);
      });
    }

    return {
      objects,
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated || false,
    };
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    throw new Error(`Failed to list S3 objects: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get object content from S3
 */
export async function getS3Object(
  client: S3Client,
  bucket: string,
  key: string
): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    const chunks: Uint8Array[] = [];

    if (!response.Body) {
      throw new Error('No body in S3 response');
    }

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`Error getting S3 object ${key}:`, error);
    throw new Error(`Failed to get S3 object: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test S3 bucket access
 */
export async function testS3Access(
  client: S3Client,
  bucket: string
): Promise<boolean> {
  try {
    const command = new HeadBucketCommand({ Bucket: bucket });
    await client.send(command);
    return true;
  } catch (error) {
    console.error('Error testing S3 access:', error);
    return false;
  }
}

/**
 * Get common prefixes (folders) in S3 bucket
 */
export async function listS3Prefixes(
  client: S3Client,
  bucket: string,
  prefix: string = ''
): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });

    const response = await client.send(command);

    return (response.CommonPrefixes || []).map(p => p.Prefix!);
  } catch (error) {
    console.error('Error listing S3 prefixes:', error);
    throw new Error(`Failed to list S3 prefixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
