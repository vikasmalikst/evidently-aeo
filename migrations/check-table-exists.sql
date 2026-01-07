-- Quick check: Does extracted_positions table exist and have data?
SELECT 
  'Table Exists Check' as check_type,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'extracted_positions'
  ) as table_exists;

-- Check if table was renamed
SELECT 
  'Renamed Table Check' as check_type,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%extracted_positions%'
ORDER BY table_name;

-- Check row count (if table exists)
SELECT 
  'Row Count' as check_type,
  COUNT(*) as total_rows
FROM public.extracted_positions;

-- Check date range (if table exists and has data)
SELECT 
  'Date Range' as check_type,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date,
  COUNT(DISTINCT collector_result_id) as unique_collector_results
FROM public.extracted_positions;

