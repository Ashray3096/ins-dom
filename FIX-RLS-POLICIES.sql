-- ============================================================================
-- FIX: RLS Policy Error on Artifacts Upload
-- ============================================================================
-- Run this in Supabase SQL Editor to fix the RLS policy violation

-- First, check if policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'artifacts'
ORDER BY policyname;

-- Drop old policies that might be incorrectly configured
DROP POLICY IF EXISTS "Users can view their own artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can upload artifacts to their providers" ON artifacts;
DROP POLICY IF EXISTS "Users can update their artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can delete their artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can view artifacts from their sources" ON artifacts;
DROP POLICY IF EXISTS "Users can upload artifacts to their sources" ON artifacts;

-- ============================================================================
-- CREATE CORRECT POLICIES (from migration 005)
-- ============================================================================

-- SELECT: Users can view artifacts from their sources
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

-- INSERT: Users can upload artifacts to their sources
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

-- UPDATE: Users can update their artifacts
CREATE POLICY "Users can update their artifacts"
  ON artifacts FOR UPDATE
  USING (auth.uid() = created_by);

-- DELETE: Users can delete their artifacts
CREATE POLICY "Users can delete their artifacts"
  ON artifacts FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================================
-- VERIFY POLICIES WERE CREATED
-- ============================================================================

-- Check policies again
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'artifacts'
ORDER BY policyname;

-- ============================================================================
-- TEST: Check if you have providers and sources
-- ============================================================================

-- Check your providers
SELECT id, name, type, created_by FROM providers LIMIT 5;

-- Check your sources (should have file_upload sources auto-created)
SELECT id, name, source_type, provider_id, created_by FROM sources LIMIT 5;

-- If no sources exist but you have providers, the upload will create them automatically
-- But RLS must be working first!
