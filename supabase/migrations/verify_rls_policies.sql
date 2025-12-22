-- ============================================================================
-- Verify RLS Policies on Optimized Schema Tables
-- ============================================================================
-- Run this after applying the RLS migration to verify policies are correctly set
-- ============================================================================

-- 1. Check that RLS is enabled on all new tables
SELECT 
  'RLS Enabled Check' as check_name,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ PASS'
    ELSE '❌ FAIL - RLS not enabled'
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'metric_facts', 
    'brand_metrics', 
    'competitor_metrics', 
    'brand_sentiment', 
    'competitor_sentiment'
  )
ORDER BY tablename;

-- 2. Count policies per table (should be 2 per table)
SELECT 
  'Policy Count Check' as check_name,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ PASS - 2 policies (service_role + authenticated)'
    ELSE '❌ FAIL - Expected 2 policies, found ' || COUNT(*)
  END as status
FROM pg_policies 
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

-- 3. List all policies with details
SELECT 
  'Policy Details' as info,
  tablename,
  policyname,
  permissive,
  ARRAY_TO_STRING(roles, ', ') as roles,
  cmd as command_type,
  CASE 
    WHEN cmd = 'ALL' THEN '✅ Full access (service_role)'
    WHEN cmd = 'SELECT' THEN '✅ Read-only (authenticated)'
    ELSE '⚠️ Other: ' || cmd
  END as description
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN (
    'metric_facts', 
    'brand_metrics', 
    'competitor_metrics', 
    'brand_sentiment', 
    'competitor_sentiment'
  )
ORDER BY tablename, policyname;

-- 4. Summary Report
SELECT 
  '==================' as summary,
  'RLS VERIFICATION SUMMARY' as title,
  '==================' as summary2
UNION ALL
SELECT 
  'Check' as summary,
  'Result' as title,
  'Status' as summary2
UNION ALL
SELECT 
  'Tables with RLS Enabled' as summary,
  (SELECT COUNT(*) FROM pg_tables 
   WHERE schemaname = 'public' 
     AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
     AND rowsecurity = true)::text || ' / 5' as title,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_tables 
          WHERE schemaname = 'public' 
            AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
            AND rowsecurity = true) = 5 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as summary2
UNION ALL
SELECT 
  'Total Policies' as summary,
  (SELECT COUNT(*) FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment'))::text || ' policies' as title,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies 
          WHERE schemaname = 'public' 
            AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')) = 10 THEN '✅ PASS (2 per table)'
    ELSE '❌ FAIL (expected 10)'
  END as summary2
UNION ALL
SELECT 
  'Service Role Policies' as summary,
  (SELECT COUNT(*) FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
     AND 'service_role' = ANY(roles))::text as title,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies 
          WHERE schemaname = 'public' 
            AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
            AND 'service_role' = ANY(roles)) = 5 THEN '✅ PASS (1 per table)'
    ELSE '❌ FAIL (expected 5)'
  END as summary2
UNION ALL
SELECT 
  'Authenticated Policies' as summary,
  (SELECT COUNT(*) FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
     AND 'authenticated' = ANY(roles))::text as title,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies 
          WHERE schemaname = 'public' 
            AND tablename IN ('metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment')
            AND 'authenticated' = ANY(roles)) = 5 THEN '✅ PASS (1 per table)'
    ELSE '❌ FAIL (expected 5)'
  END as summary2;

-- 5. Check for any tables missing RLS or policies
SELECT 
  '⚠️ ATTENTION' as warning,
  tablename,
  CASE 
    WHEN NOT rowsecurity THEN '❌ RLS not enabled on this table'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = pg_tables.tablename) < 2 
      THEN '❌ Missing policies (found ' || (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = pg_tables.tablename)::text || ')'
    ELSE '✅ Table is properly secured'
  END as issue
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'metric_facts', 
    'brand_metrics', 
    'competitor_metrics', 
    'brand_sentiment', 
    'competitor_sentiment'
  )
ORDER BY tablename;

