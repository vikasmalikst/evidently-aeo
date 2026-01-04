/**
 * Phase 2: Backfill Historical Data to Optimized Schema
 * 
 * This script migrates data from extracted_positions to the new normalized schema:
 * - metric_facts (one per collector_result)
 * - brand_metrics
 * - competitor_metrics
 * - brand_sentiment
 * - competitor_sentiment
 * 
 * Features:
 * - Batch processing (100 rows at a time)
 * - Progress tracking
 * - Resume capability (skips already migrated data)
 * - Error handling with detailed logging
 * - Dry-run mode for testing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend directory
const envPath = path.resolve(__dirname, '../../.env');
console.log(`📁 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error(`   Attempted to load from: ${envPath}`);
  console.error(`   SUPABASE_URL found: ${!!supabaseUrl}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY found: ${!!supabaseServiceKey}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration
const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set DRY_RUN=true to test without writing

interface ExtractedPosition {
  id: number;
  collector_result_id: number;
  brand_id: string;
  customer_id: string;
  query_id: string;
  collector_type: string;
  brand_name: string;
  competitor_name: string | null;
  brand_first_position: number | null;
  brand_positions: number[];
  competitor_positions: number[] | null;
  total_brand_mentions: number;
  competitor_mentions: number | null;
  total_word_count: number;
  visibility_index: number | null;
  visibility_index_competitor: number | null;
  share_of_answers_brand: number | null;
  share_of_answers_competitor: number | null;
  has_brand_presence: boolean;
  topic: string | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  sentiment_label_competitor: string | null;
  sentiment_score_competitor: number | null;
  sentiment_positive_sentences: any;
  sentiment_negative_sentences: any;
  sentiment_positive_sentences_competitor: any;
  sentiment_negative_sentences_competitor: any;
  processed_at: string;
  created_at: string;
  metadata: any;
}

interface MetricFact {
  collector_result_id: number;
  brand_id: string;
  customer_id: string;
  query_id: string;
  collector_type: string;
  topic: string | null;
  processed_at: string;
  created_at: string;
}

interface BrandMetrics {
  metric_fact_id: number;
  visibility_index: number | null;
  share_of_answers: number | null;
  brand_first_position: number | null;
  brand_positions: number[];
  total_brand_mentions: number;
  total_word_count: number;
  has_brand_presence: boolean;
}

interface CompetitorMetrics {
  metric_fact_id: number;
  competitor_id: string;
  visibility_index: number | null;
  share_of_answers: number | null;
  competitor_positions: number[];
  competitor_mentions: number;
}

interface BrandSentiment {
  metric_fact_id: number;
  sentiment_label: string;
  sentiment_score: number;
  positive_sentences: any;
  negative_sentences: any;
}

interface CompetitorSentiment {
  metric_fact_id: number;
  competitor_id: string;
  sentiment_label: string;
  sentiment_score: number;
  positive_sentences: any;
  negative_sentences: any;
}

interface Stats {
  totalProcessed: number;
  metricFactsCreated: number;
  brandMetricsCreated: number;
  competitorMetricsCreated: number;
  brandSentimentsCreated: number;
  competitorSentimentsCreated: number;
  skipped: number;
  errors: number;
}

/**
 * Get competitor_id by name and brand_id
 */
async function getCompetitorId(brandId: string, competitorName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('brand_competitors')
    .select('id')
    .eq('brand_id', brandId)
    .eq('competitor_name', competitorName)
    .single();

  if (error || !data) {
    console.warn(`   ⚠️ Competitor not found: ${competitorName} for brand ${brandId}`);
    return null;
  }

  return data.id;
}

/**
 * Check if a collector_result_id has already been migrated
 */
async function isAlreadyMigrated(collectorResultId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('metric_facts')
    .select('collector_result_id')
    .eq('collector_result_id', collectorResultId)
    .single();

  return !!data && !error;
}

/**
 * Process a batch of extracted_positions rows using BULK INSERTS
 */
