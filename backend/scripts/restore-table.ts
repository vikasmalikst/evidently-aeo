/**
 * Restore extracted_positions table from renamed version
 * and verify it's ready for backfill
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

async function restoreTable() {
  console.log('🔧 Restoring extracted_positions table...\n');

  // First check if renamed table exists
  const { count: renamedCount, error: renamedError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('*', { count: 'exact', head: true });

  if (renamedError) {
    console.log('❌ Renamed table "extracted_positions_disabled_test" not found:', renamedError.message);
    console.log('   The table may have already been restored or never existed.');
    
    // Check if original table exists
    const { count: originalCount, error: originalError } = await supabase
      .from('extracted_positions')
      .select('*', { count: 'exact', head: true });

    if (!originalError) {
      console.log(`\n✅ Table "extracted_positions" already exists with ${originalCount ?? 0} rows`);
      return;
    }
    
    process.exit(1);
  }

  console.log(`📊 Found renamed table with ${renamedCount ?? 0} rows`);
  console.log('\n⚠️  NOTE: Table rename must be done via SQL, not through Supabase client.');
  console.log('   Please run this SQL in Supabase SQL Editor:\n');
  console.log('   ALTER TABLE extracted_positions_disabled_test RENAME TO extracted_positions;\n');
  console.log('   Or run: backend/scripts/restore-table-and-backfill.sql\n');
  
  // Check if original table already exists
  const { count: originalCount, error: originalError } = await supabase
    .from('extracted_positions')
    .select('*', { count: 'exact', head: true });

  if (!originalError) {
    console.log(`⚠️  WARNING: Both tables exist!`);
    console.log(`   - extracted_positions: ${originalCount ?? 0} rows`);
    console.log(`   - extracted_positions_disabled_test: ${renamedCount ?? 0} rows`);
  }
}

restoreTable()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

