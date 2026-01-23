/**
 * Brand Scoring Service
 * Orchestrates all scoring operations (position extraction, sentiment scoring, citation extraction) for a specific brand
 */

import { loadEnvironment } from '../../utils/env-utils';
import { consolidatedScoringService } from './consolidated-scoring.service';
import { supabaseAdmin } from '../../config/database';

// Load environment variables
loadEnvironment();

interface BrandScoringOptions {
  brandId: string;
  customerId: string;
  /**
   * Only process collector_results created after this timestamp
   * If not provided, processes all unprocessed results for the brand
   */
  since?: string;
  /**
   * Maximum number of results to process per scoring operation
   * Defaults to 50 for positions, 50 for sentiments, no limit for citations
   */
  positionLimit?: number;
  sentimentLimit?: number;
  /**
   * Whether to run scoring operations in parallel (faster) or sequentially (safer)
   * Default: false (sequential)
   */
  parallel?: boolean;
}

interface BrandScoringResult {
  positionsProcessed: number;
  sentimentsProcessed: number;
  competitorSentimentsProcessed: number;
  citationsProcessed: number;
  errors: Array<{ operation: string; error: string }>;
}

export class BrandScoringService {
  /**
   * Run all scoring operations for a specific brand
   * Uses consolidated analysis for all scoring operations
   * 
   * @param options - Scoring options
   * @returns Summary of processed results
   */
  async scoreBrand(options: BrandScoringOptions): Promise<BrandScoringResult> {
    const result = await this.scoreBrandWithConsolidatedAnalysis(options);

    // Keep legacy readers fast/correct: refresh extracted_positions_compat after scoring.
    // Do this asynchronously so API responses aren't blocked by a materialized view refresh.
    setImmediate(async () => {
      try {
        await supabaseAdmin.rpc('refresh_extracted_positions_compat');
      } catch (error) {
        console.warn(
          `[Scoring] Failed to refresh extracted_positions_compat (brand_id=${options.brandId}):`,
          error instanceof Error ? error.message : String(error)
        );
      }
    });

    return result;
  }

  /**
   * Score brand using consolidated analysis (new approach - single API call)
   */
  private async scoreBrandWithConsolidatedAnalysis(options: BrandScoringOptions): Promise<BrandScoringResult> {
    const { brandId, customerId, since, positionLimit } = options;

    console.log(`\n🚀 Using consolidated analysis for brand scoring...`);

    const result: BrandScoringResult = {
      positionsProcessed: 0,
      sentimentsProcessed: 0,
      competitorSentimentsProcessed: 0,
      citationsProcessed: 0,
      errors: [],
    };

    try {
      // Use consolidated scoring service
      const consolidatedResult = await consolidatedScoringService.scoreBrand({
        brandId,
        customerId,
        since,
        limit: positionLimit ?? 50,
      });

      result.positionsProcessed = consolidatedResult.positionsProcessed;
      result.sentimentsProcessed = consolidatedResult.sentimentsProcessed;
      result.competitorSentimentsProcessed = consolidatedResult.sentimentsProcessed;
      result.citationsProcessed = consolidatedResult.citationsProcessed;

      // Convert errors format
      result.errors = consolidatedResult.errors.map(e => ({
        operation: 'consolidated_scoring',
        error: `collector_result ${e.collectorResultId}: ${e.error}`,
      }));

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({ operation: 'consolidated_scoring', error: errorMsg });
      console.error(`❌ Consolidated scoring failed:`, errorMsg);
      return result;
    }
  }

  /**
   * Run scoring operations asynchronously (fire and forget)
   * Useful for triggers that shouldn't block the main operation
   */
  async scoreBrandAsync(options: BrandScoringOptions): Promise<void> {
    if (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test') {
      return;
    }
    // Run in background without blocking
    setImmediate(async () => {
      try {
        await this.scoreBrand(options);
      } catch (error) {
        console.error(`❌ Async brand scoring failed for brand ${options.brandId}:`, error);
        // Don't throw - this is fire-and-forget
      }
    });
  }

