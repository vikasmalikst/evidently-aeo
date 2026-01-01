# Current Project Summary: Data Collection, Scoring, Admin Page, and Cron Jobs

This document provides a comprehensive overview of the current implementation of data collection, scoring, admin page, and cron jobs in the Evidently project.

---

## 1. Database Tables

### 1.1 Data Collection Tables

#### `generated_queries`
- **Purpose**: Stores queries generated during onboarding that are used for data collection
- **Key Columns**:
  - `id` (uuid, primary key)
  - `query_text` (text) - The actual query to execute
  - `topic` (text, nullable) - Topic name
  - `intent` (text) - Query intent (defaults to 'data_collection')
  - `locale` (text) - Locale (defaults to 'en-US')
  - `country` (text) - Country (defaults to 'US')
  - `brand_id` (uuid, foreign key → brands.id)
  - `customer_id` (uuid, foreign key → customers.id)
  - `is_active` (boolean) - **CRITICAL**: Must be `true` for queries to be executed
  - `generation_id` (uuid, foreign key → query_generations.id)
  - `created_at`, `updated_at` (timestamptz)
- **Usage**: Backend queries this table to find active queries (`is_active = true`) for a brand/customer when data collection is triggered
- **Migration**: `20241112_rename_generated_queries_brand.sql`

#### `query_executions`
- **Purpose**: Tracks execution status of individual queries across different collectors
- **Key Columns**:
  - `id` (uuid, primary key)
  - `query_id` (uuid, foreign key → generated_queries.id)
  - `brand_id` (uuid, foreign key → brands.id)
  - `customer_id` (uuid, foreign key → customers.id)
  - `collector_name` (text) - Name of the collector (e.g., 'chatgpt', 'claude', 'perplexity')
  - `status` (text) - One of: 'pending', 'running', 'completed', 'failed'
  - `started_at`, `finished_at` (timestamptz, nullable)
  - `error_message` (text, nullable)
  - `error_metadata` (jsonb, nullable) - Structured error information
  - `retry_count` (integer, default 0)
  - `retry_history` (jsonb, nullable) - Array of retry attempts
  - `created_at`, `updated_at` (timestamptz)
- **Usage**: Created automatically during data collection to track each query execution attempt
- **Migration**: `20251121180000_add_missing_columns_to_query_executions.sql`

#### `collector_results`
- **Purpose**: Stores the raw collected data from AI models/collectors
- **Key Columns**:
  - `id` (uuid, primary key)
  - `query_execution_id` (uuid, foreign key → query_executions.id)
  - `query_id` (uuid, foreign key → generated_queries.id)
  - `brand_id` (uuid, foreign key → brands.id, CASCADE DELETE)
  - `customer_id` (uuid, foreign key → customers.id)
  - `collector_name` (text) - Name of the collector used
  - `raw_answer` (text) - The raw response from the AI model
  - `raw_response_json` (jsonb) - Complete raw JSON response for debugging
  - `citations` (jsonb, nullable) - Extracted citations
  - `urls` (jsonb, nullable) - URLs mentioned in the response
  - `topic` (text, nullable) - Topic name
  - `sentiment_score` (numeric, nullable) - Sentiment score (-1.0 to 1.0)
  - `sentiment_label` (text, nullable) - POSITIVE, NEGATIVE, or NEUTRAL
  - `collection_time_ms` (integer, nullable) - Time taken for collection in milliseconds
  - `processed_at` (timestamptz, nullable) - When this result was processed/scored
  - `created_at` (timestamptz)
- **Usage**: 
  - Written during data collection after successful collector execution
  - Read during scoring to extract positions, analyze sentiment, and extract citations
- **Migrations**:
  - `20250120000000_add_sentiment_to_collector_results.sql`
  - `20250130000000_add_topic_columns.sql`
  - `20250130000001_add_collection_time_to_collector_results.sql`
  - `20250131000000_add_raw_response_json_to_collector_results.sql`
  - `20250116000000_add_cascade_delete_to_collector_results.sql`

