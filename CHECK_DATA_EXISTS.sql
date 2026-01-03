-- ============================================================================
-- CHECK IF DATA EXISTS FOR COLLECTOR_RESULT_IDS SHOWING 0 COUNTS
-- ============================================================================
-- Replace YOUR_COLLECTOR_RESULT_IDS with actual IDs from the UI that show 0 counts

-- Step 1: Check if metric_facts rows exist
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  cr.created_at,
  mf.id AS metric_fact_id,
  mf.processed_at,
  CASE 
    WHEN mf.id IS NULL THEN '❌ NO metric_facts row'
    ELSE '✅ HAS metric_facts row'
  END AS metric_facts_status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS SHOWING 0 COUNTS
  123, 456, 789
)
ORDER BY cr.id;

-- Step 2: If metric_facts exists, check brand_metrics
SELECT 
  cr.id AS collector_result_id,
  mf.id AS metric_fact_id,
  bm.id AS brand_metrics_id,
  bm.total_brand_mentions,
  bm.total_brand_product_mentions,
  CASE 
    WHEN mf.id IS NULL THEN '❌ NO metric_facts'
    WHEN bm.id IS NULL THEN '❌ NO brand_metrics (but metric_facts exists!)'
    WHEN bm.total_brand_mentions IS NULL THEN '⚠️ brand_mentions is NULL'
    WHEN bm.total_brand_mentions = 0 THEN '⚠️ brand_mentions is 0'
    ELSE '✅ HAS brand_mentions data'
  END AS status
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
ORDER BY cr.id;

-- Step 3: Check competitor_metrics
SELECT 
  cr.id AS collector_result_id,
  mf.id AS metric_fact_id,
  COUNT(cm.id) AS competitor_metrics_count,
  COALESCE(SUM(cm.competitor_mentions), 0) AS total_competitor_mentions
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
GROUP BY cr.id, mf.id
ORDER BY cr.id;

-- Step 4: COMPLETE CHECK - Simulate what Supabase should return
SELECT 
  cr.id AS collector_result_id,
  cr.collector_type,
  -- What Supabase nested query should return:
  mf.id AS metric_fact_id,
  bm.total_brand_mentions AS expected_brand_mentions,
  bm.total_brand_product_mentions AS expected_product_mentions,
  COALESCE(SUM(cm.competitor_mentions), 0) AS expected_competitor_mentions,
  -- Status
  CASE 
    WHEN mf.id IS NULL THEN '❌ Supabase will return metric_facts: []'
    WHEN bm.id IS NULL THEN '❌ Supabase will return brand_metrics: []'
    WHEN bm.total_brand_mentions IS NULL AND bm.total_brand_product_mentions IS NULL 
         AND COALESCE(SUM(cm.competitor_mentions), 0) = 0 
    THEN '⚠️ Supabase will return data but all counts are NULL/0'
    ELSE '✅ Supabase should return correct data'
  END AS expected_supabase_result
FROM collector_results cr
LEFT JOIN metric_facts mf ON mf.collector_result_id = cr.id
LEFT JOIN brand_metrics bm ON bm.metric_fact_id = mf.id
LEFT JOIN competitor_metrics cm ON cm.metric_fact_id = mf.id
WHERE cr.id IN (
  -- REPLACE WITH YOUR COLLECTOR_RESULT_IDS
  123, 456, 789
)
GROUP BY cr.id, cr.collector_type, mf.id, bm.total_brand_mentions, bm.total_brand_product_mentions
ORDER BY cr.id;

