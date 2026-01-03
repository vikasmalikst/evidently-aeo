-- ============================================================================
-- COMBINED DASHBOARD KPI VALIDATION QUERY
-- ============================================================================
-- This query validates ALL 4 main KPIs in a single execution
-- Brand ID: 32b3dc03-fe6b-40e6-94ac-9a146ceca60d
-- 
-- IMPORTANT: Update the date range below to match your dashboard exactly!
-- Dashboard shows: "Dec 05, 2025 - Jan 03, 2026"
-- ============================================================================

WITH date_range AS (
  -- UPDATE THESE DATES to match your dashboard's exact date range
  SELECT 
    '2025-12-05'::date AS start_date,  -- Dec 05, 2025
    '2026-01-03'::date AS end_date     -- Jan 03, 2026
  -- To use all historical data (no date filter), comment out the above and use:
  -- SELECT NULL::date AS start_date, NULL::date AS end_date
),
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
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND bm.visibility_index IS NOT NULL
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Optional: Add customer filter (check backend logs to see if this is used)
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- 2. SHARE OF ANSWERS: Average of share_of_answers (0-100 scale)
-- IMPORTANT: Backend now EXCLUDES NULL values (doesn't convert to 0)
-- This matches SQL AVG() behavior which excludes NULLs automatically
share_data AS (
  SELECT 
    AVG(bm.share_of_answers) AS share_of_answers_percentage,
    COUNT(*) AS share_records,
    COUNT(bm.share_of_answers) AS records_with_share,
    COUNT(*) - COUNT(bm.share_of_answers) AS records_with_null_share,
    MIN(bm.share_of_answers) AS min_share,
    MAX(bm.share_of_answers) AS max_share
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND bm.share_of_answers IS NOT NULL  -- Exclude NULLs (matching backend logic)
    AND bm.share_of_answers >= 0
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Optional: Add customer filter (check backend logs to see if this is used)
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
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND bs.sentiment_score IS NOT NULL
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Optional: Add customer filter (check backend logs to see if this is used)
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- 4. BRAND PRESENCE: (Unique collector results with presence / Total unique collector results) * 100
presence_data AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results
  FROM public.metric_facts mf
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Optional: Add customer filter (check backend logs to see if this is used)
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- Additional metadata for validation
metadata AS (
  SELECT 
    COUNT(DISTINCT mf.query_id) AS total_queries,
    COUNT(DISTINCT mf.collector_type) AS total_collector_types,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
    MIN(COALESCE(mf.processed_at, mf.created_at)) AS earliest_date,
    MAX(COALESCE(mf.processed_at, mf.created_at)) AS latest_date
  FROM public.metric_facts mf
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Optional: Add customer filter (check backend logs to see if this is used)
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
-- ALTERNATIVE: Share of Answers comparison (OLD vs NEW method)
-- ============================================================================
-- Uncomment this to see the difference between OLD (including NULLs as 0) vs NEW (excluding NULLs)

/*
SELECT 
  'OLD: Including NULLs as 0 (incorrect - old dashboard behavior)' AS method,
  ROUND(AVG(COALESCE(bm.share_of_answers, 0)), 1) AS share_of_answers
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND COALESCE(bm.share_of_answers, 0) >= 0
UNION ALL
SELECT 
  'NEW: Excluding NULLs (correct - matches current backend)' AS method,
  ROUND(AVG(bm.share_of_answers), 1) AS share_of_answers
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0;
*/

