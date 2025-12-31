-- Drop raw_answer column from generated_keywords table
-- This column is no longer needed as it is a duplicate of collector_results.raw_answer
-- and is consuming significant storage space.

ALTER TABLE IF EXISTS public.generated_keywords 
DROP COLUMN IF EXISTS raw_answer;