async function processBatch(positions: ExtractedPosition[], stats: Stats): Promise<void> {
  // Group by collector_result_id (since we have 1 brand row + N competitor rows per result)
  const groupedByCollectorResult = new Map<number, ExtractedPosition[]>();
  
  for (const pos of positions) {
    const existing = groupedByCollectorResult.get(pos.collector_result_id) || [];
    existing.push(pos);
    groupedByCollectorResult.set(pos.collector_result_id, existing);
  }

  console.log(`   📦 Processing ${groupedByCollectorResult.size} collector_results (${positions.length} rows) with BULK inserts`);

  // Arrays to collect all rows for bulk insert
  const metricFactsToInsert: MetricFact[] = [];
  const collectorResultIdsToProcess: number[] = [];
  const brandRowsMap = new Map<number, ExtractedPosition>();
  const competitorRowsMap = new Map<number, ExtractedPosition[]>();

  // Phase 1: Prepare metric_facts data and validate
  for (const [collectorResultId, rows] of groupedByCollectorResult.entries()) {
    // Check if already migrated
    if (await isAlreadyMigrated(collectorResultId)) {
      stats.skipped++;
      continue;
    }

    // Separate brand row from competitor rows
    const brandRow = rows.find(r => r.competitor_name === null);
    const competitorRows = rows.filter(r => r.competitor_name !== null);

    if (!brandRow) {
      console.warn(`   ⚠️ No brand row found for collector_result ${collectorResultId}, skipping`);
      stats.skipped++;
      continue;
    }

    // Prepare metric_fact
    // Copy created_at from extracted_positions to preserve original creation date
    const metricFact: MetricFact = {
      collector_result_id: collectorResultId,
      brand_id: brandRow.brand_id,
      customer_id: brandRow.customer_id,
      query_id: brandRow.query_id,
      collector_type: brandRow.collector_type,
      topic: brandRow.topic,
      processed_at: brandRow.processed_at,
      created_at: brandRow.created_at || brandRow.processed_at, // Use created_at, fallback to processed_at if missing
    };

    metricFactsToInsert.push(metricFact);
    collectorResultIdsToProcess.push(collectorResultId);
    brandRowsMap.set(collectorResultId, brandRow);
    competitorRowsMap.set(collectorResultId, competitorRows);
  }

  if (metricFactsToInsert.length === 0) {
    console.log(`   ⏭️  All items in this batch already migrated`);
    return;
  }

  console.log(`   🚀 Bulk inserting ${metricFactsToInsert.length} metric_facts...`);

  if (DRY_RUN) {
    console.log(`   🔍 [DRY RUN] Would bulk insert ${metricFactsToInsert.length} metric_facts`);
    stats.metricFactsCreated += metricFactsToInsert.length;
    stats.totalProcessed += metricFactsToInsert.length;
    return;
  }

  // Phase 2: Bulk insert metric_facts
  const { data: insertedMetricFacts, error: metricFactsError } = await supabase
    .from('metric_facts')
    .insert(metricFactsToInsert)
    .select('id, collector_result_id');

  if (metricFactsError || !insertedMetricFacts) {
    console.error(`   ❌ Failed to bulk insert metric_facts:`, metricFactsError);
    stats.errors += metricFactsToInsert.length;
    return;
  }

  console.log(`   ✅ Inserted ${insertedMetricFacts.length} metric_facts`);
  stats.metricFactsCreated += insertedMetricFacts.length;
  stats.totalProcessed += insertedMetricFacts.length;

  // Create a map of collector_result_id to metric_fact_id
  const metricFactIdMap = new Map<number, number>();
  for (const mf of insertedMetricFacts) {
    metricFactIdMap.set(mf.collector_result_id, mf.id);
  }

  // Phase 3: Prepare all other tables' data
  const brandMetricsToInsert: BrandMetrics[] = [];
  const brandSentimentsToInsert: BrandSentiment[] = [];
  const competitorMetricsToInsert: CompetitorMetrics[] = [];
  const competitorSentimentsToInsert: CompetitorSentiment[] = [];

  // Cache for competitor IDs to avoid repeated lookups
  const competitorIdCache = new Map<string, string>();

  for (const collectorResultId of collectorResultIdsToProcess) {
    const metricFactId = metricFactIdMap.get(collectorResultId);
    if (!metricFactId) continue;

    const brandRow = brandRowsMap.get(collectorResultId)!;
    const competitorRows = competitorRowsMap.get(collectorResultId) || [];

    // Brand metrics
    brandMetricsToInsert.push({
      metric_fact_id: metricFactId,
      visibility_index: brandRow.visibility_index,
      share_of_answers: brandRow.share_of_answers_brand,
      brand_first_position: brandRow.brand_first_position,
      brand_positions: brandRow.brand_positions || [],
      total_brand_mentions: brandRow.total_brand_mentions || 0,
      total_word_count: brandRow.total_word_count || 0,
      has_brand_presence: brandRow.has_brand_presence || false,
    });

    // Brand sentiment (if exists)
    if (brandRow.sentiment_label && brandRow.sentiment_score != null) {
      brandSentimentsToInsert.push({
        metric_fact_id: metricFactId,
        sentiment_label: brandRow.sentiment_label,
        sentiment_score: brandRow.sentiment_score,
        positive_sentences: brandRow.sentiment_positive_sentences || [],
        negative_sentences: brandRow.sentiment_negative_sentences || [],
      });
    }

    // Competitor metrics and sentiments
    for (const compRow of competitorRows) {
      if (!compRow.competitor_name) continue;

      const cacheKey = `${brandRow.brand_id}:${compRow.competitor_name}`;
      let competitorId = competitorIdCache.get(cacheKey);
      
      if (!competitorId) {
        competitorId = await getCompetitorId(brandRow.brand_id, compRow.competitor_name);
        if (competitorId) {
          competitorIdCache.set(cacheKey, competitorId);
        }
      }

      if (!competitorId) continue;

      competitorMetricsToInsert.push({
        metric_fact_id: metricFactId,
        competitor_id: competitorId,
        visibility_index: compRow.visibility_index_competitor,
        share_of_answers: compRow.share_of_answers_competitor,
        competitor_positions: compRow.competitor_positions || [],
        competitor_mentions: compRow.competitor_mentions || 0,
      });

      if (compRow.sentiment_label_competitor && compRow.sentiment_score_competitor != null) {
        competitorSentimentsToInsert.push({
          metric_fact_id: metricFactId,
          competitor_id: competitorId,
          sentiment_label: compRow.sentiment_label_competitor,
          sentiment_score: compRow.sentiment_score_competitor,
          positive_sentences: compRow.sentiment_positive_sentences_competitor || [],
          negative_sentences: compRow.sentiment_negative_sentences_competitor || [],
        });
      }
    }
  }

  // Phase 4: Bulk insert all other tables
  console.log(`   🚀 Bulk inserting ${brandMetricsToInsert.length} brand_metrics...`);
  if (brandMetricsToInsert.length > 0) {
    const { error: brandMetricsError } = await supabase
      .from('brand_metrics')
      .insert(brandMetricsToInsert);

    if (brandMetricsError) {
      console.error(`   ❌ Failed to bulk insert brand_metrics:`, brandMetricsError);
      stats.errors += brandMetricsToInsert.length;
    } else {
      console.log(`   ✅ Inserted ${brandMetricsToInsert.length} brand_metrics`);
      stats.brandMetricsCreated += brandMetricsToInsert.length;
    }
  }

  if (brandSentimentsToInsert.length > 0) {
    console.log(`   🚀 Bulk inserting ${brandSentimentsToInsert.length} brand_sentiments...`);
    const { error: brandSentimentsError } = await supabase
      .from('brand_sentiment')
      .insert(brandSentimentsToInsert);

    if (brandSentimentsError) {
      console.error(`   ❌ Failed to bulk insert brand_sentiments:`, brandSentimentsError);
      stats.errors += brandSentimentsToInsert.length;
    } else {
      console.log(`   ✅ Inserted ${brandSentimentsToInsert.length} brand_sentiments`);
      stats.brandSentimentsCreated += brandSentimentsToInsert.length;
    }
  }

  if (competitorMetricsToInsert.length > 0) {
    console.log(`   🚀 Bulk inserting ${competitorMetricsToInsert.length} competitor_metrics...`);
    const { error: compMetricsError } = await supabase
      .from('competitor_metrics')
      .insert(competitorMetricsToInsert);

    if (compMetricsError) {
      console.error(`   ❌ Failed to bulk insert competitor_metrics:`, compMetricsError);
      stats.errors += competitorMetricsToInsert.length;
    } else {
      console.log(`   ✅ Inserted ${competitorMetricsToInsert.length} competitor_metrics`);
      stats.competitorMetricsCreated += competitorMetricsToInsert.length;
    }
  }

  if (competitorSentimentsToInsert.length > 0) {
    console.log(`   🚀 Bulk inserting ${competitorSentimentsToInsert.length} competitor_sentiments...`);
    const { error: compSentimentsError } = await supabase
      .from('competitor_sentiment')
      .insert(competitorSentimentsToInsert);

    if (compSentimentsError) {
      console.error(`   ❌ Failed to bulk insert competitor_sentiments:`, compSentimentsError);
      stats.errors += competitorSentimentsToInsert.length;
    } else {
      console.log(`   ✅ Inserted ${competitorSentimentsToInsert.length} competitor_sentiments`);
      stats.competitorSentimentsCreated += competitorSentimentsToInsert.length;
    }
  }

  console.log(`   ✅ Batch complete: processed ${collectorResultIdsToProcess.length} collector_results`);
}

