# Cron Job Tables - Complete Explanation

## Overview

There are **two sets of tables** in the system:

1. **NEW Unified System** (Current - Recommended):
   - `scheduled_jobs` - Stores job schedules
   - `job_runs` - Tracks execution history

2. **OLD Scoring-Only System** (Legacy - Deprecated):
   - `scoring_job_schedules` - Old scoring schedules
   - `scoring_job_runs` - Old scoring run history

## Current System (Unified)

### Table 1: `scheduled_jobs`

**Purpose:** Stores the job schedules/definitions that you create in the Admin UI.

**What it stores:**
- Job configuration (brand, customer, job type, cron expression)
- Schedule information (timezone, next run time, last run time)
- Status (active/inactive)
- Metadata (optional job-specific settings)

**Key Columns:**
- `id` - Unique job ID
- `brand_id` - Which brand this job is for
- `customer_id` - Which customer owns this job
- `job_type` - One of: `data_collection`, `scoring`, `data_collection_and_scoring`
- `cron_expression` - When to run (e.g., `0 9 * * *` = daily at 9 AM)
- `timezone` - Timezone for cron (e.g., `UTC`, `America/New_York`)
- `is_active` - Whether the job is enabled
- `next_run_at` - When the job should run next (computed from cron)
- `last_run_at` - When the job last ran
- `created_by` - Admin user who created it
- `metadata` - Optional JSON config (collectors, limits, etc.)

**Example:**
```sql
INSERT INTO scheduled_jobs (
  brand_id,
  customer_id,
  job_type,
  cron_expression,
  timezone,
  is_active
) VALUES (
  '838ba1a6-3dec-433d-bea9-a9bc278969ea',
  '157c845c-9e87-4146-8479-cb8d045212bf',
  'data_collection_and_scoring',
  '0 9 * * *',
  'UTC',
  true
);
```

**When it's used:**
- Created when you click "Create Scheduled Job" in Admin UI
- Read by the **Job Scheduler** process to find due jobs
- Updated when you edit/delete jobs
- Updated by scheduler when computing `next_run_at`

### Table 2: `job_runs`

**Purpose:** Tracks the execution history of scheduled jobs. Each time a job runs, a new row is created.

**What it stores:**
- Execution status (pending, processing, completed, failed)
- Execution metrics (queries executed, positions processed, etc.)
- Error messages (if failed)
- Timing information (started_at, finished_at)

**Key Columns:**
- `id` - Unique run ID
- `scheduled_job_id` - Links to the `scheduled_jobs` table
- `brand_id` - Which brand this run is for
- `customer_id` - Which customer owns this run
- `job_type` - Type of job executed
- `status` - One of: `pending`, `processing`, `completed`, `failed`, `cancelled`
- `scheduled_for` - When this run was scheduled for
- `started_at` - When execution started
- `finished_at` - When execution completed
- `error_message` - Error details if failed
- `metrics` - JSON with execution results (queries executed, positions processed, etc.)
- `metadata` - Additional execution context

**Example:**
```sql
-- When scheduler finds a due job, it creates a job_run:
INSERT INTO job_runs (
  scheduled_job_id,
  brand_id,
  customer_id,
  job_type,
  status,
  scheduled_for
) VALUES (
  '<job-id>',
  '<brand-id>',
  '<customer-id>',
  'data_collection_and_scoring',
  'pending',
  NOW()
);
```

**When it's used:**
- Created by **Job Scheduler** when a job is due
- Read by **Job Worker** to find pending jobs to process
- Updated by **Job Worker** as execution progresses
- Read by Admin UI to show job run history

## Legacy System (Deprecated)

### Table 3: `scoring_job_schedules` (OLD - Deprecated)

**Purpose:** Used to store scoring-only job schedules in the old system.

**Status:** ⚠️ **DEPRECATED** - This table is from the old scoring-only cron system. The new unified system uses `scheduled_jobs` instead.

**When it was used:**
- Old `scoringScheduler.ts` process would read from this table
- Only supported scoring jobs, not data collection

**Current status:**
- Still exists in database (for backward compatibility)
- Not used by new unified system
- Can be safely ignored or removed if you're not using old scoring scheduler

### Table 4: `scoring_job_runs` (OLD - Deprecated)

**Purpose:** Used to track scoring-only job execution history in the old system.

**Status:** ⚠️ **DEPRECATED** - This table is from the old scoring-only cron system. The new unified system uses `job_runs` instead.

**When it was used:**
- Old `scoringWorker.ts` process would read from this table
- Only tracked scoring operations

**Current status:**
- Still exists in database (for backward compatibility)
- Not used by new unified system
- Can be safely ignored or removed if you're not using old scoring worker

## Data Flow

### How Jobs Are Created and Executed

```
1. Admin creates job in UI
   ↓
2. INSERT into scheduled_jobs
   - Stores: brand_id, job_type, cron_expression, etc.
   - Sets: next_run_at (computed from cron)
   ↓
3. Job Scheduler (runs every 60 seconds)
   - Queries: SELECT * FROM scheduled_jobs WHERE is_active = true AND next_run_at <= NOW()
   - For each due job:
     a. INSERT into job_runs (status = 'pending')
     b. UPDATE scheduled_jobs SET next_run_at = <next scheduled time>
   ↓
4. Job Worker (runs every 30 seconds)
   - Queries: SELECT * FROM job_runs WHERE status = 'pending'
   - For each pending run:
     a. UPDATE job_runs SET status = 'processing', started_at = NOW()
     b. Execute job (data collection and/or scoring)
     c. UPDATE job_runs SET status = 'completed', finished_at = NOW(), metrics = {...}
   ↓
5. Admin views history in UI
   - Queries: SELECT * FROM job_runs WHERE customer_id = ... ORDER BY created_at DESC
```

## Table Relationships

```
scheduled_jobs (1) ──→ (many) job_runs
     │
     ├── brand_id → brands.id
     └── customer_id → customers.id

job_runs
     │
     ├── scheduled_job_id → scheduled_jobs.id
     ├── brand_id → brands.id
     └── customer_id → customers.id
```

## Which Tables to Use

### ✅ Use These (Current System):
- `scheduled_jobs` - Create/edit/delete job schedules
- `job_runs` - View execution history

### ❌ Ignore These (Legacy System):
- `scoring_job_schedules` - Old, deprecated
- `scoring_job_runs` - Old, deprecated

## Migration from Old to New System

If you have old scoring jobs in `scoring_job_schedules`, you can migrate them:

```sql
-- Migrate old scoring schedules to new unified system
INSERT INTO scheduled_jobs (
  brand_id,
  customer_id,
  job_type,
  cron_expression,
  timezone,
  is_active,
  next_run_at
)
SELECT 
  brand_id,
  customer_id,
  'scoring' as job_type,  -- Old system only had scoring
  cron_expression,
  timezone,
  is_active,
  next_run_at
FROM scoring_job_schedules
WHERE is_active = true;
```

## Summary

| Table | Purpose | Status | Used By |
|-------|---------|--------|---------|
| `scheduled_jobs` | Store job schedules | ✅ Active | Job Scheduler, Admin UI |
| `job_runs` | Track execution history | ✅ Active | Job Worker, Admin UI |
| `scoring_job_schedules` | Old scoring schedules | ⚠️ Deprecated | Old scoringScheduler.ts |
| `scoring_job_runs` | Old scoring history | ⚠️ Deprecated | Old scoringWorker.ts |

**For your daily cron jobs, you only need:**
- `scheduled_jobs` - Where you create your schedules
- `job_runs` - Where execution history is stored

