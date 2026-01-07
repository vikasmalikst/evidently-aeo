-- ============================================================================
-- TEST QUERIES: Simulate the exact database calls for LLM-wise counts
-- ============================================================================
-- Replace the placeholders with your actual values:
--   - YOUR_BRAND_ID: Your brand UUID
--   - YOUR_CUSTOMER_ID: Your customer UUID (optional)
--   - YOUR_COLLECTOR_RESULT_IDS: Array of collector_result_id integers
--   - YOUR_QUERY_IDS: Array of query_id UUIDs (optional)

-- ============================================================================
-- QUERY 1: Brand, Product, Competitor Counts
-- ============================================================================
-- This matches the query in optimized-metrics.helper.ts (lines 1262-1313)

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
  COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
  COALESCE(SUM(cm.total_competitor_product_mentions), 0) AS total_competitor_product_mentions,
  ARRAY_AGG(DISTINCT bc.competitor_name) FILTER (WHERE bc.competitor_name IS NOT NULL) AS competitor_names,
  -- Status indicators
  CASE 
    WHEN mf.id IS NULL THEN '❌ MISSING metric_facts'
    WHEN bm.id IS NULL THEN '❌ MISSING brand_metrics'
    WHEN bm.total_brand_mentions IS NULL AND bm.total_brand_product_mentions IS NULL 
         AND COALESCE(SUM(cm.competitor_mentions), 0) = 0 THEN '⚠️ All counts NULL/0'
    ELSE '✅ HAS data'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN brand_sentiment bs ON bs.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
LEFT JOIN brand_competitors bc ON cm.competitor_id = bc.id
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- REPLACE
  AND (cr.customer_id = 'YOUR_CUSTOMER_ID' OR 'YOUR_CUSTOMER_ID' IS NULL)  -- REPLACE (optional)
  -- When testing with specific collector_result_ids (matches actual query behavior):
  AND cr.id IN (123, 456, 789)  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  -- OR when testing with query_ids:
  -- AND cr.query_id IN ('uuid-1', 'uuid-2')  -- REPLACE WITH YOUR QUERY_IDS
  -- OR when testing with date range (only if collectorResultIds NOT provided):
  -- AND cr.created_at >= '2025-12-05'::timestamp
  -- AND cr.created_at <= '2026-01-03'::timestamp
GROUP BY 
  cr.id, 
  cr.query_id, 
  cr.collector_type, 
  cr.created_at,
  mf.id,
  mf.processed_at,
  bm.visibility_index,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  bs.sentiment_score
ORDER BY cr.id;

-- ============================================================================
-- QUERY 2: Keywords Count
-- ============================================================================
-- This matches the query in prompts-analytics.service.ts (lines 619-649)

-- Query 2A: By query_id
SELECT 
  query_id,
  collector_result_id,
  COUNT(*) AS keyword_count,
  ARRAY_AGG(keyword) AS keywords
FROM generated_keywords
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE
  AND customer_id = 'YOUR_CUSTOMER_ID'  -- REPLACE
  AND query_id IN ('uuid-1', 'uuid-2')  -- REPLACE WITH YOUR QUERY_IDS
GROUP BY query_id, collector_result_id
ORDER BY collector_result_id;

-- Query 2B: By collector_result_id
SELECT 
  collector_result_id,
  COUNT(*) AS keyword_count,
  ARRAY_AGG(keyword) AS keywords
FROM generated_keywords
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE
  AND customer_id = 'YOUR_CUSTOMER_ID'  -- REPLACE
  AND collector_result_id IN (123, 456, 789)  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
GROUP BY collector_result_id
ORDER BY collector_result_id;

-- ============================================================================
-- COMBINED QUERY: All counts in one result (for easy verification)
-- ============================================================================

SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  -- Brand/Product counts
  COALESCE(bm.total_brand_mentions, 0) AS brand_mentions,
  COALESCE(bm.total_brand_product_mentions, 0) AS product_mentions,
  -- Competitor counts (SUMMED)
  COALESCE(competitor_data.total_competitor_mentions, 0) AS competitor_mentions,
  COALESCE(competitor_data.total_competitor_product_mentions, 0) AS competitor_product_mentions,
  -- Keywords count
  COALESCE(keyword_data.keyword_count, 0) AS keyword_count,
  -- Status
  CASE 
    WHEN mf.id IS NULL THEN '❌ No metric_facts'
    WHEN bm.id IS NULL THEN '❌ No brand_metrics'
    WHEN COALESCE(bm.total_brand_mentions, 0) = 0 
         AND COALESCE(bm.total_brand_product_mentions, 0) = 0
         AND COALESCE(competitor_data.total_competitor_mentions, 0) = 0
         AND COALESCE(keyword_data.keyword_count, 0) = 0
    THEN '⚠️ All counts are 0'
    ELSE '✅ Has data'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN LATERAL (
  SELECT 
    COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions,
    COALESCE(SUM(cm.total_competitor_product_mentions), 0) AS total_competitor_product_mentions
  FROM competitor_metrics cm
  WHERE cm.metric_fact_id = mf.id
) competitor_data ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS keyword_count
  FROM generated_keywords gk
  WHERE gk.collector_result_id = cr.id
    AND gk.brand_id = cr.brand_id
) keyword_data ON true
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- REPLACE
  AND (cr.customer_id = 'YOUR_CUSTOMER_ID' OR 'YOUR_CUSTOMER_ID' IS NULL)  -- REPLACE (optional)
  AND cr.id IN (123, 456, 789)  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
ORDER BY cr.id;

-- ============================================================================
-- QUICK CHECK: Find collector_result_ids that should have data but show 0
-- ============================================================================

SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.created_at,
  mf.id AS has_metric_facts,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  COALESCE(SUM(cm.competitor_mentions), 0) AS competitor_mentions,
  (SELECT COUNT(*) FROM generated_keywords WHERE collector_result_id = cr.id) AS keyword_count
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.brand_id = 'YOUR_BRAND_ID'  -- REPLACE
  AND (
    mf.id IS NULL  -- Missing metric_facts
    OR bm.id IS NULL  -- Missing brand_metrics
    OR (bm.total_brand_mentions IS NULL OR bm.total_brand_mentions = 0)
    OR (bm.total_brand_product_mentions IS NULL OR bm.total_brand_product_mentions = 0)
  )
GROUP BY cr.id, cr.collector_type, cr.created_at, mf.id, bm.total_brand_mentions, bm.total_brand_product_mentions
ORDER BY cr.created_at DESC
LIMIT 20;

