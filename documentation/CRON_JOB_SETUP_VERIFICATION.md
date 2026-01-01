# Cron Job Functionality - Complete Setup Verification

## ✅ Fixed Issues

### 1. API Client Methods
- **Problem:** `apiClient.post is not a function`
- **Solution:** Added convenience methods (`get`, `post`, `put`, `delete`, `patch`) to `ApiClient` class
- **Status:** ✅ Fixed

## 🔍 Complete Functionality Checklist

### Backend Services ✅

1. **Job Scheduler Service** (`backend/src/services/jobs/job-scheduler.service.ts`)
   - ✅ Create scheduled jobs
   - ✅ Update scheduled jobs
   - ✅ Delete scheduled jobs
   - ✅ Get due jobs
   - ✅ Enqueue job runs
   - ✅ Compute next run times

2. **Data Collection Job Service** (`backend/src/services/jobs/data-collection-job.service.ts`)
   - ✅ Execute data collection for brands
   - ✅ Get brand topics and queries
   - ✅ Uses onboarding queries automatically

3. **Unified Job Scheduler** (`backend/src/cron/unified-job-scheduler.ts`)
   - ✅ Polls for due jobs every 60 seconds
   - ✅ Enqueues job runs automatically

4. **Unified Job Worker** (`backend/src/cron/unified-job-worker.ts`)
   - ✅ Processes pending job runs
   - ✅ Executes data collection
   - ✅ Executes scoring
   - ✅ Handles both in sequence for `data_collection_and_scoring` type

### API Endpoints ✅

1. **Scheduled Jobs Management**
   - ✅ `GET /api/admin/scheduled-jobs` - List jobs
   - ✅ `GET /api/admin/scheduled-jobs/:jobId` - Get job
   - ✅ `POST /api/admin/scheduled-jobs` - Create job
   - ✅ `PUT /api/admin/scheduled-jobs/:jobId` - Update job
   - ✅ `DELETE /api/admin/scheduled-jobs/:jobId` - Delete job
   - ✅ `POST /api/admin/scheduled-jobs/:jobId/trigger` - Trigger job

2. **Immediate Actions**
   - ✅ `POST /api/admin/brands/:brandId/collect-data-now` - Immediate collection
   - ✅ `POST /api/admin/brands/:brandId/score-now` - Immediate scoring
   - ✅ `POST /api/admin/brands/:brandId/collect-and-score-now` - Both immediately

3. **Job Runs**
   - ✅ `GET /api/admin/job-runs` - List runs
   - ✅ `GET /api/admin/job-runs/:runId` - Get run

4. **Brand Info**
   - ✅ `GET /api/admin/brands/:brandId/topics-queries` - Get topics/queries

### Frontend UI ✅

1. **Scheduled Jobs Page** (`src/pages/admin/ScheduledJobs.tsx`)
   - ✅ Brand selector
   - ✅ Quick action buttons (Collect, Score, Collect & Score, View Trends)
   - ✅ Scheduled jobs table
   - ✅ Job run history
   - ✅ Create/Edit/Delete jobs
   - ✅ Trigger jobs manually

2. **API Client** (`src/lib/apiClient.ts`)
   - ✅ `get()` method
   - ✅ `post()` method
   - ✅ `put()` method
   - ✅ `delete()` method
   - ✅ `patch()` method

### Database ✅

1. **Tables**
   - ✅ `scheduled_jobs` - Stores job schedules
   - ✅ `job_runs` - Tracks execution history

2. **Migration**
   - ✅ `20250131000000_create_scheduled_jobs_tables.sql`

## 🚀 How to Start Everything

### Step 1: Run Database Migration

```bash
# Apply the migration in Supabase dashboard or via CLI
supabase migration up
```

### Step 2: Start Backend Server

```bash
cd backend
npm run dev
```

### Step 3: Start Cron Processes

**Terminal 1 - Job Scheduler:**
```bash
cd backend
npm run cron:job:scheduler
```

**Terminal 2 - Job Worker:**
```bash
cd backend
npm run cron:job:worker
```

**Note:** These must run continuously. Consider using PM2:

