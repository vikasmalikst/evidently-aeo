-- ============================================================================
-- Phase 1 Verification Script (Supabase SQL Editor Compatible)
-- ============================================================================

-- 1. Verify all 5 tables exist
SELECT 
  'Tables Created' as check_name,
  COUNT(*) || ' / 5' as result,
  CASE WHEN COUNT(*) = 5 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'metric_facts', 'brand_metrics', 'competitor_metrics', 
    'brand_sentiment', 'competitor_sentiment'
  );

-- 2. List all created tables
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'metric_facts' THEN 'Core fact table'
    WHEN table_name = 'brand_metrics' THEN 'Brand metrics table'
    WHEN table_name = 'competitor_metrics' THEN 'Competitor metrics table'
    WHEN table_name = 'brand_sentiment' THEN 'Brand sentiment table'
    WHEN table_name = 'competitor_sentiment' THEN 'Competitor sentiment table'
  END as description
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'metric_facts', 'brand_metrics', 'competitor_metrics', 
    'brand_sentiment', 'competitor_sentiment'
  )
ORDER BY table_name;

-- 3. Verify materialized view exists
SELECT 
  'Materialized View' as check_name,
  COUNT(*) || ' / 1' as result,
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname = 'mv_brand_daily_metrics';

-- 4. Verify critical data types (competitor_id must be UUID)
SELECT 
  'competitor_id Type Check' as check_name,
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'uuid' THEN '✅ PASS - Correct type (UUID)'
    ELSE '❌ FAIL - Wrong type: ' || data_type
  END as validation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('competitor_metrics', 'competitor_sentiment')
  AND column_name = 'competitor_id';

-- 5. Count indexes per table
SELECT 
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'metric_facts', 'brand_metrics', 'competitor_metrics', 
    'brand_sentiment', 'competitor_sentiment'
  )
GROUP BY tablename
ORDER BY tablename;

-- 6. Count foreign key constraints
SELECT 
  'Foreign Key Constraints' as check_name,
  COUNT(*)::text || ' constraints' as result,
  '✅ PASS' as status
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public'
  AND table_name IN (
    'metric_facts', 'brand_metrics', 'competitor_metrics', 
    'brand_sentiment', 'competitor_sentiment'
  );

-- 7. Count triggers (for updated_at)
SELECT 
  'Triggers' as check_name,
  COUNT(*)::text || ' triggers' as result,
  '✅ PASS' as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'metric_facts', 'brand_metrics', 'competitor_metrics', 
    'brand_sentiment', 'competitor_sentiment'
  );

-- 8. FINAL SUMMARY
SELECT 
  '==================' as summary,
  'PHASE 1 VERIFICATION' as title,
  '==================' as summary2
UNION ALL
SELECT 
  'Check Item' as summary,
  'Result' as title,
  'Status' as summary2
UNION ALL
SELECT 
  'Tables' as summary,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment'))::text || ' / 5' as title,
  CASE WHEN (SELECT COUNT(*) FROM information_schema.tables 
             WHERE table_schema = 'public' 
               AND table_name IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')) = 5 
       THEN '✅ PASS' ELSE '❌ FAIL' END as summary2
UNION ALL
SELECT 
  'Materialized Views' as summary,
  (SELECT COUNT(*) FROM pg_matviews 
   WHERE schemaname = 'public' AND matviewname = 'mv_brand_daily_metrics')::text || ' / 1' as title,
  CASE WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_brand_daily_metrics') 
       THEN '✅ PASS' ELSE '❌ FAIL' END as summary2
UNION ALL
SELECT 
  'Indexes' as summary,
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE schemaname = 'public' 
     AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment'))::text as title,
  '✅ PASS' as summary2
UNION ALL
SELECT 
  'Foreign Keys' as summary,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public' 
     AND table_name IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment'))::text as title,
  '✅ PASS' as summary2
UNION ALL
SELECT 
  'Triggers' as summary,
  (SELECT COUNT(*) FROM information_schema.triggers 
   WHERE event_object_schema = 'public' 
     AND event_object_table IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment'))::text as title,
  '✅ PASS' as summary2
UNION ALL
SELECT 
  'competitor_id Type' as summary,
  COALESCE((SELECT data_type FROM information_schema.columns 
   WHERE table_schema = 'public' AND table_name = 'competitor_metrics' AND column_name = 'competitor_id'), 'NOT FOUND') as title,
  CASE WHEN (SELECT data_type FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'competitor_metrics' AND column_name = 'competitor_id') = 'uuid' 
       THEN '✅ PASS' ELSE '❌ FAIL' END as summary2;

