-- ============================================================================
-- DIRECT SQL: Disable extracted_positions table for testing
-- ============================================================================
-- Copy and paste this entire file into Supabase SQL Editor or psql
-- ============================================================================

-- Step 1: Rename the table (makes it inaccessible)
ALTER TABLE IF EXISTS extracted_positions 
RENAME TO extracted_positions_disabled_test;

-- Step 2: Rename the compatibility view if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'extracted_positions_compat'
    ) THEN
        ALTER MATERIALIZED VIEW extracted_positions_compat 
        RENAME TO extracted_positions_compat_disabled_test;
    END IF;
END $$;

-- Step 3: Verify the table is disabled
-- Check if old table name exists (should return 0)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCESS: extracted_positions table is disabled'
        ELSE '⚠️ WARNING: Table still exists'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions';

-- Check if disabled table exists (should return 1)
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ SUCCESS: Disabled table exists'
        ELSE '⚠️ WARNING: Disabled table not found'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions_disabled_test';

-- ============================================================================
-- STATUS: Table is now disabled
-- ============================================================================
-- All queries to 'extracted_positions' will now fail
-- This allows us to test if services work with new schema only
-- ============================================================================

