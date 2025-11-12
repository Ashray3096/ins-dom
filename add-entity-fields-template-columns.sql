-- Add missing columns to entity_fields table for NABCA template support
-- These columns store the connection between entity fields and template fields

-- Add template_id column (which template this field came from)
ALTER TABLE entity_fields
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id);

-- Add template_field_path column (path to find this field in the template)
ALTER TABLE entity_fields
ADD COLUMN IF NOT EXISTS template_field_path TEXT;

-- Add mapping_type column (how to map this field)
ALTER TABLE entity_fields
ADD COLUMN IF NOT EXISTS mapping_type TEXT CHECK (mapping_type IN ('DIRECT', 'TRANSFORM', 'COMPUTED'));

-- Add metadata column (stores nabca_section and other field-specific metadata)
ALTER TABLE entity_fields
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index on template_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_entity_fields_template_id ON entity_fields(template_id);

-- Create index on metadata for JSONB queries
CREATE INDEX IF NOT EXISTS idx_entity_fields_metadata ON entity_fields USING GIN(metadata);

-- Add comments
COMMENT ON COLUMN entity_fields.template_id IS 'Template this field was imported from';
COMMENT ON COLUMN entity_fields.template_field_path IS 'Path to find this field in the template (e.g., selectors.sections.Brand Leaders.fields.brand)';
COMMENT ON COLUMN entity_fields.mapping_type IS 'How to map this field: DIRECT (1:1), TRANSFORM (with logic), COMPUTED (calculated)';
COMMENT ON COLUMN entity_fields.metadata IS 'Additional metadata like nabca_section, validation rules, etc.';
