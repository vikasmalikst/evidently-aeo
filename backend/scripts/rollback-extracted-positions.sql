-- ============================================================================
-- Rollback Script: Restore extracted_positions table
-- ============================================================================
-- This script restores the extracted_positions table if tests reveal issues
--
-- USAGE:
--   Run this if you need to restore the table after testing
-- ============================================================================

-- Step 1: Restore the table
ALTER TABLE IF EXISTS extracted_positions_disabled_test 
RENAME TO extracted_positions;

-- Step 2: Restore the compatibility view if it exists
ALTER MATERIALIZED VIEW IF EXISTS extracted_positions_compat_disabled_test 
RENAME TO extracted_positions_compat;

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm table is restored)
-- ============================================================================

-- Check if table exists with original name (should return 1 row)
SELECT COUNT(*) as table_restored
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions';

-- ============================================================================
-- STATUS: Table is now restored
-- ============================================================================

