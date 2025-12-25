/**
 * Fix processed_at dates for collector_results that were migrated with wrong dates
 * Updates metric_facts.processed_at to match the original date from extracted_positions_disabled_test
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

async function fixProcessedAtDates() {
  console.log('🔧 Fixing processed_at dates...\n');
  console.log('='.repeat(60));

  // Find collector_results where processed_at in new schema doesn't match old schema
  const cutoffDate = '2025-12-20';

  // Get all collector_results from old schema before cutoff
  const { data: oldData, error: oldError } = await supabase
    .from('extracted_positions_disabled_test')
    .select('collector_result_id, processed_at')
    .lt('processed_at', cutoffDate)
    .order('collector_result_id', { ascending: true });

  if (oldError) {
    console.error('❌ Error fetching old data:', oldError);
    return;
  }

  // Group by collector_result_id and get the earliest processed_at (brand row)
  const oldDates = new Map<number, string>();
  (oldData || []).forEach((row: any) => {
    const id = row.collector_result_id;
    const existing = oldDates.get(id);
    if (!existing || new Date(row.processed_at) < new Date(existing)) {
      oldDates.set(id, row.processed_at);
    }
  });

  console.log(`📊 Found ${oldDates.size} collector_results in old schema before ${cutoffDate}\n`);

  // Get corresponding records from new schema
  const collectorResultIds = Array.from(oldDates.keys());
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < collectorResultIds.length; i += BATCH_SIZE) {
    const batch = collectorResultIds.slice(i, i + BATCH_SIZE);
    
    const { data: newData, error: newError } = await supabase
      .from('metric_facts')
      .select('id, collector_result_id, processed_at')
      .in('collector_result_id', batch);

    if (newError) {
      console.error(`❌ Error fetching batch:`, newError);
      errors += batch.length;
      continue;
    }

    // Update records where dates don't match
    for (const newRow of (newData || [])) {
      const oldDate = oldDates.get(newRow.collector_result_id);
      if (!oldDate) continue;

      const newDate = new Date(newRow.processed_at);
      const correctDate = new Date(oldDate);

      // Only update if dates are significantly different (more than 1 day)
      const diffDays = Math.abs((newDate.getTime() - correctDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1) {
        const { error: updateError } = await supabase
          .from('metric_facts')
          .update({ processed_at: oldDate })
          .eq('id', newRow.id);

        if (updateError) {
          console.error(`❌ Error updating collector_result ${newRow.collector_result_id}:`, updateError);
          errors++;
        } else {
          console.log(`✅ Fixed collector_result ${newRow.collector_result_id}: ${newRow.processed_at} → ${oldDate}`);
          fixed++;
        }
      } else {
        skipped++;
      }
    }

    if ((i + BATCH_SIZE) % 200 === 0) {
      console.log(`   Progress: ${Math.min(i + BATCH_SIZE, collectorResultIds.length)}/${collectorResultIds.length}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ⏭️  Skipped (dates match): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('='.repeat(60));
}

fixProcessedAtDates()
  .then(() => {
    console.log('\n✅ Fix complete!');
    console.log('   Next step: Refresh materialized view');
    console.log('   Run: REFRESH MATERIALIZED VIEW mv_brand_daily_metrics;');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });

