/**
 * Extraction Type Definitions
 *
 * Extraction runs, results, and corrections
 */

export type ExtractionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CORRECTED';

export interface Extraction {
  id: string;
  source_file_id: string;
  template_id?: string;
  status: ExtractionStatus;
  started_at: string;
  completed_at?: string;
  records_extracted: number;
  accuracy_score?: number;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  duration_seconds: number;
  error_message?: string;
  created_by: string;
}

export interface CreateExtractionInput {
  source_file_id: string;
  template_id?: string;
}

export interface UpdateExtractionInput {
  status?: ExtractionStatus;
  completed_at?: string;
  records_extracted?: number;
  accuracy_score?: number;
  cost?: number;
  input_tokens?: number;
  output_tokens?: number;
  duration_seconds?: number;
  error_message?: string;
}

/**
 * Extracted record (raw data)
 */
export interface ExtractedRecord {
  id: string;
  extraction_id: string;
  record_index: number;
  data: Record<string, any>;
  is_corrected: boolean;
  created_at: string;
}

export interface CreateExtractedRecordInput {
  extraction_id: string;
  record_index: number;
  data: Record<string, any>;
}

/**
 * Correction applied to extracted data
 */
export type CorrectionType = 'FIELD_VALUE' | 'FIELD_TYPE' | 'MISSING_FIELD' | 'EXTRA_FIELD' | 'DUPLICATE_RECORD';

export interface Correction {
  id: string;
  extraction_id: string;
  record_id: string;
  field_name: string;
  correction_type: CorrectionType;
  original_value?: any;
  corrected_value?: any;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface CreateCorrectionInput {
  extraction_id: string;
  record_id: string;
  field_name: string;
  correction_type: CorrectionType;
  original_value?: any;
  corrected_value?: any;
  notes?: string;
}

/**
 * Extraction statistics
 */
export interface ExtractionStats {
  total_extractions: number;
  successful_extractions: number;
  failed_extractions: number;
  total_records: number;
  total_cost: number;
  average_accuracy: number;
  average_duration: number;
}

/**
 * Extraction run metadata
 */
export interface ExtractionMetadata {
  model: string;
  max_tokens: number;
  temperature: number;
  file_size_bytes: number;
  file_type: string;
  prompt_version?: number;
}
