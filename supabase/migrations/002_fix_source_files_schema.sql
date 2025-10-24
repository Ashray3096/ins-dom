-- Fix source_files schema to enforce provider_id requirement
-- This ensures every source file belongs to a provider

-- 1. Handle any existing NULL provider_id values by creating/assigning a default provider
DO $$
DECLARE
  default_provider_id UUID;
  admin_user_id UUID;
BEGIN
  -- Check if there are any source_files with NULL provider_id
  IF EXISTS (SELECT 1 FROM source_files WHERE provider_id IS NULL) THEN

    -- Get the first user (typically the admin/owner) to own the default provider
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;

    IF admin_user_id IS NULL THEN
      RAISE EXCEPTION 'No users found. Cannot create default provider.';
    END IF;

    -- Check if "Manual Uploads" provider exists
    SELECT id INTO default_provider_id
    FROM providers
    WHERE name = 'Manual Uploads' AND type = 'CUSTOM'
    LIMIT 1;

    -- Create "Manual Uploads" provider if it doesn't exist
    IF default_provider_id IS NULL THEN
      INSERT INTO providers (name, type, description, cadence, created_by)
      VALUES (
        'Manual Uploads',
        'CUSTOM',
        'Default provider for manually uploaded files',
        'ADHOC',
        admin_user_id
      )
      RETURNING id INTO default_provider_id;

      RAISE NOTICE 'Created default "Manual Uploads" provider with id: %', default_provider_id;
    END IF;

    -- Update NULL provider_id values to the default provider
    UPDATE source_files
    SET provider_id = default_provider_id
    WHERE provider_id IS NULL;

    RAISE NOTICE 'Updated % source files with NULL provider_id to default provider',
      (SELECT COUNT(*) FROM source_files WHERE provider_id = default_provider_id);
  END IF;
END $$;

-- 2. Make provider_id NOT NULL to enforce the relationship
ALTER TABLE source_files
  ALTER COLUMN provider_id SET NOT NULL;

-- 3. Drop and recreate RLS policies with correct logic
DROP POLICY IF EXISTS "Users can view files from their providers" ON source_files;
DROP POLICY IF EXISTS "Users can upload files to their providers" ON source_files;
DROP POLICY IF EXISTS "Users can update their source files" ON source_files;
DROP POLICY IF EXISTS "Users can delete their source files" ON source_files;

-- Create new RLS policies
CREATE POLICY "Users can view files from their providers"
  ON source_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = source_files.provider_id
      AND providers.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can upload files to their providers"
  ON source_files FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_id
      AND providers.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their source files"
  ON source_files FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their source files"
  ON source_files FOR DELETE
  USING (auth.uid() = created_by);

-- 4. Update extraction_stats view to ensure it uses correct column names
DROP VIEW IF EXISTS extraction_stats;
CREATE OR REPLACE VIEW extraction_stats AS
SELECT
  e.id,
  e.source_file_id,
  e.template_id,
  e.status,
  e.records_extracted,
  e.accuracy_score,
  e.cost,
  e.duration_seconds,
  sf.filename AS file_name,
  sf.file_type AS file_type,
  sf.period AS file_period,
  p.name AS provider_name,
  t.name AS template_name,
  COUNT(c.id) AS correction_count,
  e.created_by
FROM extractions e
LEFT JOIN source_files sf ON e.source_file_id = sf.id
LEFT JOIN providers p ON sf.provider_id = p.id
LEFT JOIN templates t ON e.template_id = t.id
LEFT JOIN corrections c ON e.id = c.extraction_id
GROUP BY e.id, sf.filename, sf.file_type, sf.period, p.name, t.name;

-- 5. Add constraint to ensure file_type values are valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'source_files_file_type_check'
  ) THEN
    ALTER TABLE source_files
      ADD CONSTRAINT source_files_file_type_check
      CHECK (file_type IN ('PDF', 'HTML', 'EMAIL', 'MSG', 'CSV', 'EXCEL'));
  END IF;
END $$;

-- 6. Add constraint to ensure status values are valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'source_files_status_check'
  ) THEN
    ALTER TABLE source_files
      ADD CONSTRAINT source_files_status_check
      CHECK (status IN ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'ERROR'));
  END IF;
END $$;

-- 7. Update comments
COMMENT ON COLUMN source_files.provider_id IS 'Reference to data provider (required - every file must belong to a provider)';
COMMENT ON COLUMN source_files.source_url IS 'Public URL to access the uploaded file';

-- 8. Create index on file_type if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_source_files_file_type ON source_files(file_type);
