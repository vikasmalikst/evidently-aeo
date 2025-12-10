/**
 * Script to run the citation_category migration manually
 * 
 * This script adds the citation_category column to the recommendations table
 * if it doesn't already exist.
 * 
 * Usage: ts-node src/scripts/run-migration-citation-category.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add citation_category to recommendations table...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../../supabase/migrations/20251209000001_add_citation_category_to_recommendations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration using RPC or direct SQL
    // Note: Supabase JS client doesn't support raw SQL execution directly
    // We'll need to use the REST API or run it manually in the Supabase dashboard
    
    console.log('📝 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
    console.log('Please run this migration in one of the following ways:');
    console.log('\n1. Supabase Dashboard:');
    console.log('   - Go to your Supabase project dashboard');
    console.log('   - Navigate to SQL Editor');
    console.log('   - Paste and run the SQL above');
    console.log('\n2. Supabase CLI (if installed):');
    console.log('   - Run: supabase db push');
    console.log('\n3. Direct PostgreSQL connection:');
    console.log('   - Connect to your database and run the SQL above');
    
    // Try to check if column already exists
    const { data, error } = await supabase
      .from('recommendations')
      .select('citation_category')
      .limit(1);
    
    if (error) {
      if (error.message?.includes('citation_category')) {
        console.log('\n✅ Column does not exist - migration needs to be run');
      } else {
        console.log('\n⚠️  Could not check column status:', error.message);
      }
    } else {
      console.log('\n✅ Column may already exist (or table is empty)');
    }
    
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
