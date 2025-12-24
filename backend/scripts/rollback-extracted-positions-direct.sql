-- ============================================================================
-- DIRECT SQL: Restore extracted_positions table
-- ============================================================================
-- Copy and paste this entire file into Supabase SQL Editor or psql
-- ============================================================================

-- Step 1: Restore the table
ALTER TABLE IF EXISTS extracted_positions_disabled_test 
RENAME TO extracted_positions;

-- Step 2: Restore the compatibility view if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'extracted_positions_compat_disabled_test'
    ) THEN
        ALTER MATERIALIZED VIEW extracted_positions_compat_disabled_test 
        RENAME TO extracted_positions_compat;
    END IF;
END $$;

-- Step 3: Verify the table is restored
-- Check if original table name exists (should return 1)
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ SUCCESS: extracted_positions table is restored'
        ELSE '⚠️ WARNING: Table not found'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions';

-- ============================================================================
-- STATUS: Table is now restored
-- ============================================================================

