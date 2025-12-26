/**
 * One-Time Backfill Script: Update scoring_status for collector_results
 * 
 * This script backfills the scoring_status field for all collector_results where
 * scoring_status IS NULL, based on the same logic used in:
 * - Post-query deduplication (consolidated-scoring.service.ts lines 438-527)
 * - Position extraction check (position-extraction.service.ts lines 222-261)
 * 
 * Status determination:
 * - 'completed' = has metric_facts AND brand_sentiment (fully processed)
 * - 'pending' = not fully processed (needs processing)
 * 
 * Usage:
 *   npm run script:backfill-scoring-status
 *   or
 *   ts-node backend/src/scripts/backfill-scoring-status.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

const BATCH_SIZE = 100; // Process 100 records at a time

interface BackfillStats {
  totalProcessed: number;
  completed: number;
  pending: number;
  skipped: number;
  errors: number;
}

/**
 * Check if a collector_result is fully processed using optimized schema
 * Replicates logic from consolidated-scoring.service.ts lines 452-491
 */
async function isFullyProcessed(
  supabase: SupabaseClient,
  collectorResultId: number,
  brandId: string
): Promise<boolean> {
  try {
    // Step 1: Check if metric_facts exists (Step 2 completed)
    const { data: metricFact, error: metricFactError } = await supabase
      .from('metric_facts')
      .select('id')
      .eq('collector_result_id', collectorResultId)
      .eq('brand_id', brandId)
      .limit(1)
      .maybeSingle();

    if (metricFactError) {
      console.warn(`   ⚠️ Error checking metric_facts for collector_result ${collectorResultId}:`, metricFactError.message);
      return false;
    }

    if (!metricFact) {
      // No positions = not fully processed
      return false;
    }

    // Step 2: Check if brand_sentiment exists (Step 3 completed)
    const { data: brandSentiment, error: sentimentError } = await supabase
      .from('brand_sentiment')
      .select('metric_fact_id')
      .eq('metric_fact_id', metricFact.id)
      .not('sentiment_score', 'is', null)
      .limit(1)
      .maybeSingle();

    if (sentimentError) {
      console.warn(`   ⚠️ Error checking brand_sentiment for collector_result ${collectorResultId}:`, sentimentError.message);
      return false;
    }

    // Fully processed = has positions AND sentiment
    return !!brandSentiment;
  } catch (error) {
    console.error(`   ❌ Exception checking collector_result ${collectorResultId}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Process a batch of collector_results
 */
async function processBatch(
  supabase: SupabaseClient,
  collectorResults: Array<{ id: number; brand_id: string }>,
  stats: BackfillStats
): Promise<void> {
  const completedIds: number[] = [];
  const pendingIds: number[] = [];

  console.log(`\n📦 Processing batch of ${collectorResults.length} collector_results...`);

  // Check each collector_result
  for (const result of collectorResults) {
    try {
      const isCompleted = await isFullyProcessed(supabase, result.id, result.brand_id);
      
      if (isCompleted) {
        completedIds.push(result.id);
      } else {
        pendingIds.push(result.id);
      }
    } catch (error) {
      console.error(`   ❌ Error processing collector_result ${result.id}:`, error instanceof Error ? error.message : error);
      stats.errors++;
      // Continue with next result
    }
  }

  // Batch update completed status
  if (completedIds.length > 0) {
    const { error: completedError } = await supabase
      .from('collector_results')
      .update({ scoring_status: 'completed' })
      .in('id', completedIds);

    if (completedError) {
      console.error(`   ❌ Error updating completed status for ${completedIds.length} results:`, completedError.message);
      stats.errors += completedIds.length;
    } else {
      console.log(`   ✅ Updated ${completedIds.length} results to 'completed'`);
      stats.completed += completedIds.length;
    }
  }

  // Batch update pending status
  if (pendingIds.length > 0) {
    const { error: pendingError } = await supabase
      .from('collector_results')
      .update({ scoring_status: 'pending' })
      .in('id', pendingIds);

    if (pendingError) {
      console.error(`   ❌ Error updating pending status for ${pendingIds.length} results:`, pendingError.message);
      stats.errors += pendingIds.length;
    } else {
      console.log(`   ✅ Updated ${pendingIds.length} results to 'pending'`);
      stats.pending += pendingIds.length;
    }
  }

  stats.totalProcessed += collectorResults.length;
}

/**
 * Main backfill function
 */
async function backfillScoringStatus(): Promise<void> {
  console.log('\n🚀 Starting scoring_status backfill...');
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Schema: Optimized only (metric_facts + brand_sentiment)\n`);

  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });

  const stats: BackfillStats = {
    totalProcessed: 0,
    completed: 0,
    pending: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Step 1: Count total records to process
    const { count: totalCount, error: countError } = await supabase
      .from('collector_results')
      .select('id', { count: 'exact', head: true })
      .is('scoring_status', null)
      .not('raw_answer', 'is', null); // Skip results without raw_answer

    if (countError) {
      throw new Error(`Failed to count records: ${countError.message}`);
    }

    console.log(`📊 Found ${totalCount || 0} collector_results with NULL scoring_status and raw_answer\n`);

    if (!totalCount || totalCount === 0) {
      console.log('✅ No records to process. Exiting.');
      return;
    }

    // Step 2: Process in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch (include brand_id for status checking)
      const { data: batch, error: fetchError } = await supabase
        .from('collector_results')
        .select('id, brand_id')
        .is('scoring_status', null)
        .not('raw_answer', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchError) {
        console.error(`❌ Error fetching batch at offset ${offset}:`, fetchError.message);
        stats.errors += BATCH_SIZE;
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch
      await processBatch(supabase, batch, stats);

      // Update offset
      offset += BATCH_SIZE;
      hasMore = batch.length === BATCH_SIZE;

      // Progress update
      const progress = Math.min(offset, totalCount);
      const percentage = ((progress / totalCount) * 100).toFixed(1);
      console.log(`\n📈 Progress: ${progress}/${totalCount} (${percentage}%)\n`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Backfill Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total processed: ${stats.totalProcessed}`);
    console.log(`   ✅ Completed: ${stats.completed}`);
    console.log(`   ⏳ Pending: ${stats.pending}`);
    console.log(`   ⏭️  Skipped: ${stats.skipped}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  backfillScoringStatus()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { backfillScoringStatus };

