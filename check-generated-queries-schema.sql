-- Check the schema of generated_queries table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'generated_queries'
ORDER BY ordinal_position;

-- Sample data
SELECT * FROM generated_queries LIMIT 2;

