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

interface BackfillStats {
  totalFound: number;
  totalProcessed: number;
  successfullyUpdated: number;
  stillProcessing: number;
  notFound: number;
  errors: number;
}

/**
 * Map collector_type to BrightData dataset ID
 * Only Bing Copilot and Grok use BrightData snapshots
 */
function getDatasetId(collectorType: string): string | null {
  const mapping: { [key: string]: string } = {
    'Bing Copilot': 'gd_m7di5jy6s9geokz8w',
    'Grok': 'gd_m8ve0u141icu75ae74',
    'ChatGPT': 'gd_m7di5jy6s9geokz8w', // ChatGPT also uses BrightData
  };
  return mapping[collectorType] || null;
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

    // Update collector_results table
    // First, update raw_answer, citations, and urls (essential fields)
    const { error: updateError } = await supabase
      .from('collector_results')
      .update({
        raw_answer: answer,
        citations: urls.length > 0 ? urls : null,
        urls: urls.length > 0 ? urls : null,
        metadata: {
          updated_by: 'backfill_script',
          updated_at: new Date().toISOString(),
          snapshot_id: record.brightdata_snapshot_id
        }
      })
      .eq('id', record.id);

    if (updateError) {
      console.error(`   ❌ Error updating record ${record.id}:`, updateError.message);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error(`   ❌ Exception processing record ${record.id}:`, error.message);
    return { success: false, error: error.message || 'unknown_error' };
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
  };

  try {
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

