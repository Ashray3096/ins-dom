-- Migration: Update templates table for Universal Architecture
-- Date: 2024-01-10
-- Purpose: Make templates source-independent with pattern-based extraction configs

-- Existing columns in templates table:
-- id, provider_id, name, description, prompt, fields, status, version,
-- created_at, updated_at, created_by, selectors, corrections,
-- extraction_method, artifact_type, sample_artifact_id

-- Add new columns for universal templates (only if they don't exist)
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS extraction_strategy TEXT,
  ADD COLUMN IF NOT EXISTS strategy_config JSONB DEFAULT '{}'::JSONB;

-- Note: sample_artifact_id and description already exist, no need to add

-- If extraction_method exists and extraction_strategy doesn't have values,
-- we can optionally migrate data (uncomment if needed):
-- UPDATE templates SET extraction_strategy = extraction_method WHERE extraction_strategy IS NULL;

-- Add foreign key for sample_artifact_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'templates_sample_artifact_id_fkey'
  ) THEN
    ALTER TABLE templates
      ADD CONSTRAINT templates_sample_artifact_id_fkey
      FOREIGN KEY (sample_artifact_id)
      REFERENCES artifacts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add check constraint for extraction_strategy (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'templates_extraction_strategy_check'
  ) THEN
    ALTER TABLE templates
      ADD CONSTRAINT templates_extraction_strategy_check
      CHECK (extraction_strategy IN (
        'dom_selection',
        'table_detection',
        'json_path',
        'key_value',
        'ocr_text',
        'ai_extraction'
      ));
  END IF;
END $$;

-- Add index for faster template queries
CREATE INDEX IF NOT EXISTS idx_templates_extraction_strategy
  ON templates(extraction_strategy);

CREATE INDEX IF NOT EXISTS idx_templates_sample_artifact_id
  ON templates(sample_artifact_id);

-- Add comments to explain the schema
COMMENT ON COLUMN templates.extraction_strategy IS 'Extraction strategy used for all fields in this template (dom_selection, table_detection, json_path, key_value, ocr_text, ai_extraction)';
COMMENT ON COLUMN templates.strategy_config IS 'Strategy-level configuration in JSONB format (e.g., table matching rules, OCR service config, AI model settings)';
COMMENT ON COLUMN templates.sample_artifact_id IS 'Reference to the sample artifact used to create this template (for documentation and testing)';
COMMENT ON COLUMN templates.extraction_method IS 'Legacy extraction method column - may be replaced by extraction_strategy';
COMMENT ON COLUMN templates.selectors IS 'Legacy selectors column - replaced by template_fields.extraction_config';
COMMENT ON COLUMN templates.fields IS 'Legacy fields column - replaced by template_fields table with field_library references';

-- Update template_fields table (should already have extraction_config from Phase 1)
-- Add comment to clarify usage
COMMENT ON COLUMN template_fields.extraction_config IS 'Field-specific extraction configuration (CSS selector, table column, JSONPath, prompt, etc.)';

-- Create a view for easy querying of templates with field details
CREATE OR REPLACE VIEW template_details AS
SELECT
  t.id as template_id,
  t.name as template_name,
  t.extraction_strategy,
  t.strategy_config,
  t.sample_artifact_id,
  a.original_filename as sample_file,
  a.artifact_type as sample_type,
  COUNT(tf.id) as field_count,
  json_agg(
    json_build_object(
      'field_id', tf.field_id,
      'field_name', fl.name,
      'field_label', fl.label,
      'field_type', fl.field_type,
      'extraction_config', tf.extraction_config,
      'display_order', tf.display_order
    ) ORDER BY tf.display_order
  ) as fields
FROM templates t
LEFT JOIN artifacts a ON a.id = t.sample_artifact_id
LEFT JOIN template_fields tf ON tf.template_id = t.id
LEFT JOIN field_library fl ON fl.id = tf.field_id
GROUP BY t.id, t.name, t.extraction_strategy, t.strategy_config,
         t.sample_artifact_id, a.original_filename, a.artifact_type;

COMMENT ON VIEW template_details IS 'Complete template information with fields and sample artifact details';
