-- Get your brand ID for testing
-- Run this in Supabase SQL Editor

SELECT 
  b.id as brand_id,
  b.name as brand_name,
  c.id as customer_id,
  c.email as customer_email,
  (SELECT COUNT(*) FROM generated_queries WHERE brand_id = b.id AND is_active = true) as active_prompts_count
FROM brands b
JOIN customers c ON c.id = b.customer_id
ORDER BY b.created_at DESC
LIMIT 5;

-- Copy the brand_id from the results above