#### `extracted_positions`
- **Purpose**: Stores extracted brand and competitor positions from collector results
- **Key Columns**:
  - `id` (uuid, primary key)
  - `collector_result_id` (uuid, foreign key → collector_results.id)
  - `brand_id` (uuid, foreign key → brands.id, CASCADE DELETE)
  - `customer_id` (uuid, foreign key → customers.id)
  - `brand_name` (text) - Name of the brand
  - `position` (integer) - Position in the response (1-based)
  - `competitor_name` (text, nullable) - Name of competitor if applicable
  - `competitor_position` (integer, nullable) - Position of competitor
  - `topic` (text, nullable) - Topic name
  - `sentiment_score` (numeric, nullable) - Brand sentiment score (-1.0 to 1.0)
  - `sentiment_label` (text, nullable) - POSITIVE, NEGATIVE, or NEUTRAL
  - `sentiment_positive_sentences` (text[], nullable) - Sentences with positive sentiment
  - `sentiment_negative_sentences` (text[], nullable) - Sentences with negative sentiment
  - `sentiment_score_competitor` (numeric, nullable) - Competitor sentiment score
  - `sentiment_label_competitor` (text, nullable) - Competitor sentiment label
  - `sentiment_positive_sentences_competitor` (text[], nullable)
  - `sentiment_negative_sentences_competitor` (text[], nullable)
  - `has_brand_presence` (boolean, default false) - Whether brand is mentioned
  - `metadata` (jsonb, nullable) - Additional metadata
  - `processed_at` (timestamptz, nullable)
  - `created_at` (timestamptz)
- **Usage**: Created during scoring phase when positions are extracted from collector results
- **Migrations**:
  - `20250121000000_add_sentiment_to_extracted_positions.sql`
  - `20251113173000_add_has_brand_presence_flag.sql`
  - `20251113190000_add_metadata_to_extracted_positions.sql`
  - `20250130000000_add_topic_columns.sql`

### 1.2 Scoring Tables

The scoring system primarily uses the tables above (`collector_results`, `extracted_positions`) and also references:

#### `citations`
- **Purpose**: Stores extracted citations from collector results
- **Key Columns**: (Structure varies, but typically includes)
  - `id` (uuid, primary key)
  - `collector_result_id` (uuid, foreign key → collector_results.id)
  - `brand_id`, `customer_id` (uuid, foreign keys)
  - `url` (text) - Citation URL
  - `title` (text, nullable) - Citation title
  - `category` (text, nullable) - Citation category
  - `created_at` (timestamptz)

### 1.3 Cron Job Tables

#### `scheduled_jobs`
- **Purpose**: Stores job schedules/definitions created in the Admin UI
- **Key Columns**:
  - `id` (uuid, primary key)
  - `brand_id` (uuid, foreign key → brands.id, CASCADE DELETE)
  - `customer_id` (uuid, foreign key → customers.id)
  - `job_type` (text) - One of: 'data_collection', 'scoring', 'data_collection_and_scoring'
  - `cron_expression` (text) - Cron expression (e.g., '0 9 * * *' = daily at 9 AM)
  - `timezone` (text, default 'UTC')
  - `is_active` (boolean, default true) - Whether the job is enabled
  - `next_run_at` (timestamptz, nullable) - Computed next run time
  - `last_run_at` (timestamptz, nullable) - Last execution time
  - `created_at`, `updated_at` (timestamptz)
  - `created_by` (uuid, nullable) - Admin user who created it
  - `metadata` (jsonb, default '{}') - Job-specific config (collectors, limits, etc.)
- **Indexes**:
  - `idx_scheduled_jobs_brand_customer` on (brand_id, customer_id)
  - `idx_scheduled_jobs_active_next_run` on (is_active, next_run_at) WHERE is_active = true
  - `idx_scheduled_jobs_job_type` on (job_type)
  - `idx_scheduled_jobs_customer` on (customer_id)
- **Migration**: `20250131000000_create_scheduled_jobs_tables.sql`

#### `job_runs`
- **Purpose**: Tracks execution history for scheduled jobs
- **Key Columns**:
  - `id` (uuid, primary key)
  - `scheduled_job_id` (uuid, foreign key → scheduled_jobs.id, CASCADE DELETE)
  - `brand_id` (uuid, foreign key → brands.id)
  - `customer_id` (uuid, foreign key → customers.id)
  - `job_type` (text) - Same as scheduled_jobs.job_type
  - `status` (text) - One of: 'pending', 'processing', 'completed', 'failed', 'cancelled'
  - `scheduled_for` (timestamptz) - When this run was scheduled for
  - `started_at`, `finished_at` (timestamptz, nullable)
  - `error_message` (text, nullable)
  - `metrics` (jsonb, default '{}') - Execution metrics (queries executed, positions processed, etc.)
  - `metadata` (jsonb, default '{}') - Execution context and details
  - `created_at` (timestamptz)
