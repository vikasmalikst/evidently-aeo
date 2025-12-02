-- Migration: Fix topic_configurations foreign key constraint
-- Description: Removes invalid foreign key reference to users table since users table doesn't exist
-- Date: 2025-11-27

-- Drop the foreign key constraint on created_by if it exists
ALTER TABLE IF EXISTS public.topic_configurations
  DROP CONSTRAINT IF EXISTS topic_configurations_created_by_fkey;

-- Drop the foreign key constraint on changed_by in topic_change_log if it exists  
ALTER TABLE IF EXISTS public.topic_change_log
  DROP CONSTRAINT IF EXISTS topic_change_log_changed_by_fkey;

-- Note: created_by and changed_by columns remain as UUID fields but without foreign key constraints
-- They can store UUID values or NULL, but won't validate against any table