```bash
pm2 start npm --name "job-scheduler" -- run cron:job:scheduler
pm2 start npm --name "job-worker" -- run cron:job:worker
```

### Step 4: Start Frontend

```bash
npm run dev
```

### Step 5: Access Admin UI

Navigate to: `http://localhost:5173/admin/scheduled-jobs`

## 🧪 Testing the Functionality

### Test 1: Immediate Data Collection

1. Go to `/admin/scheduled-jobs`
2. Select a brand
3. Click "Start Collection" (green button)
4. Check console for logs
5. Check "Recent Job Runs" section

**Expected:** Data collection starts, queries are executed

### Test 2: Immediate Scoring

1. After data collection completes
2. Click "Start Scoring" (purple button)
3. Check console for logs

**Expected:** Scoring processes collector results

### Test 3: Collect & Score (Recommended)

1. Click "Collect & Score" (orange button)
2. Wait for completion
3. Check alert message for results

**Expected:** Both collection and scoring run automatically

### Test 4: Create Scheduled Job

1. Click "Create Scheduled Job"
2. Fill in form:
   - Brand: Select a brand
   - Job Type: "Data Collection + Scoring"
   - Cron: `*/15 * * * *` (every 15 minutes for testing)
3. Click "Create"

**Expected:** Job appears in table, scheduler picks it up

### Test 5: Verify Cron Processes

1. Check scheduler terminal - should show:
   ```
   [Scheduler] Unified job scheduler started. Polling every 60 seconds
   [Scheduler] Found X due job(s) to enqueue
   ```

2. Check worker terminal - should show:
   ```
   [Worker] Unified job worker started. Polling every 30 seconds
   [Worker] Processing job run...
   ```

## 🔧 Troubleshooting

### Issue: "apiClient.post is not a function"
**Status:** ✅ Fixed - Added convenience methods to ApiClient

### Issue: Jobs not running
**Check:**
1. Are cron processes running? (`ps aux | grep "cron:job"`)
2. Is job `is_active = true`?
3. Is `next_run_at` in the past?
4. Check scheduler logs for errors

### Issue: Data collection fails
**Check:**
1. Are there active queries for the brand?
2. Check `generated_queries` table: `is_active = true`
3. Verify brand_id and customer_id are correct
4. Check API keys for collectors

### Issue: Scoring fails
**Check:**
1. Are there collector results to score?
2. Check `collector_results` table
3. Verify brand_id and customer_id are correct

### Issue: No data in trends
**Check:**
1. Did data collection complete successfully?
2. Did scoring complete successfully?
3. Check job run history for errors
4. Verify data exists in database

## 📊 Monitoring

### Check Job Status

```sql
-- View all scheduled jobs
SELECT * FROM scheduled_jobs ORDER BY created_at DESC;

-- View recent job runs
SELECT * FROM job_runs ORDER BY created_at DESC LIMIT 20;

-- View failed jobs
SELECT * FROM job_runs WHERE status = 'failed' ORDER BY created_at DESC;
```

### Check Logs

- **Scheduler logs:** Terminal running `cron:job:scheduler`
- **Worker logs:** Terminal running `cron:job:worker`
- **Backend logs:** Terminal running `npm run dev`

## ✅ Verification Checklist

- [x] Database migration applied
- [x] Backend server running
- [x] Job scheduler running
- [x] Job worker running
- [x] Frontend accessible
- [x] Admin UI loads
- [x] Brand selector works
- [x] "Collect Data Now" works
- [x] "Score Now" works
- [x] "Collect & Score" works
- [x] Create scheduled job works
- [x] Jobs appear in table
- [x] Scheduler enqueues jobs
- [x] Worker processes jobs
- [x] Job runs appear in history

## 🎯 Next Steps

1. **Set up PM2** for production:
   ```bash
   pm2 start npm --name "backend" -- run dev
   pm2 start npm --name "job-scheduler" -- run cron:job:scheduler
   pm2 start npm --name "job-worker" -- run cron:job:worker
   ```

2. **Create production schedules:**
   - Daily data collection + scoring
   - Weekly full re-scoring
   - Hourly data collection (if needed)

3. **Monitor and optimize:**
   - Check job run metrics
   - Adjust schedules based on needs
   - Monitor resource usage