- **Indexes**:
  - `idx_job_runs_scheduled_job` on (scheduled_job_id)
  - `idx_job_runs_status` on (status) WHERE status IN ('pending', 'processing')
  - `idx_job_runs_brand_customer` on (brand_id, customer_id)
  - `idx_job_runs_scheduled_for` on (scheduled_for DESC)
  - `idx_job_runs_created_at` on (created_at DESC)
- **Migration**: `20250131000000_create_scheduled_jobs_tables.sql`

---

## 2. API Endpoints

### 2.1 Data Collection APIs

#### `POST /api/admin/brands/:brandId/collect-data-now`
- **Purpose**: Immediately trigger data collection for a brand (no schedule needed)
- **Request Body**:
  ```json
  {
    "customer_id": "uuid (required)",
    "collectors": ["chatgpt", "claude", "perplexity"] (optional),
    "locale": "en-US" (optional),
    "country": "US" (optional)
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "queriesExecuted": 10,
      "collectorResults": 30,
      "successfulExecutions": 28,
      "failedExecutions": 2,
      "errors": []
    }
  }
  ```
- **Flow**:
  1. Validates `customer_id` is provided
  2. Determines collectors to use:
     - If `collectors` provided in body, use those
     - Otherwise, fetch brand's `ai_models` from `brands` table
     - Map AI models to collector names (e.g., 'chatgpt' → 'chatgpt', 'google-ai' → 'google_aio')
     - If no collectors found, use defaults: ['chatgpt', 'google_aio', 'perplexity', 'claude']
  3. Calls `dataCollectionJobService.executeDataCollection()`
  4. Returns result immediately
- **Implementation**: `backend/src/routes/admin.routes.ts` (lines 778-843)

#### `POST /api/admin/brands/:brandId/collect-and-score-now`
- **Purpose**: Immediately trigger data collection followed by scoring (runs in background)
- **Request Body**: Same as `collect-data-now` plus optional scoring params:
  ```json
  {
    "customer_id": "uuid (required)",
    "collectors": [] (optional),
    "locale": "en-US" (optional),
    "country": "US" (optional),
    "positionLimit": 50 (optional),
    "sentimentLimit": 50 (optional),
    "parallel": false (optional)
  }
  ```
- **Response**: Returns immediately with status 'started', then runs in background
  ```json
  {
    "success": true,
    "message": "Data collection and scoring started in background...",
    "data": {
      "brandId": "uuid",
      "status": "started",
      "startedAt": "2025-01-31T12:00:00Z"
    }
  }
  ```
- **Flow**:
  1. Validates `customer_id`
  2. Returns immediately (to avoid timeout)
  3. Runs in background using `setImmediate()`:
     - Step 1: Execute data collection (same as `collect-data-now`)
     - Step 2: Execute scoring (same as `score-now`)
  4. Errors are collected but don't block the process
- **Implementation**: `backend/src/routes/admin.routes.ts` (lines 940-1068)

### 2.2 Scoring APIs

#### `POST /api/admin/brands/:brandId/score-now`
- **Purpose**: Immediately trigger scoring for a brand (processes unprocessed collector results)
- **Request Body**:
  ```json
  {
    "customer_id": "uuid (required)",
    "since": "2025-01-01T00:00:00Z" (optional - only process results after this time),
    "positionLimit": 50 (optional),
    "sentimentLimit": 50 (optional),
    "parallel": false (optional)
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "positionsProcessed": 100,
      "sentimentsProcessed": 100,
      "competitorSentimentsProcessed": 50,
      "citationsProcessed": 200,
      "errors": []
    }
  }
  ```
- **Flow**:
  1. Validates `customer_id`
  2. Calls `brandScoringService.scoreBrand()`
  3. Scoring service:
     - Extracts positions from `collector_results` → writes to `extracted_positions`
     - Analyzes sentiment for brand and competitors → updates `extracted_positions` and `collector_results`
     - Extracts citations → writes to `citations` table
  4. Returns summary of processed items
- **Implementation**: `backend/src/routes/admin.routes.ts` (lines 849-888)

### 2.3 Scheduled Jobs Management APIs

#### `GET /api/admin/scheduled-jobs`
- **Purpose**: List scheduled jobs
- **Query Params**: `customer_id` (required), `brand_id` (optional)
- **Response**: Array of `scheduled_jobs` records

