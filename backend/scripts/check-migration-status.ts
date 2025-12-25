/**
 * Check if data migration is needed by comparing
 * extracted_positions_disabled_test (old schema) with metric_facts (new schema)
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

async function checkMigrationStatus() {
  console.log('🔍 Checking Migration Status...\n');
  console.log('='.repeat(60));

  // Check old schema (extracted_positions_disabled_test)
  console.log('\n📊 OLD SCHEMA (extracted_positions_disabled_test):');
  const { count: oldCount, error: oldError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('*', { count: 'exact', head: true });

  if (oldError) {
    console.error('❌ Error accessing old schema:', oldError.message);
    return;
  }

  console.log(`   Total rows: ${oldCount ?? 0}`);

  // Get date range from old schema
  const { data: oldDateRange, error: oldDateError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('processed_at')
    .order('processed_at', { ascending: true })
    .limit(1);

  const { data: oldDateRangeMax, error: oldDateMaxError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('processed_at')
    .order('processed_at', { ascending: false })
    .limit(1);

  if (!oldDateError && oldDateRange && oldDateRange.length > 0) {
    console.log(`   Earliest date: ${oldDateRange[0].processed_at}`);
  }
  if (!oldDateMaxError && oldDateRangeMax && oldDateRangeMax.length > 0) {
    console.log(`   Latest date: ${oldDateRangeMax[0].processed_at}`);
  }

  // Get unique collector_result_ids from old schema
  const { data: oldCollectorResults, error: oldCollectorError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('collector_result_id');

  const uniqueOldCollectorResults = new Set(
    (oldCollectorResults || []).map((r: any) => r.collector_result_id)
  );
  console.log(`   Unique collector_result_ids: ${uniqueOldCollectorResults.size}`);

  // Check new schema (metric_facts)
  console.log('\n📊 NEW SCHEMA (metric_facts):');
  const { count: newCount, error: newError } = await supabase
    .from('metric_facts')
    .select('*', { count: 'exact', head: true });

  if (newError) {
    console.error('❌ Error accessing new schema:', newError.message);
    return;
  }

  console.log(`   Total rows: ${newCount ?? 0}`);

  // Get date range from new schema
  const { data: newDateRange, error: newDateError } = await supabase
    .from('metric_facts')
    .select('processed_at')
    .order('processed_at', { ascending: true })
    .limit(1);

  const { data: newDateRangeMax, error: newDateMaxError } = await supabase
    .from('metric_facts')
    .select('processed_at')
    .order('processed_at', { ascending: false })
    .limit(1);

  if (!newDateError && newDateRange && newDateRange.length > 0) {
    console.log(`   Earliest date: ${newDateRange[0].processed_at}`);
  }
  if (!newDateMaxError && newDateRangeMax && newDateRangeMax.length > 0) {
    console.log(`   Latest date: ${newDateRangeMax[0].processed_at}`);
  }

  // Get unique collector_result_ids from new schema
  const { data: newCollectorResults, error: newCollectorError } = await supabase
    .from('metric_facts')
    .select('collector_result_id');

  const uniqueNewCollectorResults = new Set(
    (newCollectorResults || []).map((r: any) => r.collector_result_id)
  );
  console.log(`   Unique collector_result_ids: ${uniqueNewCollectorResults.size}`);

  // Check data before December 20, 2025 (user's requirement)
  const cutoffDate = '2025-12-20';
  
  console.log(`\n📅 Checking data before ${cutoffDate}:`);
  
  const { count: oldBeforeCutoff, error: oldBeforeError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('*', { count: 'exact', head: true })
    .lt('processed_at', cutoffDate);

  const { count: newBeforeCutoff, error: newBeforeError } = await supabase
    .from('metric_facts')
    .select('*', { count: 'exact', head: true })
    .lt('processed_at', cutoffDate);

  console.log(`   Old schema (before ${cutoffDate}): ${oldBeforeCutoff ?? 0} rows`);
  console.log(`   New schema (before ${cutoffDate}): ${newBeforeCutoff ?? 0} rows`);

  // Compare collector_result_ids
  console.log('\n🔍 Migration Status:');
  console.log('='.repeat(60));
  
  const oldCountNum = oldCount ?? 0;
  const newCountNum = newCount ?? 0;
  const oldUniqueCount = uniqueOldCollectorResults.size;
  const newUniqueCount = uniqueNewCollectorResults.size;
  const oldBeforeCutoffNum = oldBeforeCutoff ?? 0;
  const newBeforeCutoffNum = newBeforeCutoff ?? 0;

  // Check which collector_result_ids are missing in new schema
  const missingInNew = Array.from(uniqueOldCollectorResults).filter(
    id => !uniqueNewCollectorResults.has(id)
  );

  console.log(`\n   Old schema collector_results: ${oldUniqueCount}`);
  console.log(`   New schema collector_results: ${newUniqueCount}`);
  console.log(`   Missing in new schema: ${missingInNew.length}`);

  if (missingInNew.length > 0) {
    console.log(`\n   ⚠️  MIGRATION NEEDED: ${missingInNew.length} collector_results not migrated`);
    console.log(`   Sample missing IDs: ${missingInNew.slice(0, 10).join(', ')}${missingInNew.length > 10 ? '...' : ''}`);
  } else {
    console.log(`\n   ✅ All collector_results appear to be migrated`);
  }

  // Check historical data specifically
  if (oldBeforeCutoffNum > 0 && newBeforeCutoffNum === 0) {
    console.log(`\n   ⚠️  CRITICAL: Historical data (before ${cutoffDate}) exists in old schema but NOT in new schema!`);
    console.log(`   Old schema has ${oldBeforeCutoffNum} rows before ${cutoffDate}`);
    console.log(`   New schema has ${newBeforeCutoffNum} rows before ${cutoffDate}`);
    console.log(`   → BACKFILL REQUIRED to show historical data in UI`);
  } else if (oldBeforeCutoffNum > 0 && newBeforeCutoffNum > 0) {
    const percentage = Math.round((newBeforeCutoffNum / oldBeforeCutoffNum) * 100);
    console.log(`\n   📊 Historical data migration: ${percentage}% (${newBeforeCutoffNum}/${oldBeforeCutoffNum} rows)`);
    if (percentage < 100) {
      console.log(`   ⚠️  Some historical data may be missing`);
    }
  }

  // Final recommendation
  console.log('\n' + '='.repeat(60));
  console.log('📋 RECOMMENDATION:');
  
  if (missingInNew.length > 0 || (oldBeforeCutoffNum > 0 && newBeforeCutoffNum === 0)) {
    console.log('   ✅ RUN BACKFILL: Data migration is needed');
    console.log('   → Run: npx ts-node src/scripts/phase2-backfill-optimized-schema.ts');
  } else if (oldBeforeCutoffNum > 0 && newBeforeCutoffNum < oldBeforeCutoffNum) {
    console.log('   ⚠️  PARTIAL MIGRATION: Some data may be missing');
    console.log('   → Consider running backfill to ensure completeness');
  } else {
    console.log('   ✅ NO ACTION NEEDED: Data appears to be fully migrated');
  }
  
  console.log('='.repeat(60));
}

checkMigrationStatus()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

