/**
 * File Storage Service
 *
 * Unified abstraction layer for accessing files from different storage backends:
 * - S3 (for synced source files)
 * - Supabase Storage (for uploaded files)
 *
 * This service automatically detects where a file is stored based on artifact metadata
 * and retrieves it transparently.
 */

import { createS3Client, getS3Object } from './s3-client';
import { createClient } from './supabase/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface Artifact {
  id: string;
  artifact_type: string;
  file_path: string | null;
  file_size: number | null;
  original_filename: string;
  raw_content: any;
  metadata: {
    s3_key?: string;
    s3_bucket?: string;
    s3_region?: string;
    [key: string]: any;
  } | null;
  source_id?: string | null;
}

export interface FileMetadata {
  filename: string;
  size: number;
  mimeType: string;
  storageType: 's3' | 'supabase' | 'raw_content';
}

export class FileStorageService {
  /**
   * Get file as Buffer (for processing)
   * Automatically detects storage backend and retrieves file
   */
  async getFile(artifact: Artifact): Promise<Buffer> {
    // Check if file is in S3
    if (artifact.metadata?.s3_key && artifact.metadata?.s3_bucket) {
      return this.getFileFromS3(artifact);
    }

    // Check if file has raw_content (legacy uploaded PDFs)
    if (artifact.raw_content?.base64) {
      return Buffer.from(artifact.raw_content.base64, 'base64');
    }

    // Check if file is in Supabase Storage
    if (artifact.file_path) {
      return this.getFileFromSupabase(artifact);
    }

    throw new Error(
      `Cannot retrieve file: No valid storage location found for artifact ${artifact.id}`
    );
  }

  /**
   * Get file from S3
   */
  private async getFileFromS3(artifact: Artifact): Promise<Buffer> {
    const { s3_key, s3_bucket, s3_region } = artifact.metadata!;

    console.log(`Retrieving file from S3: s3://${s3_bucket}/${s3_key}`);

    const s3Client = createS3Client({
      bucket: s3_bucket!,
      region: s3_region || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const buffer = await getS3Object(s3Client, s3_bucket!, s3_key!);
    return buffer;
  }

  /**
   * Get file from Supabase Storage
   */
  private async getFileFromSupabase(artifact: Artifact): Promise<Buffer> {
    console.log(
      `Retrieving file from Supabase Storage: ${artifact.file_path}`
    );

    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from('artifacts')
      .download(artifact.file_path!);

    if (error) {
      throw new Error(
        `Failed to download file from Supabase Storage: ${error.message}`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get file URL (for download/preview)
   * Returns a presigned URL that expires after specified time
   */
  async getFileUrl(
    artifact: Artifact,
    expiresIn: number = 3600
  ): Promise<string> {
    // S3 file: Generate presigned URL
    if (artifact.metadata?.s3_key && artifact.metadata?.s3_bucket) {
      return this.getS3PresignedUrl(artifact, expiresIn);
    }

    // Supabase Storage: Generate signed URL
    if (artifact.file_path) {
      return this.getSupabaseSignedUrl(artifact, expiresIn);
    }

    throw new Error(
      `Cannot generate URL: No valid storage location found for artifact ${artifact.id}`
    );
  }

  /**
   * Generate presigned URL for S3 file
   */
  private async getS3PresignedUrl(
    artifact: Artifact,
    expiresIn: number
  ): Promise<string> {
    const { s3_key, s3_bucket, s3_region } = artifact.metadata!;

    const s3Client = createS3Client({
      bucket: s3_bucket!,
      region: s3_region || process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const command = new GetObjectCommand({
      Bucket: s3_bucket!,
      Key: s3_key!,
      ResponseContentDisposition: `attachment; filename="${artifact.original_filename}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  }

  /**
   * Generate signed URL for Supabase Storage file
   */
  private async getSupabaseSignedUrl(
    artifact: Artifact,
    expiresIn: number
  ): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from('artifacts')
      .createSignedUrl(artifact.file_path!, expiresIn);

    if (error) {
      throw new Error(
        `Failed to generate signed URL: ${error.message}`
      );
    }

    return data.signedUrl;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(artifact: Artifact): Promise<FileMetadata> {
    let storageType: 's3' | 'supabase' | 'raw_content';

    if (artifact.metadata?.s3_key) {
      storageType = 's3';
    } else if (artifact.raw_content?.base64) {
      storageType = 'raw_content';
    } else {
      storageType = 'supabase';
    }

    const mimeTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      html: 'text/html',
      json: 'application/json',
      email: 'message/rfc822',
    };

    return {
      filename: artifact.original_filename,
      size: artifact.file_size || 0,
      mimeType: mimeTypeMap[artifact.artifact_type] || 'application/octet-stream',
      storageType,
    };
  }

  /**
   * Check if file is stored in S3
   */
  isS3File(artifact: Artifact): boolean {
    return !!(artifact.metadata?.s3_key && artifact.metadata?.s3_bucket);
  }

  /**
   * Check if file is stored in Supabase Storage
   */
  isSupabaseFile(artifact: Artifact): boolean {
    return !!artifact.file_path && !this.isS3File(artifact);
  }

  /**
   * Check if file content is stored in raw_content
   */
  hasRawContent(artifact: Artifact): boolean {
    return !!artifact.raw_content?.base64;
  }
}

// Singleton instance
let instance: FileStorageService | null = null;

export function getFileStorageService(): FileStorageService {
  if (!instance) {
    instance = new FileStorageService();
  }
  return instance;
}
