/*
  # Dashboard Snapshot Cache

  - Stores precomputed dashboard payloads per brand & customer
  - Enables near-instant dashboard loads by serving cached summaries
*/

CREATE TABLE IF NOT EXISTS brand_dashboard_snapshots (
  brand_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_dashboard_snapshots_customer
  ON brand_dashboard_snapshots (customer_id, computed_at DESC);

ALTER TABLE brand_dashboard_snapshots
  ENABLE ROW LEVEL SECURITY;

-- Allow service role full access; backend uses service_role key
DROP POLICY IF EXISTS "Service role can manage dashboard snapshots" ON brand_dashboard_snapshots;
CREATE POLICY "Service role can manage dashboard snapshots"
  ON brand_dashboard_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


