/**
 * Check SanDisk data in both legacy and new schema for Dec 17-20
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

async function checkSanDiskData() {
  console.log('🔍 Checking SanDisk Data (Dec 17-20, 2025)...\n');
  console.log('='.repeat(60));

  // Step 1: Find SanDisk brand_id
  console.log('📋 Step 1: Finding SanDisk brand...');
  const { data: brands, error: brandError } = await supabase
    .from('brands')
    .select('id, name, slug')
    .ilike('name', '%sandisk%')
    .limit(5);

  if (brandError) {
    console.error('❌ Error finding brand:', brandError);
    return;
  }

  if (!brands || brands.length === 0) {
    console.log('❌ SanDisk brand not found');
    return;
  }

  const sandiskBrand = brands[0];
  console.log(`✅ Found: ${sandiskBrand.name} (ID: ${sandiskBrand.id})\n`);

  const brandId = sandiskBrand.id;
  const startDate = '2025-12-17';
  const endDate = '2025-12-20T23:59:59';

  // Step 2: Check legacy schema (extracted_positions_disabled_test)
  console.log('📊 Step 2: Checking LEGACY SCHEMA (extracted_positions_disabled_test)...');
  const { data: legacyData, error: legacyError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('collector_result_id, processed_at, visibility_index, share_of_answers_brand, sentiment_score')
    .eq('brand_id', brandId)
    .gte('processed_at', startDate)
    .lte('processed_at', endDate)
    .order('processed_at', { ascending: true });

  if (legacyError) {
    console.error('❌ Error querying legacy schema:', legacyError);
  } else {
    const uniqueCollectorResults = new Set((legacyData || []).map((r: any) => r.collector_result_id));
    console.log(`   Total rows: ${legacyData?.length || 0}`);
    console.log(`   Unique collector_result_ids: ${uniqueCollectorResults.size}`);
    
    if (legacyData && legacyData.length > 0) {
      const dates = legacyData.map((r: any) => new Date(r.processed_at).toISOString().split('T')[0]);
      const uniqueDates = new Set(dates);
      console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      console.log(`   Unique dates: ${Array.from(uniqueDates).sort().join(', ')}`);
      
      // Show sample data
      console.log(`\n   Sample data (first 5 rows):`);
      legacyData.slice(0, 5).forEach((row: any, idx: number) => {
        console.log(`   ${idx + 1}. collector_result_id: ${row.collector_result_id}, date: ${new Date(row.processed_at).toISOString().split('T')[0]}, visibility: ${row.visibility_index}, SOA: ${row.share_of_answers_brand}, sentiment: ${row.sentiment_score}`);
      });
    } else {
      console.log(`   ⚠️  No data found in legacy schema for this date range`);
    }
  }

  // Step 3: Check new schema (metric_facts)
  console.log('\n📊 Step 3: Checking NEW SCHEMA (metric_facts)...');
  const { data: newData, error: newError } = await supabase
    .from('metric_facts')
    .select(`
      collector_result_id,
      processed_at,
      brand_metrics(visibility_index, share_of_answers),
      brand_sentiment(sentiment_score)
    `)
    .eq('brand_id', brandId)
    .gte('processed_at', startDate)
    .lte('processed_at', endDate)
    .order('processed_at', { ascending: true });

  if (newError) {
    console.error('❌ Error querying new schema:', newError);
  } else {
    const uniqueCollectorResults = new Set((newData || []).map((r: any) => r.collector_result_id));
    console.log(`   Total rows: ${newData?.length || 0}`);
    console.log(`   Unique collector_result_ids: ${uniqueCollectorResults.size}`);
    
    if (newData && newData.length > 0) {
      const dates = newData.map((r: any) => new Date(r.processed_at).toISOString().split('T')[0]);
      const uniqueDates = new Set(dates);
      console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
      console.log(`   Unique dates: ${Array.from(uniqueDates).sort().join(', ')}`);
      
      // Show sample data
      console.log(`\n   Sample data (first 5 rows):`);
      newData.slice(0, 5).forEach((row: any, idx: number) => {
        const visibility = row.brand_metrics?.[0]?.visibility_index || 'N/A';
        const soa = row.brand_metrics?.[0]?.share_of_answers || 'N/A';
        const sentiment = row.brand_sentiment?.[0]?.sentiment_score || 'N/A';
        console.log(`   ${idx + 1}. collector_result_id: ${row.collector_result_id}, date: ${new Date(row.processed_at).toISOString().split('T')[0]}, visibility: ${visibility}, SOA: ${soa}, sentiment: ${sentiment}`);
      });
    } else {
      console.log(`   ⚠️  No data found in new schema for this date range`);
    }
  }

  // Step 4: Compare collector_result_ids
  console.log('\n🔍 Step 4: Comparing Data...');
  if (legacyData && newData) {
    const legacyIds = new Set((legacyData || []).map((r: any) => r.collector_result_id));
    const newIds = new Set((newData || []).map((r: any) => r.collector_result_id));
    
    const inLegacyOnly = Array.from(legacyIds).filter(id => !newIds.has(id));
    const inNewOnly = Array.from(newIds).filter(id => !legacyIds.has(id));
    const inBoth = Array.from(legacyIds).filter(id => newIds.has(id));
    
    console.log(`   In legacy schema: ${legacyIds.size} unique collector_results`);
    console.log(`   In new schema: ${newIds.size} unique collector_results`);
    console.log(`   In both: ${inBoth.length}`);
    console.log(`   In legacy only: ${inLegacyOnly.length}`);
    console.log(`   In new only: ${inNewOnly.length}`);
    
    if (inLegacyOnly.length > 0) {
      console.log(`\n   ⚠️  Missing in new schema: ${inLegacyOnly.slice(0, 10).join(', ')}${inLegacyOnly.length > 10 ? '...' : ''}`);
    }
    if (inNewOnly.length > 0) {
      console.log(`\n   ℹ️  Only in new schema (newer data): ${inNewOnly.slice(0, 10).join(', ')}${inNewOnly.length > 10 ? '...' : ''}`);
    }
  }

  // Step 5: Check by date
  console.log('\n📅 Step 5: Data by Date...');
  if (legacyData && legacyData.length > 0) {
    const byDate = new Map<string, number>();
    legacyData.forEach((r: any) => {
      const date = new Date(r.processed_at).toISOString().split('T')[0];
      byDate.set(date, (byDate.get(date) || 0) + 1);
    });
    
    console.log(`   Legacy schema by date:`);
    Array.from(byDate.entries()).sort().forEach(([date, count]) => {
      console.log(`     ${date}: ${count} rows`);
    });
  }

  if (newData && newData.length > 0) {
    const byDate = new Map<string, number>();
    newData.forEach((r: any) => {
      const date = new Date(r.processed_at).toISOString().split('T')[0];
      byDate.set(date, (byDate.get(date) || 0) + 1);
    });
    
    console.log(`\n   New schema by date:`);
    Array.from(byDate.entries()).sort().forEach(([date, count]) => {
      console.log(`     ${date}: ${count} rows`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Check Complete');
  console.log('='.repeat(60));
}

checkSanDiskData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

