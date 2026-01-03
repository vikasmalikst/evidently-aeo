-- ============================================================================
-- DASHBOARD TOP SECTIONS VALIDATION QUERIES
-- ============================================================================
-- This file contains validation queries for:
-- 1. Top Citations Sources (Top Brand Sources)
-- 2. Top Performing Topics
-- 
-- Brand ID: Update this to match your brand
-- Date Range: Update to match your dashboard date range
-- ============================================================================

-- ============================================================================
-- SECTION 1: TOP CITATIONS SOURCES (Top Brand Sources)
-- ============================================================================
-- Validates the "Top Citations Sources" section on the dashboard
-- Shows: Domain, URL, Impact Score, Visibility, Share, Usage, Change
-- Impact Score = 20% Visibility + 20% SOA + 20% Sentiment + 20% Citations + 20% Topics
-- ============================================================================

WITH date_range AS (
  -- UPDATE THESE DATES to match your dashboard's exact date range
  SELECT 
    '2025-12-28'::date AS start_date,  -- Dec 28, 2025
    '2026-01-03'::date AS end_date     -- Jan 03, 2026
  -- To use all historical data (no date filter), comment out the above and use:
  -- SELECT NULL::date AS start_date, NULL::date AS end_date
),
-- Get all citations with valid usage_count (exclude NULLs)
citations_data AS (
  SELECT 
    c.id,
    c.domain,
    c.url,
    c.page_name,
    c.category,
    c.usage_count,
    c.collector_result_id,
    mf.brand_id,
    mf.customer_id,
    COALESCE(mf.processed_at::date, mf.created_at::date) AS metric_date
  FROM public.citations c
  INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Exclude NULL usage_count values (matching backend logic)
    AND c.usage_count IS NOT NULL
    AND c.usage_count > 0
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- Aggregate citations by domain (normalize domain: lowercase, remove www.)
domain_aggregates AS (
  SELECT 
    LOWER(TRIM(REPLACE(domain, 'www.', ''))) AS normalized_domain,
    domain AS original_domain,
    -- Get primary URL (shortest URL, usually most relevant)
    (SELECT url FROM citations_data cd2 
     WHERE LOWER(TRIM(REPLACE(cd2.domain, 'www.', ''))) = LOWER(TRIM(REPLACE(c.domain, 'www.', '')))
     ORDER BY LENGTH(cd2.url) ASC
     LIMIT 1) AS primary_url,
    -- Get page title (first non-null page_name)
    (SELECT page_name FROM citations_data cd2 
     WHERE LOWER(TRIM(REPLACE(cd2.domain, 'www.', ''))) = LOWER(TRIM(REPLACE(c.domain, 'www.', '')))
       AND cd2.page_name IS NOT NULL
     LIMIT 1) AS page_title,
    -- Total usage count (sum of all usage_count for this domain)
    SUM(c.usage_count) AS total_usage,
    -- Unique collector results citing this domain
    COUNT(DISTINCT c.collector_result_id) AS unique_collector_results,
    -- All unique URLs for this domain
    ARRAY_AGG(DISTINCT c.url) FILTER (WHERE c.url IS NOT NULL) AS all_urls,
    -- Unique topics (from metric_facts)
    COUNT(DISTINCT mf.topic) FILTER (WHERE mf.topic IS NOT NULL) AS topics_count
  FROM citations_data c
  INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
  GROUP BY 
    LOWER(TRIM(REPLACE(domain, 'www.', ''))),
    domain
),
-- Get metrics per domain (visibility, SOA, sentiment) from brand_metrics
-- Backend aggregates by collector_result_id first, then averages per domain
collector_metrics AS (
  SELECT 
    c.collector_result_id,
    LOWER(TRIM(REPLACE(c.domain, 'www.', ''))) AS normalized_domain,
    -- Get metrics per collector result (backend uses collectorBrandStats)
    AVG(bm.visibility_index) AS collector_visibility,  -- 0-1 scale
    AVG(bm.share_of_answers) FILTER (WHERE bm.share_of_answers IS NOT NULL) AS collector_share,  -- 0-100 scale, exclude NULLs
    AVG(bs.sentiment_score) FILTER (WHERE bs.sentiment_score IS NOT NULL) AS collector_sentiment  -- 1-100 scale, exclude NULLs
  FROM citations_data c
  INNER JOIN public.metric_facts mf ON c.collector_result_id = mf.collector_result_id
  LEFT JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  WHERE bm.visibility_index IS NOT NULL
  GROUP BY c.collector_result_id, LOWER(TRIM(REPLACE(c.domain, 'www.', '')))
),
-- Average metrics per domain (averaging collector-level averages)
domain_metrics AS (
  SELECT 
    normalized_domain,
    -- Average visibility (0-1 scale, will convert to 0-100)
    AVG(collector_visibility) AS avg_visibility,
    -- Average SOA (exclude NULLs - matching backend logic)
    AVG(collector_share) FILTER (WHERE collector_share IS NOT NULL) AS avg_share,
    -- Average sentiment (1-100 scale)
    AVG(collector_sentiment) FILTER (WHERE collector_sentiment IS NOT NULL) AS avg_sentiment,
    -- Count of collector results
    COUNT(DISTINCT collector_result_id) AS collector_results_count
  FROM collector_metrics
  GROUP BY normalized_domain
),
-- Calculate total collector results for mention rate
total_collector_results AS (
  SELECT COUNT(DISTINCT mf.collector_result_id) AS total_count
  FROM public.metric_facts mf
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- Calculate max values for normalization
max_values AS (
  SELECT 
    MAX(dm.avg_visibility) AS max_visibility,
    MAX(dm.avg_share) AS max_share,
    MAX(dm.avg_sentiment) AS max_sentiment,
    MAX(da.total_usage) AS max_usage,
    MAX(da.topics_count) AS max_topics
  FROM domain_aggregates da
  LEFT JOIN domain_metrics dm ON da.normalized_domain = dm.normalized_domain
)
-- Final output: Top Citations Sources
SELECT 
  da.normalized_domain AS domain,
  da.primary_url AS url,
  da.page_title AS title,
  -- Mention Rate: (unique collector results citing this source / total collector results) * 100
  ROUND(
    (da.unique_collector_results::numeric / NULLIF(tcr.total_count, 0)) * 100,
    1
  ) AS mention_rate,
  -- Impact Score: Composite of Visibility (20%), SOA (20%), Sentiment (20%), Citations (20%), Topics (20%)
  -- Visibility is 0-1 scale, convert to 0-100
  -- SOA is already 0-100 scale
  -- Sentiment is 1-100 scale (but backend normalizes to 0-100)
  ROUND(
    (LEAST(100, GREATEST(0, COALESCE(dm.avg_visibility, 0) * 100)) * 0.2) +
    (LEAST(100, GREATEST(0, COALESCE(dm.avg_share, 0))) * 0.2) +
    (LEAST(100, GREATEST(0, COALESCE(dm.avg_sentiment, 0))) * 0.2) +
    (LEAST(100, GREATEST(0, CASE WHEN mv.max_usage > 0 THEN (da.total_usage::numeric / mv.max_usage) * 100 ELSE 0 END)) * 0.2) +
    (LEAST(100, GREATEST(0, CASE WHEN mv.max_topics > 0 THEN (da.topics_count::numeric / mv.max_topics) * 100 ELSE 0 END)) * 0.2),
    1
  ) AS impact_score,
  -- Component metrics
  ROUND(COALESCE(dm.avg_visibility, 0) * 100, 1) AS visibility,  -- Convert 0-1 to 0-100
  ROUND(COALESCE(dm.avg_share, 0), 1) AS share_of_answers,
  ROUND(COALESCE(dm.avg_sentiment, 0), 2) AS sentiment,
  da.total_usage AS usage_count,
  da.topics_count,
  -- Change: NULL (would need previous period data to calculate)
  NULL::numeric AS change,
  -- Additional metadata
  da.unique_collector_results,
  array_length(da.all_urls, 1) AS total_urls
FROM domain_aggregates da
LEFT JOIN domain_metrics dm ON da.normalized_domain = dm.normalized_domain
CROSS JOIN total_collector_results tcr
CROSS JOIN max_values mv
WHERE da.total_usage > 0
ORDER BY 
  -- Sort by Impact Score (descending), then by Mention Rate as tiebreaker
  (LEAST(100, GREATEST(0, COALESCE(dm.avg_visibility, 0) * 100)) * 0.2 +
   LEAST(100, GREATEST(0, COALESCE(dm.avg_share, 0))) * 0.2 +
   LEAST(100, GREATEST(0, COALESCE(dm.avg_sentiment, 0))) * 0.2 +
   LEAST(100, GREATEST(0, CASE WHEN mv.max_usage > 0 THEN (da.total_usage::numeric / mv.max_usage) * 100 ELSE 0 END)) * 0.2 +
   LEAST(100, GREATEST(0, CASE WHEN mv.max_topics > 0 THEN (da.topics_count::numeric / mv.max_topics) * 100 ELSE 0 END)) * 0.2) DESC,
  (da.unique_collector_results::numeric / NULLIF(tcr.total_count, 0)) DESC
LIMIT 10;

-- ============================================================================
-- SECTION 2: TOP PERFORMING TOPICS
-- ============================================================================
-- Validates the "Top Performing Topics" section on the dashboard
-- Shows: Topic, Queries Tracked, Visibility, Share of Answers, Brand Presence, Sentiment
-- IMPORTANT: Excludes NULL values for SOA (matching backend logic)
-- ============================================================================

WITH date_range AS (
  -- UPDATE THESE DATES to match your dashboard's exact date range
  SELECT 
    '2025-12-28'::date AS start_date,  -- Dec 28, 2025
    '2026-01-03'::date AS end_date     -- Jan 03, 2026
  -- To use all historical data (no date filter), comment out the above and use:
  -- SELECT NULL::date AS start_date, NULL::date AS end_date
),
-- Get all metric_facts with brand metrics and topics
topic_data AS (
  SELECT 
    mf.id,
    mf.query_id,
    mf.collector_result_id,
    mf.topic,
    bm.visibility_index,
    bm.share_of_answers,
    bm.has_brand_presence,
    bs.sentiment_score,
    COALESCE(mf.processed_at::date, mf.created_at::date) AS metric_date
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  LEFT JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    -- Date filter: Use processed_at if available, otherwise created_at (matching backend)
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    AND mf.topic IS NOT NULL
    AND TRIM(mf.topic) != ''
    -- Optional: Add customer filter
    -- AND mf.customer_id = 'YOUR_CUSTOMER_ID'
),
-- Get citation usage per topic
topic_citation_usage AS (
  SELECT 
    mf.topic,
    SUM(c.usage_count) AS citation_usage
  FROM public.metric_facts mf
  INNER JOIN public.citations c ON mf.collector_result_id = c.collector_result_id
  CROSS JOIN date_range dr
  WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c'
    AND (dr.start_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) >= dr.start_date)
    AND (dr.end_date IS NULL OR COALESCE(mf.processed_at::date, mf.created_at::date) <= dr.end_date)
    AND mf.topic IS NOT NULL
    AND TRIM(mf.topic) != ''
    AND c.usage_count IS NOT NULL
    AND c.usage_count > 0
  GROUP BY mf.topic
),
-- Aggregate metrics per topic
topic_aggregates AS (
  SELECT 
    td.topic,
    -- Unique queries tracked (promptsTracked)
    COUNT(DISTINCT td.query_id) AS prompts_tracked,
    -- Average visibility (0-1 scale, convert to 0-100)
    AVG(td.visibility_index) * 100 AS avg_visibility,
    -- Average SOA (exclude NULLs - matching backend logic)
    -- Backend uses shareValues array which only contains non-null values
    AVG(td.share_of_answers) FILTER (WHERE td.share_of_answers IS NOT NULL AND td.share_of_answers >= 0) AS avg_share,
    -- Average sentiment (1-100 scale, exclude NULLs)
    AVG(td.sentiment_score) FILTER (WHERE td.sentiment_score IS NOT NULL) AS avg_sentiment,
    -- Brand presence: (collector results with presence / total collector results) * 100
    COUNT(DISTINCT CASE WHEN td.has_brand_presence = true THEN td.collector_result_id END) AS collector_results_with_presence,
    COUNT(DISTINCT td.collector_result_id) AS total_collector_results,
    -- Citation usage for this topic
    COALESCE(tcu.citation_usage, 0) AS citation_usage
  FROM topic_data td
  LEFT JOIN topic_citation_usage tcu ON td.topic = tcu.topic
  GROUP BY td.topic, tcu.citation_usage
),
-- Calculate total citation usage for volume ratio
total_citation_usage AS (
  SELECT SUM(citation_usage) AS total_usage
  FROM topic_citation_usage
)
-- Final output: Top Performing Topics
SELECT 
  ta.topic,
  ta.prompts_tracked AS queries_tracked,
  -- Average Volume: (citation usage for this topic / total citation usage) * 100
  CASE 
    WHEN tcu.total_usage > 0 
    THEN ROUND((ta.citation_usage::numeric / tcu.total_usage::numeric) * 100, 1)
    ELSE 0
  END AS average_volume,
  ROUND(COALESCE(ta.avg_visibility, 0), 1) AS visibility,
  ROUND(COALESCE(ta.avg_share, 0), 1) AS share_of_answers,
  ROUND(COALESCE(ta.avg_sentiment, 0), 2) AS sentiment_score,
  -- Brand Presence: (collector results with presence / total collector results) * 100
  CASE 
    WHEN ta.total_collector_results > 0
    THEN ROUND((ta.collector_results_with_presence::numeric / ta.total_collector_results::numeric) * 100, 1)
    ELSE NULL
  END AS brand_presence_percentage,
  -- Additional metadata
  ta.collector_results_with_presence,
  ta.total_collector_results,
  ta.citation_usage
FROM topic_aggregates ta
CROSS JOIN total_citation_usage tcu
WHERE ta.prompts_tracked > 0
ORDER BY 
  -- Sort by visibility (descending), then share, then prompts_tracked
  COALESCE(ta.avg_visibility, 0) DESC,
  COALESCE(ta.avg_share, 0) DESC,
  ta.prompts_tracked DESC
LIMIT 10;

-- ============================================================================
-- DEBUG QUERIES
-- ============================================================================
-- Use these to debug specific issues

-- Check date column usage
SELECT 
  'Date Column Check' AS info,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) AS processed_at_count,
  COUNT(*) FILTER (WHERE created_at IS NOT NULL) AS created_at_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE processed_at IS NOT NULL) > COUNT(*) FILTER (WHERE created_at IS NOT NULL) THEN 'Using processed_at'
    WHEN COUNT(*) FILTER (WHERE created_at IS NOT NULL) > COUNT(*) FILTER (WHERE processed_at IS NOT NULL) THEN 'Using created_at'
    ELSE 'Both have similar counts'
  END AS recommendation
FROM public.metric_facts
WHERE brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c';

-- Check for NULL share_of_answers values
SELECT 
  'SOA NULL Check' AS info,
  COUNT(*) AS total_records,
  COUNT(share_of_answers) AS records_with_soa,
  COUNT(*) - COUNT(share_of_answers) AS records_with_null_soa,
  ROUND((COUNT(*) - COUNT(share_of_answers))::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS pct_null_soa
FROM public.brand_metrics bm
INNER JOIN public.metric_facts mf ON bm.metric_fact_id = mf.id
WHERE mf.brand_id = 'b1e7af2d-de46-420b-bccf-61d7ad9fde2c';

