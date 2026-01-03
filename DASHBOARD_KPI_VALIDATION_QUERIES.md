# Dashboard KPI Validation Queries

This document contains SQL queries to validate the KPIs shown on the dashboard against the database tables.

## Prerequisites

Replace the following placeholders in the queries:
- `YOUR_BRAND_ID` - The UUID of the brand you want to validate
- `YOUR_CUSTOMER_ID` - The UUID of the customer (optional, for filtering)
- `START_DATE` - Start date in ISO format (e.g., '2024-01-01T00:00:00Z')
- `END_DATE` - End date in ISO format (e.g., '2024-01-31T23:59:59Z')

---

## 1. Visibility Index (Visibility Score)

**Dashboard Display**: Shows as a percentage (0-100)

**Calculation**: Average of `visibility_index` from `brand_metrics` table (stored as 0-1 scale) multiplied by 100

**Validation Query**:

```sql
-- Visibility Index Validation
-- This should match the "Visibility Score" KPI on the dashboard
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
```

**Alternative Query (using customer_id filter)**:

```sql
-- Visibility Index with Customer Filter
SELECT 
  ROUND(AVG(bm.visibility_index) * 100, 1) AS visibility_index_percentage,
  COUNT(*) AS total_records,
  COUNT(bm.visibility_index) AS records_with_visibility
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.customer_id = 'YOUR_CUSTOMER_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.visibility_index IS NOT NULL;
```

**Expected Result**: A single row with `visibility_index_percentage` matching the dashboard value (rounded to 1 decimal place).

---

## 2. Share of Answers

**Dashboard Display**: Shows as a percentage (0-100)

**Calculation**: Simple average of all `share_of_answers` values from `brand_metrics` table (already stored as 0-100 scale)

**Validation Query**:

```sql
-- Share of Answers Validation
-- This should match the "Share of Answers" KPI on the dashboard
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
```

**Alternative Query (using customer_id filter)**:

```sql
-- Share of Answers with Customer Filter
SELECT 
  ROUND(AVG(bm.share_of_answers), 1) AS share_of_answers_percentage,
  COUNT(*) AS total_records
FROM public.metric_facts mf
INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.customer_id = 'YOUR_CUSTOMER_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bm.share_of_answers IS NOT NULL
  AND bm.share_of_answers >= 0;
```

**Expected Result**: A single row with `share_of_answers_percentage` matching the dashboard value (rounded to 1 decimal place).

---

## 3. Sentiment Score

**Dashboard Display**: Shows as a score (1-100)

**Calculation**: Average of `sentiment_score` from `brand_sentiment` table (stored in 1-100 format)

**Note**: The schema comment says sentiment_score is -1 to 1, but the code indicates it's stored in 1-100 format. If your data is in -1 to 1 format, use the conversion query below.

**Validation Query (assuming 1-100 format)**:

```sql
-- Sentiment Score Validation (1-100 format)
-- This should match the "Sentiment Score" KPI on the dashboard
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
```

**Alternative Query (if sentiment is stored in -1 to 1 format, convert to 1-100)**:

```sql
-- Sentiment Score Validation (with -1 to 1 conversion)
-- Use this if sentiment_score is stored in -1 to 1 format
SELECT 
  ROUND(AVG((bs.sentiment_score + 1) * 50), 2) AS sentiment_score_average,
  COUNT(*) AS total_records,
  COUNT(bs.sentiment_score) AS records_with_sentiment
FROM public.metric_facts mf
INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bs.sentiment_score IS NOT NULL;
```

**Alternative Query (using customer_id filter)**:

```sql
-- Sentiment Score with Customer Filter
SELECT 
  ROUND(AVG(bs.sentiment_score), 2) AS sentiment_score_average,
  COUNT(*) AS total_records
FROM public.metric_facts mf
INNER JOIN public.brand_sentiment bs ON mf.id = bs.metric_fact_id
WHERE mf.brand_id = 'YOUR_BRAND_ID'
  AND mf.customer_id = 'YOUR_CUSTOMER_ID'
  AND mf.processed_at >= 'START_DATE'
  AND mf.processed_at <= 'END_DATE'
  AND bs.sentiment_score IS NOT NULL;
```

**Expected Result**: A single row with `sentiment_score_average` matching the dashboard value (rounded to 2 decimal places).

---

## 4. Brand Presence Percentage

