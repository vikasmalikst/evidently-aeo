-- ============================================================================
-- Restore extracted_positions table and prepare for backfill
-- ============================================================================
-- This script handles the case where both tables exist:
-- - extracted_positions (empty)
-- - extracted_positions_disabled_test (has historical data)
-- ============================================================================

-- Step 1: Drop the empty extracted_positions table if it exists and is empty
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    -- Check if extracted_positions exists and is empty
    SELECT COUNT(*) INTO row_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'extracted_positions';
    
    IF row_count > 0 THEN
        -- Check actual row count
        EXECUTE 'SELECT COUNT(*) FROM public.extracted_positions' INTO row_count;
        
        IF row_count = 0 THEN
            RAISE NOTICE 'Dropping empty extracted_positions table...';
            DROP TABLE IF EXISTS public.extracted_positions CASCADE;
        ELSE
            RAISE NOTICE 'extracted_positions has % rows, keeping it', row_count;
        END IF;
    END IF;
END $$;

-- Step 2: Restore the table (rename disabled_test back to extracted_positions)
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
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ SUCCESS: extracted_positions table is restored'
        ELSE '⚠️ WARNING: Table not found'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'extracted_positions';

-- Step 4: Check row count
SELECT 
    'Row Count' as check_type,
    COUNT(*) as total_rows,
    MIN(processed_at) as earliest_date,
    MAX(processed_at) as latest_date
FROM public.extracted_positions;

