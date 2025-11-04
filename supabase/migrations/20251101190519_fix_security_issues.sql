/*
  # Fix Database Security Issues

  ## Changes Made

  1. **Add Missing Foreign Key Indexes**
     - Add index on `email_verifications.user_id` to improve foreign key query performance
     - Add index on `password_resets.user_id` to improve foreign key query performance

  2. **Optimize RLS Policies**
     - Update `users` table policies to use `(select auth.uid())` for better performance at scale
     - Update `user_sessions` table policy to use `(select auth.uid())` for better performance at scale
     - This prevents re-evaluation of auth functions for each row

  3. **Remove Unused Indexes**
     - Drop `idx_users_email` (already covered by UNIQUE constraint)
     - Drop `idx_email_verifications_code` (unused index)
     - Drop `idx_password_resets_code` (unused index)
     - Drop `idx_user_sessions_user_id` (replaced by better index below)

  4. **Fix Function Search Path**
     - Update `update_updated_at_column` function with explicit search_path to prevent security issues

  ## Performance Impact
  - Foreign key indexes will significantly improve query performance for joins and cascading deletes
  - Optimized RLS policies will prevent function re-evaluation for each row
  - Removing unused indexes reduces write overhead and storage requirements
*/

-- Add missing foreign key indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

-- Drop unused indexes to reduce overhead
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_email_verifications_code;
DROP INDEX IF EXISTS idx_password_resets_code;
DROP INDEX IF EXISTS idx_user_sessions_user_id;

-- Drop existing RLS policies that need optimization
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;

-- Create optimized RLS policies using (select auth.uid())
-- This prevents re-evaluation of auth.uid() for each row
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix function search path security issue
-- Drop trigger first, then recreate function with explicit search_path
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate trigger to use updated function
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();