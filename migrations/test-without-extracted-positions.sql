-- ============================================================================
-- Test Script: Disable extracted_positions table for testing
-- ============================================================================
-- This script temporarily renames the extracted_positions table to simulate
-- it being dropped, allowing us to test if all services work with new schema only.
--
-- USAGE:
--   1. Run this script to disable the table
--   2. Run your tests
--   3. Run the rollback script to restore if needed
-- ============================================================================

-- Step 1: Rename the table (makes it inaccessible)
ALTER TABLE IF EXISTS extracted_positions 
RENAME TO extracted_positions_disabled_test;

-- Step 2: Rename the compatibility view if it exists
ALTER MATERIALIZED VIEW IF EXISTS extracted_positions_compat 
RENAME TO extracted_positions_compat_disabled_test;

-- Step 3: Verify the table is inaccessible
-- (Try to query it - should fail)
-- SELECT * FROM extracted_positions LIMIT 1; -- This should fail

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm table is disabled)
-- ============================================================================

-- Check if table exists with old name (should return 0 rows)
SELECT COUNT(*) as old_table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions';

-- Check if disabled table exists (should return 1 row)
SELECT COUNT(*) as disabled_table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions_disabled_test';

-- ============================================================================
-- STATUS: Table is now disabled
-- ============================================================================
-- All queries to 'extracted_positions' will now fail
-- This allows us to test if services work with new schema only
-- ============================================================================

