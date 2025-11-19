-- Check data availability for Test Brand
-- Run this in Supabase SQL Editor

-- 1. Find the brand ID for "Test Brand"
SELECT 
  id,
  name,
  customer_id,
  domain,
  created_at
FROM brands
WHERE name ILIKE '%test%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if topics exist in brand_topics table
-- Replace 'YOUR_BRAND_ID' with the actual brand ID from step 1
SELECT 
  bt.id,
  bt.topic_name,
  bt.category,
  bt.priority,
  bt.is_active,
  bt.created_at
FROM brand_topics bt
JOIN brands b ON b.id = bt.brand_id
WHERE b.name ILIKE '%test%'
ORDER BY bt.priority ASC;

-- 3. Check if topics exist in brand metadata
SELECT 
  id,
  name,
  metadata->>'topics' as topics_from_metadata,
  metadata
FROM brands
WHERE name ILIKE '%test%';

-- 4. Check if there are any generated_queries for this brand
SELECT 
  COUNT(*) as total_queries,
  COUNT(DISTINCT topic) as unique_topics,
  MIN(created_at) as first_query_date,
  MAX(created_at) as last_query_date
FROM generated_queries gq
JOIN brands b ON b.id = gq.brand_id
WHERE b.name ILIKE '%test%';

-- 5. Check if there are any extracted_positions (analytics data) for this brand
SELECT 
  COUNT(*) as total_positions,
  COUNT(DISTINCT ep.query_id) as unique_queries,
  MIN(ep.processed_at) as first_position_date,
  MAX(ep.processed_at) as last_position_date,
  COUNT(DISTINCT cr.query_id) as queries_with_results
FROM extracted_positions ep
JOIN brands b ON b.id = ep.brand_id
LEFT JOIN collector_results cr ON cr.id = ep.collector_result_id
WHERE b.name ILIKE '%test%';

-- 6. Check the date range of available analytics data
SELECT 
  DATE(ep.processed_at) as date,
  COUNT(*) as positions_count,
  COUNT(DISTINCT ep.query_id) as unique_queries
FROM extracted_positions ep
JOIN brands b ON b.id = ep.brand_id
WHERE b.name ILIKE '%test%'
GROUP BY DATE(ep.processed_at)
ORDER BY date DESC
LIMIT 30;

-- 7. Check if collector_results exist for this brand's queries
SELECT 
  COUNT(*) as total_collector_results,
  COUNT(DISTINCT cr.query_id) as unique_queries,
  MIN(cr.created_at) as first_result_date,
  MAX(cr.created_at) as last_result_date
FROM collector_results cr
JOIN generated_queries gq ON gq.id = cr.query_id
JOIN brands b ON b.id = gq.brand_id
WHERE b.name ILIKE '%test%';

-- 8. Sample of topics with their analytics (if any)
SELECT 
  gq.topic,
  COUNT(DISTINCT gq.id) as query_count,
  COUNT(DISTINCT cr.id) as result_count,
  COUNT(DISTINCT ep.id) as position_count,
  AVG(ep.share_of_answers_brand) as avg_soa,
  AVG(ep.sentiment_score) as avg_sentiment
FROM generated_queries gq
JOIN brands b ON b.id = gq.brand_id
LEFT JOIN collector_results cr ON cr.query_id = gq.id
LEFT JOIN extracted_positions ep ON ep.query_id = gq.id
WHERE b.name ILIKE '%test%'
GROUP BY gq.topic
ORDER BY query_count DESC;

