/**
 * Field Library Types
 * Type definitions for reusable field definitions
 */

export type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'EMAIL' | 'URL' | 'PHONE' | 'JSON';

export type FieldClassification = 'PII' | 'PCI' | 'PHI' | 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

export interface ValidationRules {
  min?: number;
  max?: number;
  max_length?: number;
  pattern?: string;
  required?: boolean;
  [key: string]: any;
}

export interface FieldLibrary {
  id: string;

  // Basic Info
  name: string;                           // 'vendor_name', 'sales_l12m'
  label: string;                          // 'Vendor Name', 'Sales (L12M)'
  description?: string;                   // Human-readable description

  // Field Properties
  field_type: FieldType;

  // Classification & Categorization
  classification?: FieldClassification;
  category?: string;                      // 'vendor', 'sales', 'product', 'date'
  tags?: string[];                        // ['supplier', 'company', 'distributor']

  // Validation & Transformation
  validation_rules?: ValidationRules;     // JSON schema for field validation
  transformations?: string[];             // ['trim', 'uppercase', 'remove_commas']

  // Metadata
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  // Usage tracking
  usage_count?: number;                   // How many templates use this field
  last_used_at?: string;

  // Versioning
  version?: number;
  is_deprecated?: boolean;
  deprecated_reason?: string;
  replaced_by?: string;
}

export interface CreateFieldLibraryInput {
  name: string;
  label: string;
  description?: string;
  field_type: FieldType;
  classification?: FieldClassification;
  category?: string;
  tags?: string[];
  validation_rules?: ValidationRules;
  transformations?: string[];
}

export interface UpdateFieldLibraryInput {
  label?: string;
  description?: string;
  field_type?: FieldType;
  classification?: FieldClassification;
  category?: string;
  tags?: string[];
  validation_rules?: ValidationRules;
  transformations?: string[];
  is_deprecated?: boolean;
  deprecated_reason?: string;
}

export interface FieldLibraryFilters {
  category?: string;
  field_type?: FieldType;
  classification?: FieldClassification;
  search?: string;                        // Search in name, label, description, tags
  tags?: string[];
  is_deprecated?: boolean;
}

export interface TemplateField {
  id: string;
  template_id: string;
  field_id: string;

  // Extraction Configuration (strategy-specific)
  extraction_config: Record<string, any>;

  // Field-specific transformations (overrides field_library defaults)
  transformations?: string[];

  // Display order in template
  display_order: number;

  // Required field?
  is_required: boolean;

  // Metadata
  created_at?: string;
  updated_at?: string;

  // Joined field data
  field?: FieldLibrary;
}

export interface CreateTemplateFieldInput {
  template_id: string;
  field_id: string;
  extraction_config: Record<string, any>;
  transformations?: string[];
  display_order: number;
  is_required?: boolean;
}

// Common transformation functions
export const COMMON_TRANSFORMATIONS = [
  'trim',
  'uppercase',
  'lowercase',
  'remove_commas',
  'remove_percent',
  'remove_dollar_sign',
  'parse_number',
  'parse_date',
  'fix_leading_dot',
  'normalize_whitespace',
] as const;

export type TransformationFunction = typeof COMMON_TRANSFORMATIONS[number];

// Common categories
export const COMMON_CATEGORIES = [
  'date',
  'vendor',
  'product',
  'sales',
  'volume',
  'classification',
  'location',
  'comparison',
  'financial',
  'generic',
] as const;

export type CommonCategory = typeof COMMON_CATEGORIES[number];
