# How to Verify Top Sources of a Topic from Database

This guide explains how to verify the top sources displayed for each topic in the Topics table by querying the database directly.

## Database Tables Involved

The top sources are calculated from the following tables:
- `citations` - Contains citation data with domain, URL, and usage counts
- `extracted_positions` - Maps collector results to topics
- `collector_results` - Contains the actual query execution results

## SQL Query to Verify Top Sources for a Specific Topic

### Step 1: Find the Topic ID and Normalized Name

```sql
-- Find your topic
SELECT 
  id,
  topic_name,
  LOWER(TRIM(topic_name)) as normalized_name,
  brand_id,
  customer_id
FROM topics
WHERE topic_name ILIKE '%your topic name%'
  AND brand_id = 'your-brand-id'
  AND customer_id = 'your-customer-id';
```

### Step 2: Get Top Sources for a Topic (Complete Query)

```sql
-- Replace these variables:
-- :brand_id - Your brand UUID
-- :customer_id - Your customer UUID  
-- :topic_name - The exact topic name (case-insensitive)
-- :start_date - Start date in ISO format (e.g., '2024-01-01T00:00:00Z')
-- :end_date - End date in ISO format (e.g., '2024-12-31T23:59:59Z')

WITH topic_mapping AS (
  -- Get collector_result_id to topic name mapping
  SELECT DISTINCT
    ep.collector_result_id,
    COALESCE(
      NULLIF(TRIM(ep.topic), ''),
      (ep.metadata->>'topic_name')::text
    ) as topic_name
  FROM extracted_positions ep
  WHERE ep.brand_id = :brand_id
    AND ep.customer_id = :customer_id
    AND ep.collector_result_id IS NOT NULL
    AND (
      (ep.topic IS NOT NULL AND TRIM(ep.topic) != '')
      OR (ep.metadata->>'topic_name') IS NOT NULL
    )
),
topic_citations AS (
  -- Get citations grouped by topic and domain
  SELECT 
    LOWER(TRIM(tm.topic_name)) as normalized_topic_name,
    c.domain,
    c.url,
    c.category,
    SUM(c.usage_count) as total_citations
  FROM citations c
  INNER JOIN topic_mapping tm ON c.collector_result_id = tm.collector_result_id
  WHERE c.brand_id = :brand_id
    AND c.customer_id = :customer_id
    AND c.created_at >= :start_date
    AND c.created_at <= :end_date
    AND LOWER(TRIM(tm.topic_name)) = LOWER(TRIM(:topic_name))
  GROUP BY 
    LOWER(TRIM(tm.topic_name)),
    c.domain,
    c.url,
    c.category
)
SELECT 
  normalized_topic_name as topic,
  domain,
  url,
  category,
  total_citations,
  -- Determine source type (matches backend logic)
  CASE 
    WHEN category = 'brand' THEN 'brand'
    WHEN category = 'editorial' THEN 'editorial'
    WHEN category = 'corporate' THEN 'corporate'
    WHEN category = 'reference' THEN 'reference'
    WHEN category = 'ugc' THEN 'ugc'
    WHEN category = 'institutional' THEN 'institutional'
    WHEN domain ILIKE '%wikipedia%' OR domain ILIKE '%britannica%' OR domain ILIKE '%dictionary%' THEN 'reference'
    WHEN domain ILIKE '%.edu%' OR domain ILIKE '%.gov%' THEN 'institutional'
    WHEN domain ILIKE '%reddit%' OR domain ILIKE '%twitter%' OR domain ILIKE '%medium%' OR domain ILIKE '%github%' THEN 'ugc'
    ELSE 'editorial'
  END as source_type
FROM topic_citations
ORDER BY total_citations DESC
LIMIT 3;  -- Top 3 sources (backend returns top 3, frontend shows only top 1)
```

## Simplified Query for Quick Verification

If you just want to see the top source (domain only) for a specific topic:

