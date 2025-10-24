-- ============================================================================
-- DEBUG: Authentication Mismatch Issue
-- The source exists but auth.uid() doesn't match created_by
-- ============================================================================

-- STEP 1: What is YOUR user ID according to auth.uid()?
SELECT auth.uid() as your_auth_uid;

-- STEP 2: What sources exist in the database?
SELECT
    id,
    name,
    source_type,
    created_by,
    provider_id
FROM sources
ORDER BY created_at DESC
LIMIT 5;

-- STEP 3: What providers exist?
SELECT
    id,
    name,
    type,
    created_by
FROM providers
ORDER BY created_at DESC
LIMIT 5;

-- STEP 4: Do the created_by values match auth.uid()?
SELECT
    'Sources' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE created_by = auth.uid()) as owned_by_you,
    COUNT(*) FILTER (WHERE created_by != auth.uid()) as owned_by_others
FROM sources

UNION ALL

SELECT
    'Providers' as table_name,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE created_by = auth.uid()) as owned_by_you,
    COUNT(*) FILTER (WHERE created_by != auth.uid()) as owned_by_others
FROM providers;

-- STEP 5: Show the EXACT mismatch
SELECT
    s.id as source_id,
    s.name as source_name,
    s.created_by as source_created_by,
    auth.uid() as current_auth_uid,
    CASE
        WHEN s.created_by = auth.uid() THEN '✓ MATCH'
        ELSE '✗ MISMATCH - This is the problem!'
    END as status
FROM sources s
ORDER BY s.created_at DESC
LIMIT 5;

-- ============================================================================
-- THE FIX: Update created_by to match your auth.uid()
-- ============================================================================

-- UNCOMMENT THIS AFTER VERIFYING THE ISSUE:

/*
-- Fix sources
UPDATE sources
SET created_by = auth.uid()
WHERE created_by != auth.uid();

-- Fix providers (if needed)
UPDATE providers
SET created_by = auth.uid()
WHERE created_by != auth.uid();

-- Verify the fix
SELECT 'Fixed!' as status, COUNT(*) as updated_sources
FROM sources
WHERE created_by = auth.uid();
*/
