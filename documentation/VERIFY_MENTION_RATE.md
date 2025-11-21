# Manual Verification Guide: Mention Rate Calculation

This guide will help you manually calculate mention rate using SQL queries on your `citations` and `collector_results` tables to verify the values shown on your dashboard.

---

## Understanding Mention Rate

**Mention Rate Formula**:
```
Mention Rate = (Number of unique collector results citing this source / Total collector results) × 100
```

**What it means**: The percentage of AI responses (collector results) where a specific source domain is cited.

---

## Step-by-Step Verification Process

### Step 1: Identify Your Brand ID and Date Range

First, you need to know:
- Your `brand_id`
- The date range you're viewing on the dashboard (e.g., Last 30 days)

**Query to find your brand**:
```sql
SELECT id, name, customer_id 
FROM brands 
WHERE name = 'Your Brand Name';  -- Replace with your brand name
```

**Query to see recent date ranges**:
```sql
SELECT 
  MIN(created_at) as earliest_citation,
  MAX(created_at) as latest_citation,
  COUNT(*) as total_citations
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID';  -- Replace with your brand_id
```

---

### Step 2: Get Total Collector Results (Denominator)

This is the total number of AI responses in your time period.

**Query**:
```sql
-- Replace 'YOUR_BRAND_ID', 'START_DATE', and 'END_DATE' with actual values
-- Example: '2024-01-01T00:00:00Z' and '2024-01-31T23:59:59Z'

SELECT COUNT(*) as total_collector_results
FROM collector_results
WHERE brand_id = 'YOUR_BRAND_ID'
  AND created_at >= 'START_DATE'
  AND created_at <= 'END_DATE';
```

**Example Output**:
```
total_collector_results
-----------------------
23
```

This means you have **23 total AI responses** in this period.

---

### Step 3: Get Unique Collector Results Citing a Specific Source (Numerator)

For each source domain, count how many unique collector results cite it.

**Query for a specific domain (e.g., uber.com)**:
```sql
-- Replace 'YOUR_BRAND_ID', 'START_DATE', 'END_DATE', and 'uber.com' with actual values

SELECT 
  COUNT(DISTINCT collector_result_id) as unique_collector_results_citing_source,
  domain
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'
  AND created_at >= 'START_DATE'
  AND created_at <= 'END_DATE'
  AND domain = 'uber.com'  -- Replace with the domain you want to check
GROUP BY domain;
```

**Example Output**:
```
unique_collector_results_citing_source | domain
---------------------------------------|--------
8                                      | uber.com
```

This means `uber.com` is cited in **8 unique collector results**.

---

### Step 4: Calculate Mention Rate Manually

**Formula**:
```
Mention Rate = (unique_collector_results_citing_source / total_collector_results) × 100
```

**Example**:
```
Mention Rate = (8 / 23) × 100 = 34.78%
```

Rounded to 1 decimal place: **34.8%**

---

### Step 5: Compare All Sources at Once

To see mention rates for all sources and compare with your dashboard:

**Complete Query**:
```sql
-- Replace 'YOUR_BRAND_ID', 'START_DATE', and 'END_DATE' with actual values

WITH total_responses AS (
  SELECT COUNT(*) as total
  FROM collector_results
  WHERE brand_id = 'YOUR_BRAND_ID'
    AND created_at >= 'START_DATE'
    AND created_at <= 'END_DATE'
),
source_counts AS (
  SELECT 
    domain,
    COUNT(DISTINCT collector_result_id) as unique_collector_results
  FROM citations
  WHERE brand_id = 'YOUR_BRAND_ID'
    AND created_at >= 'START_DATE'
    AND created_at <= 'END_DATE'
  GROUP BY domain
)
SELECT 
  sc.domain,
  sc.unique_collector_results,
  tr.total as total_collector_results,
  ROUND((sc.unique_collector_results::numeric / tr.total::numeric) * 100, 1) as mention_rate_percent
FROM source_counts sc
CROSS JOIN total_responses tr
ORDER BY mention_rate_percent DESC;
```

**Example Output**:
```
domain          | unique_collector_results | total_collector_results | mention_rate_percent
----------------|-------------------------|------------------------|---------------------
uber.com        | 8                       | 23                     | 34.8
reddit.com      | 6                       | 23                     | 26.1
apps.apple.com  | 5                       | 23                     | 21.7
facebook.com    | 4                       | 23                     | 17.4
mediacoverage.com | 3                     | 23                     | 13.0
```

---

### Step 6: Verify with Usage Count

Sometimes you might want to see the total citation count (usage_count) vs unique collector results:

**Query**:
```sql
-- Replace 'YOUR_BRAND_ID', 'START_DATE', and 'END_DATE' with actual values

SELECT 
  domain,
  COUNT(DISTINCT collector_result_id) as unique_collector_results,
  SUM(usage_count) as total_citation_count,
  COUNT(*) as total_citation_rows
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'
  AND created_at >= 'START_DATE'
  AND created_at <= 'END_DATE'
GROUP BY domain
ORDER BY unique_collector_results DESC;
```

