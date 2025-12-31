/**
 * One-Time Backfill Script: Update raw_answer from BrightData snapshots
 * 
 * This script:
 * 1. Finds all collector_results where raw_answer IS NULL and brightdata_snapshot_id IS NOT NULL
 * 2. Fetches the snapshot data from BrightData API
 * 3. Extracts the raw_answer using the same parsing logic as the polling service
 * 4. Updates the collector_results table with the extracted raw_answer
 * 
 * Usage:
 *   npm run script:backfill-raw-answer-from-snapshots
 *   or
 *   ts-node backend/src/scripts/backfill-raw-answer-from-snapshots.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { transitionCollectorResultById } from '../services/data-collection/collector-results-status';

// Load environment variables
loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const brightDataApiKey = getEnvVar('BRIGHTDATA_API_KEY');

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const BATCH_SIZE = 10; // Process 10 records at a time to avoid rate limits
const STUCK_PROCESSING_HOURS = 8;
const STUCK_PROCESSING_ERROR = 'Running for more than 8 hours. Check BrightData Status';
const STUCK_SCORING_RESET_HOURS = 2;
const STUCK_SCORING_FAIL_HOURS = 8;
const STUCK_SCORING_TIMEOUT_ERROR = 'Scoring Time Out. Pending for more than 8 hours';

interface BackfillStats {
  totalFound: number;
  totalProcessed: number;
  successfullyUpdated: number;
  stillProcessing: number;
  notFound: number;
  errors: number;
  stuckMarkedFailed: number;
  scoringResetToNull: number;
  scoringTimedOutFailed: number;
}

/**
 * Extract answer and URLs from BrightData response
 * Uses the same logic as BrightDataPollingService.extractAnswerAndUrls
 */
function extractAnswerAndUrls(actualResult: any): { answer: string; urls: string[] } {
  // Extract answer - try multiple fields
  let answer = actualResult.answer_text || actualResult.answer || actualResult.response || actualResult.content || 'No response';
  
  // If no answer found, try extracting from HTML
  if ((!answer || answer === 'No response') && actualResult.answer_section_html) {
    answer = actualResult.answer_section_html.replace(/<[^>]*>/g, '').trim() || actualResult.answer_section_html;
  }

  // Extract citations/URLs
  let citationsArray: any[] = [];
  
  if (actualResult.citations && Array.isArray(actualResult.citations)) {
    citationsArray = actualResult.citations;
  } else if (actualResult.links_attached && Array.isArray(actualResult.links_attached)) {
    citationsArray = actualResult.links_attached;
  } else if (actualResult.sources && Array.isArray(actualResult.sources)) {
    citationsArray = actualResult.sources;
  } else if (actualResult.urls && Array.isArray(actualResult.urls)) {
    citationsArray = actualResult.urls;
  }
  
  // Extract URLs from citations array
  let urls: string[] = [];
  if (Array.isArray(citationsArray) && citationsArray.length > 0) {
    urls = citationsArray
      .map((citation: any) => {
        if (typeof citation === 'string') {
          return citation.startsWith('http://') || citation.startsWith('https://') ? citation : null;
        }
        if (typeof citation === 'object' && citation !== null) {
          return citation.url || citation.source || citation.link || citation.href || null;
        }
        return null;
      })
      .filter((url: string | null): url is string => url !== null && (url.startsWith('http://') || url.startsWith('https://')));
    
    urls = [...new Set(urls)]; // Remove duplicates
  }
  
  // Fallback: extract URLs from text content
  if (urls.length === 0) {
    const textToSearch = answer || actualResult.answer_section_html || '';
    if (textToSearch) {
      const urlRegex = /https?:\/\/[^\s\)<>"]+/g;
      const extractedUrls = textToSearch.match(urlRegex) || [];
      urls = [...new Set(extractedUrls as string[])];
    }
  }

  return { answer, urls };
}

/**
 * Fetch snapshot data from BrightData API
 */