#### `POST /api/admin/scheduled-jobs`
- **Purpose**: Create a new scheduled job
- **Request Body**:
  ```json
  {
    "brand_id": "uuid",
    "customer_id": "uuid",
    "job_type": "data_collection" | "scoring" | "data_collection_and_scoring",
    "cron_expression": "0 9 * * *",
    "timezone": "UTC",
    "is_active": true,
    "metadata": {} (optional)
  }
  ```
- **Response**: Created job record

#### `PUT /api/admin/scheduled-jobs/:jobId`
- **Purpose**: Update a scheduled job (e.g., toggle active status)
- **Request Body**: Partial job data
- **Response**: Updated job record

#### `DELETE /api/admin/scheduled-jobs/:jobId`
- **Purpose**: Delete a scheduled job
- **Response**: Success confirmation

#### `POST /api/admin/scheduled-jobs/:jobId/trigger`
- **Purpose**: Manually trigger a scheduled job immediately
- **Response**: Job run created

#### `GET /api/admin/job-runs`
- **Purpose**: List job runs (execution history)
- **Query Params**: `customer_id` (required), `brand_id` (optional), `scheduled_job_id` (optional), `limit` (optional)
- **Response**: Array of `job_runs` records

#### `GET /api/admin/job-runs/:runId`
- **Purpose**: Get details of a specific job run
- **Response**: Single `job_runs` record with full metrics

#### `GET /api/admin/brands/:brandId/queries-diagnostic`
- **Purpose**: Get diagnostic information about a brand's queries and data collection status
- **Query Params**: `customer_id` (required)
- **Response**:
  ```json
  {
    "queries": {
      "total": 100,
      "active": 95
    },
    "collectorResults": {
      "count": 500
    },
    "diagnostic": {
      "hasActiveQueries": true,
      "canCollectData": true
    }
  }
  ```

**Implementation**: `backend/src/routes/admin.routes.ts` (lines 372-1068)

---

## 3. Admin Page

### 3.1 Location
- **File**: `src/pages/admin/ScheduledJobs.tsx`
- **Route**: `/admin/scheduled-jobs` (defined in `src/App.tsx`)

### 3.2 Features

#### Brand Selection
- Dropdown to select a brand
- Fetches `customer_id` from auth store or brand API
- Used for filtering jobs and quick actions

#### Quick Actions (for selected brand)
1. **Collect Data Now**
   - Button: Green "Collect Data Now"
   - Calls `POST /api/admin/brands/:brandId/collect-data-now`
   - Shows loading state while collecting
   - Displays success message with queries executed count

2. **Score Now**
   - Button: Purple "Score Now"
   - Calls `POST /api/admin/brands/:brandId/score-now`
   - Shows loading state while scoring
   - Displays success message with positions/sentiments processed

3. **Collect & Score** (Recommended)
   - Button: Orange "Collect & Score"
   - Calls `POST /api/admin/brands/:brandId/collect-and-score-now`
   - Runs both operations in sequence
   - Shows background processing message

4. **View Historical Trends**
   - Link to `/search-visibility` page
   - Opens in new tab

#### Diagnostic Information
- Shows when "Show Diagnostic" button is clicked
- Displays:
  - Active Queries count
  - Total Queries count
  - Collector Results count
  - Can Collect Data status (Yes/No)
- Warning if no active queries found

#### Scheduled Jobs Table
- Columns:
  - Brand name
  - Job Type (Data Collection, Scoring, or Data Collection + Scoring)
  - Schedule (cron expression)
  - Next Run (formatted date/time)
  - Status (Active/Inactive badge)
  - Actions:
    - **Activate/Deactivate**: Toggle job status
    - **Trigger**: Manually trigger job
    - **History**: View job run history modal
    - **Trends**: Link to trends page
    - **Delete**: Delete job

#### Create Scheduled Job Modal
- Form fields:
  - Brand (dropdown)
  - Job Type (dropdown: Data Collection, Scoring, Data Collection + Scoring)
  - Cron Expression (text input, e.g., "0 9 * * *")
  - Timezone (text input, default "UTC")
  - Active (checkbox)
- Submits to `POST /api/admin/scheduled-jobs`

#### Recent Job Runs Section
- Lists last 10 job runs
- Shows:
  - Status badge (pending, processing, completed, failed, cancelled)
  - Job type
  - Scheduled time
  - Error message (if failed)
  - Metrics (JSON formatted)

