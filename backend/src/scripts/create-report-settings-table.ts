import { supabaseAdmin } from '../config/database';

/**
 * Migration Script: Create report_settings table
 * 
 * This script creates a table to store report generation and delivery settings
 * for each brand, including frequency and email distribution lists.
 */

async function createReportSettingsTable() {
  console.log('🚀 Starting migration: Create report_settings table');

  try {
    // Create the report_settings table
    const { error: createTableError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Create ENUM type for frequency if it doesn't exist
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

        -- Create index on brand_id for faster lookups
        CREATE INDEX IF NOT EXISTS idx_report_settings_brand_id ON report_settings(brand_id);
        
        -- Create index on customer_id for faster lookups
        CREATE INDEX IF NOT EXISTS idx_report_settings_customer_id ON report_settings(customer_id);

        -- Create trigger to update updated_at timestamp
        CREATE OR REPLACE FUNCTION update_report_settings_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_update_report_settings_updated_at ON report_settings;
        CREATE TRIGGER trigger_update_report_settings_updated_at
          BEFORE UPDATE ON report_settings
          FOR EACH ROW
          EXECUTE FUNCTION update_report_settings_updated_at();

        -- Enable Row Level Security
        ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
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
      `
    });

    if (createTableError) {
      // If rpc doesn't exist, try direct SQL execution
      console.log('⚠️  RPC method not available, attempting direct table creation...');

      // Create enum type
      const { error: enumError } = await supabaseAdmin.from('_migrations').select('*').limit(1);

      // Since we can't execute raw SQL directly, we'll need to create the table through Supabase dashboard
      console.log('⚠️  Please create the table manually in Supabase dashboard with the following schema:');
      console.log(`
Table Name: report_settings

Columns:
  - id: uuid, primary key, default: gen_random_uuid()
  - brand_id: uuid, not null, foreign key -> brands(id) ON DELETE CASCADE
  - customer_id: uuid, not null, foreign key -> customers(id) ON DELETE CASCADE
  - frequency: text, not null, default: 'monthly', check constraint: frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly')
  - distribution_emails: jsonb, not null, default: '[]'
  - is_active: boolean, not null, default: true
  - created_at: timestamptz, not null, default: now()
  - updated_at: timestamptz, not null, default: now()

Constraints:
  - UNIQUE (brand_id, customer_id)

Indexes:
  - idx_report_settings_brand_id on brand_id
  - idx_report_settings_customer_id on customer_id

RLS Policies: (Enable RLS)
  - SELECT: customer_id IN (SELECT customer_id FROM users WHERE id = auth.uid())
  - INSERT: customer_id IN (SELECT customer_id FROM users WHERE id = auth.uid())
  - UPDATE: customer_id IN (SELECT customer_id FROM users WHERE id = auth.uid())
  - DELETE: customer_id IN (SELECT customer_id FROM users WHERE id = auth.uid())
      `);

      throw new Error('Manual table creation required - see console output for schema');
    }

    console.log('✅ Successfully created report_settings table');
    console.log('✅ Created indexes for brand_id and customer_id');
    console.log('✅ Created updated_at trigger');
    console.log('✅ Enabled Row Level Security with policies');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  createReportSettingsTable()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { createReportSettingsTable };
