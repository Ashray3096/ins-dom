/**
 * Artifact Type Definitions
 *
 * Based on spec section 3: Database Schema - Artifacts Table
 */

export type ArtifactType = 'pdf' | 'html' | 'email' | 'json';
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Artifact {
  id: string;
  source_id: string; // References sources table (not providers directly)
  artifact_type: ArtifactType;
  file_path: string | null;
  file_size: number | null;
  original_filename: string;
  raw_content: any | null; // JSONB for structured content
  metadata: ArtifactMetadata | null;
  extraction_status: ExtractionStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  // Nested relationship: artifact -> source -> provider
  source?: {
    id: string;
    name: string;
    source_type: string;
    provider?: {
      id: string;
      name: string;
      type: string;
    };
  };
}

export interface ArtifactMetadata {
  mime_type?: string;
  page_count?: number;
  file_type?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  encoding?: string;
  [key: string]: any; // Allow additional metadata
}

export interface ArtifactUploadData {
  source_id: string; // Must reference a source, not provider directly
  artifact_type: ArtifactType;
  original_filename: string;
  file_size: number;
  file_path: string;
  metadata?: ArtifactMetadata;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  artifact?: Artifact;
  error?: string;
}