#### Job Run History Modal
- Opens when clicking "History" on a job
- Shows all runs for that job (up to 50)
- Displays:
  - Status badge
  - Scheduled time
  - Duration (if completed)
  - Error message (if failed)
  - Full metrics JSON

---

## 4. Cron Jobs

### 4.1 Architecture

The cron job system consists of two separate processes:

1. **Job Scheduler** (`unified-job-scheduler.ts`)
   - Polls `scheduled_jobs` table for due jobs
   - Creates `job_runs` records with status 'pending'
   - Updates `next_run_at` on scheduled jobs

2. **Job Worker** (`unified-job-worker.ts`)
   - Polls `job_runs` table for 'pending' jobs
   - Claims jobs by updating status to 'processing'
   - Executes the actual work (data collection and/or scoring)
   - Updates job run with results and metrics

### 4.2 Job Scheduler

**File**: `backend/src/cron/unified-job-scheduler.ts`

**Functionality**:
- Polls every 60 seconds (configurable via `JOB_SCHEDULER_POLL_MS`)
- Queries `scheduled_jobs` where:
  - `is_active = true`
  - `next_run_at <= NOW()`
- For each due job:
  1. Creates a `job_runs` record with status 'pending'
  2. Updates `scheduled_jobs.next_run_at` to next scheduled time (computed from cron expression)
- Uses `jobSchedulerService` (`backend/src/services/jobs/job-scheduler.service.ts`)

**Key Methods**:
- `enqueueDueJobs()`: Finds due jobs and enqueues them
- `tick()`: Main polling loop

### 4.3 Job Worker

**File**: `backend/src/cron/unified-job-worker.ts`

**Functionality**:
- Polls every 30 seconds (configurable via `JOB_WORKER_POLL_MS`)
- Queries `job_runs` where:
  - `status = 'pending'`
  - Ordered by `scheduled_for` ASC
  - Limited to 5 runs per tick (configurable via `JOB_WORKER_BATCH`)
- For each pending run:
  1. **Claims the job**: Updates status to 'processing' and sets `started_at` (atomic operation to prevent duplicate processing)
  2. **Fetches scheduled job details**: Gets job configuration from `scheduled_jobs`
  3. **Determines collectors**: 
     - If `metadata.collectors` exists, use those
     - Otherwise, fetch brand's `ai_models` and map to collectors
     - Default to ['chatgpt', 'google_aio', 'perplexity', 'claude'] if none found
  4. **Executes based on job_type**:
     - **`data_collection`**: Calls `dataCollectionJobService.executeDataCollection()`
     - **`scoring`**: Calls `brandScoringService.scoreBrand()`
     - **`data_collection_and_scoring`**: Executes both in sequence
  5. **Updates job run**: Sets status to 'completed' or 'failed', records metrics, sets `finished_at`
  6. **Updates scheduled job**: Sets `last_run_at` to current time

**Key Methods**:
- `processPendingRuns()`: Finds and processes pending runs
- `processSingleRun()`: Processes a single job run
- `markRunFailed()`: Marks a run as failed with error message

### 4.4 Data Collection Job Service

**File**: `backend/src/services/jobs/data-collection-job.service.ts`

**Functionality**:
- Queries `generated_queries` for active queries (`is_active = true`) for the brand/customer
- For each query:
  1. Creates `query_executions` records for each collector
  2. Executes query using `dataCollectionService` (which calls various collector services)
  3. On success: Creates `collector_results` record
  4. On failure: Updates `query_executions` with error
- Returns summary:
  - `queriesExecuted`: Number of queries processed
  - `collectorResults`: Number of results created
  - `successfulExecutions`: Number of successful executions
  - `failedExecutions`: Number of failed executions
  - `errors`: Array of errors

### 4.5 Scoring Service

**File**: `backend/src/services/scoring/brand-scoring.orchestrator.ts`

**Functionality**:
- Orchestrates all scoring operations for a brand
- Uses feature flag `USE_CONSOLIDATED_ANALYSIS`:
  - If `true`: Uses `consolidatedScoringService` (single API call approach)
  - If `false`: Uses legacy approach (separate calls)
