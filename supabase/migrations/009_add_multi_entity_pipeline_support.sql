-- Migration: Add multi-entity pipeline support
-- Allows a single pipeline to target multiple entities (e.g., NABCA 8 tables)

-- Add columns to pipelines table
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_entities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_multi_entity BOOLEAN DEFAULT false;

-- Create index for entity lookups
CREATE INDEX IF NOT EXISTS idx_pipelines_entity ON pipelines(entity_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_multi_entity ON pipelines(is_multi_entity) WHERE is_multi_entity = true;

-- Add check constraint: either entity_id OR target_entities must be set (but not both)
ALTER TABLE pipelines
  ADD CONSTRAINT pipelines_entity_check CHECK (
    (entity_id IS NOT NULL AND is_multi_entity = false) OR
    (entity_id IS NULL AND is_multi_entity = true AND array_length(target_entities, 1) > 0) OR
    (entity_id IS NULL AND is_multi_entity = false AND array_length(target_entities, 1) = 0)
  );

-- Comments
COMMENT ON COLUMN pipelines.entity_id IS 'Single target entity for standard pipelines (mutually exclusive with target_entities)';
COMMENT ON COLUMN pipelines.target_entities IS 'Array of entity names for multi-entity pipelines (e.g., NABCA 8 tables)';
COMMENT ON COLUMN pipelines.is_multi_entity IS 'True if pipeline targets multiple entities; uses target_entities array instead of entity_id';
