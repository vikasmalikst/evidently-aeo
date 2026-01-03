-- ============================================================================
-- COMBINED DASHBOARD KPI VALIDATION QUERY
-- ============================================================================
-- This query validates ALL 4 main KPIs in a single execution
-- Brand ID: 32b3dc03-fe6b-40e6-94ac-9a146ceca60d
-- No date range filter - includes all historical data
-- ============================================================================

WITH
-- 1. VISIBILITY INDEX: Average of visibility_index (0-1 scale) * 100
visibility_data AS (
  SELECT 
    AVG(bm.visibility_index) * 100 AS visibility_index_percentage,
    COUNT(*) AS visibility_records,
    COUNT(bm.visibility_index) AS records_with_visibility,
    MIN(bm.visibility_index) * 100 AS min_visibility,
    MAX(bm.visibility_index) * 100 AS max_visibility
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND bm.visibility_index IS NOT NULL
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- 2. SHARE OF ANSWERS: Average of share_of_answers (0-100 scale)
-- NOTE: Dashboard converts NULL to 0, so we use COALESCE to match
share_data AS (
  SELECT 
    AVG(COALESCE(bm.share_of_answers, 0)) AS share_of_answers_percentage,
    COUNT(*) AS share_records,
    COUNT(bm.share_of_answers) AS records_with_share,
    COUNT(*) - COUNT(bm.share_of_answers) AS records_with_null_share,
    MIN(COALESCE(bm.share_of_answers, 0)) AS min_share,
    MAX(COALESCE(bm.share_of_answers, 0)) AS max_share
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND COALESCE(bm.share_of_answers, 0) >= 0
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- 3. SENTIMENT SCORE: Average of sentiment_score (1-100 scale)
sentiment_data AS (
  SELECT 
    AVG(bs.sentiment_score) AS sentiment_score_average,
    COUNT(*) AS sentiment_records,
    COUNT(bs.sentiment_score) AS records_with_sentiment,
    MIN(bs.sentiment_score) AS min_sentiment,
    MAX(bs.sentiment_score) AS max_sentiment
  FROM public.metric_facts mf
  INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    AND bs.sentiment_score IS NOT NULL
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- 4. BRAND PRESENCE: (Unique collector results with presence / Total unique collector results) * 100
presence_data AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results
  FROM public.metric_facts mf
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- Additional metadata for validation
metadata AS (
  SELECT 
    COUNT(DISTINCT mf.query_id) AS total_queries,
    COUNT(DISTINCT mf.collector_type) AS total_collector_types,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
    MIN(mf.processed_at) AS earliest_date,
    MAX(mf.processed_at) AS latest_date
  FROM public.metric_facts mf
  WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
)
-- Final output: All KPIs in one row
SELECT 
  -- KPI Values (should match dashboard)
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
  
  -- Record counts for validation
  vd.visibility_records,
  vd.records_with_visibility,
  sd.share_records,
  sd.records_with_share,
  sd.records_with_null_share,
  st.sentiment_records,
  st.records_with_sentiment,
  pd.collector_results_with_presence,
  pd.total_collector_results,
  
  -- Min/Max ranges
  vd.min_visibility,
  vd.max_visibility,
  sd.min_share,
  sd.max_share,
  st.min_sentiment,
  st.max_sentiment,
  
  -- Metadata
  md.total_queries,
  md.total_collector_types,
  md.total_collector_results AS total_collector_results_metadata,
  md.earliest_date,
  md.latest_date,
  
  -- NULL impact analysis for Share of Answers
  CASE 
    WHEN sd.share_records > 0 
    THEN ROUND((sd.records_with_null_share::numeric / sd.share_records::numeric) * 100, 1)
    ELSE 0
  END AS pct_null_share_values

FROM visibility_data vd
CROSS JOIN share_data sd
CROSS JOIN sentiment_data st
CROSS JOIN presence_data pd
CROSS JOIN metadata md;

-- ============================================================================
-- ALTERNATIVE: Share of Answers with NULLs EXCLUDED (for comparison)
-- ============================================================================
-- Uncomment this to see the difference between including vs excluding NULLs
/*
SELECT 
  'Including NULLs (Dashboard method)' AS method,
  ROUND(AVG(COALESCE(bm.share_of_answers, 0)), 1) AS share_of_answers
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND COALESCE(bm.share_of_answers, 0) >= 0
UNION ALL
SELECT 
  'Excluding NULLs (SQL method)' AS method,
  ROUND(AVG(bm.share_of_answers), 1) AS share_of_answers
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0;
*/

