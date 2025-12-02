-- Migration: Create Scheduled Jobs and Job Runs Tables
-- Description: Adds support for scheduling data collection and scoring jobs
-- Date: 2025-01-31

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Scheduled Jobs Table
-- Stores job schedules for both data collection and scoring operations
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('data_collection', 'scoring', 'data_collection_and_scoring')),
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID, -- Admin user who created the schedule
  metadata JSONB DEFAULT '{}'::jsonb -- Stores job-specific config (collectors, limits, etc.)
  -- Note: Cron validation is done in application code, not at database level
  -- to allow for more flexible cron expressions
);

-- Job Runs Table
-- Tracks execution history for scheduled jobs
CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_job_id UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('data_collection', 'scoring', 'data_collection_and_scoring')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  metrics JSONB DEFAULT '{}'::jsonb, -- Stores execution metrics (items processed, counts, etc.)
  metadata JSONB DEFAULT '{}'::jsonb, -- Stores execution context and details
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scheduled_jobs
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_brand_customer 
  ON public.scheduled_jobs(brand_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_active_next_run 
  ON public.scheduled_jobs(is_active, next_run_at) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_job_type 
  ON public.scheduled_jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_customer 
  ON public.scheduled_jobs(customer_id);

-- Indexes for job_runs
CREATE INDEX IF NOT EXISTS idx_job_runs_scheduled_job 
  ON public.job_runs(scheduled_job_id);

CREATE INDEX IF NOT EXISTS idx_job_runs_status 
  ON public.job_runs(status) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_job_runs_brand_customer 
  ON public.job_runs(brand_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_job_runs_scheduled_for 
  ON public.job_runs(scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_job_runs_created_at 
  ON public.job_runs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for scheduled_jobs updated_at
DROP TRIGGER IF EXISTS update_scheduled_jobs_updated_at ON public.scheduled_jobs;
CREATE TRIGGER update_scheduled_jobs_updated_at
  BEFORE UPDATE ON public.scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();

-- Comments
COMMENT ON TABLE public.scheduled_jobs IS 'Stores scheduled jobs for data collection and scoring operations';
COMMENT ON TABLE public.job_runs IS 'Tracks execution history for scheduled jobs';
COMMENT ON COLUMN public.scheduled_jobs.job_type IS 'Type of job: data_collection, scoring, or data_collection_and_scoring';
COMMENT ON COLUMN public.scheduled_jobs.metadata IS 'Job-specific configuration (collectors, limits, parallel execution, etc.)';
COMMENT ON COLUMN public.job_runs.metrics IS 'Execution metrics (items processed, counts, durations, etc.)';
COMMENT ON COLUMN public.job_runs.metadata IS 'Execution context and details';