**Dashboard Display**: Shows as a percentage (0-100)

**Calculation**: (Unique collector results with brand presence / Total unique collector results) * 100

**Validation Query**:

```sql
-- Brand Presence Percentage Validation
-- This should match the "Brand Presence" KPI on the dashboard
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
```

**Alternative Query (using customer_id filter)**:

```sql
-- Brand Presence Percentage with Customer Filter
WITH collector_results_with_presence AS (
  SELECT DISTINCT mf.collector_result_id
  FROM public.metric_facts mf
  INNER JOIN public.brand_metrics bm ON mf.id = bm.metric_fact_id
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.customer_id = 'YOUR_CUSTOMER_ID'
    AND mf.processed_at >= 'START_DATE'
    AND mf.processed_at <= 'END_DATE'
    AND bm.has_brand_presence = true
),
total_collector_results AS (
  SELECT DISTINCT mf.collector_result_id
  FROM public.metric_facts mf
  WHERE mf.brand_id = 'YOUR_BRAND_ID'
    AND mf.customer_id = 'YOUR_CUSTOMER_ID'
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
```

**Expected Result**: A single row with `brand_presence_percentage` matching the dashboard value (rounded to 1 decimal place).

---

## 5. Combined Validation Query (All KPIs at Once)

**Use this query to validate all KPIs in a single execution**:

```sql
-- Combined KPI Validation Query
-- Validates all 4 main KPIs: Visibility Index, Share of Answers, Sentiment Score, Brand Presence
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
```

**Expected Result**: A single row with all 4 KPI values that should match the dashboard.

---

## 6. Date Range Helper Query

**Use this to find the date range of data for a brand**:

```sql
-- Find Date Range for a Brand
SELECT 
  MIN(mf.processed_at) AS earliest_date,
  MAX(mf.processed_at) AS latest_date,
  COUNT(DISTINCT mf.collector_result_id) AS total_collector_results,
  COUNT(DISTINCT mf.query_id) AS total_queries
FROM public.metric_facts mf
WHERE mf.brand_id = 'YOUR_BRAND_ID';
```

---

## 7. Detailed Breakdown Query

**Use this to see a detailed breakdown of each metric by collector type**:

```sql
-- Detailed Breakdown by Collector Type
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
```

---

## Notes

1. **Date Range**: The dashboard uses `processed_at` timestamp from `metric_facts` table for filtering by date range.

2. **Rounding**: 
   - Visibility Index: Rounded to 1 decimal place
   - Share of Answers: Rounded to 1 decimal place
   - Sentiment Score: Rounded to 2 decimal places
   - Brand Presence: Rounded to 1 decimal place

3. **Null Handling**: All queries filter out NULL values to match the dashboard calculation logic.

4. **Brand Presence**: This metric counts unique `collector_result_id` values, not row counts, to ensure accurate percentage calculation.

5. **Customer ID**: If you need to filter by customer_id, add `AND mf.customer_id = 'YOUR_CUSTOMER_ID'` to the WHERE clause.

6. **Collector Filtering**: If the dashboard has collector filters applied, you may need to add `AND mf.collector_type IN ('collector1', 'collector2', ...)` to match the filtered results.

---

## Troubleshooting

If the values don't match:

1. **Check Date Range**: Ensure you're using the same date range as the dashboard (check the date picker on the dashboard).

2. **Check Filters**: Verify if any filters (collector type, customer, etc.) are applied on the dashboard.

3. **Check Data Freshness**: The dashboard uses `processed_at` timestamp. Ensure your data has been processed.

4. **Check NULL Values**: Some metrics might exclude NULL values. Verify your query handles NULLs the same way.

5. **Check Rounding**: Ensure rounding matches (1 decimal for most, 2 for sentiment).

6. **Check Brand Presence Logic**: Brand presence uses DISTINCT collector_result_id, not row counts.

7. **Share of Answers Discrepancy**: If SOA values differ significantly:
   - The dashboard uses **simple average** of all `share_of_answers` values (not query-level averaging)
   - Check if collector filters are applied on the dashboard
   - Verify the date range matches exactly
   - Use the diagnostic queries (section 10 in SQL file) to identify the source of discrepancy
   - Common causes:
     * Different date ranges
     * Collector type filters applied on dashboard
     * Customer ID filters
     * Data not yet processed (check `processed_at` timestamps)

