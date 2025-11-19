-- Rollback Migration: Remove Prompt Versioning Tables
-- Description: Rolls back the prompt versioning system
-- WARNING: This will delete all version history and metrics
-- Date: 2025-11-18

-- Remove columns from collector_results
ALTER TABLE public.collector_results
  DROP COLUMN IF EXISTS configuration_id,
  DROP COLUMN IF EXISTS configuration_version;

-- Drop views that depend on is_active column (if they exist)
DROP VIEW IF EXISTS queries_with_context CASCADE;

-- Remove columns from generated_queries
ALTER TABLE public.generated_queries
  DROP COLUMN IF EXISTS archived_by CASCADE,
  DROP COLUMN IF EXISTS archived_at CASCADE,
  DROP COLUMN IF EXISTS is_active CASCADE;

-- Drop tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS public.prompt_metrics_snapshots CASCADE;
DROP TABLE IF EXISTS public.prompt_change_log CASCADE;
DROP TABLE IF EXISTS public.prompt_configuration_snapshots CASCADE;
DROP TABLE IF EXISTS public.prompt_configurations CASCADE;

-- Note: This does not remove the UUID extension as it may be used elsewhere

