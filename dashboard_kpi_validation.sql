-- ============================================================================
-- DASHBOARD KPI VALIDATION QUERIES
-- ============================================================================
-- Replace placeholders:
--   YOUR_BRAND_ID: UUID of the brand
--   YOUR_CUSTOMER_ID: UUID of the customer (optional)
--   START_DATE: '2024-01-01T00:00:00Z' (ISO format)
--   END_DATE: '2024-01-31T23:59:59Z' (ISO format)
-- ============================================================================

-- ============================================================================
-- 1. VISIBILITY INDEX (Visibility Score)
-- ============================================================================
-- Expected: Percentage (0-100), rounded to 1 decimal place
SELECT 
  ROUND(AVG(bm.visibility_index) * 100, 1) AS visibility_index_percentage,
  COUNT(*) AS total_records,
  COUNT(bm.visibility_index) AS records_with_visibility,
  MIN(bm.visibility_index) * 100 AS min_visibility,
  MAX(bm.visibility_index) * 100 AS max_visibility
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.visibility_index IS NOT NULL;

-- ============================================================================
-- 2. SHARE OF ANSWERS
-- ============================================================================
-- Expected: Percentage (0-100), rounded to 1 decimal place
-- 
-- IMPORTANT: The dashboard calculates SOA in two ways:
-- Method 1 (Simple Average): Average of all share_of_answers values (what this query does)
-- Method 2 (Query-Level Average): Average per query first, then average those averages
-- 
-- The dashboard uses Method 1 (simple average) as per payload-builder.ts lines 1117-1124
-- If your values don't match, try Method 2 query below

-- Method 1: Simple Average (matches dashboard default calculation)
SELECT 
  ROUND(AVG(bm.share_of_answers), 1) AS share_of_answers_percentage,
  COUNT(*) AS total_records,
  COUNT(bm.share_of_answers) AS records_with_share,
  MIN(bm.share_of_answers) AS min_share,
  MAX(bm.share_of_answers) AS max_share
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0;

-- Method 2: Query-Level Average (average per query, then average those averages)
-- Use this if Method 1 doesn't match the dashboard
WITH query_level_averages AS (
  SELECT 
    mf.query_id,
    AVG(bm.share_of_answers) AS avg_share_per_query,
    COUNT(*) AS records_per_query
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bm.share_of_answers IS NOT NULL
    AND bm.share_of_answers >= 0
  GROUP BY mf.query_id
)
SELECT 
  ROUND(AVG(avg_share_per_query), 1) AS share_of_answers_percentage,
  COUNT(*) AS total_queries,
  SUM(records_per_query) AS total_records
FROM query_level_averages;

-- ============================================================================
-- 3. SENTIMENT SCORE
-- ============================================================================
-- Expected: Score (1-100), rounded to 2 decimal places
-- Note: If sentiment is stored in -1 to 1 format, use the conversion query below
SELECT 
  ROUND(AVG(bs.sentiment_score), 2) AS sentiment_score_average,
  COUNT(*) AS total_records,
  COUNT(bs.sentiment_score) AS records_with_sentiment,
  MIN(bs.sentiment_score) AS min_sentiment,
  MAX(bs.sentiment_score) AS max_sentiment
FROM public.metric_facts mf
INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bs.sentiment_score IS NOT NULL;

-- Alternative: If sentiment is stored in -1 to 1 format (convert to 1-100)
-- SELECT 
--   ROUND(AVG((bs.sentiment_score + 1) * 50), 2) AS sentiment_score_average,
--   COUNT(*) AS total_records
-- FROM public.metric_facts mf
-- INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
-- WHERE mf.brand_id = 'YOUR_BRAND_ID'
--   AND mf.processed_at >= 'START_DATE'
--   AND mf.processed_at <= 'END_DATE'
--   AND bs.sentiment_score IS NOT NULL;

-- ============================================================================
-- 4. BRAND PRESENCE PERCENTAGE
-- ============================================================================
-- Expected: Percentage (0-100), rounded to 1 decimal place
WITH collector_results_with_presence AS (
  SELECT DISTINCT mf.collector_result_id
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bm.has_brand_presence = true
),
total_collector_results AS (
  SELECT DISTINCT mf.collector_result_id
  FROM public.metric_facts mf
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
)
SELECT 
  COUNT(DISTINCT crp.collector_result_id) AS collector_results_with_presence,
  COUNT(DISTINCT tcr.collector_result_id) AS total_collector_results,
  CASE 
    WHEN COUNT(DISTINCT tcr.collector_result_id) > 0 
    THEN ROUND(
      (COUNT(DISTINCT crp.collector_result_id)::numeric / 
       COUNT(DISTINCT tcr.collector_result_id)::numeric) * 100, 
      1
    )
    ELSE 0
  END AS brand_presence_percentage
FROM total_collector_results tcr
LEFT JOIN collector_results_with_presence crp 
  ON tcr.collector_result_id = crp.collector_result_id;

