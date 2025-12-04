-- Quick Verification Queries for Cron Jobs
-- Run these in your Supabase SQL Editor to verify your cron jobs are set up correctly

-- 1. Check all scheduled jobs for your customer
SELECT 
  id,
  brand_id,
  job_type,
  cron_expression,
  timezone,
  is_active,
  next_run_at,
  last_run_at,
  created_at,
  CASE 
    WHEN is_active = false THEN '❌ Inactive'
    WHEN next_run_at IS NULL THEN '⚠️ No next run scheduled'
    WHEN next_run_at < NOW() THEN '✅ Due to run'
    ELSE '⏰ Scheduled'
  END as status
FROM scheduled_jobs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'  -- Replace with your customer_id
ORDER BY created_at DESC;

-- 2. Check recent job runs
SELECT 
  id,
  scheduled_job_id,
  brand_id,
  job_type,
  status,
  started_at,
  completed_at,
  error_message,
  result_metadata,
  created_at
FROM job_runs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'  -- Replace with your customer_id
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if jobs are due to run (next_run_at is in the past)
SELECT 
  id,
  brand_id,
  job_type,
  cron_expression,
  next_run_at,
  NOW() as current_time,
  EXTRACT(EPOCH FROM (NOW() - next_run_at)) / 60 as minutes_overdue
FROM scheduled_jobs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'  -- Replace with your customer_id
  AND is_active = true
  AND next_run_at < NOW()
ORDER BY next_run_at ASC;

-- 4. Check pending job runs (waiting to be processed)
SELECT 
  id,
  scheduled_job_id,
  brand_id,
  job_type,
  status,
  scheduled_for,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_waiting
FROM job_runs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'  -- Replace with your customer_id
  AND status = 'pending'
ORDER BY created_at ASC;

-- 5. Check job run success rate
SELECT 
  job_type,
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY job_type), 2) as percentage
FROM job_runs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'  -- Replace with your customer_id
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY job_type, status
ORDER BY job_type, status;

-- 6. Check if there are active queries for your brands
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  COUNT(gq.id) as total_queries,
  COUNT(CASE WHEN gq.is_active = true THEN 1 END) as active_queries
FROM brands b
LEFT JOIN generated_queries gq ON gq.brand_id = b.id AND gq.customer_id = b.customer_id
WHERE b.customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'  -- Replace with your customer_id
GROUP BY b.id, b.name
ORDER BY b.name;

-- 7. Verify a specific job's next run time
SELECT 
  id,
  brand_id,
  job_type,
  cron_expression,
  timezone,
  is_active,
  next_run_at,
  last_run_at,
  -- Calculate next 5 run times
  next_run_at as run_1,
  next_run_at + INTERVAL '1 day' as run_2,
  next_run_at + INTERVAL '2 days' as run_3,
  next_run_at + INTERVAL '3 days' as run_4,
  next_run_at + INTERVAL '4 days' as run_5
FROM scheduled_jobs
WHERE id = '<your-job-id>'  -- Replace with your job ID
  AND customer_id = '157c845c-9e87-4146-8479-cb8d045212bf';  -- Replace with your customer_id

