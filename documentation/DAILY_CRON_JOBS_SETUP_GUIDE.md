# Daily Cron Jobs Setup Guide

## Overview

This guide will help you set up daily cron jobs for your brands to automatically collect data and score it on a schedule.

## Prerequisites

1. ✅ Database migration applied (`20250131000000_create_scheduled_jobs_tables.sql`)
2. ✅ Backend server running
3. ✅ Access to admin UI at `/admin/scheduled-jobs`

## Step 1: Access the Admin UI

1. Navigate to: `http://localhost:5173/admin/scheduled-jobs` (or your frontend URL)
2. You should see the Scheduled Jobs page with:
   - Brand selector dropdown
   - Quick action buttons
   - Scheduled jobs table
   - Job run history

## Step 2: Create a Daily Scheduled Job

### Option A: Using the Admin UI (Recommended)

1. **Select a Brand:**
   - Use the "Select Brand for Quick Actions" dropdown
   - Choose the brand you want to schedule (e.g., "YouTube", "Uber")

2. **Click "Create Scheduled Job"** button (top right)

3. **Fill in the Job Details:**
   - **Brand:** Select your brand from dropdown
   - **Job Type:** Choose one of:
     - `Data Collection` - Only collects data
     - `Scoring` - Only scores existing data
     - `Data Collection + Scoring` - **Recommended for daily jobs** (collects then scores)
   - **Cron Expression:** Enter a daily schedule
     - **Daily at 9 AM UTC:** `0 9 * * *`
     - **Daily at 2 AM UTC:** `0 2 * * *`
     - **Daily at midnight UTC:** `0 0 * * *`
     - **Every day at 6 PM UTC:** `0 18 * * *`
   - **Timezone:** Enter timezone (e.g., `UTC`, `America/New_York`, `America/Los_Angeles`)
   - **Active:** ✅ Check this box (jobs only run if active)

4. **Click "Create"**

### Option B: Using SQL (Alternative)

If you prefer to create jobs directly in the database:

```sql
INSERT INTO scheduled_jobs (
  brand_id,
  customer_id,
  job_type,
  cron_expression,
  timezone,
  is_active,
  created_by
) VALUES (
  '838ba1a6-3dec-433d-bea9-a9bc278969ea',  -- Your brand ID
  '157c845c-9e87-4146-8479-cb8d045212bf',  -- Your customer ID
  'data_collection_and_scoring',            -- Job type
  '0 9 * * *',                              -- Daily at 9 AM UTC
  'UTC',                                     -- Timezone
  true,                                      -- Active
  NULL                                       -- Created by (admin user ID if available)
);
```

## Step 3: Start the Cron Processes

The cron jobs require **two separate processes** to be running:

### Terminal 1: Job Scheduler

The scheduler polls for due jobs and enqueues them:

```bash
cd backend
npm run cron:job:scheduler
```

**Expected output:**
```
[Scheduler] Unified job scheduler started. Polling every 60 seconds
[Scheduler] Checking for due jobs...
[Scheduler] Found 0 due job(s) to enqueue
```

### Terminal 2: Job Worker

The worker processes enqueued jobs:

```bash
cd backend
npm run cron:job:worker
```

**Expected output:**
```
[Worker] Unified job worker started. Polling every 30 seconds
[Worker] Checking for pending job runs...
[Worker] Found 0 pending job run(s)
```

### Keep Both Running

**Important:** Both processes must run continuously. They will:
- Scheduler: Check every 60 seconds for due jobs
- Worker: Check every 30 seconds for pending jobs

## Step 4: Verify Your Scheduled Job

### Check in Admin UI

1. **View Scheduled Jobs Table:**
   - Your new job should appear in the "Scheduled Jobs" table
   - Check columns:
     - **Brand:** Should show your brand name
     - **Job Type:** Should show "Data Collection + Scoring"
     - **Schedule:** Should show your cron expression
     - **Next Run:** Should show the next scheduled time
     - **Status:** Should show "Active" (green badge)

2. **Check Job Details:**
   - Click on a job row to see details
   - Verify `next_run_at` is set correctly
   - Verify `is_active` is `true`

### Check in Database

Run this SQL query to see all your scheduled jobs:

```sql
SELECT 
  id,
  brand_id,
  job_type,
  cron_expression,
  timezone,
  is_active,
  next_run_at,
  last_run_at,
  created_at
FROM scheduled_jobs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'
ORDER BY created_at DESC;
```

**What to verify:**
- ✅ `is_active` = `true`
- ✅ `next_run_at` is set (should be in the future)
- ✅ `cron_expression` matches your desired schedule
- ✅ `job_type` is correct

## Step 5: Test the Job (Manual Trigger)

Before waiting for the scheduled time, test it manually:

1. **In Admin UI:**
   - Find your job in the table
   - Click the "Trigger" button (or "Run Now")
   - This will immediately enqueue and execute the job

2. **Check Job Runs:**
   - Go to "Recent Job Runs" section
   - You should see a new job run with status "running" or "completed"
   - Click on it to see details

3. **Verify Execution:**
   - Check the worker terminal for logs:
     ```
     [Worker] Processing job run...
     [Worker] Executing data collection...
     [Worker] Data collection completed: X queries executed
     [Worker] Executing scoring...
     [Worker] Scoring completed: X positions processed
     ```

## Step 6: Monitor Scheduled Execution

### Watch the Scheduler Logs

When a job is due, you'll see in the scheduler terminal:

```
[Scheduler] Found 1 due job(s) to enqueue
[Scheduler] Enqueued job run: <run-id>
[Scheduler] Updated next_run_at for job: <job-id>
```

