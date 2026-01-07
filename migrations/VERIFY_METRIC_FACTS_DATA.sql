-- ============================================================================
-- VERIFICATION QUERIES: Check if metric_facts has data for collector_result_ids
-- ============================================================================
-- Replace YOUR_COLLECTOR_RESULT_IDS with actual IDs showing 0 counts
-- Replace YOUR_BRAND_ID with the brand ID you're testing

-- ============================================================================
-- 1. Check if metric_facts rows exist for collector_result_ids
-- ============================================================================
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.created_at AS collector_created_at,
  mf.id AS metric_fact_id,
  mf.processed_at AS metric_processed_at,
  CASE 
    WHEN mf.id IS NULL THEN '❌ MISSING metric_facts'
    ELSE '✅ HAS metric_facts'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
ORDER BY cr.id;

-- ============================================================================
-- 2. Check if brand_metrics exists and has counts
-- ============================================================================
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  mf.id AS metric_fact_id,
  bm.id AS brand_metrics_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  CASE 
    WHEN mf.id IS NULL THEN '❌ MISSING metric_facts'
    WHEN bm.id IS NULL THEN '❌ MISSING brand_metrics'
    WHEN bm.total_brand_mentions IS NULL THEN '⚠️ brand_mentions is NULL'
    WHEN bm.total_brand_mentions = 0 THEN '⚠️ brand_mentions is 0'
    ELSE '✅ HAS counts'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
ORDER BY cr.id;

-- ============================================================================
-- 3. Check competitor_metrics and SUM competitor mentions
-- ============================================================================
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  mf.id AS metric_fact_id,
  COUNT(cm.id) AS competitor_metrics_count,
  COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
  COALESCE(SUM(cm.total_competitor_product_mentions), 0) AS total_competitor_product_mentions,
  STRING_AGG(bc.competitor_name, ', ') AS competitor_names
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
LEFT JOIN brand_competitors bc ON cm.competitor_id = bc.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
GROUP BY cr.id, cr.collector_type, mf.id
ORDER BY cr.id;

-- ============================================================================
-- 4. COMPLETE DATA CHECK: All counts in one query (matches what query should return)
-- ============================================================================
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.created_at,
  mf.id AS metric_fact_id,
  mf.processed_at,
  -- Brand metrics
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  -- Competitor metrics (SUMMED)
  COALESCE(competitor_summary.total_competitor_mentions, 0) AS total_competitor_mentions,
  COALESCE(competitor_summary.total_competitor_product_mentions, 0) AS total_competitor_product_mentions,
  competitor_summary.competitor_names,
  -- Status
  CASE 
    WHEN mf.id IS NULL THEN '❌ MISSING metric_facts'
    WHEN bm.id IS NULL THEN '❌ MISSING brand_metrics'
    WHEN bm.total_brand_mentions IS NULL AND bm.total_brand_product_mentions IS NULL 
         AND COALESCE(competitor_summary.total_competitor_mentions, 0) = 0 THEN '⚠️ All counts are NULL/0'
    ELSE '✅ HAS data'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN LATERAL (
  SELECT 
    COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
    COALESCE(SUM(cm.total_competitor_product_mentions), 0) AS total_competitor_product_mentions,
    STRING_AGG(bc.competitor_name, ', ') AS competitor_names
  FROM competitor_metrics cm
  LEFT JOIN brand_competitors bc ON cm.competitor_id = bc.id
  WHERE cm.metric_fact_id = mf.id
) competitor_summary ON true
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
ORDER BY cr.id;

-- ============================================================================
-- 5. Check date filter impact (if dates are being used)
-- ============================================================================
-- This shows which collector_results would be excluded by date filters
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.created_at,
  mf.processed_at,
  CASE 
    WHEN cr.created_at < '2025-12-05'::timestamp THEN '❌ BEFORE startDate (would be excluded)'
    WHEN cr.created_at > '2026-01-03'::timestamp THEN '❌ AFTER endDate (would be excluded)'
    ELSE '✅ Within date range'
  END AS date_filter_status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
ORDER BY cr.id;

-- ============================================================================
-- 6. Simulate the actual Supabase query structure
-- ============================================================================
-- This mimics what the optimized-metrics.helper.ts query should return
SELECT 
  cr.id AS collector_result_id,
  cr.query_id,
  cr.collector_type,
  cr.created_at,
  -- From metric_facts
  mf.id AS metric_fact_id,
  mf.processed_at,
  -- From brand_metrics
  bm.visibility_index,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  -- From brand_sentiment
  bs.sentiment_score,
  -- From competitor_metrics (aggregated)
  COALESCE(competitor_data.total_competitor_mentions, 0) AS competitor_count,
  COALESCE(competitor_data.total_competitor_product_mentions, 0) AS competitor_product_count,
  competitor_data.competitor_names,
  -- Status check
  CASE 
    WHEN mf.id IS NULL THEN '❌ No metric_facts'
    WHEN bm.id IS NULL THEN '❌ No brand_metrics'
    WHEN bm.total_brand_mentions IS NULL AND bm.total_brand_product_mentions IS NULL 
         AND COALESCE(competitor_data.total_competitor_mentions, 0) = 0 THEN '⚠️ All NULL/0'
    ELSE '✅ Has data'
  END AS query_result_status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN brand_sentiment bs ON bs.metric_fact_id = mf.id
LEFT JOIN LATERAL (
  SELECT 
    COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
    COALESCE(SUM(cm.total_competitor_product_mentions), 0) AS total_competitor_product_mentions,
    ARRAY_AGG(bc.competitor_name) FILTER (WHERE bc.competitor_name IS NOT NULL) AS competitor_names
  FROM competitor_metrics cm
  LEFT JOIN brand_competitors bc ON cm.competitor_id = bc.id
  WHERE cm.metric_fact_id = mf.id
) competitor_data ON true
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
ORDER BY cr.id;

-- ============================================================================
-- 7. Find collector_result_ids that have metric_facts but show 0 counts
-- ============================================================================
-- Use this to find IDs that should have data but don't
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.created_at,
  mf.id AS metric_fact_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
  CASE 
    WHEN mf.id IS NOT NULL 
         AND bm.id IS NOT NULL 
         AND (bm.total_brand_mentions = 0 OR bm.total_brand_mentions IS NULL)
         AND (bm.total_brand_product_mentions = 0 OR bm.total_brand_product_mentions IS NULL)
         AND COALESCE(SUM(cm.competitor_mentions), 0) = 0
    THEN '⚠️ Has metric_facts but all counts are 0'
    ELSE '✅ OK'
  END AS issue_status
FROM collector_results cr
INNER JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- REPLACE
  AND cr.customer_id = 'YOUR_CUSTOMER_ID'  -- REPLACE (optional)
GROUP BY cr.id, cr.collector_type, cr.created_at, mf.id, bm.total_brand_mentions, bm.total_brand_product_mentions
HAVING (
  bm.total_brand_mentions = 0 OR bm.total_brand_mentions IS NULL
) AND (
  bm.total_brand_product_mentions = 0 OR bm.total_brand_product_mentions IS NULL
) AND (
  COALESCE(SUM(cm.competitor_mentions), 0) = 0
)
ORDER BY cr.created_at DESC
LIMIT 20;

