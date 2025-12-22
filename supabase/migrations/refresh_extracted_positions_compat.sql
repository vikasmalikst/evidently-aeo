-- Refresh the extracted_positions_compat materialized view
-- Run this after each data collection batch to make new data visible to all services

REFRESH MATERIALIZED VIEW public.extracted_positions_compat;

-- Query to check row counts
SELECT 
  'extracted_positions_compat' as view_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT collector_result_id) as unique_collector_results,
  COUNT(*) FILTER (WHERE competitor_name IS NULL) as brand_rows,
  COUNT(*) FILTER (WHERE competitor_name IS NOT NULL) as competitor_rows,
  MIN(processed_at) as oldest_data,
  MAX(processed_at) as newest_data
FROM public.extracted_positions_compat;

