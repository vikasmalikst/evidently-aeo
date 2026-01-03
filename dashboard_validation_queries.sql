-- ============================================================================
-- DASHBOARD VALIDATION QUERIES
-- ============================================================================
-- Brand ID: b1e7af2d-de46-420b-bccf-61d7ad9fde2c
-- Date filter: Last 7 days (matching dashboard default)
-- Updated to match backend logic: NULL values are excluded
-- Uses processed_at if available, otherwise created_at (matching backend)
-- 
-- IMPORTANT: 
-- 1. You may need to add customer_id filter if your backend uses it
-- 2. Clear dashboard cache or use skipCache=true to see updated values
-- 3. Update the date range below to match your exact dashboard date range
-- ============================================================================

-- ============================================================================
-- SECTION 1: LLM VISIBILITY (7 Days) TABLE
-- ============================================================================
-- Validates the "LLM Visibility (7 Days)" section on the dashboard
-- Shows: Visibility, SOA, Sentiment, Brand Presence per LLM/Collector Type
-- ============================================================================

-- Get date range for last 7 days (matching dashboard default)
-- NOTE: Update these dates to match the exact date range shown in your dashboard
-- The dashboard typically shows "Last 7 Days" which includes today
-- IMPORTANT: Update these variables to match your dashboard
-- 1. Replace 'YOUR_CUSTOMER_ID' with your actual customer_id (or remove the filter if not used)
-- 2. Update the date range to match your exact dashboard date range
WITH date_range AS (
  SELECT 
    (CURRENT_DATE - INTERVAL '6 days')::date AS start_date,  -- Last 7 days including today
    CURRENT_DATE::date AS end_date
  -- To use a specific date range, replace the above with:
  -- '2024-01-01'::date AS start_date,
  -- '2024-01-07'::date AS end_date
),
-- Check which date column has data (backend uses processed_at if available, else created_at)
date_column_check AS (
  SELECT 
    COUNT(*) FILTER (WHERE processed_at IS NOT NULL) AS processed_at_count,
    COUNT(*) FILTER (WHERE created_at IS NOT NULL) AS created_at_count
  FROM public.metric_facts
  WHERE brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
),
visibility_per_llm AS (
  SELECT 
    mf.collector_type,
    AVG(bm.visibility_index) * 100 AS visibility_index,
    COUNT(*) AS visibility_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Add customer_id filter if your backend uses it (check backend logs or API calls)
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
    AND bm.visibility_index IS NOT NULL
    -- Use processed_at if available, otherwise created_at (matching backend logic)
    AND COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date
    AND COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date
  GROUP BY mf.collector_type
),
share_per_llm AS (
  SELECT 
    mf.collector_type,
    AVG(bm.share_of_answers) AS share_of_answers,
    COUNT(bm.share_of_answers) AS records_with_share
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Add customer_id filter if your backend uses it
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
    AND bm.share_of_answers IS NOT NULL
    AND bm.share_of_answers >= 0
    -- Use processed_at if available, otherwise created_at (matching backend logic)
    AND COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date
    AND COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date
  GROUP BY mf.collector_type
),
sentiment_per_llm AS (
  SELECT 
    mf.collector_type,
    AVG(bs.sentiment_score) AS sentiment_score,
    COUNT(bs.sentiment_score) AS sentiment_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Add customer_id filter if your backend uses it
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
    AND bs.sentiment_score IS NOT NULL
    -- Use processed_at if available, otherwise created_at (matching backend logic)
    AND COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date
    AND COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date
  GROUP BY mf.collector_type
),
brand_presence_per_llm AS (
  SELECT 
    mf.collector_type,
    COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results
  FROM public.metric_facts mf
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Add customer_id filter if your backend uses it
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
    -- Use processed_at if available, otherwise created_at (matching backend logic)
    AND COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date
    AND COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date
  GROUP BY mf.collector_type
)
SELECT 
  v.collector_type AS llm,
  ROUND(v.visibility_index, 0) AS visibility,
  ROUND(s.share_of_answers, 0) AS soa,
  ROUND(st.sentiment_score, 0) AS sentiment,
  CASE 
    WHEN bp.total_collector_results > 0 
    THEN ROUND(
      (bp.collector_results_with_presence::numeric / 
       bp.total_collector_results::numeric) * 100, 
      0
    )
    ELSE 0
  END AS brand_presence,
  -- Additional metadata for validation
  v.visibility_records,
  s.records_with_share,
  st.sentiment_records,
  bp.collector_results_with_presence,
  bp.total_collector_results
