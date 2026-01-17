-- Create ENUM type for report frequency
DO $$ BEGIN
  CREATE TYPE report_frequency AS ENUM ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create report_settings table
CREATE TABLE IF NOT EXISTS report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  frequency report_frequency NOT NULL DEFAULT 'monthly',
  day_of_week TEXT,
  day_of_month INTEGER,
  month_in_quarter INTEGER,
  custom_interval INTEGER,
  start_date TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  distribution_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_brand_report_settings UNIQUE (brand_id, customer_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_report_settings_brand_id ON report_settings(brand_id);
CREATE INDEX IF NOT EXISTS idx_report_settings_customer_id ON report_settings(customer_id);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_report_settings_updated_at ON report_settings;
CREATE TRIGGER trigger_update_report_settings_updated_at
  BEFORE UPDATE ON report_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_report_settings_updated_at();

-- Enable Row Level Security
ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user access
DROP POLICY IF EXISTS "Users can view their own report settings" ON report_settings;
CREATE POLICY "Users can view their own report settings"
  ON report_settings FOR SELECT
  USING (customer_id IN (
    SELECT customer_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert their own report settings" ON report_settings;
CREATE POLICY "Users can insert their own report settings"
  ON report_settings FOR INSERT
  WITH CHECK (customer_id IN (
    SELECT customer_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update their own report settings" ON report_settings;
CREATE POLICY "Users can update their own report settings"
  ON report_settings FOR UPDATE
  USING (customer_id IN (
    SELECT customer_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete their own report settings" ON report_settings;
CREATE POLICY "Users can delete their own report settings"
  ON report_settings FOR DELETE
  USING (customer_id IN (
    SELECT customer_id FROM users WHERE id = auth.uid()
  ));
