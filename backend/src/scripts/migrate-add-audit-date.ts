/**
 * Database Migration Script: Add audit_date column
 * 
 * This script adds the audit_date column to enable daily upsert pattern
 * Run this manually in Supabase SQL Editor or via migration tool
 */

import { supabaseAdmin } from '../config/supabase';

async function runMigration() {
    console.log('Starting migration: add_audit_date_column...');

    try {
        // Step 1: Add audit_date column (nullable initially)
        console.log('Step 1: Adding audit_date column...');
        await supabaseAdmin.rpc('exec_sql', {
            sql: `ALTER TABLE domain_readiness_audits ADD COLUMN IF NOT EXISTS audit_date DATE;`
        });

        // Step 2: Backfill audit_date from created_at
        console.log('Step 2: Backfilling audit_date from created_at...');
        await supabaseAdmin.rpc('exec_sql', {
            sql: `UPDATE domain_readiness_audits SET audit_date = DATE(created_at) WHERE audit_date IS NULL;`
        });

        // Step 3: Make audit_date NOT NULL
        console.log('Step 3: Making audit_date NOT NULL...');
        await supabaseAdmin.rpc('exec_sql', {
            sql: `ALTER TABLE domain_readiness_audits ALTER COLUMN audit_date SET NOT NULL;`
        });

        // Step 4: Add unique constraint
        console.log('Step 4: Adding unique constraint...');
        await supabaseAdmin.rpc('exec_sql', {
            sql: `
        ALTER TABLE domain_readiness_audits 
        DROP CONSTRAINT IF EXISTS unique_brand_audit_date;
        
        ALTER TABLE domain_readiness_audits 
        ADD CONSTRAINT unique_brand_audit_date 
        UNIQUE (brand_id, audit_date);
      `
        });

        // Step 5: Create index
        console.log('Step 5: Creating index...');
        await supabaseAdmin.rpc('exec_sql', {
            sql: `CREATE INDEX IF NOT EXISTS idx_domain_readiness_brand_date ON domain_readiness_audits (brand_id, audit_date DESC);`
        });

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export { runMigration };