### Watch the Worker Logs

When processing, you'll see in the worker terminal:

```
[Worker] Found 1 pending job run(s)
[Worker] Processing job run: <run-id>
[Worker] Job type: data_collection_and_scoring
[Worker] Executing data collection...
[Worker] Data collection completed: X queries executed
[Worker] Executing scoring...
[Worker] Scoring completed: X positions, X sentiments processed
[Worker] Job run completed successfully
```

### Check Job Run History

In the Admin UI:
1. Scroll to "Recent Job Runs" section
2. You should see new runs appearing after each execution
3. Click on a run to see:
   - Start time
   - End time
   - Status (completed/failed)
   - Results (queries executed, positions processed, etc.)

## Step 7: Verify Data Collection

After a job runs, verify new data was collected:

### Check Collector Results

```sql
SELECT 
  COUNT(*) as total_results,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM collector_results
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'
  AND created_at >= NOW() - INTERVAL '1 day';
```

### Check Extracted Positions

```sql
SELECT 
  COUNT(*) as total_positions,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM extracted_positions
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'
  AND created_at >= NOW() - INTERVAL '1 day';
```

### Check Dashboard

1. Go to your dashboard: `http://localhost:5173/dashboard`
2. Select your brand
3. Check the charts - you should see new data points
4. The trends should show the new data

## Common Cron Expressions for Daily Jobs

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Daily at 9 AM UTC | `0 9 * * *` | Every day at 9:00 AM |
| Daily at midnight UTC | `0 0 * * *` | Every day at 00:00 |
| Daily at 2 AM UTC | `0 2 * * *` | Every day at 2:00 AM |
| Daily at 6 PM UTC | `0 18 * * *` | Every day at 6:00 PM |
| Every 12 hours | `0 */12 * * *` | At 00:00 and 12:00 |
| Every 6 hours | `0 */6 * * *` | At 00:00, 06:00, 12:00, 18:00 |

**Cron Format:** `minute hour day month weekday`
- `*` = every value
- `*/N` = every N units
- `0-5` = range
- `0,5,10` = specific values

## Troubleshooting

### Issue: Jobs not appearing in table

**Check:**
1. Is the job `is_active = true`?
2. Is the `customer_id` correct?
3. Refresh the page

**Fix:**
```sql
UPDATE scheduled_jobs
SET is_active = true
WHERE id = '<your-job-id>';
```

### Issue: Jobs not running

**Check:**
1. Are both scheduler and worker processes running?
2. Is `next_run_at` in the past or future?
3. Check scheduler logs for errors

**Fix:**
```sql
-- Check next_run_at
SELECT id, cron_expression, next_run_at, is_active
FROM scheduled_jobs
WHERE id = '<your-job-id>';

-- Manually update next_run_at if needed
UPDATE scheduled_jobs
SET next_run_at = NOW() + INTERVAL '1 hour'
WHERE id = '<your-job-id>';
```

### Issue: Jobs running but no data collected

**Check:**
1. Are there active queries for the brand?
2. Check worker logs for errors
3. Verify `customer_id` matches your brand

**Fix:**
```sql
-- Check active queries
SELECT COUNT(*) 
FROM generated_queries
WHERE brand_id = '<your-brand-id>'
  AND customer_id = '<your-customer-id>'
  AND is_active = true;
```

### Issue: Scheduler/Worker processes crash

**Check:**
1. Check terminal for error messages
2. Verify database connection
3. Check environment variables

**Fix:**
- Restart the processes
- Check backend logs
- Verify `.env` file has correct database credentials

## Production Setup (Using PM2)

For production, use PM2 to keep processes running:

```bash
# Install PM2 globally
npm install -g pm2

# Start scheduler
cd backend
pm2 start npm --name "job-scheduler" -- run cron:job:scheduler

# Start worker
pm2 start npm --name "job-worker" -- run cron:job:worker

# Start backend server
pm2 start npm --name "backend" -- run dev

# View status
pm2 status

# View logs
pm2 logs job-scheduler
pm2 logs job-worker

# Save PM2 configuration
pm2 save
pm2 startup  # Follow instructions to enable auto-start on reboot
```

## Quick Verification Checklist

- [ ] Scheduled job created in Admin UI
- [ ] Job appears in scheduled jobs table
- [ ] `is_active = true` in database
- [ ] `next_run_at` is set correctly
- [ ] Scheduler process is running
- [ ] Worker process is running
- [ ] Manual trigger works
- [ ] Job run appears in history
- [ ] New data appears in database
- [ ] Charts show new data points

## Example: Complete Setup for One Brand

```bash
# 1. Start backend server (Terminal 1)
cd backend
npm run dev

# 2. Start scheduler (Terminal 2)
cd backend
npm run cron:job:scheduler

# 3. Start worker (Terminal 3)
cd backend
npm run cron:job:worker

# 4. In browser, go to:
# http://localhost:5173/admin/scheduled-jobs

# 5. Create job:
# - Brand: YouTube
# - Job Type: Data Collection + Scoring
# - Cron: 0 9 * * *
# - Timezone: UTC
# - Active: ✅

# 6. Verify in database:
psql -d your_database -c "
SELECT id, brand_id, job_type, cron_expression, next_run_at, is_active
FROM scheduled_jobs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf';
"

# 7. Wait for next run or trigger manually
```

## Next Steps

1. **Set up multiple brands:** Create separate jobs for each brand
2. **Different schedules:** Some brands might need different collection frequencies
3. **Monitor regularly:** Check job run history weekly
4. **Set up alerts:** Consider adding email/Slack notifications for failed jobs

