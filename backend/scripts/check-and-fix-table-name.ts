/**
 * Check if extracted_positions table exists or was renamed
 * and provide fix instructions
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStatus() {
  console.log('🔍 Checking extracted_positions table status...\n');

  // Check if table exists with original name
  const { count: originalCount, error: originalError } = await supabase
    .from('extracted_positions')
    .select('*', { count: 'exact', head: true });

  if (originalError) {
    console.log('❌ Table "extracted_positions" not accessible:', originalError.message);
    
    // Check if it was renamed
    const { count: renamedCount, error: renamedError } = await supabase
      .from('extracted_positions_disabled_test')
      .select('*', { count: 'exact', head: true });

    if (!renamedError && renamedCount !== null) {
      console.log('\n⚠️  FOUND: Table was renamed to "extracted_positions_disabled_test"');
      console.log(`📊 Rows in renamed table: ${renamedCount}`);
      console.log('\n🔧 TO FIX: Run this SQL in Supabase SQL Editor:');
      console.log('   ALTER TABLE extracted_positions_disabled_test RENAME TO extracted_positions;');
      return;
    }
  } else {
    console.log(`✅ Table "extracted_positions" exists`);
    console.log(`📊 Row count: ${originalCount ?? 'null'}`);
    
    if (originalCount === null || originalCount === 0) {
      console.log('\n⚠️  WARNING: Table exists but is empty!');
      console.log('   This means all data was already migrated or deleted.');
    } else {
      console.log(`\n✅ Table has ${originalCount} rows - ready for backfill`);
    }
  }

  // Also check new schema
  const { count: newSchemaCount, error: newError } = await supabase
    .from('metric_facts')
    .select('*', { count: 'exact', head: true });

  if (newError) {
    console.log('\n❌ New schema table "metric_facts" not accessible:', newError.message);
  } else {
    console.log(`\n📊 New schema (metric_facts) row count: ${newSchemaCount ?? 'null'}`);
  }
}

checkTableStatus()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