async function fetchSnapshotData(snapshotId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
    const response = await fetch(snapshotUrl, {
      headers: {
        'Authorization': `Bearer ${brightDataApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 202) {
      // Still processing
      return { success: false, error: 'still_processing' };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const responseText = await response.text();
    let downloadResult: any;

    try {
      downloadResult = JSON.parse(responseText);
    } catch (parseError) {
      return { success: false, error: 'invalid_json' };
    }

    // Handle different response structures
    let actualResult = downloadResult;
    
    // If response is an array, take the first element
    if (Array.isArray(downloadResult) && downloadResult.length > 0) {
      actualResult = downloadResult[0];
    }
    
    // Check if data is ready - look for answer fields
    const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
    const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
    const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
    
    if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
      return { success: true, data: actualResult };
    }

    return { success: false, error: 'no_answer_found' };
  } catch (error: any) {
    return { success: false, error: error.message || 'unknown_error' };
  }
}

/**
 * Process a single collector_result record
 */
async function processRecord(
  record: { id: number; brightdata_snapshot_id: string; collector_type: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    // Fetch snapshot data
    const snapshotResult = await fetchSnapshotData(record.brightdata_snapshot_id);
    
    if (!snapshotResult.success) {
      if (snapshotResult.error === 'still_processing') {
        return { success: false, error: 'still_processing' };
      }
      return { success: false, error: snapshotResult.error || 'fetch_failed' };
    }

    if (!snapshotResult.data) {
      return { success: false, error: 'no_data' };
    }

    // Extract answer and URLs
    const { answer, urls } = extractAnswerAndUrls(snapshotResult.data);

    if (!answer || answer.trim().length === 0 || answer === 'No response') {
      return { success: false, error: 'empty_answer' };
    }

    const scoringStartedAt = new Date().toISOString();

    const { data: rawUpdatedRows, error: rawUpdateError } = await supabase
      .from('collector_results')
      .update({
        raw_answer: answer,
        citations: urls.length > 0 ? urls : null,
        urls: urls.length > 0 ? urls : null,
      })
      .eq('id', record.id)
      .select('id, status');

    if (rawUpdateError) {
      console.error(`   ❌ Error updating record ${record.id}:`, rawUpdateError.message);
      return { success: false, error: rawUpdateError.message };
    }

    const currentStatus = rawUpdatedRows?.[0]?.status ?? null;

    if (currentStatus === 'failed') {
      const { error: directStatusError } = await supabase
        .from('collector_results')
        .update({
          status: 'completed',
          error_message: null,
        })
        .eq('id', record.id)
        .eq('status', 'failed');

      if (directStatusError) {
        console.warn(
          `   ⚠️  Error updating status (failed->completed) for record ${record.id}:`,
          directStatusError.message
        );
      }
    } else if (currentStatus !== 'completed') {
      let transitioned = false;
      let skippedTerminal = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const result = await transitionCollectorResultById(
          supabase,
          record.id,
          'completed',
          {
            source: 'backfill_script',
            reason: 'successful_snapshot_processing',
            collectorType: record.collector_type,
            snapshotId: record.brightdata_snapshot_id,
          },
          {
            error_message: null,
            metadata: {
              updated_by: 'backfill_script',
              updated_at: scoringStartedAt,
              snapshot_id: record.brightdata_snapshot_id,
            },
          }
        );

        if (result.updated || result.skippedTerminal) {
          transitioned = true;
          skippedTerminal = result.skippedTerminal;
          break;
        }

        await sleep(150 * Math.pow(2, attempt - 1));
      }

      if (skippedTerminal) {
        const { data: statusRow } = await supabase
          .from('collector_results')
          .select('status')
          .eq('id', record.id)
          .maybeSingle();

        if (statusRow?.status === 'failed') {
          const { error: directStatusError } = await supabase
            .from('collector_results')
            .update({
              status: 'completed',
              error_message: null,
            })
            .eq('id', record.id)
            .eq('status', 'failed');

          if (directStatusError) {
            console.warn(
              `   ⚠️  Error updating status (failed->completed) for record ${record.id}:`,
              directStatusError.message
            );
          }
        }
      }

      if (!transitioned) {
        return { success: false, error: 'status_transition_failed' };
      }
    }

    const scoringResetPayload = {
      scoring_status: 'pending',
      scoring_started_at: null,
      scoring_completed_at: null,
      scoring_error: null,
    };

    const { data: updatedScoringNull, error: scoringNullError } = await supabase
      .from('collector_results')
      .update(scoringResetPayload)
      .eq('id', record.id)
      .is('scoring_status', null)
      .select('id');

    if (scoringNullError) {
      console.warn(`   ⚠️  Error updating scoring_status for record ${record.id}:`, scoringNullError.message);
    }

    if (!scoringNullError && (!updatedScoringNull || updatedScoringNull.length === 0)) {
      const { error: scoringPendingError } = await supabase
        .from('collector_results')
        .update(scoringResetPayload)
        .eq('id', record.id)
        .in('scoring_status', ['pending', 'processing', 'error'])
        .select('id');

      if (scoringPendingError) {
        console.warn(
          `   ⚠️  Error updating scoring_status (pending/error) for record ${record.id}:`,
          scoringPendingError.message
        );
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error(`   ❌ Exception processing record ${record.id}:`, error.message);
    return { success: false, error: error.message || 'unknown_error' };
  }
}

async function markStuckProcessingRows(stats: BackfillStats): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_HOURS * 60 * 60 * 1000).toISOString();
  const PAGE_SIZE = 500;
  let offset = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('collector_results')
      .select('id')
      .eq('status', 'processing')
      .not('brightdata_snapshot_id', 'is', null)
      .is('raw_answer', null)
      .lt('created_at', cutoff)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('❌ Error fetching stuck processing rows:', error.message);
      return;
    }

    if (!rows || rows.length === 0) {
      return;
    }

    const ids = rows.map((row: any) => row.id).filter((id: any) => typeof id === 'number' && Number.isFinite(id));
    if (ids.length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('collector_results')
        .update({
          status: 'failed',
          error_message: STUCK_PROCESSING_ERROR,
        })
        .in('id', ids)
        .select('id');

      if (updateError) {
        console.error('❌ Error marking stuck processing rows as failed:', updateError.message);
      } else {
        stats.stuckMarkedFailed += (updated?.length ?? 0);
      }
    }

    if (rows.length < PAGE_SIZE) {
      return;
    }

    offset += PAGE_SIZE;
  }
}

async function markStuckScoringRows(stats: BackfillStats): Promise<void> {
  const resetCutoff = new Date(Date.now() - STUCK_SCORING_RESET_HOURS * 60 * 60 * 1000).toISOString();
  const failCutoff = new Date(Date.now() - STUCK_SCORING_FAIL_HOURS * 60 * 60 * 1000).toISOString();
  const PAGE_SIZE = 500;

  let lastFailedId = 0;
  while (true) {
    const { data: rows, error } = await supabase
      .from('collector_results')
      .select('id, scoring_error')
      .eq('scoring_status', 'pending')
      .not('raw_answer', 'is', null)
      .not('scoring_started_at', 'is', null)
      .lt('scoring_started_at', failCutoff)
      .gt('id', lastFailedId)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);

    if (error) {
      console.error('❌ Error fetching stuck scoring rows (pending >8h):', error.message);
      return;
    }

    if (!rows || rows.length === 0) {
      break;
    }

    for (const row of rows as Array<{ id: number; scoring_error: string | null }>) {
      const nextError =
        row.scoring_error && row.scoring_error.trim().length > 0
          ? `${row.scoring_error}\n${STUCK_SCORING_TIMEOUT_ERROR}`
          : STUCK_SCORING_TIMEOUT_ERROR;

      const { error: updateError } = await supabase
        .from('collector_results')
        .update({
          scoring_status: 'error',
          scoring_error: nextError,
        })
        .eq('id', row.id)
        .eq('scoring_status', 'pending')
        .not('raw_answer', 'is', null)
        .not('scoring_started_at', 'is', null)
        .lt('scoring_started_at', failCutoff);

      if (updateError) {
        console.error(`❌ Error marking scoring timeout for collector_result ${row.id}:`, updateError.message);
      } else {
        stats.scoringTimedOutFailed += 1;
      }
    }

    lastFailedId = (rows as any[])[rows.length - 1]?.id ?? lastFailedId;
    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  let lastResetId = 0;
  while (true) {
    const { data: rows, error } = await supabase
      .from('collector_results')
      .select('id')
      .eq('scoring_status', 'pending')
      .not('raw_answer', 'is', null)
      .not('scoring_started_at', 'is', null)
      .lt('scoring_started_at', resetCutoff)
      .gte('scoring_started_at', failCutoff)
      .gt('id', lastResetId)
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);

    if (error) {
      console.error('❌ Error fetching stuck scoring rows (pending >2h):', error.message);
      return;
    }

    if (!rows || rows.length === 0) {
      break;
    }

    const ids = (rows as any[])
      .map((row) => row.id)
      .filter((id) => typeof id === 'number' && Number.isFinite(id));

    if (ids.length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('collector_results')
        .update({
          scoring_status: null,
          scoring_started_at: null,
          scoring_completed_at: null,
          scoring_error: null,
        })
        .in('id', ids)
        .eq('scoring_status', 'pending')
        .not('raw_answer', 'is', null)
        .not('scoring_started_at', 'is', null)
        .lt('scoring_started_at', resetCutoff)
        .gte('scoring_started_at', failCutoff)
        .select('id');

      if (updateError) {
        console.error('❌ Error resetting stuck scoring rows to null:', updateError.message);
      } else {
        stats.scoringResetToNull += updated?.length ?? 0;
      }
    }

    lastResetId = (rows as any[])[rows.length - 1]?.id ?? lastResetId;
    if (rows.length < PAGE_SIZE) {
      break;
    }
  }
}

/**
 * Process a batch of collector_results
 */
async function processBatch(
  records: Array<{ id: number; brightdata_snapshot_id: string; collector_type: string }>,
  stats: BackfillStats
): Promise<void> {
  console.log(`\n📦 Processing batch of ${records.length} records...`);

  for (const record of records) {
    try {
      const result = await processRecord(record);
      
      if (result.success) {
        stats.successfullyUpdated++;
        console.log(`   ✅ Updated record ${record.id} (snapshot: ${record.brightdata_snapshot_id})`);
      } else {
        if (result.error === 'still_processing') {
          stats.stillProcessing++;
          console.log(`   ⏳ Record ${record.id} still processing (snapshot: ${record.brightdata_snapshot_id})`);
        } else if (result.error === 'no_data' || result.error === 'not_found') {
          stats.notFound++;
          console.log(`   ⚠️  Record ${record.id} - snapshot not found or no data (${result.error})`);
        } else {
          stats.errors++;
          console.log(`   ❌ Record ${record.id} failed: ${result.error}`);
        }
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      stats.errors++;
      console.error(`   ❌ Error processing record ${record.id}:`, error.message);
    }
  }

  stats.totalProcessed += records.length;
}

/**
 * Main backfill function
 */
async function backfillRawAnswerFromSnapshots(): Promise<void> {
  console.log('\n🚀 Starting raw_answer backfill from BrightData snapshots...');
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Processing only records where raw_answer IS NULL and brightdata_snapshot_id IS NOT NULL\n`);

  const stats: BackfillStats = {
    totalFound: 0,
    totalProcessed: 0,
    successfullyUpdated: 0,
    stillProcessing: 0,
    notFound: 0,
    errors: 0,
    stuckMarkedFailed: 0,
    scoringResetToNull: 0,
    scoringTimedOutFailed: 0,
  };

  try {
    await markStuckProcessingRows(stats);
    if (stats.stuckMarkedFailed > 0) {
      console.log(`⚠️  Marked ${stats.stuckMarkedFailed} stuck 'processing' rows as failed (>${STUCK_PROCESSING_HOURS}h)`);
    }

    await markStuckScoringRows(stats);
    if (stats.scoringResetToNull > 0) {
      console.log(
        `⚠️  Reset ${stats.scoringResetToNull} stuck scoring_status='pending' rows to NULL (>${STUCK_SCORING_RESET_HOURS}h)`
      );
    }
    if (stats.scoringTimedOutFailed > 0) {
      console.log(
        `⚠️  Marked ${stats.scoringTimedOutFailed} stuck scoring_status='pending' rows as error (>${STUCK_SCORING_FAIL_HOURS}h)`
      );
    }

    // Step 1: Count total records to process
    const { count: totalCount, error: countError } = await supabase
      .from('collector_results')
      .select('id', { count: 'exact', head: true })
      .is('raw_answer', null)
      .not('brightdata_snapshot_id', 'is', null);

    if (countError) {
      throw new Error(`Failed to count records: ${countError.message}`);
    }

    stats.totalFound = totalCount || 0;
    console.log(`📊 Found ${stats.totalFound} collector_results with NULL raw_answer and non-null brightdata_snapshot_id\n`);

    if (!stats.totalFound || stats.totalFound === 0) {
      console.log('✅ No records to process. Exiting.');
      return;
    }

    // Step 2: Process in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch
      const { data: batch, error: fetchError } = await supabase
        .from('collector_results')
        .select('id, brightdata_snapshot_id, collector_type')
        .is('raw_answer', null)
        .not('brightdata_snapshot_id', 'is', null)
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
      await processBatch(batch, stats);

      // Update offset
      offset += BATCH_SIZE;
      hasMore = batch.length === BATCH_SIZE;

      // Progress update
      const progress = Math.min(offset, stats.totalFound);
      const percentage = ((progress / stats.totalFound) * 100).toFixed(1);
      console.log(`\n📈 Progress: ${progress}/${stats.totalFound} (${percentage}%)\n`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Backfill Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total found: ${stats.totalFound}`);
    console.log(`   Total processed: ${stats.totalProcessed}`);
    console.log(`   ✅ Successfully updated: ${stats.successfullyUpdated}`);
    console.log(`   ⏳ Still processing: ${stats.stillProcessing}`);
    console.log(`   ⚠️  Not found/no data: ${stats.notFound}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log(`   🚫 Marked stuck as failed: ${stats.stuckMarkedFailed}`);
    console.log(`   ⏳ Reset scoring pending to NULL: ${stats.scoringResetToNull}`);
    console.log(`   ❌ Marked scoring pending as error: ${stats.scoringTimedOutFailed}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  backfillRawAnswerFromSnapshots()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { backfillRawAnswerFromSnapshots };
