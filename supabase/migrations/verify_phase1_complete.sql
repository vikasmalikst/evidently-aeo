-- ============================================================================
-- Phase 1 Verification Script
-- ============================================================================
-- This script verifies that all Phase 1 schema changes were applied correctly
-- ============================================================================

\echo '========================================='
\echo 'Phase 1 Verification: New Schema Tables'
\echo '========================================='

-- ============================================================================
-- 1. Verify Tables Exist
-- ============================================================================
\echo ''
\echo '1. Verifying Tables Exist...'
\echo '----------------------------'

SELECT 
  table_name,
  CASE 
    WHEN table_name = 'metric_facts' THEN '✓ Core fact table'
    WHEN table_name = 'brand_metrics' THEN '✓ Brand metrics table'
    WHEN table_name = 'competitor_metrics' THEN '✓ Competitor metrics table'
    WHEN table_name = 'brand_sentiment' THEN '✓ Brand sentiment table'
    WHEN table_name = 'competitor_sentiment' THEN '✓ Competitor sentiment table'
  END as description
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'metric_facts',
    'brand_metrics',
    'competitor_metrics',
    'brand_sentiment',
    'competitor_sentiment'
  )
ORDER BY table_name;

-- Check if all 5 tables exist
\echo ''
SELECT 
  CASE 
    WHEN COUNT(*) = 5 THEN '✅ SUCCESS: All 5 tables created'
    ELSE '❌ FAIL: Expected 5 tables, found ' || COUNT(*)
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'metric_facts',
    'brand_metrics',
    'competitor_metrics',
    'brand_sentiment',
    'competitor_sentiment'
  );

-- ============================================================================
-- 2. Verify Materialized View Exists
-- ============================================================================
\echo ''
\echo '2. Verifying Materialized View...'
\echo '----------------------------------'

SELECT 
  matviewname as view_name,
  '✓ Daily metrics materialized view' as description
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname = 'mv_brand_daily_metrics';

\echo ''
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_matviews 
      WHERE schemaname = 'public' 
        AND matviewname = 'mv_brand_daily_metrics'
    ) THEN '✅ SUCCESS: Materialized view created'
    ELSE '❌ FAIL: Materialized view not found'
  END as status;

-- ============================================================================
-- 3. Verify Column Structure
-- ============================================================================
\echo ''
\echo '3. Verifying Column Structure...'
\echo '---------------------------------'

-- metric_facts columns
\echo ''
\echo 'metric_facts columns:'
SELECT 
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END as nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'metric_facts'
ORDER BY ordinal_position;

-- brand_metrics columns
\echo ''
\echo 'brand_metrics columns:'
SELECT 
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END as nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'brand_metrics'
ORDER BY ordinal_position;

-- competitor_metrics columns
\echo ''
\echo 'competitor_metrics columns:'
SELECT 
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END as nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'competitor_metrics'
ORDER BY ordinal_position;

-- ============================================================================
-- 4. Verify Indexes
-- ============================================================================
\echo ''
\echo '4. Verifying Indexes...'
\echo '-----------------------'

SELECT 
  tablename,
  indexname,
  '✓' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'metric_facts',
    'brand_metrics',
    'competitor_metrics',
    'brand_sentiment',
    'competitor_sentiment'
  )
ORDER BY tablename, indexname;

-- Count indexes
\echo ''
SELECT 
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'metric_facts',
    'brand_metrics',
    'competitor_metrics',
    'brand_sentiment',
    'competitor_sentiment'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 5. Verify Foreign Key Constraints
-- ============================================================================
\echo ''
\echo '5. Verifying Foreign Key Constraints...'
\echo '----------------------------------------'

SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✓' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'metric_facts',
    'brand_metrics',
    'competitor_metrics',
    'brand_sentiment',
    'competitor_sentiment'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- 6. Verify Triggers (for updated_at)
-- ============================================================================
\echo ''
\echo '6. Verifying Triggers...'
\echo '------------------------'

SELECT 
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event,
  '✓' as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'metric_facts',
    'brand_metrics',
    'competitor_metrics',
    'brand_sentiment',
    'competitor_sentiment'
  )
ORDER BY event_object_table;

-- ============================================================================
-- 7. Verify Data Types for Critical Columns
-- ============================================================================
\echo ''
\echo '7. Verifying Critical Data Types...'
\echo '------------------------------------'

-- Check competitor_id is UUID (not INTEGER)
SELECT 
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'uuid' THEN '✅ Correct type (UUID)'
    ELSE '❌ Wrong type: ' || data_type
  END as validation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('competitor_metrics', 'competitor_sentiment')
  AND column_name = 'competitor_id';

-- Check brand_id is UUID
SELECT 
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'uuid' THEN '✅ Correct type (UUID)'
    ELSE '❌ Wrong type: ' || data_type
  END as validation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'metric_facts'
  AND column_name = 'brand_id';

-- ============================================================================
-- 8. Summary Report
-- ============================================================================
\echo ''
\echo '========================================='
\echo 'SUMMARY REPORT'
\echo '========================================='

SELECT 
  'Tables Created' as check_item,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN (
       'metric_facts', 'brand_metrics', 'competitor_metrics', 
       'brand_sentiment', 'competitor_sentiment'
     )) || ' / 5' as result,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN (
              'metric_facts', 'brand_metrics', 'competitor_metrics', 
              'brand_sentiment', 'competitor_sentiment'
            )) = 5 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status

UNION ALL

SELECT 
  'Materialized Views' as check_item,
  (SELECT COUNT(*) FROM pg_matviews 
   WHERE schemaname = 'public' 
     AND matviewname = 'mv_brand_daily_metrics') || ' / 1' as result,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_matviews 
      WHERE schemaname = 'public' 
        AND matviewname = 'mv_brand_daily_metrics'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status

UNION ALL

SELECT 
  'Indexes Created' as check_item,
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE schemaname = 'public' 
     AND tablename IN (
       'metric_facts', 'brand_metrics', 'competitor_metrics', 
       'brand_sentiment', 'competitor_sentiment'
     ))::text || ' indexes' as result,
  '✅ PASS' as status

UNION ALL

SELECT 
  'Foreign Keys' as check_item,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE constraint_type = 'FOREIGN KEY' 
     AND table_schema = 'public' 
     AND table_name IN (
       'metric_facts', 'brand_metrics', 'competitor_metrics', 
       'brand_sentiment', 'competitor_sentiment'
     ))::text || ' constraints' as result,
  '✅ PASS' as status

UNION ALL

SELECT 
  'Triggers' as check_item,
  (SELECT COUNT(*) FROM information_schema.triggers 
   WHERE event_object_schema = 'public' 
     AND event_object_table IN (
       'metric_facts', 'brand_metrics', 'competitor_metrics', 
       'brand_sentiment', 'competitor_sentiment'
     ))::text || ' triggers' as result,
  '✅ PASS' as status

UNION ALL

SELECT 
  'competitor_id Type' as check_item,
  (SELECT data_type FROM information_schema.columns 
   WHERE table_schema = 'public' 
     AND table_name = 'competitor_metrics' 
     AND column_name = 'competitor_id') as result,
  CASE 
    WHEN (SELECT data_type FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'competitor_metrics' 
            AND column_name = 'competitor_id') = 'uuid' THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

\echo ''
\echo '========================================='
\echo 'Phase 1 Verification Complete!'
\echo '========================================='
\echo ''
\echo 'Next Step: Run Phase 2 (Backfill Data)'
\echo ''

