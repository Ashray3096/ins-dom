/**
 * Source Files Type Definitions
 */

export type SourceFileType = 'PDF' | 'HTML' | 'EMAIL' | 'MSG' | 'CSV' | 'EXCEL';
export type SourceFileStatus = 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'ERROR';

export interface SourceFile {
  id: string;
  provider_id: string | null;
  filename: string;
  file_type: SourceFileType;
  file_size: number | null;
  storage_path: string | null;
  source_url: string | null;
  metadata: any;
  status: SourceFileStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  provider?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface SourceFileUploadData {
  provider_id: string; // Required - every file must belong to a provider
  filename: string;
  file_type: SourceFileType;
  file_size: number;
  storage_path: string;
  source_url?: string;
  metadata?: any;
}

// ============================================================================
// SOURCE CONFIGURATIONS (Per Spec Section 3)
// Sources define WHERE data comes from (URL, S3, API, File Upload)
// ============================================================================

export type SourceType = 'url' | 's3_bucket' | 'api' | 'file_upload';

export interface Source {
  id: string;
  provider_id: string;
  name: string;
  source_type: SourceType;
  configuration: SourceConfiguration;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  provider?: {
    id: string;
    name: string;
    type: string;
  };
}

// Configuration types for different source types
export type SourceConfiguration =
  | URLSourceConfig
  | S3SourceConfig
  | APISourceConfig
  | FileUploadSourceConfig;

export interface URLSourceConfig {
  url: string;
}

export interface S3SourceConfig {
  bucket: string;
  prefix: string;
  pattern?: string; // e.g., "*.pdf"
  test_mode?: boolean;
  test_limit?: number; // Number of files to process in test mode
  region?: string;
}

export interface APISourceConfig {
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  auth_type?: 'none' | 'bearer' | 'api_key';
  auth_token?: string;
}

export interface FileUploadSourceConfig {
  upload_type: 'manual';
  allowed_types?: string[]; // e.g., ["pdf", "html"]
}

export interface SourceCreateData {
  provider_id: string;
  name: string;
  source_type: SourceType;
  configuration: SourceConfiguration;
  is_active?: boolean;
}

export interface SourceUpdateData {
  name?: string;
  configuration?: SourceConfiguration;
  is_active?: boolean;
}
