/*
  # Add Missing Columns to query_executions Table

  ## Problem
  Commit b67e7dd (Nov 14, 2025) added enhanced error handling to the data collection
  service, including structured error types and retry logic. The code was updated to
  use new database columns (`updated_at`, `error_metadata`, `retry_count`, `retry_history`)
  but the corresponding database migration was never created or applied.
  
  This is causing all collector executions to fail with PGRST204 errors:
  - "Could not find the 'updated_at' column of 'query_executions' in the schema cache"
  - "Could not find the 'error_metadata' column of 'query_executions' in the schema cache"

  ## Root Cause
  Code migration without corresponding database migration - the enhanced error handling
  features were added to the codebase but the database schema was never updated.

  ## Changes
  1. Add `updated_at` column (timestamptz) - tracks when execution records are updated
  2. Add `error_metadata` column (jsonb) - stores structured error information
  3. Add `retry_count` column (integer) - tracks number of retry attempts
  4. Add `retry_history` column (jsonb) - stores array of retry attempt records
  5. Add trigger to automatically update `updated_at` on row updates
  6. Add indexes for performance

  ## Impact
  - Fixes data collection failures for all collectors (ChatGPT, Gemini, Bing Copilot, Perplexity, Grok)
  - Enables proper error tracking and debugging
  - Allows execution status updates to succeed
  - Enables retry logic tracking and circuit breaker functionality
*/

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'query_executions' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE query_executions 
    ADD COLUMN updated_at timestamptz DEFAULT now();
    
    -- Update existing rows to have updated_at = created_at or now()
    UPDATE query_executions 
    SET updated_at = COALESCE(executed_at, now())
    WHERE updated_at IS NULL;
  END IF;
END $$;

-- Add error_metadata column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'query_executions' 
    AND column_name = 'error_metadata'
  ) THEN
    ALTER TABLE query_executions 
    ADD COLUMN error_metadata jsonb DEFAULT NULL;
    
    COMMENT ON COLUMN query_executions.error_metadata IS 'Structured error information including error type, context, and retry details';
  END IF;
END $$;

-- Add retry_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'query_executions' 
    AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE query_executions 
    ADD COLUMN retry_count integer DEFAULT 0;
    
    COMMENT ON COLUMN query_executions.retry_count IS 'Number of retry attempts made for this execution';
  END IF;
END $$;

-- Add retry_history column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'query_executions' 
    AND column_name = 'retry_history'
  ) THEN
    ALTER TABLE query_executions 
    ADD COLUMN retry_history jsonb DEFAULT '[]'::jsonb;
    
    COMMENT ON COLUMN query_executions.retry_history IS 'Array of retry attempt records with timestamps and error details';
  END IF;
END $$;

-- Create or update trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_query_executions_updated_at ON query_executions;

CREATE TRIGGER update_query_executions_updated_at
  BEFORE UPDATE ON query_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index on updated_at for performance
CREATE INDEX IF NOT EXISTS idx_query_executions_updated_at 
  ON query_executions(updated_at);

-- Add index on error_metadata for error querying (GIN index for jsonb)
CREATE INDEX IF NOT EXISTS idx_query_executions_error_metadata 
  ON query_executions USING GIN (error_metadata);

-- Add index on retry_count for filtering failed retries
CREATE INDEX IF NOT EXISTS idx_query_executions_retry_count 
  ON query_executions(retry_count) 
  WHERE retry_count > 0;

COMMENT ON TABLE query_executions IS 'Tracks query execution attempts across different collectors';
