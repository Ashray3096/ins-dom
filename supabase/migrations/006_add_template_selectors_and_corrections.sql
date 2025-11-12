-- Migration: Add selectors and corrections columns to templates table
-- This enables storing extraction rules and user corrections for template learning

-- Add new columns to templates table
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS selectors JSONB,
  ADD COLUMN IF NOT EXISTS corrections JSONB,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT DEFAULT 'ai' CHECK (extraction_method IN ('ai', 'visual', 'hybrid')),
  ADD COLUMN IF NOT EXISTS artifact_type TEXT CHECK (artifact_type IN ('pdf', 'html', 'email', 'json')),
  ADD COLUMN IF NOT EXISTS sample_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN templates.selectors IS 'CSS selectors and XPath rules for visual extraction';
COMMENT ON COLUMN templates.corrections IS 'User corrections from AI extraction to improve template accuracy';
COMMENT ON COLUMN templates.extraction_method IS 'Method used: ai (AI-based), visual (selector-based), or hybrid';
COMMENT ON COLUMN templates.artifact_type IS 'Type of artifact this template works with';
COMMENT ON COLUMN templates.sample_artifact_id IS 'Reference to the artifact used to create this template';

-- Example selectors structure:
-- {
--   "fields": {
--     "product_name": {
--       "cssSelector": ".product > .name",
--       "xpath": "//div[@class='product']/span[@class='name']",
--       "sampleValue": "Jack Daniels"
--     }
--   }
-- }

-- Example corrections structure:
-- {
--   "corrections": {
--     "0": { "price": true },
--     "1": { "quantity": true }
--   },
--   "originalData": [...],
--   "correctedData": [...],
--   "statistics": {
--     "totalFields": 20,
--     "correctedFields": 3,
--     "correctedRows": 2,
--     "correctionRate": 15
--   }
-- }