**Note**: 
- `unique_collector_results` = Number of unique AI responses citing this source (used for mention rate)
- `total_citation_count` = Sum of all `usage_count` values (may be higher if a source is cited multiple times in the same response)
- `total_citation_rows` = Number of rows in citations table for this domain

**Important**: Mention rate uses `unique_collector_results`, NOT `total_citation_count`.

---

## Common Issues to Check

### Issue 1: Domain Normalization

The code normalizes domains (removes `www.`, converts to lowercase). Check if your database has variations:

```sql
-- Check for domain variations
SELECT 
  domain,
  COUNT(DISTINCT collector_result_id) as unique_results,
  COUNT(*) as total_rows
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'
  AND created_at >= 'START_DATE'
  AND created_at <= 'END_DATE'
  AND (domain ILIKE '%uber%' OR domain ILIKE '%reddit%')  -- Check specific domains
GROUP BY domain
ORDER BY domain;
```

If you see `www.uber.com` and `uber.com` as separate rows, they should be grouped together in the calculation.

### Issue 2: Null or Missing collector_result_id

Check if any citations are missing collector_result_id:

```sql
-- Check for citations without collector_result_id
SELECT 
  COUNT(*) as citations_without_collector_result_id
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'
  AND created_at >= 'START_DATE'
  AND created_at <= 'END_DATE'
  AND collector_result_id IS NULL;
```

These citations won't be counted in mention rate calculation.

### Issue 3: Date Range Mismatch

Make sure your date range matches what's shown on the dashboard:

```sql
-- Check date range of your citations
SELECT 
  MIN(created_at) as earliest,
  MAX(created_at) as latest,
  COUNT(*) as total_citations
FROM citations
WHERE brand_id = 'YOUR_BRAND_ID'
  AND created_at >= 'START_DATE'
  AND created_at <= 'END_DATE';
```

---

## Quick Verification Query (All-in-One)

Run this query to get everything you need for verification:

```sql
-- Replace 'YOUR_BRAND_ID', 'START_DATE', and 'END_DATE' with actual values

WITH 
-- Step 1: Get total collector results
total_responses AS (
  SELECT COUNT(*) as total
  FROM collector_results
  WHERE brand_id = 'YOUR_BRAND_ID'
    AND created_at >= 'START_DATE'
    AND created_at <= 'END_DATE'
),
-- Step 2: Get unique collector results per source
source_mentions AS (
  SELECT 
    LOWER(TRIM(REPLACE(domain, 'www.', ''))) as normalized_domain,
    COUNT(DISTINCT collector_result_id) as unique_collector_results,
    SUM(usage_count) as total_citations,
    COUNT(*) as citation_rows
  FROM citations
  WHERE brand_id = 'YOUR_BRAND_ID'
    AND created_at >= 'START_DATE'
    AND created_at <= 'END_DATE'
    AND collector_result_id IS NOT NULL
  GROUP BY LOWER(TRIM(REPLACE(domain, 'www.', '')))
)
-- Step 3: Calculate mention rate
SELECT 
  sm.normalized_domain as domain,
  sm.unique_collector_results,
  tr.total as total_collector_results,
  ROUND((sm.unique_collector_results::numeric / tr.total::numeric) * 100, 1) as calculated_mention_rate,
  sm.total_citations,
  sm.citation_rows
FROM source_mentions sm
CROSS JOIN total_responses tr
ORDER BY calculated_mention_rate DESC
LIMIT 20;  -- Top 20 sources
```

This query:
1. Normalizes domains (removes www., lowercase)
2. Counts unique collector results per source
3. Calculates mention rate percentage
4. Shows additional stats for verification

---

## Expected Results

After running these queries, you should see:
- **Total collector results**: Should match the total number of AI responses in your time period
- **Unique collector results per source**: Should match the numerator in mention rate calculation
- **Calculated mention rate**: Should match (within rounding) what's shown on your dashboard

---

## Troubleshooting

If your manual calculation doesn't match the dashboard:

1. **Check date range**: Make sure START_DATE and END_DATE match exactly
2. **Check brand_id**: Verify you're using the correct brand_id
3. **Check domain normalization**: The code normalizes domains, so `www.uber.com` and `uber.com` should be treated as the same
4. **Check for NULL values**: Citations without `collector_result_id` won't be counted
5. **Check timezone**: Make sure dates are in UTC (the code uses UTC)

---

## Next Steps

Once you've verified mention rate, you can use similar queries to verify:
- **Share of Answer (SOA)**: Query `extracted_positions` table
- **Sentiment**: Query `collector_results.sentiment_score` field

Let me know if you'd like me to create similar verification guides for SOA and Sentiment!

