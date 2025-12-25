/**
 * Check if the missing collector_results exist in old schema
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

async function checkMissing() {
  const missingIds = [4310, 4308, 4309, 4304, 4319, 4318, 4300, 4317, 4316];
  const cutoffDate = '2025-12-20';

  console.log('🔍 Checking Missing Collector Results...\n');
  console.log(`Missing IDs: ${missingIds.join(', ')}\n`);

  for (const id of missingIds) {
    // Check in old schema
    const { data: oldData, error: oldError } = await supabase
      .from('extracted_positions_disabled_test')
      .select('collector_result_id, processed_at, brand_id')
      .eq('collector_result_id', id)
      .lt('processed_at', cutoffDate)
      .limit(1);

    // Check in new schema
    const { data: newData, error: newError } = await supabase
      .from('metric_facts')
      .select('collector_result_id, processed_at')
      .eq('collector_result_id', id)
      .limit(1);

    if (oldError) {
      console.log(`ID ${id}: ❌ Error checking old schema: ${oldError.message}`);
    } else if (oldData && oldData.length > 0) {
      console.log(`ID ${id}: ✅ Exists in old schema (date: ${oldData[0].processed_at}, brand: ${oldData[0].brand_id?.substring(0, 8)}...)`);
      
      if (newData && newData.length > 0) {
        console.log(`        ⚠️  Also exists in new schema (date: ${newData[0].processed_at})`);
        if (new Date(newData[0].processed_at) >= new Date(cutoffDate)) {
          console.log(`        ⚠️  But date is AFTER cutoff (${cutoffDate}) - this is why it's missing from historical check`);
        }
      } else {
        console.log(`        ❌ NOT in new schema - needs migration`);
      }
    } else {
      console.log(`ID ${id}: ❌ Not found in old schema before ${cutoffDate}`);
    }
  }
}

checkMissing()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

