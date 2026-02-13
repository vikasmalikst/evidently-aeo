/**
 * One-Time Backfill Script: Fix metric_facts.created_at dates
 *
 * This script:
 * 1. Iterates through all metric_facts records
 * 2. Joins with collector_results to get the original collection time
 * 3. Updates metric_facts.created_at to match collector_results.created_at
 *    (if they differ by more than 1 minute)
 *
 * Usage:
 *   ts-node backend/src/scripts/backfill-metric-facts-dates.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';

// Load environment variables
loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const BATCH_SIZE = 500;
const THROTTLE_MS = 200; // Delay between batches to reduce DB load

async function backfillDates() {
  console.log('🚀 Starting metric_facts date backfill...');

  let processed = 0;
  let updated = 0;
  let errors = 0;
  let lastId = 0;
  let hasMore = true;

  while (hasMore) {
    // 1. Fetch batch of metric_facts
    const { data: metrics, error: fetchError } = await supabase
      .from('metric_facts')
      .select(`
        id,
        collector_result_id,
        created_at,
        collector_results!inner (
          id,
          created_at
        )
      `)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('❌ Error fetching batch:', fetchError);
      errors++;
      break;
    }

    if (!metrics || metrics.length === 0) {
      hasMore = false;
      break;
    }

    // 2. Identify records needing update
    interface UpdateItem {
      id: number;
      created_at: string;
    }
    const updates: UpdateItem[] = [];
    for (const metric of metrics) {
      // @ts-ignore
      const collectorResultData = metric.collector_results;
      if (!collectorResultData) continue;

      const collectorResult = Array.isArray(collectorResultData) ? collectorResultData[0] : collectorResultData;
      if (!collectorResult) continue;

      const metricDate = new Date(metric.created_at).getTime();
      const collectorDate = new Date(collectorResult.created_at).getTime();
      const diffMs = Math.abs(metricDate - collectorDate);

      // If difference is > 1 minute (60000ms), update it
      if (diffMs > 60000) {
        updates.push({
          id: metric.id,
          created_at: collectorResult.created_at
        });
      }

      lastId = metric.id;
    }

    // 3. Perform updates
    if (updates.length > 0) {
      console.log(`   📝 Updating ${updates.length} records in this batch (ID > ${lastId - BATCH_SIZE})...`);

      const CHUNK_SIZE = 20;
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(update => 
          supabase
            .from('metric_facts')
            .update({ created_at: update.created_at })
            .eq('id', update.id)
        ));
      }
      
      updated += updates.length;
    }

    processed += metrics.length;
    process.stdout.write(`\r✅ Processed: ${processed}, Updated: ${updated}, Errors: ${errors}`);
    
    // Safety throttle
    await new Promise(resolve => setTimeout(resolve, THROTTLE_MS));
  }

  console.log('\n\n🏁 Backfill complete!');
  console.log(`   Total Processed: ${processed}`);
  console.log(`   Total Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
}

backfillDates().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
