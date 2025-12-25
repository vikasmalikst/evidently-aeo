/**
 * Verify historical data exists in new schema before December 20, 2025
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

async function verifyHistoricalData() {
  console.log('🔍 Verifying Historical Data (before December 20, 2025)...\n');
  console.log('='.repeat(60));

  const cutoffDate = '2025-12-20';

  // Check collector_results (not rows) before cutoff
  const { data: oldCollectorResults, error: oldError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('collector_result_id, processed_at')
    .lt('processed_at', cutoffDate);

  const { data: newCollectorResults, error: newError } = await supabase
    .from('metric_facts')
    .select('collector_result_id, processed_at')
    .lt('processed_at', cutoffDate);

  if (oldError || newError) {
    console.error('❌ Error:', oldError || newError);
    return;
  }

  const oldUniqueIds = new Set((oldCollectorResults || []).map((r: any) => r.collector_result_id));
  const newUniqueIds = new Set((newCollectorResults || []).map((r: any) => r.collector_result_id));

  console.log(`\n📊 Collector Results Before ${cutoffDate}:`);
  console.log(`   Old schema: ${oldUniqueIds.size} unique collector_result_ids`);
  console.log(`   New schema: ${newUniqueIds.size} unique collector_result_ids`);

  // Check date distribution
  console.log(`\n📅 Date Distribution (New Schema):`);
  
  const { data: dateDistribution, error: distError } = await supabase
    .from('metric_facts')
    .select('processed_at')
    .lt('processed_at', cutoffDate)
    .order('processed_at', { ascending: true });

  if (!distError && dateDistribution && dateDistribution.length > 0) {
    const dates = dateDistribution.map((d: any) => new Date(d.processed_at).toISOString().split('T')[0]);
    const uniqueDates = new Set(dates);
    console.log(`   Unique dates: ${uniqueDates.size}`);
    console.log(`   Earliest: ${dates[0]}`);
    console.log(`   Latest: ${dates[dates.length - 1]}`);
    
    // Show sample dates
    const sortedDates = Array.from(uniqueDates).sort();
    console.log(`   Sample dates: ${sortedDates.slice(0, 5).join(', ')}${sortedDates.length > 5 ? '...' : ''}`);
  }

  // Check if all old IDs are in new
  const missing = Array.from(oldUniqueIds).filter(id => !newUniqueIds.has(id));
  
  console.log(`\n🔍 Migration Status:`);
  console.log(`   Missing collector_results: ${missing.length}`);
  
  if (missing.length === 0) {
    console.log(`   ✅ All collector_results before ${cutoffDate} are migrated!`);
  } else {
    console.log(`   ⚠️  ${missing.length} collector_results missing`);
    console.log(`   Sample missing IDs: ${missing.slice(0, 10).join(', ')}`);
  }

  // Check by brand
  console.log(`\n📊 Checking by Brand (sample):`);
  const { data: brandData, error: brandError } = await supabase
    .from('metric_facts')
    .select('brand_id, processed_at')
    .lt('processed_at', cutoffDate)
    .limit(100);

  if (!brandError && brandData) {
    const brandCounts = new Map<string, number>();
    brandData.forEach((d: any) => {
      const count = brandCounts.get(d.brand_id) || 0;
      brandCounts.set(d.brand_id, count + 1);
    });
    
    console.log(`   Brands with historical data: ${brandCounts.size}`);
    console.log(`   Sample brand counts: ${Array.from(brandCounts.entries()).slice(0, 5).map(([id, count]) => `${id.substring(0, 8)}...: ${count}`).join(', ')}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification Complete');
  console.log('='.repeat(60));
}

verifyHistoricalData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

