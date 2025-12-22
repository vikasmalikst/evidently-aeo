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

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
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
  metadata: any;
}

interface MetricFact {
  collector_result_id: number;
  brand_id: string;
  customer_id: string;
  query_id: string;
  collector_type: string;
  topic: string | null;
  collected_at: string;
  metadata: any;
}

interface BrandMetrics {
  metric_fact_id: number;
  visibility_index: number;
  share_of_answers: number;
  total_mentions: number;
  product_mentions: number;
  first_position: number | null;
  has_presence: boolean;
}

interface CompetitorMetrics {
  metric_fact_id: number;
  competitor_id: string;
  visibility_index: number;
  share_of_answers: number;
  total_mentions: number;
  product_mentions: number;
  first_position: number | null;
  has_presence: boolean;
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
 * Process a batch of extracted_positions rows
 */
async function processBatch(positions: ExtractedPosition[], stats: Stats): Promise<void> {
  // Group by collector_result_id (since we have 1 brand row + N competitor rows per result)
  const groupedByCollectorResult = new Map<number, ExtractedPosition[]>();
  
  for (const pos of positions) {
    const existing = groupedByCollectorResult.get(pos.collector_result_id) || [];
    existing.push(pos);
    groupedByCollectorResult.set(pos.collector_result_id, existing);
  }

  console.log(`   📦 Processing ${groupedByCollectorResult.size} collector_results (${positions.length} rows)`);

  for (const [collectorResultId, rows] of groupedByCollectorResult.entries()) {
    try {
      // Check if already migrated
      if (await isAlreadyMigrated(collectorResultId)) {
        console.log(`   ⏭️  Skipping collector_result ${collectorResultId} (already migrated)`);
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

      // 1. Create metric_fact
      const metricFact: MetricFact = {
        collector_result_id: collectorResultId,
        brand_id: brandRow.brand_id,
        customer_id: brandRow.customer_id,
        query_id: brandRow.query_id,
        collector_type: brandRow.collector_type,
        topic: brandRow.topic,
        collected_at: brandRow.processed_at,
        metadata: brandRow.metadata || {},
      };

      if (DRY_RUN) {
        console.log(`   🔍 [DRY RUN] Would create metric_fact for collector_result ${collectorResultId}`);
        stats.metricFactsCreated++;
      } else {
        const { data: metricFactData, error: metricFactError } = await supabase
          .from('metric_facts')
          .insert(metricFact)
          .select('id')
          .single();

        if (metricFactError || !metricFactData) {
          console.error(`   ❌ Failed to create metric_fact for collector_result ${collectorResultId}:`, metricFactError);
          stats.errors++;
          continue;
        }

        const metricFactId = metricFactData.id;
        stats.metricFactsCreated++;

        // 2. Create brand_metrics
        const brandMetrics: BrandMetrics = {
          metric_fact_id: metricFactId,
          visibility_index: brandRow.visibility_index || 0,
          share_of_answers: brandRow.share_of_answers_brand || 0,
          total_mentions: brandRow.total_brand_mentions || 0,
          product_mentions: brandRow.total_brand_mentions || 0, // Approximate
          first_position: brandRow.brand_first_position,
          has_presence: brandRow.has_brand_presence,
        };

        const { error: brandMetricsError } = await supabase
          .from('brand_metrics')
          .insert(brandMetrics);

        if (brandMetricsError) {
          console.error(`   ❌ Failed to create brand_metrics for metric_fact ${metricFactId}:`, brandMetricsError);
          stats.errors++;
        } else {
          stats.brandMetricsCreated++;
        }

        // 3. Create brand_sentiment (if exists)
        if (brandRow.sentiment_label && brandRow.sentiment_score != null) {
          const brandSentiment: BrandSentiment = {
            metric_fact_id: metricFactId,
            sentiment_label: brandRow.sentiment_label,
            sentiment_score: brandRow.sentiment_score,
            positive_sentences: brandRow.sentiment_positive_sentences || [],
            negative_sentences: brandRow.sentiment_negative_sentences || [],
          };

          const { error: brandSentimentError } = await supabase
            .from('brand_sentiment')
            .insert(brandSentiment);

          if (brandSentimentError) {
            console.error(`   ❌ Failed to create brand_sentiment for metric_fact ${metricFactId}:`, brandSentimentError);
            stats.errors++;
          } else {
            stats.brandSentimentsCreated++;
          }
        }

        // 4. Create competitor_metrics and competitor_sentiment for each competitor
        for (const compRow of competitorRows) {
          if (!compRow.competitor_name) continue;

          const competitorId = await getCompetitorId(brandRow.brand_id, compRow.competitor_name);
          if (!competitorId) {
            console.warn(`   ⚠️ Skipping competitor ${compRow.competitor_name} (not found in brand_competitors)`);
            continue;
          }

          // Create competitor_metrics
          const competitorMetrics: CompetitorMetrics = {
            metric_fact_id: metricFactId,
            competitor_id: competitorId,
            visibility_index: compRow.visibility_index_competitor || 0,
            share_of_answers: compRow.share_of_answers_competitor || 0,
            total_mentions: compRow.competitor_mentions || 0,
            product_mentions: compRow.competitor_mentions || 0, // Approximate
            first_position: compRow.competitor_positions?.[0] || null,
            has_presence: (compRow.competitor_mentions || 0) > 0,
          };

          const { error: compMetricsError } = await supabase
            .from('competitor_metrics')
            .insert(competitorMetrics);

          if (compMetricsError) {
            console.error(`   ❌ Failed to create competitor_metrics for ${compRow.competitor_name}:`, compMetricsError);
            stats.errors++;
          } else {
            stats.competitorMetricsCreated++;
          }

          // Create competitor_sentiment (if exists)
          if (compRow.sentiment_label_competitor && compRow.sentiment_score_competitor != null) {
            const competitorSentiment: CompetitorSentiment = {
              metric_fact_id: metricFactId,
              competitor_id: competitorId,
              sentiment_label: compRow.sentiment_label_competitor,
              sentiment_score: compRow.sentiment_score_competitor,
              positive_sentences: compRow.sentiment_positive_sentences_competitor || [],
              negative_sentences: compRow.sentiment_negative_sentences_competitor || [],
            };

            const { error: compSentimentError } = await supabase
              .from('competitor_sentiment')
              .insert(competitorSentiment);

            if (compSentimentError) {
              console.error(`   ❌ Failed to create competitor_sentiment for ${compRow.competitor_name}:`, compSentimentError);
              stats.errors++;
            } else {
              stats.competitorSentimentsCreated++;
            }
          }
        }

        console.log(`   ✅ Migrated collector_result ${collectorResultId} (1 brand + ${competitorRows.length} competitors)`);
      }

      stats.totalProcessed++;
    } catch (error) {
      console.error(`   ❌ Error processing collector_result ${collectorResultId}:`, error);
      stats.errors++;
    }
  }
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