- **Legacy Approach** (if `USE_CONSOLIDATED_ANALYSIS = false`):
  1. **Position Extraction**: 
     - Queries `collector_results` where `processed_at IS NULL`
     - Extracts brand and competitor positions
     - Writes to `extracted_positions`
  2. **Sentiment Analysis**:
     - Analyzes sentiment for brand and competitors
     - Updates `extracted_positions` with sentiment scores and labels
     - Updates `collector_results` with sentiment
  3. **Citation Extraction**:
     - Extracts citations from collector results
     - Writes to `citations` table
- Returns summary:
  - `positionsProcessed`: Number of positions extracted
  - `sentimentsProcessed`: Number of sentiments analyzed
  - `competitorSentimentsProcessed`: Number of competitor sentiments
  - `citationsProcessed`: Number of citations extracted
  - `errors`: Array of errors

### 4.6 Running Cron Jobs

**Process Management**:
- Both scheduler and worker should run as separate Node.js processes
- Typically run via PM2, systemd, or similar process manager
- Can be run manually:
  ```bash
  # Terminal 1: Job Scheduler
  cd backend
  npm run cron:scheduler
  # or
  ts-node src/cron/unified-job-scheduler.ts

  # Terminal 2: Job Worker
  cd backend
  npm run cron:worker
  # or
  ts-node src/cron/unified-job-worker.ts
  ```

**Environment Variables**:
- `JOB_SCHEDULER_POLL_MS`: Polling interval for scheduler (default: 60000 = 60 seconds)
- `JOB_SCHEDULER_BATCH`: Max schedules to process per tick (default: 25)
- `JOB_WORKER_POLL_MS`: Polling interval for worker (default: 30000 = 30 seconds)
- `JOB_WORKER_BATCH`: Max runs to process per tick (default: 5)
- `USE_CONSOLIDATED_ANALYSIS`: Use consolidated scoring (default: false)

---

## 5. Data Flow

### 5.1 Data Collection Flow

```
1. User clicks "Collect Data Now" or scheduled job triggers
   ↓
2. Backend queries: SELECT * FROM generated_queries 
   WHERE brand_id = ? AND customer_id = ? AND is_active = true
   ↓
3. For each query:
   a. Create query_executions records for each collector
   b. Execute query via collector service (ChatGPT, Claude, etc.)
   c. On success:
      - INSERT INTO collector_results (raw_answer, citations, urls, ...)
      - UPDATE query_executions SET status = 'completed'
   d. On failure:
      - UPDATE query_executions SET status = 'failed', error_message = ...
   ↓
4. Return summary: queriesExecuted, collectorResults, successfulExecutions, failedExecutions
```

### 5.2 Scoring Flow

```
1. User clicks "Score Now" or scheduled job triggers
   ↓
2. Backend queries: SELECT * FROM collector_results 
   WHERE brand_id = ? AND customer_id = ? AND processed_at IS NULL
   ↓
3. Position Extraction:
   a. For each collector_result:
      - Extract brand position (where brand is mentioned)
      - Extract competitor positions (if mentioned)
      - INSERT INTO extracted_positions (brand_name, position, competitor_name, ...)
   ↓
4. Sentiment Analysis:
   a. For each extracted_position:
      - Analyze sentiment for brand (POSITIVE/NEGATIVE/NEUTRAL, score -1.0 to 1.0)
      - Analyze sentiment for competitors (if applicable)
      - UPDATE extracted_positions SET sentiment_score, sentiment_label, ...
      - UPDATE collector_results SET sentiment_score, sentiment_label
   ↓
5. Citation Extraction:
   a. For each collector_result:
      - Extract citations (URLs, titles)
      - INSERT INTO citations (url, title, category, ...)
   ↓
6. Mark results as processed:
   - UPDATE collector_results SET processed_at = NOW()
   ↓
7. Return summary: positionsProcessed, sentimentsProcessed, citationsProcessed
```

### 5.3 Scheduled Job Flow

```
1. Admin creates job in UI
   ↓
2. POST /api/admin/scheduled-jobs
   - INSERT INTO scheduled_jobs (job_type, cron_expression, ...)
   - Compute next_run_at from cron expression
   ↓
3. Job Scheduler (runs every 60s):
   - SELECT * FROM scheduled_jobs 
     WHERE is_active = true AND next_run_at <= NOW()
   - For each due job:
     a. INSERT INTO job_runs (status = 'pending', scheduled_for = NOW())
     b. UPDATE scheduled_jobs SET next_run_at = <next scheduled time>
   ↓
4. Job Worker (runs every 30s):
   - SELECT * FROM job_runs WHERE status = 'pending' LIMIT 5
   - For each pending run:
     a. UPDATE job_runs SET status = 'processing', started_at = NOW()
     b. Execute job (data collection and/or scoring)
     c. UPDATE job_runs SET status = 'completed', finished_at = NOW(), metrics = {...}
     d. UPDATE scheduled_jobs SET last_run_at = NOW()
   ↓
5. Admin views history in UI:
   - GET /api/admin/job-runs?customer_id=...&brand_id=...
   - Display in "Recent Job Runs" section
```

