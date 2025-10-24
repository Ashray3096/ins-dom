/**
 * Template Type Definitions
 *
 * Extraction templates for reusable prompts and field schemas
 */

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface TemplateField {
  name: string;
  description: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  example?: string;
}

export interface Template {
  id: string;
  provider_id?: string;
  name: string;
  description?: string;
  prompt: string;
  fields: TemplateField[];
  status: TemplateStatus;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateTemplateInput {
  provider_id?: string;
  name: string;
  description?: string;
  prompt: string;
  fields: TemplateField[];
  status?: TemplateStatus;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  prompt?: string;
  fields?: TemplateField[];
  status?: TemplateStatus;
}

/**
 * Template version for tracking changes
 */
export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  prompt: string;
  fields: TemplateField[];
  created_at: string;
  created_by: string;
  change_notes?: string;
}

/**
 * Pre-built templates for common extraction patterns
 */
export const TEMPLATE_PRESETS = {
  NABCA_SPIRITS: {
    name: 'NABCA Distilled Spirits Report',
    description: 'Extract brand sales data from NABCA monthly reports',
    prompt: `Extract ALL data from ALL tables in this document.

For each table row, extract:
- brand_name: The brand or product name
- bottle_size: The bottle size (keep original format like "1.75L", "750ml")
- case_sales_ytd: Year-to-date case sales (number)
- case_sales_12m: Rolling 12-month case sales (number)
- category: Product category if mentioned

Extract EVERY row from EVERY table. Include all brands and all size categories.
Return as a JSON array with these exact field names.`,
    fields: [
      {
        name: 'brand_name',
        description: 'The brand or product name',
        type: 'string' as const,
        required: true,
        example: 'TITO HANDMADE VODKA-CLASSIC-DOM'
      },
      {
        name: 'bottle_size',
        description: 'The bottle size (keep original format)',
        type: 'string' as const,
        required: true,
        example: '9L'
      },
      {
        name: 'case_sales_ytd',
        description: 'Year-to-date case sales',
        type: 'number' as const,
        required: true,
        example: '2109668'
      },
      {
        name: 'case_sales_12m',
        description: 'Rolling 12-month case sales',
        type: 'number' as const,
        required: true,
        example: '3775466'
      },
      {
        name: 'category',
        description: 'Product category',
        type: 'string' as const,
        required: false,
        example: 'VODKA-CLASSIC-DOM'
      }
    ]
  }
} as const;
