# Scheduled Jobs - User Guide

## Step 1: Run the Database Migration

First, apply the database migration to create the necessary tables:

```bash
# If using Supabase CLI
supabase migration up

# Or apply the migration directly in your Supabase dashboard:
# Go to SQL Editor → Run the migration file:
# supabase/migrations/20250131000000_create_scheduled_jobs_tables.sql
```

## Step 2: Start the Cron Processes

You need to run two background processes for the job system to work:

### Terminal 1: Job Scheduler (Enqueues due jobs)
```bash
cd backend
npm run cron:job:scheduler
```

This process:
- Polls every 60 seconds for jobs that are due
- Creates `job_run` records for jobs that should execute
- Updates `next_run_at` for scheduled jobs

### Terminal 2: Job Worker (Processes job runs)
```bash
cd backend
npm run cron:job:worker
```

This process:
- Polls every 30 seconds for pending job runs
- Executes data collection and/or scoring operations
- Updates job run status and metrics

**Note:** These processes should run continuously. Consider using PM2 or systemd to keep them running:

```bash
# Using PM2
pm2 start npm --name "job-scheduler" -- run cron:job:scheduler
pm2 start npm --name "job-worker" -- run cron:job:worker
```

## Step 3: Access the Admin UI

1. **Start your frontend application:**
   ```bash
   npm run dev
   ```

2. **Navigate to the Scheduled Jobs page:**
   ```
   http://localhost:5173/admin/scheduled-jobs
   ```
   (Replace with your actual frontend URL)

3. **Make sure you're logged in** with an admin account

## Step 4: Create Your First Scheduled Job

### Option A: Using the Admin UI

1. Click the **"Create Scheduled Job"** button
2. Fill in the form:
   - **Brand**: Select the brand you want to schedule jobs for
   - **Job Type**: Choose one of:
     - `Data Collection` - Only collects data
     - `Scoring` - Only runs scoring operations
     - `Data Collection + Scoring` - Runs both (recommended)
   - **Cron Expression**: Enter a cron schedule (see examples below)
   - **Timezone**: Default is UTC
   - **Active**: Check to enable the job immediately
3. Click **"Create"**

### Option B: Using the API Directly

```bash
curl -X POST http://localhost:3000/api/admin/scheduled-jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "brand_id": "your-brand-uuid",
    "customer_id": "your-customer-uuid",
    "job_type": "data_collection_and_scoring",
    "cron_expression": "0 9 * * *",
    "timezone": "UTC",
    "is_active": true,
    "metadata": {
      "collectors": ["chatgpt", "google_aio", "perplexity"],
      "parallel": false,
      "positionLimit": 50,
      "sentimentLimit": 50
    }
  }'
```

## Cron Expression Examples

Cron format: `minute hour day month weekday`

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Daily at 9:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `30 14 * * 1-5` | Weekdays (Mon-Fri) at 2:30 PM |
| `0 0 1 * *` | First day of every month at midnight |
| `*/15 * * * *` | Every 15 minutes |
| `0 0,12 * * *` | Twice daily at midnight and noon |

## Step 5: Monitor Your Jobs

### View Scheduled Jobs
- The main page shows all scheduled jobs
- See next run time, last run time, and status
- Toggle jobs active/inactive
- View job run history

### View Job Runs
1. Click **"History"** on any scheduled job
2. See execution history with:
   - Status (pending, processing, completed, failed)
   - Execution time
   - Metrics (queries executed, items processed, etc.)
   - Error messages (if any)

### Recent Runs Section
- The bottom of the page shows the 10 most recent job runs
- Quick view of what's happening

## Step 6: Manual Job Execution

You can manually trigger a job without waiting for the schedule:

1. Click **"Trigger"** on any scheduled job
2. The job will be executed immediately
3. Check the job run history to see results

## Common Use Cases

### Daily Data Collection + Scoring
```json
{
  "job_type": "data_collection_and_scoring",
  "cron_expression": "0 9 * * *",
  "timezone": "UTC"
}
```
Runs every day at 9 AM UTC, collects new data and scores it.

### Hourly Data Collection Only
```json
{
  "job_type": "data_collection",
  "cron_expression": "0 * * * *",
  "timezone": "UTC"
}
```
Collects data every hour.

### Weekly Scoring of Existing Data
```json
{
  "job_type": "scoring",
  "cron_expression": "0 0 * * 0",
  "timezone": "UTC"
}
```
Runs scoring every Sunday at midnight.

## Troubleshooting

### Jobs Not Running

1. **Check if cron processes are running:**
   ```bash
   # Check if processes are running
   ps aux | grep "cron:job"
   ```

2. **Check job status:**
   - Ensure job is `Active` in the UI
   - Check `next_run_at` is in the past
   - Verify `job_runs` table has pending entries

3. **Check logs:**
   - Look at console output from scheduler and worker processes
   - Check for error messages

### Job Runs Failing

1. **Check job run history:**
   - Click "History" on the job
   - Look for error messages
   - Check execution metrics

2. **Common issues:**
   - Brand ID or Customer ID invalid
   - No active queries found for the brand
   - Database connection issues
   - API rate limits

### Viewing Logs

The scheduler and worker output logs to console. Look for:
- `[Scheduler]` - Messages from the scheduler
- `[Worker]` - Messages from the worker
- Error messages with details

## API Reference

### Get All Scheduled Jobs
```bash
GET /api/admin/scheduled-jobs?customer_id=UUID&brand_id=UUID
```

### Get Job Run History
```bash
GET /api/admin/job-runs?customer_id=UUID&brand_id=UUID&status=completed&limit=20
```

### Update a Job
```bash
PUT /api/admin/scheduled-jobs/:jobId
{
  "is_active": false,
  "cron_expression": "0 10 * * *"
}
```

### Delete a Job
```bash
DELETE /api/admin/scheduled-jobs/:jobId
```

## Best Practices

1. **Start with a test schedule:**
   - Use `*/15 * * * *` (every 15 minutes) to test
   - Verify it works before setting to daily/weekly

2. **Monitor first few runs:**
   - Check job run history after first execution
   - Verify metrics look correct
   - Ensure no errors

3. **Use appropriate job types:**
   - `data_collection_and_scoring` for regular updates
   - `data_collection` only if you want to collect more frequently
   - `scoring` only if you want to re-score existing data

4. **Set reasonable schedules:**
   - Don't run too frequently (API rate limits)
   - Consider data collection costs
   - Balance freshness vs. resource usage

5. **Keep cron processes running:**
   - Use process managers (PM2, systemd)
   - Set up monitoring/alerts
   - Log to files for debugging

## Next Steps

Once your jobs are running:
1. Monitor the job run history regularly
2. Check the metrics to understand data collection patterns
3. Adjust schedules based on your needs
4. Use the collected data to build trend charts in your dashboard