-- ============================================================================
-- 5. COMBINED VALIDATION (All KPIs at Once)
-- ============================================================================
WITH visibility_data AS (
  SELECT 
    AVG(bm.visibility_index) * 100 AS visibility_index_percentage,
    COUNT(*) AS visibility_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bm.visibility_index IS NOT NULL
),
share_data AS (
  -- Simple average (matches dashboard default)
  SELECT 
    AVG(bm.share_of_answers) AS share_of_answers_percentage,
    COUNT(*) AS share_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bm.share_of_answers IS NOT NULL
    AND bm.share_of_answers >= 0
),
sentiment_data AS (
  SELECT 
    AVG(bs.sentiment_score) AS sentiment_score_average,
    COUNT(*) AS sentiment_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bs.sentiment_score IS NOT NULL
),
presence_data AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results
  FROM public.metric_facts mf
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
)
SELECT 
  ROUND(vd.visibility_index_percentage, 1) AS visibility_index,
  ROUND(sd.share_of_answers_percentage, 1) AS share_of_answers,
  ROUND(st.sentiment_score_average, 2) AS sentiment_score,
  CASE 
    WHEN pd.total_collector_results > 0 
    THEN ROUND(
      (pd.collector_results_with_presence::numeric / 
       pd.total_collector_results::numeric) * 100, 
      1
    )
    ELSE 0
  END AS brand_presence_percentage,
  vd.visibility_records,
  sd.share_records,
  st.sentiment_records,
  pd.collector_results_with_presence,
  pd.total_collector_results
FROM visibility_data vd
CROSS JOIN share_data sd
CROSS JOIN sentiment_data st
CROSS JOIN presence_data pd;

-- ============================================================================
-- 6. DATE RANGE HELPER
-- ============================================================================
-- Find the date range of available data for a brand
SELECT 
  MIN(mf.processed_at) AS earliest_date,
  MAX(mf.processed_at) AS latest_date,
  COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
  COUNT(DISTINCT mf.query_id) AS total_queries
FROM public.metric_facts mf
WHERE mf.brand_id = 'YOUR_BRAND_ID';

-- ============================================================================
-- 7. DETAILED BREAKDOWN BY COLLECTOR TYPE
-- ============================================================================
SELECT 
  mf.collector_type,
  COUNT(DISTINCT mf.collector_result_id) AS collector_results,
  ROUND(AVG(bm.visibility_index) * 100, 1) AS avg_visibility_index,
  ROUND(AVG(bm.share_of_answers), 1) AS avg_share_of_answers,
  ROUND(AVG(bs.sentiment_score), 2) AS avg_sentiment_score,
  COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS results_with_presence
FROM public.metric_facts mf
LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
GROUP BY mf.collector_type
ORDER BY collector_results DESC;

-- ============================================================================
-- 8. WITH CUSTOMER ID FILTER (if needed)
-- ============================================================================
-- Add this condition to any query above:
--   AND mf.customer_id = 'YOUR_CUSTOMER_ID'

-- ============================================================================
-- 9. WITH COLLECTOR TYPE FILTER (if needed)
-- ============================================================================
-- Add this condition to any query above:
--   AND mf.collector_type IN ('ChatGPT', 'Claude', 'Gemini', ...)

-- ============================================================================
-- 10. DIAGNOSTIC QUERY - Why SOA differs
-- ============================================================================
-- Use this to diagnose why Share of Answers might differ between SQL and dashboard
-- This shows breakdown by collector type, date, and query to identify discrepancies

-- Check 1: Breakdown by Collector Type
SELECT 
  mf.collector_type,
  COUNT(*) AS record_count,
  ROUND(AVG(bm.share_of_answers), 1) AS avg_share,
  MIN(bm.share_of_answers) AS min_share,
  MAX(bm.share_of_answers) AS max_share
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0
GROUP BY mf.collector_type
ORDER BY record_count DESC;

-- Check 2: Breakdown by Date (to see if date range is the issue)
SELECT 
  DATE(mf.processed_at) AS date,
  COUNT(*) AS record_count,
  ROUND(AVG(bm.share_of_answers), 1) AS avg_share
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0
GROUP BY DATE(mf.processed_at)
ORDER BY date DESC;

-- Check 3: Query-level breakdown (to see if some queries skew the average)
SELECT 
  mf.query_id,
  COUNT(*) AS collector_results_count,
  ROUND(AVG(bm.share_of_answers), 1) AS avg_share_per_query,
  MIN(bm.share_of_answers) AS min_share,
  MAX(bm.share_of_answers) AS max_share
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0
GROUP BY mf.query_id
ORDER BY collector_results_count DESC
LIMIT 20;

-- Check 4: Compare simple average vs query-level average
WITH simple_avg AS (
  SELECT AVG(bm.share_of_answers) AS value
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bm.share_of_answers IS NOT NULL
    AND bm.share_of_answers >= 0
),
query_level_avg AS (
  SELECT AVG(avg_share) AS value
  FROM (
    SELECT mf.query_id, AVG(bm.share_of_answers) AS avg_share
    FROM public.metric_facts mf
    INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
    WHERE mf.brand_id = 'YOUR_BRAND_ID'
      AND mf.processed_at >= 'START_DATE'
      AND mf.processed_at <= 'END_DATE'
      AND bm.share_of_answers IS NOT NULL
      AND bm.share_of_answers >= 0
    GROUP BY mf.query_id
  ) subq
)
SELECT 
  ROUND(sa.value, 1) AS simple_average,
  ROUND(qla.value, 1) AS query_level_average,
  ROUND(ABS(sa.value - qla.value), 1) AS difference
FROM simple_avg sa
CROSS JOIN query_level_avg qla;

