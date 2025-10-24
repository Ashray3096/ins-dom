-- ============================================================================
-- DEFINITIVE FIX FOR RLS ERROR
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================================

-- First, let's see what we're dealing with
DO $$
BEGIN
    RAISE NOTICE '=== CHECKING CURRENT STATE ===';
END $$;

-- Check if source_id column exists
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'artifacts'
AND column_name IN ('source_id', 'provider_id');

-- Check current policies
SELECT
    policyname,
    cmd,
    CASE
        WHEN policyname LIKE '%source%' THEN '✓ New policy'
        WHEN policyname LIKE '%provider%' THEN '✗ Old policy (wrong!)'
        ELSE '? Unknown'
    END as status
FROM pg_policies
WHERE tablename = 'artifacts'
ORDER BY policyname;

-- ============================================================================
-- STEP 1: ENSURE source_id COLUMN EXISTS
-- ============================================================================

DO $$
BEGIN
    -- Add source_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'artifacts' AND column_name = 'source_id'
    ) THEN
        ALTER TABLE artifacts ADD COLUMN source_id UUID REFERENCES sources(id) ON DELETE CASCADE;
        RAISE NOTICE '✓ Added source_id column';
    ELSE
        RAISE NOTICE '✓ source_id column already exists';
    END IF;
END $$;

-- Add index on source_id
CREATE INDEX IF NOT EXISTS idx_artifacts_source_id ON artifacts(source_id);

-- ============================================================================
-- STEP 2: DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== DROPPING OLD POLICIES ===';
END $$;

DROP POLICY IF EXISTS "Users can view their own artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can upload artifacts to their providers" ON artifacts;
DROP POLICY IF EXISTS "Users can update their artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can delete their artifacts" ON artifacts;
DROP POLICY IF EXISTS "Users can view artifacts from their sources" ON artifacts;
DROP POLICY IF EXISTS "Users can upload artifacts to their sources" ON artifacts;
DROP POLICY IF EXISTS "Users can insert artifacts to their sources" ON artifacts;
DROP POLICY IF EXISTS "Users can create artifacts for their sources" ON artifacts;

-- ============================================================================
-- STEP 3: CREATE CORRECT POLICIES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== CREATING NEW POLICIES ===';
END $$;

-- Policy 1: SELECT (View)
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

-- Policy 2: INSERT (Upload)
CREATE POLICY "Users can upload artifacts to their sources"
ON artifacts FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
        SELECT 1 FROM sources
        JOIN providers ON providers.id = sources.provider_id
        WHERE sources.id = source_id
        AND providers.created_by = auth.uid()
    )
);

-- Policy 3: UPDATE
CREATE POLICY "Users can update their artifacts"
ON artifacts FOR UPDATE
USING (auth.uid() = created_by);

-- Policy 4: DELETE
CREATE POLICY "Users can delete their artifacts"
ON artifacts FOR DELETE
USING (auth.uid() = created_by);

-- ============================================================================
-- STEP 4: VERIFY POLICIES WERE CREATED
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== VERIFICATION ===';
END $$;

SELECT
    policyname,
    cmd,
    '✓ Policy active' as status
FROM pg_policies
WHERE tablename = 'artifacts'
ORDER BY cmd, policyname;

-- ============================================================================
-- STEP 5: CHECK IF YOU HAVE DATA TO TEST WITH
-- ============================================================================

-- Your user ID
SELECT auth.uid() as your_user_id;

-- Your providers
SELECT id, name, type, created_by
FROM providers
WHERE created_by = auth.uid()
LIMIT 3;

-- Your sources
SELECT id, name, source_type, provider_id, created_by
FROM sources
WHERE created_by = auth.uid()
LIMIT 3;

-- ============================================================================
-- STEP 6: TEST THE INSERT POLICY (OPTIONAL - UNCOMMENT TO TEST)
-- ============================================================================

/*
-- Replace these with actual values from steps above
DO $$
DECLARE
    test_source_id UUID := 'YOUR_SOURCE_ID_HERE';  -- Replace with real source ID
    test_user_id UUID := auth.uid();
BEGIN
    -- Try to insert a test artifact
    INSERT INTO artifacts (
        source_id,
        artifact_type,
        original_filename,
        file_size,
        file_path,
        extraction_status,
        created_by
    ) VALUES (
        test_source_id,
        'pdf',
        'test-rls.pdf',
        1024,
        'test/test-rls.pdf',
        'pending',
        test_user_id
    );

    RAISE NOTICE '✓ Test insert succeeded! RLS is working.';

    -- Clean up test data
    DELETE FROM artifacts WHERE original_filename = 'test-rls.pdf';
    RAISE NOTICE '✓ Cleaned up test data.';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test insert failed: %', SQLERRM;
END $$;
*/

-- ============================================================================
-- FINAL STATUS
-- ============================================================================

DO $$
DECLARE
    policy_count INT;
BEGIN
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'artifacts';

    IF policy_count = 4 THEN
        RAISE NOTICE '=== SUCCESS ===';
        RAISE NOTICE '✓ All 4 policies are active';
        RAISE NOTICE '✓ RLS should now work correctly';
        RAISE NOTICE '';
        RAISE NOTICE 'Try uploading a file now!';
    ELSE
        RAISE NOTICE '=== WARNING ===';
        RAISE NOTICE '✗ Expected 4 policies but found %', policy_count;
        RAISE NOTICE 'Check the output above for errors';
    END IF;
END $$;
