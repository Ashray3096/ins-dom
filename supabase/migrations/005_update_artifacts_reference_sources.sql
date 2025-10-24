-- Update artifacts table to reference sources instead of providers
-- This aligns with spec: providers → sources → artifacts

-- ============================================================================
-- UPDATE ARTIFACTS TABLE STRUCTURE
-- ============================================================================

-- Add source_id column (allow NULL temporarily for migration)
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES sources(id) ON DELETE CASCADE;

-- For any existing artifacts that reference providers directly,
-- we'll need to create corresponding sources first
-- This is a data migration step that should be handled carefully

-- Drop the old provider_id column (after data migration)
-- Note: If you have existing data, you'll need to:
-- 1. Create a source for each artifact's provider
-- 2. Update artifact.source_id to point to that source
-- 3. Then drop provider_id

-- For now, let's make source_id required for new records
-- but keep provider_id for backward compatibility during migration
-- ALTER TABLE artifacts DROP COLUMN provider_id; -- Uncomment after data migration

-- Make source_id NOT NULL for new records (after existing data is migrated)
-- ALTER TABLE artifacts ALTER COLUMN source_id SET NOT NULL; -- Uncomment after data migration

-- Add index on source_id
CREATE INDEX IF NOT EXISTS idx_artifacts_source_id ON artifacts(source_id);

-- ============================================================================
-- UPDATE ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Drop old policies that referenced providers directly
DROP POLICY IF EXISTS "Users can view their own artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can upload artifacts to their providers" ON artifacts;
DROP POLICY IF EXISTS "Users can update their artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can delete their artifacts" ON artifacts;

-- Create new policies that work through sources
CREATE POLICY "Users can view artifacts from their sources"
  ON artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sources
      JOIN providers ON providers.id = sources.provider_id
      WHERE sources.id = artifacts.source_id
      AND providers.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can upload artifacts to their sources"
  ON artifacts FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM sources
      JOIN providers ON providers.id = sources.provider_id
      WHERE sources.id = source_id
      AND providers.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their artifacts"
  ON artifacts FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their artifacts"
  ON artifacts FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN artifacts.source_id IS 'References the source configuration that this artifact came from';

-- ============================================================================
-- DATA MIGRATION HELPER FUNCTION (OPTIONAL)
-- ============================================================================

-- This function helps migrate existing artifacts to the new structure
-- Run this if you have existing artifacts with provider_id but no source_id

CREATE OR REPLACE FUNCTION migrate_artifacts_to_sources()
RETURNS void AS $$
DECLARE
  artifact_record RECORD;
  new_source_id UUID;
BEGIN
  -- For each artifact that has provider_id but no source_id
  FOR artifact_record IN
    SELECT * FROM artifacts
    WHERE provider_id IS NOT NULL
    AND source_id IS NULL
  LOOP
    -- Check if a file_upload source already exists for this provider
    SELECT id INTO new_source_id
    FROM sources
    WHERE provider_id = artifact_record.provider_id
    AND source_type = 'file_upload'
    LIMIT 1;

    -- If no source exists, create one
    IF new_source_id IS NULL THEN
      INSERT INTO sources (
        provider_id,
        name,
        source_type,
        configuration,
        created_by
      )
      VALUES (
        artifact_record.provider_id,
        'Manual File Uploads',
        'file_upload',
        '{"upload_type": "manual"}'::jsonb,
        artifact_record.created_by
      )
      RETURNING id INTO new_source_id;
    END IF;

    -- Update the artifact to reference the source
    UPDATE artifacts
    SET source_id = new_source_id
    WHERE id = artifact_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_artifacts_to_sources() IS 'Migrates existing artifacts from provider_id to source_id by creating file_upload sources';
