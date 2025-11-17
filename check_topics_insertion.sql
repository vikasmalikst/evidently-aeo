-- ============================================
-- CHECK TOPIC INSERTION FOR GOOGLE MEET
-- ============================================

-- Step 1: Find the brand ID for Google Meet
SELECT id, name, customer_id, created_at
FROM brands
WHERE name ILIKE '%google meet%' OR name ILIKE '%meet%'
ORDER BY created_at DESC
LIMIT 5;

-- Replace 'YOUR_BRAND_ID' with the actual brand_id from above query
-- Replace 'YOUR_CUSTOMER_ID' with your customer_id

-- Step 2: Check if topics were inserted into brand_topics table
SELECT 
  id,
  brand_id,
  topic_name,
  category,
  description,
  created_at
FROM brand_topics
WHERE brand_id = 'YOUR_BRAND_ID'  -- Replace with actual brand_id
ORDER BY created_at DESC;

-- Step 3: Check if queries were generated with topic metadata
SELECT 
  id,
  query_text,
  metadata->>'topic_name' as topic_name,
  metadata->>'topic' as topic_alt,
  created_at
FROM generated_queries
WHERE brand_id = 'YOUR_BRAND_ID'  -- Replace with actual brand_id
ORDER BY created_at DESC
LIMIT 20;

-- Step 4: Count queries with and without topic metadata
SELECT 
  COUNT(*) as total_queries,
  COUNT(metadata->>'topic_name') as queries_with_topic_name,
  COUNT(metadata->>'topic') as queries_with_topic,
  COUNT(*) - COUNT(metadata->>'topic_name') as missing_topic_name
FROM generated_queries
WHERE brand_id = 'YOUR_BRAND_ID';  -- Replace with actual brand_id

-- Step 5: Check if positions have topic metadata (after data collection runs)
SELECT 
  COUNT(*) as total_positions,
  COUNT(metadata->>'topic_name') as positions_with_topic,
  COUNT(*) - COUNT(metadata->>'topic_name') as missing_topic
FROM extracted_positions
WHERE brand_id = 'YOUR_BRAND_ID';  -- Replace with actual brand_id

-- Step 6: Verify topic categorization
SELECT 
  topic_name,
  category,
  CASE 
    WHEN category IS NULL THEN '❌ NOT CATEGORIZED'
    WHEN category = '' THEN '❌ EMPTY CATEGORY'
    ELSE '✅ CATEGORIZED'
  END as status
FROM brand_topics
WHERE brand_id = 'YOUR_BRAND_ID'  -- Replace with actual brand_id
ORDER BY category, topic_name;

