
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
    console.log('Connecting to database...');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase
    });

    try {
        await client.connect();
        console.log('Connected!');

        const sql = `
      -- Step 1: Add audit_date column
      ALTER TABLE domain_readiness_audits 
      ADD COLUMN IF NOT EXISTS audit_date DATE;

      -- Step 2: Backfill audit_date
      UPDATE domain_readiness_audits 
      SET audit_date = DATE(created_at)
      WHERE audit_date IS NULL;

      -- Step 3: Make audit_date NOT NULL
      ALTER TABLE domain_readiness_audits 
      ALTER COLUMN audit_date SET NOT NULL;

      -- Step 4: Unique Constraint
      ALTER TABLE domain_readiness_audits 
      DROP CONSTRAINT IF EXISTS unique_brand_audit_date;

      ALTER TABLE domain_readiness_audits 
      ADD CONSTRAINT unique_brand_audit_date 
      UNIQUE (brand_id, audit_date);

      -- Step 5: Index
      CREATE INDEX IF NOT EXISTS idx_domain_readiness_brand_date 
      ON domain_readiness_audits (brand_id, audit_date DESC);
    `;

        console.log('Running migration SQL...');
        await client.query(sql);
        console.log('✅ Migration applied successfully via pg client!');

    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.error('Check your DATABASE_URL in .env');
        }
    } finally {
        await client.end();
    }
}

migrate();
