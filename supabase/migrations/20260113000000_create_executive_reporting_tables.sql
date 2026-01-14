-- Migration: Create Executive Reporting Tables
-- Description: Creates tables for executive reporting feature including reports, schedules, annotations, and GA integrations
-- Date: 2026-01-13

-- Create executive_reports table
CREATE TABLE IF NOT EXISTS executive_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  comparison_period_start DATE NOT NULL,
  comparison_period_end DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  executive_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups by brand and date range
CREATE INDEX idx_executive_reports_brand_period ON executive_reports(brand_id, report_period_end DESC);
CREATE INDEX idx_executive_reports_generated_at ON executive_reports(generated_at DESC);

-- Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  reporting_period_days INTEGER NOT NULL CHECK (reporting_period_days IN (7, 30, 60, 90)),
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
 last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create partial unique index to ensure only one active schedule per brand
CREATE UNIQUE INDEX idx_unique_active_brand_schedule ON report_schedules(brand_id) WHERE is_active = true;

-- Create index for finding due schedules
CREATE INDEX idx_report_schedules_next_send ON report_schedules(next_send_at) WHERE is_active = true;
CREATE INDEX idx_report_schedules_brand ON report_schedules(brand_id);

-- Create report_annotations table
CREATE TABLE IF NOT EXISTS report_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES executive_reports(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  target_id TEXT,
  comment TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentions JSONB DEFAULT '[]'::jsonb,
  status TEXT CHECK (status IN ('discuss', 'action_required', 'resolved')),
  parent_comment_id UUID REFERENCES report_annotations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for annotations
CREATE INDEX idx_report_annotations_report ON report_annotations(report_id);
CREATE INDEX idx_report_annotations_author ON report_annotations(author_id);
CREATE INDEX idx_report_annotations_created ON report_annotations(created_at DESC);

-- Create ga_integrations table
CREATE TABLE IF NOT EXISTS ga_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  ga_property_id TEXT NOT NULL,
  ga_view_id TEXT,
  access_token TEXT, -- Will be encrypted at application level
  refresh_token TEXT, -- Will be encrypted at application level
  token_expiry TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for active GA integrations
CREATE INDEX idx_ga_integrations_brand ON ga_integrations(brand_id) WHERE is_active = true;

-- Add updated_at trigger for executive_reports
CREATE OR REPLACE FUNCTION update_executive_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_executive_reports_updated_at
  BEFORE UPDATE ON executive_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_executive_reports_updated_at();

-- Add updated_at trigger for report_schedules
CREATE OR REPLACE FUNCTION update_report_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_report_schedules_updated_at
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_report_schedules_updated_at();

-- Add updated_at trigger for report_annotations
CREATE OR REPLACE FUNCTION update_report_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_report_annotations_updated_at
  BEFORE UPDATE ON report_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_report_annotations_updated_at();

-- Add updated_at trigger for ga_integrations
CREATE OR REPLACE FUNCTION update_ga_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ga_integrations_updated_at
  BEFORE UPDATE ON ga_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_ga_integrations_updated_at();

-- Add RLS policies (Row Level Security)
ALTER TABLE executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policy for executive_reports: users can only access reports for their brands
CREATE POLICY executive_reports_access_policy ON executive_reports
  FOR ALL
  USING (
    brand_id IN (
      SELECT b.id FROM brands b
      INNER JOIN users u ON u.customer_id = b.customer_id
      WHERE u.id = auth.uid()
    )
  );

-- RLS policy for report_schedules: users can only access schedules for their brands
CREATE POLICY report_schedules_access_policy ON report_schedules
  FOR ALL
  USING (
    brand_id IN (
      SELECT b.id FROM brands b
      INNER JOIN users u ON u.customer_id = b.customer_id
      WHERE u.id = auth.uid()
    )
  );

-- RLS policy for report_annotations: users can only access annotations for their brand reports
CREATE POLICY report_annotations_access_policy ON report_annotations
  FOR ALL
  USING (
    report_id IN (
      SELECT er.id FROM executive_reports er
      INNER JOIN brands b ON b.id = er.brand_id
      INNER JOIN users u ON u.customer_id = b.customer_id
      WHERE u.id = auth.uid()
    )
  );

-- RLS policy for ga_integrations: users can only access GA integrations for their brands
CREATE POLICY ga_integrations_access_policy ON ga_integrations
  FOR ALL
  USING (
    brand_id IN (
      SELECT b.id FROM brands b
      INNER JOIN users u ON u.customer_id = b.customer_id
      WHERE u.id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE executive_reports IS 'Stores generated executive reports with snapshot data';
COMMENT ON TABLE report_schedules IS 'Manages automated report scheduling and delivery';
COMMENT ON TABLE report_annotations IS 'Stores collaborative comments and annotations on reports';
COMMENT ON TABLE ga_integrations IS 'Google Analytics integration configuration per brand';
