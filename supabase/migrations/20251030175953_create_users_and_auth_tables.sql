/*
  # Authentication and User Management Schema

  ## Overview
  This migration creates the core tables needed for user authentication and session management.

  ## New Tables
  
  ### `users`
  - `id` (uuid, primary key) - References auth.users(id)
  - `email` (varchar, unique, not null) - User email address
  - `full_name` (varchar) - User's full name
  - `email_verified` (boolean, default false) - Email verification status
  - `created_at` (timestamp) - Account creation timestamp
  - `updated_at` (timestamp) - Last update timestamp

  ### `email_verifications`
  - `id` (uuid, primary key) - Verification record ID
  - `user_id` (uuid, foreign key) - References users(id)
  - `email` (varchar) - Email to verify
  - `verification_code` (varchar) - 6-digit verification code
  - `expires_at` (timestamp) - Code expiration time (24 hours)
  - `created_at` (timestamp) - Record creation time

  ### `password_resets`
  - `id` (uuid, primary key) - Reset record ID
  - `user_id` (uuid, foreign key) - References users(id)
  - `email` (varchar) - Email for reset
  - `reset_code` (varchar) - Reset code
  - `expires_at` (timestamp) - Code expiration time (1 hour)
  - `created_at` (timestamp) - Record creation time

  ### `user_sessions`
  - `id` (uuid, primary key) - Session ID
  - `user_id` (uuid, foreign key) - References users(id)
  - `login_at` (timestamp) - Login timestamp
  - `logout_at` (timestamp, nullable) - Logout timestamp
  - `ip_address` (varchar) - User IP address
  - `user_agent` (text) - Browser user agent

  ## Security
  - Enable RLS on all tables
  - Users can only read their own data
  - Email verifications and password resets are managed server-side only
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) UNIQUE NOT NULL,
  full_name varchar(255),
  email_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  verification_code varchar(10) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  reset_code varchar(10) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  ip_address varchar(45),
  user_agent text
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for email_verifications (service role only)
CREATE POLICY "Service role can manage email verifications"
  ON email_verifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for password_resets (service role only)
CREATE POLICY "Service role can manage password resets"
  ON password_resets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code ON email_verifications(verification_code);
CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets(reset_code);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();