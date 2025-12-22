-- ============================================================================
-- Refresh Materialized View
-- ============================================================================
-- Run this after Phase 2 backfill completes to populate the materialized view
-- ============================================================================

-- Refresh the materialized view (this may take a few seconds to minutes depending on data size)
REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;

-- Verify the materialized view has data
SELECT 
  'Materialized View Row Count' as check_name,
  COUNT(*)::text || ' rows' as result,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ SUCCESS'
    ELSE '⚠️ No data (this is OK if no data was backfilled)'
  END as status
FROM mv_brand_daily_metrics;

-- Show sample data (first 10 rows)
SELECT 
  brand_id,
  collector_type,
  metric_date,
  avg_visibility_index,
  avg_share_of_answers,
  total_queries,
  total_mentions
FROM mv_brand_daily_metrics
ORDER BY metric_date DESC, brand_id, collector_type
LIMIT 10;

