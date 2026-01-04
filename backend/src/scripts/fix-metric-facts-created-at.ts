/**
 * Fix metric_facts.created_at from extracted_positions.created_at
 * 
 * This script updates existing metric_facts rows to use the correct created_at
 * date from extracted_positions table instead of the insertion timestamp.
 * 
 * Background:
 * - The original backfill script used processed_at and let created_at default to NOW()
 * - This caused created_at to show insertion dates (Dec 22) instead of scoring dates (Nov 8)
 * - extracted_positions.created_at = scoring timestamp (when data was scored)
 * - collector_results.created_at = collection timestamp (when data was collected)
 * - This script ONLY fixes old records that were migrated from extracted_positions
 * - New records (not in extracted_positions) are left unchanged
 * 
 * Features:
 * - Batch processing for performance
 * - Progress tracking
 * - Dry-run mode for testing
 * - Safe to re-run (idempotent)
 * - Error handling with detailed logging
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
const BATCH_SIZE = 500;
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set DRY_RUN=true to test without writing

interface UpdateStats {
  totalRows: number;
  rowsUpdated: number;
  rowsSkipped: number;
  errors: number;
}

/**
 * Get created_at from extracted_positions for a batch of collector_result_ids
 * This ONLY returns data for records that exist in extracted_positions (old migrated records)
 * New records (not in extracted_positions) will be skipped
 */
async function getCreatedAtMap(collectorResultIds: number[]): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from('extracted_positions')
    .select('collector_result_id, created_at')
    .in('collector_result_id', collectorResultIds)
    .is('competitor_name', null) // Only get brand rows (competitor_name is null)
    .limit(collectorResultIds.length);

  if (error) {
    console.error('❌ Error fetching created_at from extracted_positions:', error);
    return new Map();
  }

  const createdAtMap = new Map<number, string>();
  (data || []).forEach(row => {
    if (row.created_at && row.collector_result_id) {
      createdAtMap.set(row.collector_result_id, row.created_at);
    }
  });

  return createdAtMap;
}

/**
 * Update a batch of metric_facts rows
 */
async function updateBatch(metricFactIds: number[], createdAtMap: Map<number, string>, stats: UpdateStats): Promise<void> {
  if (metricFactIds.length === 0) {
    return;
  }

  // Fetch metric_facts to get collector_result_id mappings
  const { data: metricFacts, error: fetchError } = await supabase
    .from('metric_facts')
    .select('id, collector_result_id')
    .in('id', metricFactIds);

  if (fetchError || !metricFacts) {
    console.error('❌ Error fetching metric_facts:', fetchError);
    stats.errors += metricFactIds.length;
    return;
  }

  // Group updates by created_at value (batch updates by same value)
  const updatesByCreatedAt = new Map<string, number[]>();
  
  for (const mf of metricFacts) {
    const created_at = createdAtMap.get(mf.collector_result_id);
    if (!created_at) {
      stats.rowsSkipped++;
      continue;
    }

    const existing = updatesByCreatedAt.get(created_at) || [];
    existing.push(mf.id);
    updatesByCreatedAt.set(created_at, existing);
  }

  if (updatesByCreatedAt.size === 0) {
    console.log(`   ⏭️  No updates needed for this batch (records not in extracted_positions - new records)`);
    return;
  }

  // Perform updates (one per unique created_at value)
  let batchUpdated = 0;
  
  for (const [created_at, ids] of updatesByCreatedAt.entries()) {
    if (DRY_RUN) {
      console.log(`   🔍 [DRY RUN] Would update ${ids.length} rows with created_at=${created_at}`);
      batchUpdated += ids.length;
      continue;
    }

    const { error: updateError } = await supabase
      .from('metric_facts')
      .update({ created_at })
      .in('id', ids);

    if (updateError) {
      console.error(`   ❌ Error updating batch (created_at=${created_at}):`, updateError);
      stats.errors += ids.length;
    } else {
      console.log(`   ✅ Updated ${ids.length} rows with created_at=${created_at}`);
      batchUpdated += ids.length;
    }
  }

  stats.rowsUpdated += batchUpdated;
}

/**
 * Main fix function
 */
async function fixCreatedAt(): Promise<void> {
  console.log('========================================');
  console.log('Fix metric_facts.created_at from extracted_positions');
  console.log('========================================');
  console.log('');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE: No data will be updated');
    console.log('');
  }

  const stats: UpdateStats = {
    totalRows: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    errors: 0,
  };

  // Get total count of metric_facts
  const { count: totalCount, error: countError } = await supabase
    .from('metric_facts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Failed to count metric_facts:', countError);
    process.exit(1);
  }

  stats.totalRows = totalCount || 0;
  console.log(`📊 Total rows in metric_facts: ${stats.totalRows}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log('');

  if (stats.totalRows === 0) {
    console.log('✅ No rows to update');
    return;
  }

  let offset = 0;
  let batchNumber = 1;

  while (offset < stats.totalRows) {
    console.log(`\n📦 Batch ${batchNumber} (offset ${offset})...`);

    // Fetch batch of metric_facts
    const { data: metricFacts, error: fetchError } = await supabase
      .from('metric_facts')
      .select('id, collector_result_id')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id', { ascending: true });

    if (fetchError) {
      console.error(`❌ Failed to fetch batch ${batchNumber}:`, fetchError);
      stats.errors += BATCH_SIZE;
      break;
    }

    if (!metricFacts || metricFacts.length === 0) {
      console.log('✅ No more rows to process');
      break;
    }

    // Get unique collector_result_ids from this batch
    const collectorResultIds = Array.from(new Set(metricFacts.map(mf => mf.collector_result_id)));

    // Fetch created_at values from extracted_positions (ONLY for old migrated records)
    console.log(`   🔍 Fetching created_at from extracted_positions for ${collectorResultIds.length} collector_results...`);
    const createdAtMap = await getCreatedAtMap(collectorResultIds);

    if (createdAtMap.size === 0) {
      console.log(`   ⏭️  No matching records in extracted_positions (new records, skipping)`);
      stats.rowsSkipped += metricFacts.length;
    } else {
      console.log(`   ✅ Found ${createdAtMap.size} old records in extracted_positions (will update)`);
      
      // Update this batch
      const metricFactIds = metricFacts.map(mf => mf.id);
      await updateBatch(metricFactIds, createdAtMap, stats);
    }

    offset += BATCH_SIZE;
    batchNumber++;

    // Progress report
    const progress = Math.min(100, Math.round((offset / stats.totalRows) * 100));
    console.log(`   📈 Progress: ${progress}% (${offset}/${stats.totalRows} rows)`);
  }

  // Final summary
  console.log('');
  console.log('========================================');
  console.log('UPDATE COMPLETE');
  console.log('========================================');
  console.log(`📊 Total rows in metric_facts: ${stats.totalRows}`);
  console.log(`✅ Old records updated (from extracted_positions): ${stats.rowsUpdated}`);
  console.log(`⏭️  New records skipped (not in extracted_positions): ${stats.rowsSkipped}`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE: No actual data was updated');
    console.log('   Run without DRY_RUN=true to perform actual updates');
  } else {
    console.log('✅ All old metric_facts rows (from extracted_positions) have been updated');
    console.log('   created_at now matches extracted_positions.created_at (scoring timestamp)');
    console.log('   New records (not in extracted_positions) were left unchanged');
  }
}

// Run the fix
fixCreatedAt()
  .then(() => {
    console.log('✅ Fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix script failed:', error);
    process.exit(1);
  });

