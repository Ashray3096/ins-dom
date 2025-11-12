-- Migration: Add 'textract' extraction method to templates
-- This enables storing Textract-based extraction rules

-- Drop the existing constraint
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_extraction_method_check;

-- Add new constraint with 'textract' included
ALTER TABLE templates
  ADD CONSTRAINT templates_extraction_method_check
  CHECK (extraction_method IN ('ai', 'visual', 'hybrid', 'textract'));

-- Update comment
COMMENT ON COLUMN templates.extraction_method IS 'Method used: ai (AI-based), visual (selector-based), hybrid (combination), or textract (AWS Textract-based)';