---

## 6. Key Services

### 6.1 Data Collection Service
- **File**: `backend/src/services/data-collection/data-collection.service.ts`
- **Purpose**: Orchestrates data collection across multiple collectors
- **Collectors**: ChatGPT, Claude, Perplexity, Google AI, etc.

### 6.2 Scoring Services
- **Position Extraction**: `backend/src/services/scoring/position-extraction.service.ts`
- **Brand Sentiment**: `backend/src/services/scoring/sentiment/brand-sentiment.service.ts`
- **Competitor Sentiment**: `backend/src/services/scoring/sentiment/competitor-sentiment.service.ts`
- **Combined Sentiment**: `backend/src/services/scoring/sentiment/combined-sentiment.service.ts`
- **Consolidated Scoring**: `backend/src/services/scoring/consolidated-scoring.service.ts`
- **Citation Extraction**: `backend/src/services/citations/citation-extraction.service.ts`

### 6.3 Job Services
- **Job Scheduler Service**: `backend/src/services/jobs/job-scheduler.service.ts`
- **Data Collection Job Service**: `backend/src/services/jobs/data-collection-job.service.ts`

---

## 7. Important Notes

### 7.1 Query Activation
- **CRITICAL**: Queries in `generated_queries` must have `is_active = true` to be executed
- If no active queries found, data collection will fail with "No active queries found"
- Queries are typically created during onboarding, but can be manually activated via SQL:
  ```sql
  UPDATE generated_queries 
  SET is_active = true 
  WHERE brand_id = ? AND customer_id = ?;
  ```

### 7.2 Collector Selection
- Collectors are automatically determined from brand's `ai_models` field
- Mapping: 'chatgpt' → 'chatgpt', 'google-ai' → 'google_aio', 'claude' → 'claude', etc.
- If no `ai_models` set, defaults to: ['chatgpt', 'google_aio', 'perplexity', 'claude']

### 7.3 Job Types
- **`data_collection`**: Only collects data, doesn't score
- **`scoring`**: Only scores existing data, doesn't collect
- **`data_collection_and_scoring`**: Collects data first, then automatically scores it (recommended)

### 7.4 Error Handling
- Failed job runs are marked with status 'failed' and include `error_message`
- Errors don't block subsequent operations (e.g., if data collection fails, scoring can still run on existing data)
- Job runs include `metrics` JSONB field with detailed execution results

### 7.5 Performance
- Data collection typically takes 10-20 minutes depending on number of queries
- Scoring typically takes 5-15 minutes depending on data volume
- Combined operations take 15-35 minutes
- Large jobs may take longer - monitor via job run history

---

## 8. File Locations Summary

### Backend
- **Admin Routes**: `backend/src/routes/admin.routes.ts`
- **Job Scheduler**: `backend/src/cron/unified-job-scheduler.ts`
- **Job Worker**: `backend/src/cron/unified-job-worker.ts`
- **Data Collection Job Service**: `backend/src/services/jobs/data-collection-job.service.ts`
- **Job Scheduler Service**: `backend/src/services/jobs/job-scheduler.service.ts`
- **Brand Scoring Service**: `backend/src/services/scoring/brand-scoring.orchestrator.ts`
- **Data Collection Service**: `backend/src/services/data-collection/data-collection.service.ts`

### Frontend
- **Admin Page**: `src/pages/admin/ScheduledJobs.tsx`
- **Route Definition**: `src/App.tsx` (line 20, route `/admin/scheduled-jobs`)

### Database Migrations
- **Scheduled Jobs Tables**: `supabase/migrations/20250131000000_create_scheduled_jobs_tables.sql`
- **Collector Results**: Various migrations in `supabase/migrations/`
- **Query Executions**: `supabase/migrations/20251121180000_add_missing_columns_to_query_executions.sql`
- **Extracted Positions**: Various migrations in `supabase/migrations/`

---

**Last Updated**: January 2025
**Version**: 1.0

