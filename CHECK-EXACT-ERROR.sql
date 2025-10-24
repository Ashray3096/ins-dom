-- ============================================================================
-- EXACT ERROR CHECKER
-- This will show you EXACTLY what's wrong
-- ============================================================================

-- 1. Does source_id column exist?
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✓ source_id column EXISTS'
        ELSE '✗ source_id column MISSING - Run migration 005!'
    END as source_id_status
FROM information_schema.columns
WHERE table_name = 'artifacts' AND column_name = 'source_id';

-- 2. Does provider_id column still exist?
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '⚠ provider_id still exists (should be removed after migration)'
        ELSE '✓ provider_id removed'
    END as provider_id_status
FROM information_schema.columns
WHERE table_name = 'artifacts' AND column_name = 'provider_id';

-- 3. Check policies reference the right columns
SELECT
    policyname,
    cmd,
    CASE
        WHEN with_check LIKE '%source_id%' OR qual LIKE '%source_id%' THEN '✓ Uses source_id'
        WHEN with_check LIKE '%provider_id%' OR qual LIKE '%provider_id%' THEN '✗ Uses provider_id (WRONG!)'
        ELSE '? Check manually'
    END as policy_check
FROM pg_policies
WHERE tablename = 'artifacts'
ORDER BY cmd;

-- 4. Show the ACTUAL INSERT policy
SELECT
    policyname,
    with_check as insert_policy_logic
FROM pg_policies
WHERE tablename = 'artifacts'
AND cmd = 'INSERT';

-- 5. Check if you have a source to test with
SELECT
    s.id as source_id,
    s.name as source_name,
    s.source_type,
    p.name as provider_name,
    s.created_by,
    auth.uid() as your_user_id,
    CASE
        WHEN s.created_by = auth.uid() THEN '✓ You own this source'
        ELSE '✗ You do NOT own this source'
    END as ownership
FROM sources s
JOIN providers p ON p.id = s.provider_id
WHERE s.created_by = auth.uid()
LIMIT 5;

-- ============================================================================
-- THE SMOKING GUN: Test the exact policy logic
-- ============================================================================

-- Get a source you own
WITH test_source AS (
    SELECT id FROM sources WHERE created_by = auth.uid() LIMIT 1
)
SELECT
    'Testing with source: ' || id as test_info
FROM test_source;

-- Test if the policy would allow this insert
WITH test_source AS (
    SELECT id FROM sources WHERE created_by = auth.uid() LIMIT 1
)
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM sources
            JOIN providers ON providers.id = sources.provider_id
            WHERE sources.id = (SELECT id FROM test_source)
            AND providers.created_by = auth.uid()
        ) THEN '✓ Policy SHOULD allow insert'
        ELSE '✗ Policy WOULD BLOCK insert'
    END as policy_test_result;

-- ============================================================================
-- SOLUTION
-- ============================================================================

SELECT '

╔════════════════════════════════════════════════════════════════╗
║                      WHAT TO DO NEXT                           ║
╚════════════════════════════════════════════════════════════════╝

If source_id column is MISSING:
  → Run DEFINITIVE-RLS-FIX.sql

If policies use provider_id:
  → Run DEFINITIVE-RLS-FIX.sql

If you have NO sources:
  → Go to /dashboard/sources and create a source first!

If everything looks correct but still fails:
  → Check browser console for the exact error
  → Look at Network tab to see what''s being sent

' as instructions;
