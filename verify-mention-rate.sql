-- ============================================================
-- MENTION RATE VERIFICATION SCRIPT
-- ============================================================
-- This script helps you manually verify mention rate calculations
-- Replace the variables below with your actual values
-- ============================================================

-- STEP 1: Set your variables (REPLACE THESE VALUES)
-- ============================================================
-- Option 1: Find your brand_id first
SELECT id, name, customer_id 
FROM brands 
WHERE name ILIKE '%YOUR_BRAND_NAME%';  -- Replace with your brand name

-- Option 2: Use the brand_id directly (uncomment and set)
-- \set brand_id 'YOUR_BRAND_ID_HERE'
-- \set start_date '2024-01-01T00:00:00Z'
-- \set end_date '2024-01-31T23:59:59Z'

-- ============================================================
-- STEP 2: Get Total Collector Results (Denominator)
-- ============================================================
-- Replace 'YOUR_BRAND_ID', 'START_DATE', and 'END_DATE' with actual values
-- Example dates: '2024-12-01T00:00:00Z' and '2024-12-31T23:59:59Z'

SELECT 
  COUNT(*) as total_collector_results,
  MIN(created_at) as earliest_response,
  MAX(created_at) as latest_response
FROM collector_results
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
  AND created_at >= 'START_DATE'  -- REPLACE THIS (e.g., '2024-12-01T00:00:00Z')
  AND created_at <= 'END_DATE';   -- REPLACE THIS (e.g., '2024-12-31T23:59:59Z')

-- ============================================================
-- STEP 3: Get Unique Collector Results Per Source (Numerator)
-- ============================================================
-- This shows how many unique collector results cite each source

SELECT 
  domain,
  COUNT(DISTINCT collector_result_id) as unique_collector_results,
  SUM(usage_count) as total_citation_count,
  COUNT(*) as total_citation_rows
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
  AND created_at >= 'START_DATE'  -- REPLACE THIS
  AND created_at <= 'END_DATE'    -- REPLACE THIS
  AND collector_result_id IS NOT NULL
GROUP BY domain
ORDER BY unique_collector_results DESC;

-- ============================================================
-- STEP 4: Calculate Mention Rate for All Sources
-- ============================================================
-- This is the complete calculation matching the dashboard

WITH total_responses AS (
  SELECT COUNT(*) as total
  FROM collector_results
  WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
    AND created_at >= 'START_DATE'  -- REPLACE THIS
    AND created_at <= 'END_DATE'    -- REPLACE THIS
),
source_mentions AS (
  SELECT 
    -- Normalize domain (remove www., lowercase, trim) - matching code logic
    LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', ''))) as normalized_domain,
    COUNT(DISTINCT collector_result_id) as unique_collector_results,
    SUM(usage_count) as total_citations,
    COUNT(*) as citation_rows
  FROM citations
  WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
    AND created_at >= 'START_DATE'  -- REPLACE THIS
    AND created_at <= 'END_DATE'    -- REPLACE THIS
    AND collector_result_id IS NOT NULL
    AND domain IS NOT NULL
    AND domain != ''
  GROUP BY LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', '')))
  HAVING LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', ''))) != 'unknown'
)
SELECT 
  sm.normalized_domain as domain,
  sm.unique_collector_results as numerator,
  tr.total as denominator,
  ROUND((sm.unique_collector_results::numeric / tr.total::numeric) * 100, 1) as calculated_mention_rate_percent,
  sm.total_citations,
  sm.citation_rows,
  -- Show the calculation breakdown
  CONCAT(
    sm.unique_collector_results, 
    ' / ', 
    tr.total, 
    ' × 100 = ', 
    ROUND((sm.unique_collector_results::numeric / tr.total::numeric) * 100, 1),
    '%'
  ) as calculation_breakdown
FROM source_mentions sm
CROSS JOIN total_responses tr
ORDER BY calculated_mention_rate_percent DESC
LIMIT 20;  -- Top 20 sources

-- ============================================================
-- STEP 5: Verify a Specific Source (e.g., uber.com)
-- ============================================================
-- Replace 'uber.com' with the domain you want to check

WITH total_responses AS (
  SELECT COUNT(*) as total
  FROM collector_results
  WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
    AND created_at >= 'START_DATE'  -- REPLACE THIS
    AND created_at <= 'END_DATE'    -- REPLACE THIS
),
source_mentions AS (
  SELECT 
    LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', ''))) as normalized_domain,
    COUNT(DISTINCT collector_result_id) as unique_collector_results
  FROM citations
  WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
    AND created_at >= 'START_DATE'  -- REPLACE THIS
    AND created_at <= 'END_DATE'    -- REPLACE THIS
    AND collector_result_id IS NOT NULL
    AND LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', ''))) = 'uber.com'  -- REPLACE THIS
  GROUP BY LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', '')))
)
SELECT 
  sm.normalized_domain as domain,
  sm.unique_collector_results as "Cited in X responses",
  tr.total as "Total responses",
  ROUND((sm.unique_collector_results::numeric / tr.total::numeric) * 100, 1) as "Mention Rate %",
  CONCAT(
    'Formula: (', 
    sm.unique_collector_results, 
    ' / ', 
    tr.total, 
    ') × 100 = ', 
    ROUND((sm.unique_collector_results::numeric / tr.total::numeric) * 100, 1),
    '%'
  ) as "Calculation"
FROM source_mentions sm
CROSS JOIN total_responses tr;

-- ============================================================
-- STEP 6: Check for Domain Variations
-- ============================================================
-- This helps identify if domains are stored inconsistently
-- (e.g., www.uber.com vs uber.com)

SELECT 
  domain as original_domain,
  LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', ''))) as normalized_domain,
  COUNT(DISTINCT collector_result_id) as unique_collector_results,
  COUNT(*) as total_rows
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
  AND created_at >= 'START_DATE'  -- REPLACE THIS
  AND created_at <= 'END_DATE'    -- REPLACE THIS
  AND (domain ILIKE '%uber%' OR domain ILIKE '%reddit%')  -- Check specific domains
GROUP BY domain, LOWER(TRIM(REPLACE(COALESCE(domain, ''), 'www.', '')))
ORDER BY normalized_domain, original_domain;

-- ============================================================
-- STEP 7: Check for Missing Data
-- ============================================================
-- Verify there are no issues with the data

-- Check for citations without collector_result_id
SELECT 
  COUNT(*) as citations_without_collector_result_id,
  COUNT(DISTINCT domain) as affected_domains
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
  AND created_at >= 'START_DATE'  -- REPLACE THIS
  AND created_at <= 'END_DATE'    -- REPLACE THIS
  AND collector_result_id IS NULL;

-- Check for citations with null or empty domains
SELECT 
  COUNT(*) as citations_with_null_or_empty_domain
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
  AND created_at >= 'START_DATE'  -- REPLACE THIS
  AND created_at <= 'END_DATE'    -- REPLACE THIS
  AND (domain IS NULL OR domain = '' OR domain = 'unknown');

-- Check date range coverage
SELECT 
  MIN(created_at) as earliest_citation,
  MAX(created_at) as latest_citation,
  COUNT(*) as total_citations,
  COUNT(DISTINCT domain) as unique_domains,
  COUNT(DISTINCT collector_result_id) as unique_collector_results
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'  -- REPLACE THIS
  AND created_at >= 'START_DATE'  -- REPLACE THIS
  AND created_at <= 'END_DATE';   -- REPLACE THIS