```sql
-- Quick verification query
SELECT 
  c.domain,
  SUM(c.usage_count) as citations,
  COUNT(DISTINCT c.url) as unique_urls
FROM citations c
INNER JOIN extracted_positions ep ON c.collector_result_id = ep.collector_result_id
WHERE c.brand_id = :brand_id
  AND c.customer_id = :customer_id
  AND c.created_at >= :start_date
  AND c.created_at <= :end_date
  AND (
    LOWER(TRIM(ep.topic)) = LOWER(TRIM(:topic_name))
    OR LOWER(TRIM(ep.metadata->>'topic_name')) = LOWER(TRIM(:topic_name))
  )
GROUP BY c.domain
ORDER BY citations DESC
LIMIT 1;  -- Top source only
```

## Example: Verify Top Source for "Excederin migraine relief"

```sql
-- Example with actual values (replace with your actual IDs and dates)
SELECT 
  c.domain,
  SUM(c.usage_count) as total_citations,
  c.category,
  CASE 
    WHEN c.category = 'brand' THEN 'brand'
    WHEN c.domain ILIKE '%wikipedia%' OR domain ILIKE '%britannica%' THEN 'reference'
    WHEN c.domain ILIKE '%.edu%' OR domain ILIKE '%.gov%' THEN 'institutional'
    ELSE 'editorial'
  END as source_type
FROM citations c
INNER JOIN extracted_positions ep ON c.collector_result_id = ep.collector_result_id
WHERE c.brand_id = 'your-brand-uuid'
  AND c.customer_id = 'your-customer-uuid'
  AND c.created_at >= '2024-01-01T00:00:00Z'
  AND c.created_at <= '2024-12-31T23:59:59Z'
  AND (
    LOWER(TRIM(ep.topic)) = 'excederin migraine relief'
    OR LOWER(TRIM(ep.metadata->>'topic_name')) = 'excederin migraine relief'
  )
GROUP BY c.domain, c.category
ORDER BY total_citations DESC
LIMIT 1;
```

## Key Points to Verify

1. **Domain Extraction**: The frontend extracts the domain from the URL using:
   ```javascript
   domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
   ```
   Make sure your SQL query groups by domain correctly.

2. **Source Type Classification**: The backend classifies sources based on:
   - `category` column (if available)
   - Domain patterns (wikipedia, .edu, .gov, reddit, etc.)
   - Defaults to 'editorial' if no match

3. **Sorting**: Sources are sorted by `total_citations` (sum of `usage_count`) in descending order.

4. **Date Range**: Make sure you're using the same date range as the frontend (typically last 30/90 days or custom range).

5. **Topic Name Normalization**: Topic names are normalized to lowercase and trimmed:
   ```sql
   LOWER(TRIM(topic_name))
   ```

## Troubleshooting

### If top source doesn't match:

1. **Check date range**: Verify the `created_at` dates match your frontend filter
2. **Check topic name**: Ensure exact match (case-insensitive, trimmed)
3. **Check brand/customer IDs**: Verify you're querying the correct brand and customer
4. **Check collector_result_id mapping**: Some citations might not have a corresponding entry in `extracted_positions`

### Debug query to see all data:

```sql
-- See all citations for a topic (for debugging)
SELECT 
  c.id,
  c.domain,
  c.url,
  c.usage_count,
  c.created_at,
  ep.topic,
  ep.metadata->>'topic_name' as metadata_topic_name
FROM citations c
LEFT JOIN extracted_positions ep ON c.collector_result_id = ep.collector_result_id
WHERE c.brand_id = :brand_id
  AND c.customer_id = :customer_id
  AND c.created_at >= :start_date
  AND c.created_at <= :end_date
  AND (
    LOWER(TRIM(COALESCE(ep.topic, ep.metadata->>'topic_name', ''))) = LOWER(TRIM(:topic_name))
  )
ORDER BY c.created_at DESC;
```

## Notes

- The backend returns **top 3 sources** per topic, but the frontend now displays only the **top 1 source** (domain only, no percentages)
- Citations are aggregated by domain (multiple URLs from the same domain are combined)
- The `usage_count` field represents how many times a citation was used in AI responses
- Source type affects the visual styling (brand sources get a colored background)

