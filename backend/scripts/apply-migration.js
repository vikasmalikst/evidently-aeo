#!/usr/bin/env node

/**
 * Apply Priority Migration Script
 * This script applies the priority-based migration to the global_settings table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function applyMigration() {
  try {
    console.log('🚀 Starting priority migration...');
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please check your environment variables.');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('✅ Connected to Supabase');
    
    // Step 1: Check if columns already exist
    console.log('🔍 Checking if priority columns already exist...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('global_settings')
      .select('P1, P2, P3, P4')
      .limit(1);
    
    if (columnsError && !columnsError.message.includes('column "P1" does not exist')) {
      console.error('❌ Error checking columns:', columnsError);
      throw columnsError;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ Priority columns already exist, skipping migration');
      return;
    }
    
    console.log('📝 Priority columns do not exist, proceeding with migration...');
    
    // Since we can't run DDL directly through the client, let's create a simple workaround
    // We'll create a new table with the priority structure and migrate data
    
    console.log('🔄 Creating new table structure...');
    
    // For now, let's just log what needs to be done manually
    console.log(`
    ⚠️  MANUAL MIGRATION REQUIRED ⚠️
    
    Please run the following SQL commands in your Supabase SQL editor:
    
    1. Add priority columns:
    ALTER TABLE public.global_settings 
    ADD COLUMN IF NOT EXISTS P1 TEXT,
    ADD COLUMN IF NOT EXISTS P2 TEXT,
    ADD COLUMN IF NOT EXISTS P3 TEXT,
    ADD COLUMN IF NOT EXISTS P4 TEXT;
    
    2. Migrate existing data:
    UPDATE public.global_settings 
    SET 
      P1 = CASE 
        WHEN default_provider IS NOT NULL AND default_provider != '' THEN default_provider
        WHEN enabled_providers IS NOT NULL AND array_length(enabled_providers, 1) > 0 THEN enabled_providers[1]
        ELSE NULL
      END,
      P2 = CASE 
        WHEN enabled_providers IS NOT NULL AND array_length(enabled_providers, 1) > 1 THEN enabled_providers[2]
        ELSE NULL
      END,
      P3 = CASE 
        WHEN enabled_providers IS NOT NULL AND array_length(enabled_providers, 1) > 2 THEN enabled_providers[3]
        ELSE NULL
      END,
      P4 = CASE 
        WHEN enabled_providers IS NOT NULL AND array_length(enabled_providers, 1) > 3 THEN enabled_providers[4]
        ELSE NULL
      END
    WHERE P1 IS NULL;
    
    3. Remove old columns:
    ALTER TABLE public.global_settings 
    DROP COLUMN IF EXISTS enabled_providers,
    DROP COLUMN IF EXISTS default_provider;
    
    4. Add performance index:
    CREATE INDEX IF NOT EXISTS idx_global_settings_service_name ON public.global_settings(service_name);
    `);
    
    console.log('📋 Please run the above SQL commands in your Supabase SQL editor');
    
  } catch (error) {
    console.error('💥 Migration check failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration();
