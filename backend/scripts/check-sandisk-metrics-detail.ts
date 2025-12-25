/**
 * Check SanDisk metrics detail - verify brand_metrics and brand_sentiment have data
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

async function checkSanDiskMetricsDetail() {
  console.log('🔍 Checking SanDisk Metrics Detail (Dec 17, 2025)...\n');
  console.log('='.repeat(60));

  const brandId = '5a57c430-6940-4198-a1f5-a443cbd044dc'; // SanDisk
  const startDate = '2025-12-17';
  const endDate = '2025-12-20T23:59:59';

  // Get metric_facts for SanDisk
  const { data: metricFacts, error: mfError } = await supabase
    .from('metric_facts')
    .select('id, collector_result_id, processed_at')
    .eq('brand_id', brandId)
    .gte('processed_at', startDate)
    .lte('processed_at', endDate);

  if (mfError) {
    console.error('❌ Error:', mfError);
    return;
  }

  console.log(`📊 Found ${metricFacts?.length || 0} metric_facts\n`);

  if (!metricFacts || metricFacts.length === 0) {
    console.log('⚠️  No metric_facts found');
    return;
  }

  const metricFactIds = metricFacts.map(mf => mf.id);

  // Check brand_metrics
  const { data: brandMetrics, error: bmError } = await supabase
    .from('brand_metrics')
    .select('metric_fact_id, visibility_index, share_of_answers, has_brand_presence')
    .in('metric_fact_id', metricFactIds);

  console.log(`📊 Brand Metrics:`);
  console.log(`   Total rows: ${brandMetrics?.length || 0}`);
  if (brandMetrics && brandMetrics.length > 0) {
    console.log(`   Sample (first 3):`);
    brandMetrics.slice(0, 3).forEach((bm: any) => {
      console.log(`     metric_fact_id: ${bm.metric_fact_id}, visibility: ${bm.visibility_index}, SOA: ${bm.share_of_answers}, presence: ${bm.has_brand_presence}`);
    });
  } else {
    console.log(`   ⚠️  No brand_metrics found for these metric_facts`);
  }

  // Check brand_sentiment
  const { data: brandSentiment, error: bsError } = await supabase
    .from('brand_sentiment')
    .select('metric_fact_id, sentiment_score, sentiment_label')
    .in('metric_fact_id', metricFactIds);

  console.log(`\n📊 Brand Sentiment:`);
  console.log(`   Total rows: ${brandSentiment?.length || 0}`);
  if (brandSentiment && brandSentiment.length > 0) {
    console.log(`   Sample (first 3):`);
    brandSentiment.slice(0, 3).forEach((bs: any) => {
      console.log(`     metric_fact_id: ${bs.metric_fact_id}, score: ${bs.sentiment_score}, label: ${bs.sentiment_label}`);
    });
  } else {
    console.log(`   ⚠️  No brand_sentiment found for these metric_facts`);
  }

  // Compare with legacy data
  console.log(`\n📊 Legacy Schema Comparison:`);
  const { data: legacyData, error: legacyError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('collector_result_id, visibility_index, share_of_answers_brand, sentiment_score, processed_at')
    .eq('brand_id', brandId)
    .is('competitor_name', null) // Only brand rows
    .gte('processed_at', startDate)
    .lte('processed_at', endDate)
    .order('processed_at', { ascending: true });

  if (!legacyError && legacyData) {
    console.log(`   Legacy rows: ${legacyData.length}`);
    if (legacyData.length > 0) {
      console.log(`   Sample (first 3):`);
      legacyData.slice(0, 3).forEach((row: any) => {
        console.log(`     collector_result_id: ${row.collector_result_id}, visibility: ${row.visibility_index}, SOA: ${row.share_of_answers_brand}, sentiment: ${row.sentiment_score}, date: ${new Date(row.processed_at).toISOString().split('T')[0]}`);
      });
    }
  }

  // Check which metric_facts are missing brand_metrics
  const metricFactIdsWithMetrics = new Set((brandMetrics || []).map((bm: any) => bm.metric_fact_id));
  const missingMetrics = metricFacts.filter(mf => !metricFactIdsWithMetrics.has(mf.id));

  if (missingMetrics.length > 0) {
    console.log(`\n⚠️  Missing brand_metrics for ${missingMetrics.length} metric_facts:`);
    console.log(`   Collector result IDs: ${missingMetrics.map(mf => mf.collector_result_id).join(', ')}`);
  }

  // Check which metric_facts are missing brand_sentiment
  const metricFactIdsWithSentiment = new Set((brandSentiment || []).map((bs: any) => bs.metric_fact_id));
  const missingSentiment = metricFacts.filter(mf => !metricFactIdsWithSentiment.has(mf.id));

  if (missingSentiment.length > 0) {
    console.log(`\n⚠️  Missing brand_sentiment for ${missingSentiment.length} metric_facts:`);
    console.log(`   Collector result IDs: ${missingSentiment.map(mf => mf.collector_result_id).join(', ')}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Check Complete');
  console.log('='.repeat(60));
}

checkSanDiskMetricsDetail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

