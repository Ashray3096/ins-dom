/**
 * File Upload Utilities
 *
 * Handles uploading files to Supabase Storage with validation and progress tracking
 */

import { createClient } from '@/lib/supabase/client';
import type { ArtifactType, ArtifactMetadata } from '@/types/artifacts';

// File upload constraints
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: {
    pdf: ['application/pdf'],
    html: ['text/html', 'application/xhtml+xml'],
    email: ['message/rfc822', 'application/vnd.ms-outlook'], // .eml, .msg
    json: ['application/json'],
  },
  ALLOWED_EXTENSIONS: {
    pdf: ['.pdf'],
    html: ['.html', '.htm'],
    email: ['.eml', '.msg'],
    json: ['.json'],
  },
} as const;

export interface UploadOptions {
  providerId: string;
  file: File;
  onProgress?: (progress: number) => void;
}

export interface UploadSuccess {
  success: true;
  filePath: string;
  publicUrl: string;
  artifactType: ArtifactType;
  metadata: ArtifactMetadata;
}

export interface UploadError {
  success: false;
  error: string;
}

export type UploadResult = UploadSuccess | UploadError;

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string; artifactType?: ArtifactType } {
  // Check file size
  if (file.size > UPLOAD_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${UPLOAD_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  // Determine artifact type from file extension and MIME type
  const extension = getFileExtension(file.name).toLowerCase();
  const mimeType = file.type.toLowerCase();

  let artifactType: ArtifactType | null = null;

  // Check PDF
  if (
    UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.pdf.includes(extension) ||
    UPLOAD_CONSTRAINTS.ALLOWED_TYPES.pdf.includes(mimeType)
  ) {
    artifactType = 'pdf';
  }
  // Check HTML
  else if (
    UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.html.includes(extension) ||
    UPLOAD_CONSTRAINTS.ALLOWED_TYPES.html.includes(mimeType)
  ) {
    artifactType = 'html';
  }
  // Check Email
  else if (
    UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.email.includes(extension) ||
    UPLOAD_CONSTRAINTS.ALLOWED_TYPES.email.includes(mimeType)
  ) {
    artifactType = 'email';
  }
  // Check JSON
  else if (
    UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.json.includes(extension) ||
    UPLOAD_CONSTRAINTS.ALLOWED_TYPES.json.includes(mimeType)
  ) {
    artifactType = 'json';
  }

  if (!artifactType) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: PDF, HTML, Email (.eml, .msg)`,
    };
  }

  return {
    valid: true,
    artifactType,
  };
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { providerId, file, onProgress } = options;

  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error!,
    };
  }

  try {
    const supabase = createClient();
    const artifactType = validation.artifactType!;

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const sanitizedFileName = sanitizeFileName(file.name);
    const filePath = `${providerId}/${timestamp}-${randomId}/${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('artifacts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: `Failed to upload file: ${error.message}`,
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('artifacts')
      .getPublicUrl(filePath);

    // Build metadata
    const metadata: ArtifactMetadata = {
      mime_type: file.type,
      file_type: artifactType,
      original_size: file.size,
      uploaded_at: new Date().toISOString(),
    };

    // Report completion
    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      filePath: data.path,
      publicUrl: urlData.publicUrl,
      artifactType,
      metadata,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase.storage
      .from('artifacts')
      .remove([filePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return {
        success: false,
        error: `Failed to delete file: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot);
}

/**
 * Sanitize filename to remove unsafe characters
 */
function sanitizeFileName(filename: string): string {
  // Remove or replace unsafe characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 255); // Limit length
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on artifact type
 */
export function getFileIcon(artifactType: ArtifactType): string {
  const icons = {
    pdf: '📄',
    html: '🌐',
    email: '📧',
    json: '📋',
  };
  return icons[artifactType] || '📎';
}
