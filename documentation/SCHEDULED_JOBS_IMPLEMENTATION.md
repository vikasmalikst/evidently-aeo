# Scheduled Jobs Implementation

## Overview

This implementation adds a comprehensive cron job system for automating data collection and scoring operations. The system allows administrators to schedule recurring jobs that:

1. **Collect brand data** using the topics and queries selected during onboarding
2. **Score collected data** using the brand scoring orchestrator (position extraction, sentiment scoring, citation extraction)
3. **Run both operations** in sequence (data collection followed by scoring)

## Architecture

### Database Schema

**Tables Created:**
- `scheduled_jobs` - Stores job schedules with cron expressions
- `job_runs` - Tracks execution history for scheduled jobs

**Migration File:** `supabase/migrations/20250131000000_create_scheduled_jobs_tables.sql`

### Backend Services

1. **Job Scheduler Service** (`backend/src/services/jobs/job-scheduler.service.ts`)
   - Creates, updates, and deletes scheduled jobs
   - Computes next run times from cron expressions
   - Enqueues job runs when due

2. **Data Collection Job Service** (`backend/src/services/jobs/data-collection-job.service.ts`)
   - Executes data collection for a brand using onboarding topics/queries
   - Retrieves active queries from `generated_queries` table
   - Uses the existing data collection service to execute queries across collectors

3. **Unified Job Scheduler** (`backend/src/cron/unified-job-scheduler.ts`)
   - Polls for due jobs every 60 seconds (configurable)
   - Enqueues job runs for jobs that are due

4. **Unified Job Worker** (`backend/src/cron/unified-job-worker.ts`)
   - Processes pending job runs
   - Executes data collection and/or scoring based on job type
   - Updates job run status and metrics
   - Handles errors gracefully

### API Endpoints

**Admin Routes** (`backend/src/routes/admin.routes.ts`):

- `GET /api/admin/scheduled-jobs` - List scheduled jobs (filtered by customer/brand)
- `GET /api/admin/scheduled-jobs/:jobId` - Get a specific scheduled job
- `POST /api/admin/scheduled-jobs` - Create a new scheduled job
- `PUT /api/admin/scheduled-jobs/:jobId` - Update a scheduled job
- `DELETE /api/admin/scheduled-jobs/:jobId` - Delete a scheduled job
- `POST /api/admin/scheduled-jobs/:jobId/trigger` - Manually trigger a job run
- `GET /api/admin/job-runs` - Get job run history (with filters)
- `GET /api/admin/job-runs/:runId` - Get a specific job run
- `GET /api/admin/brands/:brandId/topics-queries` - Get active topics/queries for a brand

### Frontend Admin UI

**Page:** `src/pages/admin/ScheduledJobs.tsx`

Features:
- View all scheduled jobs for a customer/brand
- Create new scheduled jobs with cron expressions
- Toggle job active/inactive status
- Manually trigger job runs
- View job run history with metrics and errors
- Delete scheduled jobs

**Route:** `/admin/scheduled-jobs`

## Job Types

1. **`data_collection`** - Only collects data using onboarding topics/queries
2. **`scoring`** - Only runs scoring operations (position extraction, sentiment scoring, citations)
3. **`data_collection_and_scoring`** - Runs data collection first, then scoring

## Cron Expression Format

Standard 5-field cron format:
```
minute hour day month weekday
```

Examples:
- `0 9 * * *` - Daily at 9:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `30 14 * * 1-5` - Weekdays at 2:30 PM

## Configuration

### Environment Variables

- `JOB_SCHEDULER_POLL_MS` - Polling interval for scheduler (default: 60000ms = 1 minute)
- `JOB_WORKER_POLL_MS` - Polling interval for worker (default: 30000ms = 30 seconds)
- `JOB_SCHEDULER_BATCH` - Max schedules to process per tick (default: 25)
- `JOB_WORKER_BATCH` - Max job runs to process per tick (default: 5)

### NPM Scripts

```bash
# Run the job scheduler (enqueues due jobs)
npm run cron:job:scheduler

# Run the job worker (processes pending job runs)
npm run cron:job:worker
```

## How It Works

### Data Collection Flow

1. Admin creates a scheduled job for a brand with job type `data_collection` or `data_collection_and_scoring`
2. Scheduler detects the job is due and creates a `job_run` record with status `pending`
3. Worker picks up the pending job run and updates status to `processing`
4. Worker calls `dataCollectionJobService.executeDataCollection()` which:
   - Fetches active queries from `generated_queries` table for the brand
   - Executes queries through the data collection service
   - Returns metrics (queries executed, successful/failed executions)
5. Worker updates job run with metrics and status `completed` or `failed`

### Scoring Flow

1. Admin creates a scheduled job with job type `scoring` or `data_collection_and_scoring`
2. Worker calls `brandScoringService.scoreBrand()` which:
   - Extracts positions from collector results
   - Scores sentiments for brand and competitors
   - Extracts citations
3. Worker updates job run with metrics from scoring operations

### Combined Flow

When job type is `data_collection_and_scoring`:
1. Data collection runs first
2. Scoring runs after data collection completes
3. Both operations' metrics are stored in the job run

## Usage Example

### Creating a Scheduled Job via API

```bash
POST /api/admin/scheduled-jobs
{
  "brand_id": "uuid-here",
  "customer_id": "uuid-here",
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
}
```

### Viewing Job Runs

```bash
GET /api/admin/job-runs?customer_id=uuid&brand_id=uuid&status=completed&limit=20
```

## Monitoring

- Job runs are stored in `job_runs` table with:
  - Status (pending, processing, completed, failed, cancelled)
  - Start/finish timestamps
  - Execution metrics (JSONB)
  - Error messages (if failed)

- Scheduled jobs track:
  - Next run time (computed from cron expression)
  - Last run time
  - Active/inactive status

## Future Enhancements

1. Email/Slack notifications for failed jobs
2. Retry logic for failed job runs
3. Job dependencies (e.g., scoring only runs if data collection succeeds)
4. Job run timeouts
5. Rate limiting per brand/customer
6. Dashboard with job execution trends and charts

