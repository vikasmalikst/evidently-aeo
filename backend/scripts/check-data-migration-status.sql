-- ============================================================================
-- Data Migration Status Check
-- ============================================================================
-- This script checks if data was properly migrated from extracted_positions
-- to the new optimized schema (metric_facts, brand_metrics, etc.)
-- ============================================================================

-- 1. Check date range of data in OLD schema (extracted_positions)
SELECT 
  'OLD SCHEMA (extracted_positions)' as schema_name,
  COUNT(*) as total_rows,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date,
  COUNT(DISTINCT brand_id) as unique_brands,
  COUNT(DISTINCT collector_result_id) as unique_collector_results
FROM public.extracted_positions;

-- 2. Check date range of data in NEW schema (metric_facts)
SELECT 
  'NEW SCHEMA (metric_facts)' as schema_name,
  COUNT(*) as total_rows,
  MIN(processed_at) as earliest_date,
  MAX(processed_at) as latest_date,
  COUNT(DISTINCT brand_id) as unique_brands,
  COUNT(DISTINCT collector_result_id) as unique_collector_results
FROM public.metric_facts;

-- 3. Check brand_metrics count
SELECT 
  'brand_metrics' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT metric_fact_id) as unique_metric_facts,
  MIN(created_at) as earliest_created,
  MAX(created_at) as latest_created
FROM public.brand_metrics;

-- 4. Check brand_sentiment count
SELECT 
  'brand_sentiment' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT metric_fact_id) as unique_metric_facts,
  MIN(created_at) as earliest_created,
  MAX(created_at) as latest_created
FROM public.brand_sentiment;

-- 5. Compare collector_result_ids between old and new schema
-- This shows which collector_results have been migrated
SELECT 
  'Migration Status' as check_type,
  COUNT(DISTINCT ep.collector_result_id) as in_old_schema,
  COUNT(DISTINCT mf.collector_result_id) as in_new_schema,
  COUNT(DISTINCT ep.collector_result_id) - COUNT(DISTINCT mf.collector_result_id) as not_migrated_count
FROM public.extracted_positions ep
LEFT JOIN public.metric_facts mf ON ep.collector_result_id = mf.collector_result_id;

-- 6. Check data by date ranges (last 30 days)
SELECT 
  DATE(processed_at) as date,
  COUNT(*) as rows_in_old_schema
FROM public.extracted_positions
WHERE processed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;

SELECT 
  DATE(processed_at) as date,
  COUNT(*) as rows_in_new_schema
FROM public.metric_facts
WHERE processed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- 7. Check specific brand data (replace with actual brand_id if needed)
-- This shows data availability for a specific brand
SELECT 
  'Brand Data Check' as check_type,
  b.name as brand_name,
  COUNT(DISTINCT ep.collector_result_id) as collector_results_in_old_schema,
  COUNT(DISTINCT mf.collector_result_id) as collector_results_in_new_schema,
  MIN(ep.processed_at) as earliest_in_old,
  MAX(ep.processed_at) as latest_in_old,
  MIN(mf.processed_at) as earliest_in_new,
  MAX(mf.processed_at) as latest_in_new
FROM public.brands b
LEFT JOIN public.extracted_positions ep ON b.id = ep.brand_id
LEFT JOIN public.metric_facts mf ON b.id = mf.brand_id
GROUP BY b.id, b.name
ORDER BY b.name
LIMIT 20;

-- 8. Find the cutoff date (when data starts appearing in new schema)
-- This helps identify when the migration or dual-write started
SELECT 
  'New Schema Earliest Date' as check_type,
  MIN(processed_at) as earliest_date_in_new_schema,
  DATE(MIN(processed_at)) as earliest_date_only
FROM public.metric_facts;

-- 9. Check data distribution by date in new schema (last 30 days)
-- This shows if there's a gap before the earliest date
SELECT 
  DATE(processed_at) as date,
  COUNT(*) as rows_in_new_schema,
  COUNT(DISTINCT brand_id) as unique_brands,
  COUNT(DISTINCT collector_result_id) as unique_collector_results
FROM public.metric_facts
WHERE processed_at >= (SELECT MIN(processed_at) FROM public.metric_facts) - INTERVAL '30 days'
GROUP BY DATE(processed_at)
ORDER BY date DESC;

-- 10. Compare data availability: old vs new schema by date
-- This shows which dates have data in old schema but not in new schema
SELECT 
  DATE(ep.processed_at) as date,
  COUNT(DISTINCT ep.collector_result_id) as collector_results_in_old_schema,
  COUNT(DISTINCT mf.collector_result_id) as collector_results_in_new_schema,
  COUNT(DISTINCT ep.collector_result_id) - COUNT(DISTINCT mf.collector_result_id) as missing_in_new_schema
FROM public.extracted_positions ep
LEFT JOIN public.metric_facts mf ON ep.collector_result_id = mf.collector_result_id
WHERE ep.processed_at >= NOW() - INTERVAL '60 days'
GROUP BY DATE(ep.processed_at)
HAVING COUNT(DISTINCT ep.collector_result_id) > COUNT(DISTINCT mf.collector_result_id)
ORDER BY date DESC;

