# Quick Start: Daily Cron Jobs Setup

## 🚀 5-Minute Setup

### Step 1: Start the Processes (3 terminals)

**Terminal 1 - Backend Server:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Job Scheduler:**
```bash
cd backend
npm run cron:job:scheduler
```

**Terminal 3 - Job Worker:**
```bash
cd backend
npm run cron:job:worker
```

### Step 2: Create a Daily Job via UI

1. Open: `http://localhost:5173/admin/scheduled-jobs`
2. Select your brand from dropdown
3. Click **"Create Scheduled Job"**
4. Fill in:
   - **Brand:** Your brand (e.g., "YouTube")
   - **Job Type:** `Data Collection + Scoring` ⭐
   - **Cron Expression:** `0 9 * * *` (daily at 9 AM UTC)
   - **Timezone:** `UTC`
   - **Active:** ✅ Checked
5. Click **"Create"**

### Step 3: Verify Setup

**In Admin UI:**
- ✅ Job appears in "Scheduled Jobs" table
- ✅ Status shows "Active" (green badge)
- ✅ "Next Run" shows a future time

**In Database (run in Supabase SQL Editor):**
```sql
SELECT 
  id,
  brand_id,
  job_type,
  cron_expression,
  is_active,
  next_run_at
FROM scheduled_jobs
WHERE customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'
ORDER BY created_at DESC;
```

**Expected:**
- `is_active` = `true`
- `next_run_at` = future timestamp
- `job_type` = `data_collection_and_scoring`

### Step 4: Test Immediately

**Option A: Manual Trigger (Recommended)**
1. In Admin UI, find your job
2. Click **"Trigger"** or **"Run Now"** button
3. Check "Recent Job Runs" section
4. Should see status: "processing" → "completed"

**Option B: Wait for Scheduled Time**
- Check scheduler terminal logs
- Should see: `[Scheduler] Found 1 due job(s) to enqueue`
- Check worker terminal logs
- Should see: `[Worker] Processing job run...`

### Step 5: Verify Data Collection

**Check new data:**
```sql
-- Check collector results from last hour
SELECT COUNT(*), MAX(created_at)
FROM collector_results
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND created_at >= NOW() - INTERVAL '1 hour';

-- Check extracted positions from last hour
SELECT COUNT(*), MAX(created_at)
FROM extracted_positions
WHERE brand_id = '838ba1a6-3dec-433d-bea9-a9bc278969ea'
  AND created_at >= NOW() - INTERVAL '1 hour';
```

**Check dashboard:**
1. Go to: `http://localhost:5173/dashboard`
2. Select your brand
3. Charts should show new data points

## 📋 Common Daily Cron Expressions

| Time | Cron Expression | Description |
|------|----------------|-------------|
| 9 AM UTC | `0 9 * * *` | Daily at 9:00 AM |
| Midnight UTC | `0 0 * * *` | Daily at 00:00 |
| 2 AM UTC | `0 2 * * *` | Daily at 2:00 AM |
| 6 PM UTC | `0 18 * * *` | Daily at 6:00 PM |

## ✅ Verification Checklist

- [ ] Scheduler process running (Terminal 2)
- [ ] Worker process running (Terminal 3)
- [ ] Job created in Admin UI
- [ ] Job shows `is_active = true` in database
- [ ] `next_run_at` is set correctly
- [ ] Manual trigger works
- [ ] Job run appears in history
- [ ] New data collected (check `collector_results` table)
- [ ] New positions extracted (check `extracted_positions` table)
- [ ] Charts show new data

## 🔍 Troubleshooting

**Jobs not running?**
1. Check both processes are running
2. Check `is_active = true`
3. Check `next_run_at` is in the past (if due)
4. Check scheduler logs for errors

**No data collected?**
1. Check active queries exist: `SELECT COUNT(*) FROM generated_queries WHERE is_active = true`
2. Check worker logs for errors
3. Verify `customer_id` matches

**Need help?**
- Check `DAILY_CRON_JOBS_SETUP_GUIDE.md` for detailed guide
- Run `verify-cron-jobs.sql` queries to diagnose issues