FROM visibility_per_llm v
LEFT JOIN share_per_llm s ON v.collector_type = s.collector_type
LEFT JOIN sentiment_per_llm st ON v.collector_type = st.collector_type
LEFT JOIN brand_presence_per_llm bp ON v.collector_type = bp.collector_type
ORDER BY s.share_of_answers DESC NULLS LAST;

-- Debug: Check date column usage
SELECT 
  'Date Column Check' AS info,
  processed_at_count,
  created_at_count,
  CASE 
    WHEN processed_at_count > created_at_count THEN 'Using processed_at'
    WHEN created_at_count > processed_at_count THEN 'Using created_at'
    ELSE 'Both have similar counts'
  END AS recommendation
FROM date_column_check;

-- ============================================================================
-- SECTION 2: SOURCE TYPE DISTRIBUTION
-- ============================================================================
-- Validates the "Source Type Distribution" section on the dashboard
-- Shows: Percentage breakdown by citation category
-- IMPORTANT: Excludes NULL usage_count values (matching updated backend)
-- ============================================================================

WITH date_range AS (
  SELECT 
    (CURRENT_DATE - INTERVAL '6 days')::date AS start_date,
    CURRENT_DATE::date AS end_date
),
citation_data AS (
  SELECT 
    COALESCE(LOWER(TRIM(c.category)), 'other') AS category_key,
    c.usage_count
  FROM public.citations c
  INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Add customer_id filter if your backend uses it
    -- AND c.customer_id = 'YOUR_CUSTOMER_ID'
    -- Match citations date filter (backend uses created_at for citations)
    AND c.created_at >= dr.start_date
    AND c.created_at <= dr.end_date
    -- Exclude NULL usage_count values (matching updated backend logic)
    AND c.usage_count IS NOT NULL
    AND c.usage_count > 0
),
category_totals AS (
  SELECT 
    category_key,
    SUM(usage_count) AS total_usage,
    COUNT(*) AS citation_count
  FROM citation_data
  GROUP BY category_key
),
total_citations AS (
  SELECT SUM(total_usage) AS grand_total
  FROM category_totals
)
SELECT 
  CASE 
    WHEN ct.category_key = 'other' THEN 'Other'
    WHEN ct.category_key = 'editorial' THEN 'Editorial'
    WHEN ct.category_key = 'corporate' THEN 'Corporate'
    WHEN ct.category_key = 'ugc' THEN 'UGC'
    WHEN ct.category_key = 'social' THEN 'Social'
    WHEN ct.category_key = 'institutional' THEN 'Institutional'
    WHEN ct.category_key = 'reference' THEN 'Reference'
    WHEN ct.category_key = 'media' THEN 'Media'
    ELSE INITCAP(ct.category_key)
  END AS source_type,
  ct.citation_count,
  ct.total_usage,
  ROUND(
    (ct.total_usage::numeric / NULLIF(tc.grand_total, 0)) * 100, 
    1
  ) AS percentage
FROM category_totals ct
CROSS JOIN total_citations tc
ORDER BY ct.total_usage DESC;

-- ============================================================================
-- DETAILED BREAKDOWN QUERIES (for troubleshooting)
-- ============================================================================

