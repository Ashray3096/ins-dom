/**
 * Provider Type Definitions
 *
 * Data providers (NABCA, TTB, etc.) and their source files
 */

export type ProviderType = 'NABCA' | 'TTB' | 'CUSTOM';

export type ProviderCadence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ADHOC';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  description?: string;
  cadence: ProviderCadence;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateProviderInput {
  name: string;
  type: ProviderType;
  description?: string;
  cadence: ProviderCadence;
}

export interface UpdateProviderInput {
  name?: string;
  description?: string;
  cadence?: ProviderCadence;
}

export type SourceFileType = 'PDF' | 'HTML' | 'EMAIL' | 'MSG' | 'CSV' | 'EXCEL';

export type SourceFileStatus = 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'ERROR';

export interface SourceFile {
  id: string;
  provider_id: string;
  name: string;
  type: SourceFileType;
  status: SourceFileStatus;
  file_size: number;
  storage_path: string;
  upload_date: string;
  period?: string; // e.g., "2024-01", "Q1-2024"
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
}

export interface CreateSourceFileInput {
  provider_id: string;
  name: string;
  type: SourceFileType;
  file_size: number;
  storage_path: string;
  period?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSourceFileInput {
  status?: SourceFileStatus;
  metadata?: Record<string, any>;
}

/**
 * Provider configuration for common data sources
 */
export const PROVIDER_CONFIGS = {
  NABCA: {
    name: 'NABCA',
    type: 'NABCA' as ProviderType,
    description: 'National Alcoholic Beverage Control Association - Monthly distilled spirits reports',
    cadence: 'MONTHLY' as ProviderCadence,
    expectedFileType: 'PDF' as SourceFileType
  },
  TTB: {
    name: 'TTB',
    type: 'TTB' as ProviderType,
    description: 'Alcohol and Tobacco Tax and Trade Bureau - Annual/quarterly data',
    cadence: 'ANNUAL' as ProviderCadence,
    expectedFileType: 'PDF' as SourceFileType
  }
} as const;
