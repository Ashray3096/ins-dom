-- ============================================================================
-- DEBUG: RLS Policy Error
-- Run these queries one by one to diagnose the issue
-- ============================================================================

-- Step 1: Check if RLS is enabled on artifacts table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'artifacts';
-- Should show: rowsecurity = true

-- Step 2: Check what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'artifacts'
ORDER BY policyname;
-- Should show 4 policies

-- Step 3: Check your user ID
SELECT auth.uid();
-- Copy this UUID - you'll need it

-- Step 4: Check your providers
SELECT id, name, type, created_by
FROM providers
WHERE created_by = auth.uid();
-- Should show your providers

-- Step 5: Check your sources
SELECT id, name, source_type, provider_id, created_by
FROM sources
WHERE created_by = auth.uid();
-- Should show your sources

-- Step 6: Try to manually insert an artifact (THIS WILL LIKELY FAIL)
-- Replace the UUIDs with actual values from steps 3-5
/*
INSERT INTO artifacts (
  source_id,
  artifact_type,
  original_filename,
  file_size,
  file_path,
  extraction_status,
  created_by
) VALUES (
  'YOUR_SOURCE_ID_HERE',  -- From step 5
  'pdf',
  'test.pdf',
  1024,
  'test/test.pdf',
  'pending',
  'YOUR_USER_ID_HERE'  -- From step 3
);
*/

-- Step 7: Check if the source belongs to a provider you own
-- Replace YOUR_SOURCE_ID with actual value
/*
SELECT
  s.id as source_id,
  s.name as source_name,
  s.created_by as source_created_by,
  p.id as provider_id,
  p.name as provider_name,
  p.created_by as provider_created_by,
  auth.uid() as current_user
FROM sources s
JOIN providers p ON p.id = s.provider_id
WHERE s.id = 'YOUR_SOURCE_ID_HERE';
*/

-- Step 8: Test the RLS policy logic manually
-- Replace YOUR_SOURCE_ID with actual value
/*
SELECT EXISTS (
  SELECT 1 FROM sources
  JOIN providers ON providers.id = sources.provider_id
  WHERE sources.id = 'YOUR_SOURCE_ID_HERE'
  AND providers.created_by = auth.uid()
) as can_insert;
*/
-- Should return: can_insert = true

-- ============================================================================
-- POTENTIAL FIX: If RLS is not enabled
-- ============================================================================

-- Enable RLS if it's disabled
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POTENTIAL FIX: If policies are missing
-- ============================================================================

-- Drop and recreate policies (copy from FIX-RLS-POLICIES.sql if needed)
-- This ensures clean slate

DROP POLICY IF EXISTS "Users can view artifacts from their sources" ON artifacts;
DROP POLICY IF EXISTS "Users can upload artifacts to their sources" ON artifacts;
DROP POLICY IF EXISTS "Users can update their artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can delete their artifacts" ON artifacts;

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
-- VERIFICATION
-- ============================================================================

-- Verify policies are created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'artifacts';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'artifacts';