-- LLM Visibility - Detailed breakdown per metric
SELECT 
  mf.collector_type AS llm,
  
  -- Visibility Index
  ROUND(AVG(bm.visibility_index) * 100, 0) AS visibility,
  COUNT(bm.visibility_index) AS visibility_records,
  ROUND(MIN(bm.visibility_index) * 100, 1) AS min_visibility,
  ROUND(MAX(bm.visibility_index) * 100, 1) AS max_visibility,
  
  -- Share of Answers (SOA) - NULLs excluded
  ROUND(AVG(bm.share_of_answers), 0) AS soa,
  COUNT(bm.share_of_answers) AS soa_records,
  COUNT(*) AS total_records,
  COUNT(*) - COUNT(bm.share_of_answers) AS records_with_null_soa,
  ROUND(MIN(bm.share_of_answers), 1) AS min_soa,
  ROUND(MAX(bm.share_of_answers), 1) AS max_soa,
  
  -- Sentiment Score
  ROUND(AVG(bs.sentiment_score), 0) AS sentiment,
  COUNT(bs.sentiment_score) AS sentiment_records,
  ROUND(MIN(bs.sentiment_score), 1) AS min_sentiment,
  ROUND(MAX(bs.sentiment_score), 1) AS max_sentiment,
  
  -- Brand Presence
  COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
  COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
  CASE 
    WHEN COUNT(DISTINCT mf.collector_result_id) > 0 
    THEN ROUND(
      (COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END)::numeric / 
       COUNT(DISTINCT mf.collector_result_id)::numeric) * 100, 
      0
    )
    ELSE 0
  END AS brand_presence,
  
  -- Additional counts
  COUNT(DISTINCT mf.query_id) AS total_queries,
  COUNT(*) AS total_rows

FROM public.metric_facts mf
LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
GROUP BY mf.collector_type
ORDER BY AVG(bm.share_of_answers) DESC NULLS LAST;

-- Source Type Distribution - Detailed breakdown
SELECT 
  COALESCE(LOWER(TRIM(c.category)), 'other') AS category_key,
  COUNT(*) AS total_citations,
  COUNT(CASE WHEN c.usage_count IS NULL THEN 1 END) AS citations_with_null_usage,
  COUNT(CASE WHEN c.usage_count IS NOT NULL AND c.usage_count > 0 THEN 1 END) AS citations_with_valid_usage,
  SUM(CASE WHEN c.usage_count IS NOT NULL AND c.usage_count > 0 THEN c.usage_count ELSE 0 END) AS total_usage,
  MIN(c.usage_count) AS min_usage_count,
  MAX(c.usage_count) AS max_usage_count
FROM public.citations c
INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
GROUP BY COALESCE(LOWER(TRIM(c.category)), 'other')
ORDER BY total_usage DESC;

-- ============================================================================
-- COMBINED VALIDATION (All KPIs + LLM Visibility + Source Distribution)
-- ============================================================================

WITH 
-- Main KPIs
visibility_data AS (
  SELECT 
    AVG(bm.visibility_index) * 100 AS visibility_index_percentage,
    COUNT(*) AS visibility_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND bm.visibility_index IS NOT NULL
),
share_data AS (
  SELECT 
    AVG(bm.share_of_answers) AS share_of_answers_percentage,
    COUNT(bm.share_of_answers) AS share_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND bm.share_of_answers IS NOT NULL
    AND bm.share_of_answers >= 0
),
sentiment_data AS (
  SELECT 
    AVG(bs.sentiment_score) AS sentiment_score_average,
    COUNT(bs.sentiment_score) AS sentiment_records
  FROM public.metric_facts mf
  INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND bs.sentiment_score IS NOT NULL
),
presence_data AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN bm.has_brand_presence = true THEN mf.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT mf.collector_result_id) AS total_collector_results
  FROM public.metric_facts mf
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
),
source_distribution_data AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN c.usage_count IS NOT NULL AND c.usage_count > 0 THEN c.category END) AS categories_with_data,
    SUM(CASE WHEN c.usage_count IS NOT NULL AND c.usage_count > 0 THEN c.usage_count ELSE 0 END) AS total_citation_usage
  FROM public.citations c
  INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
)
SELECT 
  -- Main KPIs
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
  
  -- Source Distribution Summary
  sdd.categories_with_data,
  sdd.total_citation_usage,
  
  -- Record counts
  vd.visibility_records,
  sd.share_records,
  st.sentiment_records,
  pd.collector_results_with_presence,
  pd.total_collector_results

FROM visibility_data vd
CROSS JOIN share_data sd
CROSS JOIN sentiment_data st
CROSS JOIN presence_data pd
CROSS JOIN source_distribution_data sdd;