  /**
   * Run a complete backfill for a brand (cleanup + re-score + backdate)
   * This logic mirrors the robust script approach.
   */
  async backfillBrand(options: {
    brandId: string;
    customerId: string;
    startDate: string;
    endDate: string;
    force?: boolean;
    preserveDates?: boolean;
    sendLog?: (msg: string) => void;
  }): Promise<{ processed: number, errorCount: number }> {
    const { brandId, customerId, startDate, endDate, force = false, preserveDates = true, sendLog = console.log } = options;

    const start = new Date(startDate);
    const end = new Date(endDate);

    sendLog(`\n🔄 Starting Backfill for Brand: ${brandId}`);
    sendLog(`   Dates: ${start.toISOString()} to ${end.toISOString()} `);

    // 1. Fetch relevant collector_results
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('collector_results')
      .select('id, created_at')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (resultsError || !results) {
      throw new Error(`Error fetching collector_results: ${resultsError?.message} `);
    }

    if (results.length === 0) {
      sendLog('⚠️ No results found in this period.');
      return { processed: 0, errorCount: 0 };
    }

    sendLog(`🔎 Found ${results.length} collector_results to re - process.`);

    const resultIds = results.map(r => r.id);

    // 2. Clean up existing data (metric_facts and citations)
    // We intentionally ignore extracted_positions as they are legacy/expensive to re-compute
    sendLog('🗑️ Cleaning up existing metrics and citations...');

    const { count: deletedMetrics } = await supabaseAdmin
      .from('metric_facts')
      .delete({ count: 'exact' })
      .in('collector_result_id', resultIds);

    sendLog(`   - Deleted ${deletedMetrics} metric_facts rows`);

    const { count: deletedCitations } = await supabaseAdmin
      .from('citations')
      .delete({ count: 'exact' })
      .in('collector_result_id', resultIds);

    sendLog(`   - Deleted ${deletedCitations} citations rows`);

    // 3. Reset scoring_status
    sendLog('🔄 Resetting scoring_status to "pending"...');
    await supabaseAdmin
      .from('collector_results')
      .update({ scoring_status: 'pending' })
      .in('id', resultIds);

    // 4. Re-Process
    sendLog('⚙️ Re-Scoring (batch process)...');

    // We delegate to the standard scoreBrand method which picks up 'pending' items
    // passing 'since' helps efficient querying but isn't strictly required if status is pending
    const scoreResult: any = await this.scoreBrand({
      brandId,
      customerId,
      since: start.toISOString(),
      positionLimit: 1000 // Ensure we grab a good chunk
    });

    sendLog(`   Scored: ${scoreResult.positionsProcessed} positions, ${scoreResult.sentimentsProcessed} sentiments.`);

    let errorCount = scoreResult.errors?.length || 0;

    // 5. Backdate timestamps if requested
    if (preserveDates) {
      sendLog('🕰️ Backdating timestamps...');
      // Correct processed_at and created_at to match original collector_result creation time
      // We do this by iterating results because SQL update-join is tricky in Supabase JS client
      for (const result of results) {
        const originalDate = result.created_at;

        const { error: updateMetricsError } = await supabaseAdmin
          .from('metric_facts')
          .update({
            processed_at: originalDate,
            created_at: originalDate
          })
          .eq('collector_result_id', result.id);

        if (updateMetricsError) {
          console.error(`Failed to backdate metrics for ${result.id}: `, updateMetricsError);
          errorCount++;
        }

        // Citations
        await supabaseAdmin
          .from('citations')
          .update({ created_at: originalDate })
          .eq('collector_result_id', result.id);
      }
      sendLog('   Backdating complete.');
    }

    // 6. Log to backfill_history
    const details = {
      resultsFound: results.length,
      deletedMetrics,
      deletedCitations,
      scoringOutput: scoreResult,
      backdated: preserveDates,
      errorCount
    };

    const { error: historyError } = await supabaseAdmin
      .from('backfill_history')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        target_start_date: start,
        target_end_date: end,
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        details: details
      });

    if (historyError) {
      sendLog('⚠️ Failed to log to backfill_history.');
    } else {
      sendLog('📝 Logged to backfill_history.');
    }

    return { processed: results.length, errorCount };
  }
}

export const brandScoringService = new BrandScoringService();