/**
 * Main backfill function
 */
async function backfillData(): Promise<void> {
  console.log('========================================');
  console.log('Phase 2: Backfill Historical Data');
  console.log('========================================');
  console.log('');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE: No data will be written');
    console.log('');
  }

  const stats: Stats = {
    totalProcessed: 0,
    metricFactsCreated: 0,
    brandMetricsCreated: 0,
    competitorMetricsCreated: 0,
    brandSentimentsCreated: 0,
    competitorSentimentsCreated: 0,
    skipped: 0,
    errors: 0,
  };

  // Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('extracted_positions')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Failed to count extracted_positions:', countError);
    process.exit(1);
  }

  console.log(`📊 Total rows in extracted_positions: ${totalCount}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log('');

  let offset = 0;
  let batchNumber = 1;

  while (offset < (totalCount || 0)) {
    console.log(`\n📦 Batch ${batchNumber} (offset ${offset})...`);

    // Fetch batch
    const { data: positions, error: fetchError } = await supabase
      .from('extracted_positions')
      .select('*')
      .order('collector_result_id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      console.error(`❌ Failed to fetch batch ${batchNumber}:`, fetchError);
      stats.errors++;
      break;
    }

    if (!positions || positions.length === 0) {
      console.log('✅ No more rows to process');
      break;
    }

    await processBatch(positions as ExtractedPosition[], stats);

    offset += BATCH_SIZE;
    batchNumber++;

    // Progress report
    const progress = Math.min(100, Math.round((offset / (totalCount || 1)) * 100));
    console.log(`   📈 Progress: ${progress}% (${offset}/${totalCount} rows)`);
  }

  // Final summary
  console.log('');
  console.log('========================================');
  console.log('BACKFILL COMPLETE');
  console.log('========================================');
  console.log(`✅ Collector results processed: ${stats.totalProcessed}`);
  console.log(`✅ Metric facts created: ${stats.metricFactsCreated}`);
  console.log(`✅ Brand metrics created: ${stats.brandMetricsCreated}`);
  console.log(`✅ Competitor metrics created: ${stats.competitorMetricsCreated}`);
  console.log(`✅ Brand sentiments created: ${stats.brandSentimentsCreated}`);
  console.log(`✅ Competitor sentiments created: ${stats.competitorSentimentsCreated}`);
  console.log(`⏭️  Skipped (already migrated): ${stats.skipped}`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE: No actual data was written');
    console.log('   Run without DRY_RUN=true to perform actual migration');
  } else {
    console.log('✅ Next Step: Refresh materialized view');
    console.log('   Run: REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;');
  }
}

// Run backfill
backfillData()
  .then(() => {
    console.log('✅ Backfill script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill script failed:', error);
    process.exit(1);
  });

