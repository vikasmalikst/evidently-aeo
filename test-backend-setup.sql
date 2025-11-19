-- Test Script: Verify Prompt Management Tables
-- Run this in Supabase SQL Editor to verify setup

-- 1. Check if tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'prompt_configurations',
    'prompt_configuration_snapshots',
    'prompt_change_log',
    'prompt_metrics_snapshots'
  )
ORDER BY table_name;

-- 2. Check if columns were added to collector_results
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'collector_results'
  AND column_name IN ('configuration_version', 'configuration_id')
ORDER BY column_name;

-- 3. Check if columns were added to generated_queries
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'generated_queries'
  AND column_name IN ('is_active', 'archived_at', 'archived_by')
ORDER BY column_name;

-- 4. Count existing prompts (should have data)
SELECT 
  COUNT(*) as total_prompts,
  COUNT(DISTINCT brand_id) as brands_with_prompts
FROM generated_queries
WHERE query_text IS NOT NULL;

-- 5. Check for any existing configurations (should be empty initially)
SELECT 
  COUNT(*) as existing_versions
FROM prompt_configurations;

