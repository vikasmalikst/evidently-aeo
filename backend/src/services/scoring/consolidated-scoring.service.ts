/**
 * Consolidated Scoring Service
 * 
 * Uses consolidated analysis service to perform all scoring operations in a single API call:
 * - Product extraction (brand + competitors)
 * - Citation categorization
 * - Sentiment analysis (brand + competitors)
 * 
 * Then stores all results in the appropriate database tables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { consolidatedAnalysisService, ConsolidatedAnalysisOptions } from './consolidated-analysis.service';
import { positionExtractionService } from './position-extraction.service';
import { OptimizedMetricsHelper } from '../query-helpers/optimized-metrics.helper';
import { keywordGenerationService } from '../keywords/keyword-generation.service';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

interface ConsolidatedScoringOptions {
  brandId: string;
  customerId: string;
  since?: string;
  limit?: number;
}

interface ConsolidatedScoringResult {
  processed: number;
  positionsProcessed: number;
  sentimentsProcessed: number;
  citationsProcessed: number;
  errors: Array<{ collectorResultId: number; error: string }>;
  metrics: {
    totalCitations: number;
    cachedCitations: number;
    totalOccurrences: number; // Brand + Competitor analysis runs
    cachedOccurrences: number; // Runs satisfied from cache
  };
}

export class ConsolidatedScoringService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  /**
   * Get cached analysis from database for a collector_result
   */
  private async getCachedAnalysisFromDB(collectorResultId: number): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('consolidated_analysis_cache')
        .select('products, sentiment')
        .eq('collector_result_id', collectorResultId)
        .maybeSingle();

      if (error) {
        console.warn(`⚠️ Error fetching cached analysis for collector_result ${collectorResultId}:`, error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      // Reconstruct analysis object from cached data
      return {
        products: data.products || { brand: [], competitors: {} },
        sentiment: data.sentiment || { brand: { label: 'NEUTRAL', score: 60 }, competitors: {} },
        citations: {}, // Citations are stored separately
      };
    } catch (error) {
      console.warn(`⚠️ Error fetching cached analysis:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Atomically claim a collector_result for processing
   * Sets status to 'processing' only if status is claimable (pending, error, or null)
   * Returns true if successfully claimed, false if already claimed by another worker
   */
  private async claimCollectorResult(collectorResultId: number): Promise<boolean> {
    try {
      // 1. Try with RPC (Atomic) if available
      const { data, error } = await this.supabase
        .rpc('claim_collector_result', { row_id: collectorResultId })
        .maybeSingle();

      if (!error && data) return true;
      
      // 2. Fallback strategies (Sequential to avoid OR() bug)
      // We try to claim by matching specific status one by one
      const statuses = [null, 'pending', 'error', 'timeout'];
      
      for (const status of statuses) {
          let query = this.supabase.from('collector_results').update({
              scoring_status: 'processing',
              scoring_started_at: new Date().toISOString(),
          }).eq('id', collectorResultId);
          
          if (status === null) {
              query = query.is('scoring_status', null);
          } else {
              query = query.eq('scoring_status', status);
          }
          
          const { data: legacyData, error: legacyError } = await query.select('id').single();
          
          if (!legacyError && legacyData) return true;
          
          // Handle missing column fallback
          if (legacyError && (legacyError.message.includes('column') || legacyError.message.includes('scoring_started_at'))) {
             if (status === null) {
                 console.warn(`⚠️ 'scoring_started_at' column likely missing, falling back to 'scoring_status' only.`);
             }

             let minQuery = this.supabase.from('collector_results').update({
                  scoring_status: 'processing'
              }).eq('id', collectorResultId);
              
              if (status === null) {
                  minQuery = minQuery.is('scoring_status', null);
              } else {
                  minQuery = minQuery.eq('scoring_status', status);
              }
              
              const { data: minData, error: minError } = await minQuery.select('id').single();
              if (!minError && minData) return true;
          }
      }
      
      return false;

    } catch (error) {
      console.warn(`⚠️ Exception claiming collector_result ${collectorResultId}:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Mark a collector_result as completed
   * Sets status to 'completed' and clears error message
   */
  private async markCollectorResultCompleted(collectorResultId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('collector_results')
        .update({
          scoring_status: 'completed',
          scoring_completed_at: new Date().toISOString(),
          scoring_error: null,
        })
        .eq('id', collectorResultId);

      if (error) {
        // Fallback: update only status if columns missing
        if (error.message.includes('column') || error.message.includes('scoring_completed_at')) {
           await this.supabase
            .from('collector_results')
            .update({ scoring_status: 'completed' })
            .eq('id', collectorResultId);
           return;
        }
        console.warn(`⚠️ Error marking collector_result ${collectorResultId} as completed:`, error.message);
      }
    } catch (error) {
      console.warn(`⚠️ Exception marking collector_result ${collectorResultId} as completed:`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Mark a collector_result as error or timeout
   * Sets status to 'error' or 'timeout' and stores error message
   */
  private async markCollectorResultError(collectorResultId: number, errorMessage: string): Promise<void> {
    try {
      // Check if this is a timeout error
      const isTimeout = errorMessage.toLowerCase().includes('timeout') || 
                        errorMessage.toLowerCase().includes('timed out') ||
                        errorMessage.toLowerCase().includes('abort') ||
                        errorMessage.toLowerCase().includes('time out');
      
      const status = isTimeout ? 'timeout' : 'error';

      if (isTimeout) {
        console.log(`   ⏱️ Marking collector_result ${collectorResultId} as '${status}' due to timeout error`);
      }

      const { error } = await this.supabase
        .from('collector_results')
        .update({
          scoring_status: status,
          scoring_error: errorMessage,
        })
        .eq('id', collectorResultId);

      if (error) {
         // Fallback: update only status if columns missing
        if (error.message.includes('column') || error.message.includes('scoring_error')) {
           await this.supabase
            .from('collector_results')
            .update({ scoring_status: status })
            .eq('id', collectorResultId);
           return;
        }
        console.warn(`⚠️ Error marking collector_result ${collectorResultId} as ${status}:`, error.message);
      }
    } catch (error) {
      console.warn(`⚠️ Exception marking collector_result ${collectorResultId} as error/timeout:`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Process a single collector_result with per-result batching
   * OPTIMIZATION: Batches all database operations (positions + sentiment) for one collector_result together
   * This reduces database round trips from 5+ operations to 1 batch per collector_result
   * 
   * Returns true if ALL steps succeeded, false otherwise
   */
  private async processSingleResultWithBatching(
    collectorResult: any,
    brandId: string,
    customerId: string,
    result: ConsolidatedScoringResult,
    processedCount: number,
    totalCount: number
  ): Promise<boolean> {
    const collectorResultId = collectorResult.id;
    
    // Track success status for each step
    let step1Success = false;
    let step2Success = false;
    let step3Success = false;
    let step3Skipped = false;

    try {
      // Step 1: Run consolidated analysis (or get from cache)
      console.log(`\n   📊 [Item ${processedCount}/${totalCount}] Processing collector_result ${collectorResultId}...`);
      
      // Call runConsolidatedAnalysis which uses consolidatedAnalysisService.analyze
      // This handles both caching and new analysis with full metrics tracking
      const analysis = await this.runConsolidatedAnalysis(collectorResult, brandId, customerId);
      
      if (!analysis) {
        console.warn(`   ⚠️ No analysis returned for collector_result ${collectorResultId}`);
        result.errors.push({
          collectorResultId,
          error: 'Step 1 failed: No analysis returned',
        });
        return false;
      }
      
      step1Success = true;
      result.citationsProcessed++;

      // Update metrics from analysis
      if (analysis.metrics) {
        result.metrics.totalCitations += analysis.metrics.totalCitations;
        result.metrics.cachedCitations += analysis.metrics.cachedCitations;
        result.metrics.totalOccurrences += analysis.metrics.totalOccurrences;
        result.metrics.cachedOccurrences += analysis.metrics.cachedOccurrences;
      }

      // Step 2 & 3: Extract positions and prepare sentiment
      console.log(`   📍 [Item ${processedCount}/${totalCount}] Extracting positions for collector_result ${collectorResultId}...`);
      
      try {
        const { positionExtractionService } = await import('./position-extraction.service');
        // OPTIMIZATION: Pass collector result data to avoid redundant fetch
        const positionPayload = await positionExtractionService.extractPositionPayloadForBatch(collectorResultId, collectorResult);
        
        if (positionPayload) {
          const totalRows = 1 + positionPayload.competitorRows.length;
          console.log(`   📊 [Item ${processedCount}/${totalCount}] Extracted ${totalRows} position rows for collector_result ${collectorResultId} (1 brand, ${positionPayload.competitorRows.length} competitors)`);
          
          // Prepare sentiment data if available
          let sentimentData: any = undefined;
          if (analysis && analysis.sentiment) {
            const competitorNames = Object.keys(analysis.products?.competitors || {});
            sentimentData = {
              brandSentiment: analysis.sentiment.brand,
              competitorSentiment: analysis.sentiment.competitors || {},
              competitorNames: competitorNames,
            };
            console.log(`   💾 [Item ${processedCount}/${totalCount}] Prepared sentiment data for collector_result ${collectorResultId}`);
          } else {
             console.log(`   ⏭️ No sentiment data for collector_result ${collectorResultId}, skipping sentiment storage`);
             step3Skipped = true;
          }
          
          // OPTIMIZATION: Batch save all operations together (positions + sentiment)
          console.log(`   📦 [Item ${processedCount}/${totalCount}] Batch saving all operations for collector_result ${collectorResultId}...`);
          const saveResult = await positionExtractionService.batchSaveCollectorResult(positionPayload, sentimentData);
          
          console.log(`   ✅ [Item ${processedCount}/${totalCount}] Batch saved all operations for collector_result ${collectorResultId} (metric_fact_id: ${saveResult.metricFactId})`);
          
          result.positionsProcessed++;
          if (sentimentData) {
            result.sentimentsProcessed++;
          }
          
          step2Success = true;
          step3Success = !!sentimentData;
        } else {
          console.warn(`   ⚠️ No position payload extracted for collector_result ${collectorResultId}`);
          step2Success = true; // Consider it success if no error thrown
          step3Success = true; // Step 3 effectively skipped
          step3Skipped = true;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Batch save failed for collector_result ${collectorResultId}:`, errorMsg);
        result.errors.push({
          collectorResultId,
          error: `Batch save failed: ${errorMsg}`,
        });
        step2Success = false;
        step3Success = false;
      }

      // Track success
      // Only increment processed counter if ALL applicable steps succeeded
      const allStepsSucceeded = step1Success && step2Success && (step3Success || step3Skipped);

      if (allStepsSucceeded) {
        result.processed++;
        console.log(`   ✅ [Item ${processedCount}/${totalCount}] Completed all steps for collector_result ${collectorResultId}`);
        return true;
      } else {
        // Track which steps failed for better error reporting
        const failedSteps = [];
        if (!step1Success) failedSteps.push('analysis');
        if (!step2Success) failedSteps.push('positions');
        if (!step3Success && !step3Skipped) failedSteps.push('sentiment');
        
        const completedSteps = [];
        if (step1Success) completedSteps.push('analysis');
        if (step2Success) completedSteps.push('positions');
        if (step3Success || step3Skipped) completedSteps.push('sentiment');
        
        console.log(`   ⚠️ [Item ${processedCount}/${totalCount}] Partially completed collector_result ${collectorResultId}`);
        console.log(`      ✅ Completed: ${completedSteps.length > 0 ? completedSteps.join(', ') : 'none'}`);
        console.log(`      ❌ Failed: ${failedSteps.length > 0 ? failedSteps.join(', ') : 'none'}`);
        console.log(`      ⚠️ Not counted as "processed" due to incomplete steps`);
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error processing collector_result ${collectorResultId}:`, errorMsg);
      result.errors.push({
        collectorResultId,
        error: errorMsg,
      });
      return false;
    }
  }

  /**
   * Process a single collector_result completely (Step 1 → Step 2 → Step 3)
   * Used for incremental processing when Ollama is enabled
   */
  private async processSingleResultIncrementally(
    collectorResult: any,
    brandId: string,
    customerId: string,
    result: ConsolidatedScoringResult,
    processedCount: number,
    totalCount: number
  ): Promise<void> {
    const collectorResultId = collectorResult.id;
    
    // Track success status for each step
    let step1Success = false;
    let step2Success = false;
    let step3Success = false;
    let step3Skipped = false; // Step 3 can be skipped if no sentiment data

    try {
      // Step 1: Run consolidated analysis (or get from cache)
      console.log(`\n   📊 [Item ${processedCount}/${totalCount}] Processing collector_result ${collectorResultId}...`);
      
      // Check if analysis exists in DB cache
      let analysis = await this.getCachedAnalysisFromDB(collectorResultId);
      let citationsStored = false;
      
      if (analysis) {
        console.log(`   ♻️ Using cached analysis from DB for collector_result ${collectorResultId}`);
        step1Success = true;
        // Citations were already stored when this analysis was first run
        citationsStored = true;
      } else {
        // Run new analysis (this stores citations during analysis)
        analysis = await this.runConsolidatedAnalysis(collectorResult, brandId, customerId);
        if (!analysis) {
          console.warn(`   ⚠️ No analysis returned for collector_result ${collectorResultId}`);
          result.errors.push({
            collectorResultId,
            error: 'Step 1 failed: No analysis returned',
          });
          return;
        }
        step1Success = true;
        // Citations are stored during runConsolidatedAnalysis
        citationsStored = true;
      }

      // Step 2: Extract positions for this single result
      console.log(`   📍 [Item ${processedCount}/${totalCount}] Extracting positions for collector_result ${collectorResultId}...`);
      let metricFactId: number | null = null;
      let competitorIdMap: Map<string, string> = new Map();
      
      try {
        const { positionExtractionService } = await import('./position-extraction.service');
        const positionResult = await positionExtractionService.extractPositionsForNewResults({
          customerId,
          brandIds: [brandId],
          collectorResultIds: [collectorResultId], // Process only this one
        });
        
        if (positionResult.count > 0) {
          result.positionsProcessed += positionResult.count;
          console.log(`   ✅ Positions extracted for collector_result ${collectorResultId}`);
          
          // OPTIMIZATION: Use metric_fact_id from position extraction result (no redundant query needed)
          const positionData = positionResult.results.get(collectorResultId);
          if (positionData) {
            metricFactId = positionData.metricFactId;
            competitorIdMap = positionData.competitorIdMap;
            console.log(`   ✅ [Optimization] Using metric_fact_id ${metricFactId} for collector_result ${collectorResultId} (from position extraction)`);
          } else {
            console.warn(`   ⚠️ [Optimization] No position data returned for collector_result ${collectorResultId}, falling back to query`);
            // Fallback: query if data not returned (shouldn't happen, but safe fallback)
            const { data: metricFact, error: metricFactError } = await this.supabase
              .from('metric_facts')
              .select('id')
              .eq('collector_result_id', collectorResultId)
              .single();
            
            if (!metricFactError && metricFact) {
              metricFactId = metricFact.id;
            }
          }
          
          step2Success = true;
        } else {
          console.warn(`   ⚠️ No positions extracted for collector_result ${collectorResultId}`);
          // This is not necessarily a failure - might be valid (no products found)
          step2Success = true; // Consider it success if no error thrown
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Position extraction failed for collector_result ${collectorResultId}:`, errorMsg);
        result.errors.push({
          collectorResultId,
          error: `Position extraction failed: ${errorMsg}`,
        });
        step2Success = false;
      }

      // Step 3: Store sentiment for this single result
      if (analysis && analysis.sentiment && metricFactId) {
        console.log(`   💾 [Item ${processedCount}/${totalCount}] Storing sentiment for collector_result ${collectorResultId}...`);
        try {
          const competitorNames = analysis.sentiment.competitors 
            ? Object.keys(analysis.sentiment.competitors) 
            : [];
          
          // OPTIMIZATION: Batch fetch competitor IDs once per brand (not per collector_result)
          // This is done lazily - only fetch if we don't have them cached
          if (competitorNames.length > 0 && competitorIdMap.size === 0) {
            const { data: competitorData, error: compFetchError } = await this.supabase
              .from('brand_competitors')
              .select('id, competitor_name')
              .eq('brand_id', brandId)
              .in('competitor_name', competitorNames);
            
            if (!compFetchError && competitorData) {
              competitorData.forEach(comp => {
                competitorIdMap.set(comp.competitor_name, comp.id);
              });
              console.log(`   ✅ [Optimization] Cached ${competitorIdMap.size} competitor IDs for brand ${brandId}`);
            }
          }
          
          await this.storeSentiment(collectorResult, analysis, competitorNames, metricFactId, brandId, competitorIdMap);
          result.sentimentsProcessed++;
          console.log(`   ✅ Sentiment stored for collector_result ${collectorResultId}`);
          step3Success = true;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`   ❌ Sentiment storage failed for collector_result ${collectorResultId}:`, errorMsg);
          result.errors.push({
            collectorResultId,
            error: `Sentiment storage failed: ${errorMsg}`,
          });
          step3Success = false;
        }
      } else if (analysis && analysis.sentiment && !metricFactId) {
        console.warn(`   ⚠️ Skipping sentiment storage - no metric_fact_id found for collector_result ${collectorResultId}`);
      } else {
        console.log(`   ⏭️ Skipping sentiment storage for collector_result ${collectorResultId} (no sentiment data)`);
        step3Skipped = true;
        // Step 3 skipped is considered success (not an error)
        step3Success = true;
      }

      // Count citations if Step 1 succeeded (citations are stored during analysis)
      // This is independent of whether Steps 2 and 3 succeed
      if (citationsStored && step1Success) {
        result.citationsProcessed++;
      }
      
      // Only increment processed counter if ALL applicable steps succeeded
      // Step 1 (analysis) is critical - must succeed
      // Step 2 (position extraction) is required - must succeed
      // Step 3 (sentiment storage) is required if sentiment data exists, otherwise can be skipped
      const allStepsSucceeded = step1Success && step2Success && (step3Success || step3Skipped);
      
      if (allStepsSucceeded) {
        result.processed++;
        console.log(`   ✅ [Item ${processedCount}/${totalCount}] Completed all steps for collector_result ${collectorResultId}`);
      } else {
        // Track which steps failed for better error reporting
        const failedSteps = [];
        if (!step1Success) failedSteps.push('analysis');
        if (!step2Success) failedSteps.push('positions');
        if (!step3Success && !step3Skipped) failedSteps.push('sentiment');
        
        const completedSteps = [];
        if (step1Success) completedSteps.push('analysis');
        if (step2Success) completedSteps.push('positions');
        if (step3Success || step3Skipped) completedSteps.push('sentiment');
        
        console.log(`   ⚠️ [Item ${processedCount}/${totalCount}] Partially completed collector_result ${collectorResultId}`);
        console.log(`      ✅ Completed: ${completedSteps.length > 0 ? completedSteps.join(', ') : 'none'}`);
        console.log(`      ❌ Failed: ${failedSteps.length > 0 ? failedSteps.join(', ') : 'none'}`);
        console.log(`      ⚠️ Not counted as "processed" due to incomplete steps`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed to process collector_result ${collectorResultId}:`, errorMsg);
      result.errors.push({
        collectorResultId,
        error: errorMsg,
      });
    }
  }

  /**
   * Clean up stuck processing jobs
   * - Jobs stuck in 'processing' > 8 hours -> error (failed)
   * - Jobs stuck in 'processing' > 2 hours -> timeout (retryable)
   */
  private async cleanupStuckProcessing(brandId: string): Promise<void> {
    try {
      const now = new Date();
      const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

      // 1. Mark jobs stuck > 8 hours as error
      const { error: error8h } = await this.supabase
        .from('collector_results')
        .update({ 
          scoring_status: 'error', 
          scoring_error: 'Processing failed (stuck for > 8 hours)' 
        })
        .eq('brand_id', brandId)
        .eq('scoring_status', 'processing')
        .lt('scoring_started_at', eightHoursAgo);

      if (error8h) console.warn(`⚠️ Error cleaning up >8h stuck jobs: ${error8h.message}`);

      // 2. Mark jobs stuck > 2 hours as timeout
      // Note: The >8h jobs are already handled above, so this will only affect jobs between 2h and 8h
      const { error: error2h } = await this.supabase
        .from('collector_results')
        .update({ 
          scoring_status: 'timeout', 
          scoring_error: 'Processing timed out (stuck for > 2 hours)' 
        })
        .eq('brand_id', brandId)
        .eq('scoring_status', 'processing')
        .lt('scoring_started_at', twoHoursAgo);

      if (error2h) console.warn(`⚠️ Error cleaning up >2h stuck jobs: ${error2h.message}`);
    } catch (error) {
      console.warn(`⚠️ Exception during stuck job cleanup:`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Score brand using consolidated analysis
   */
  async scoreBrand(options: ConsolidatedScoringOptions): Promise<ConsolidatedScoringResult> {
    const { brandId, customerId, since, limit = 50 } = options;

    // Clean up any stuck jobs before starting new processing
    await this.cleanupStuckProcessing(brandId);

    console.log(`\n🎯 Starting consolidated scoring for brand ${brandId}...`);
    if (since) console.log(`   ▶ since: ${since}`);
    console.log(`   ▶ limit: ${limit}\n`);

    const result: ConsolidatedScoringResult = {
      processed: 0,
      positionsProcessed: 0,
      sentimentsProcessed: 0,
      citationsProcessed: 0,
      errors: [],
      metrics: {
        totalCitations: 0,
        cachedCitations: 0,
        totalOccurrences: 0,
        cachedOccurrences: 0,
      },
    };

    // Fetch collector results that need processing
    // Filter by status: only fetch rows that are NOT 'processing' or 'completed'
    let query = this.supabase
      .from('collector_results')
      .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata, citations, urls, topic')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .not('raw_answer', 'is', null) // Only process results with raw_answer
      .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error,scoring_status.eq.timeout') // Only fetch processable rows
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: collectorResults, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch collector results: ${fetchError.message}`);
    }

    if (!collectorResults || !Array.isArray(collectorResults) || collectorResults.length === 0) {
      console.log('✅ No collector results found to process');
      return result;
    }

    // Check which results are already fully processed (have positions AND sentiment)
    // This enables resume capability: if Step 1 completed but Step 2 didn't, we can still process
    const fullyProcessedResults = new Set<number>();
    const hasPositionsButNoSentiment = new Set<number>();
    
    // Use optimized schema for validation checks
    const USE_OPTIMIZED_VALIDATION = process.env.USE_OPTIMIZED_VALIDATION !== 'false'; // Default to true
    const optimizedMetricsHelper = new OptimizedMetricsHelper(this.supabase);
    
    // Batch check all collector results at once for better performance
    const collectorResultIds = collectorResults
      .filter(cr => cr && cr.id)
      .map(cr => cr.id!);
    
    if (USE_OPTIMIZED_VALIDATION && collectorResultIds.length > 0) {
      // Check positions using metric_facts + brand_metrics
      const { data: metricFacts } = await this.supabase
        .from('metric_facts')
        .select('collector_result_id, id')
        .in('collector_result_id', collectorResultIds)
        .eq('brand_id', brandId);
      
      const collectorResultsWithPositions = new Set<number>();
      if (metricFacts) {
        metricFacts.forEach(mf => {
          if (mf.collector_result_id) {
            collectorResultsWithPositions.add(mf.collector_result_id);
          }
        });
        
        // Check sentiment for results that have positions
        if (collectorResultsWithPositions.size > 0) {
          const metricFactIds = metricFacts.map(mf => mf.id);
          const { data: brandSentiment } = await this.supabase
            .from('brand_sentiment')
            .select('metric_fact_id')
            .in('metric_fact_id', metricFactIds)
            .not('sentiment_score', 'is', null);
          
          const metricFactIdsWithSentiment = new Set(brandSentiment?.map(bs => bs.metric_fact_id) || []);
          
          // Map back to collector_result_ids
          for (const mf of metricFacts) {
            if (mf.collector_result_id && collectorResultsWithPositions.has(mf.collector_result_id)) {
              if (metricFactIdsWithSentiment.has(mf.id)) {
                // Fully processed: has positions AND sentiment
                fullyProcessedResults.add(mf.collector_result_id);
              } else {
                // Has positions but missing sentiment (Step 3 incomplete)
                hasPositionsButNoSentiment.add(mf.collector_result_id);
              }
            }
          }
        }
      }
    } else {
      // Legacy: Check using extracted_positions
      for (const cr of collectorResults) {
        if (!cr || !cr.id) {
          continue;
        }
        
        // Check if positions exist
        const { data: positionRow } = await this.supabase
          .from('extracted_positions')
          .select('id, sentiment_score')
          .eq('collector_result_id', cr.id)
          .limit(1)
          .maybeSingle();

        if (positionRow) {
          // Check if sentiment is missing (null sentiment_score indicates missing sentiment)
          const { data: sentimentCheck } = await this.supabase
            .from('extracted_positions')
            .select('id')
            .eq('collector_result_id', cr.id)
            .not('sentiment_score', 'is', null)
            .limit(1)
            .maybeSingle();
          
          if (sentimentCheck) {
            // Fully processed: has positions AND sentiment
            fullyProcessedResults.add(cr.id);
          } else {
            // Has positions but missing sentiment (Step 3 incomplete)
            hasPositionsButNoSentiment.add(cr.id);
          }
        }
      }
    }

    // Filter to only results that need processing
    // Include results that have positions but missing sentiment (for Step 3 completion)
    const resultsToProcess = collectorResults.filter(r => 
      r && r.id && 
      !fullyProcessedResults.has(r.id) && 
      r.raw_answer
    );
    
    if (hasPositionsButNoSentiment.size > 0) {
      console.log(`📊 Found ${hasPositionsButNoSentiment.size} results with positions but missing sentiment (will complete Step 3)`);
    }

    if (resultsToProcess.length === 0) {
      console.log('✅ All collector results already processed');
      return result;
    }

    // Check if Ollama is enabled (for sequential processing) - brand-specific
    const { shouldUseOllama } = await import('./ollama-client.service');
    const useOllama = await shouldUseOllama(brandId);
    
    if (useOllama) {
      console.log(`🦙 Ollama is enabled - processing sequentially (one answer at a time)...`);
    }

    console.log(`📊 Processing ${resultsToProcess.length} collector results...\n`);

    // HYBRID APPROACH: Incremental processing for Ollama, batch processing for OpenRouter
    const analysisResults = new Map<number, any>();
    // Track which items were claimed and their processing status
    const claimedResults = new Map<number, { collectorResult: any; step1Success: boolean; step2Success: boolean; step3Success: boolean; error?: string }>();
    let processedCount = 0;

    if (useOllama) {
      // ONE-AT-A-TIME PROCESSING: Fetch first available row → claim → process → update status → fetch next
      // Simple approach: Query excludes 'processing' and 'completed', claim atomically, if claim fails fetch next row
      console.log(`\n🔄 Using one-at-a-time processing (Ollama enabled)`);
      console.log(`   Fetch first available row → claim → process → update status → fetch next`);
      
      processedCount = 0;
      let consecutiveFailedClaims = 0;
      let consecutiveOllamaFailures = 0;
      const maxConsecutiveFailedClaims = 10; // Exit if we can't claim 10 rows in a row (indicates no work available)
      const MAX_OLLAMA_FAILURES = 5;
      
      // One-at-a-time processing loop
      while (true) {
        // Fetch FIRST row that needs processing (query excludes 'processing' and 'completed')
        let fetchQuery = this.supabase
          .from('collector_results')
          .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata, citations, urls, topic, scoring_status')
          .eq('brand_id', brandId)
          .eq('customer_id', customerId)
          .not('raw_answer', 'is', null)
          .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error,scoring_status.eq.timeout')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (since) {
          fetchQuery = (fetchQuery as any).gte('created_at', since);
        }

        const { data: collectorResult, error: fetchError } = await fetchQuery;

        if (fetchError || !collectorResult) {
          // No more rows to process
          break;
        }

        // Validate required fields
        if (!collectorResult.raw_answer || collectorResult.raw_answer.trim().length === 0) {
          console.warn(`⚠️ Skipping collector_result ${collectorResult.id}: no raw_answer`);
          continue;
        }

        // Atomically claim this result for processing
        const claimed = await this.claimCollectorResult(collectorResult.id);
        if (!claimed) {
          // Another worker claimed it first - fetch next row
          consecutiveFailedClaims++;
          console.warn(`   ⚠️ Claim failed for collector_result ${collectorResult.id}. Consecutive failures: ${consecutiveFailedClaims}`);
          if (consecutiveFailedClaims >= maxConsecutiveFailedClaims) {
            console.log(`   ⚠️ Failed to claim ${consecutiveFailedClaims} rows consecutively. No available rows, exiting.`);
            break;
          }
          continue; // Fetch next row
        }
        
        // Successfully claimed - reset counter and process
        consecutiveFailedClaims = 0;
        processedCount++;

        console.log(`   🔒 Successfully claimed collector_result ${collectorResult.id} for processing`);

        try {
          // Process this item completely (all 3 steps) with per-result batching
          const success = await this.processSingleResultWithBatching(
            collectorResult,
            brandId,
            customerId,
            result,
            processedCount,
            0 // Total count unknown in one-at-a-time mode
          );

          if (success) {
            // Mark as completed ONLY if all steps succeeded
            await this.markCollectorResultCompleted(collectorResult.id);
            console.log(`   ✅ Collector_result ${collectorResult.id} marked as completed`);
            // Reset consecutive failures on success
            consecutiveOllamaFailures = 0;
          } else {
            // Mark as error if any step failed (even if not thrown)
            const errorMsg = 'Processing failed for one or more steps (see logs)';
            await this.markCollectorResultError(collectorResult.id, errorMsg);
            console.log(`   ❌ Collector_result ${collectorResult.id} marked as error: ${errorMsg}`);
            
            // Increment consecutive failures
            consecutiveOllamaFailures++;
            if (consecutiveOllamaFailures >= MAX_OLLAMA_FAILURES) {
              await this.disableOllamaForBrand(brandId);
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          await this.markCollectorResultError(collectorResult.id, errorMsg);
          console.error(`   ❌ Collector_result ${collectorResult.id} marked as error: ${errorMsg}`);
          result.errors.push({
            collectorResultId: collectorResult.id,
            error: errorMsg,
          });

          // Increment consecutive failures
          consecutiveOllamaFailures++;
          if (consecutiveOllamaFailures >= MAX_OLLAMA_FAILURES) {
            await this.disableOllamaForBrand(brandId);
          }
        }
      }

      // For Ollama, we're done - all steps completed incrementally
      // Note: citationsProcessed is tracked during processSingleResultWithBatching
      // when Step 1 succeeds (citations are stored during analysis, independent of Steps 2/3)
      console.log(`\n✅ One-at-a-time processing complete!`);
      console.log(`   Processed: ${result.processed}`);
      console.log(`   Citations: ${result.citationsProcessed}`);
      console.log(`   Positions: ${result.positionsProcessed}`);
      console.log(`   Sentiments: ${result.sentimentsProcessed}`);
      console.log(`   Errors: ${result.errors.length}`);
      return result;
    } else {
      // BATCH PROCESSING: Step 1 → Step 2 → Step 3 (for OpenRouter - faster)
      // Status updates: Claim before Step 1, update after Step 3 (per item)
      console.log(`\n🔄 Using batch processing (OpenRouter enabled)`);
      console.log(`   Step 1: Analyze all → Step 2: Extract all positions → Step 3: Store all sentiment`);
      console.log(`   Status: Claim before Step 1, update after Step 3 (per item)`);
      
      // Step 1: Claim and run consolidated analysis for all results
      for (const collectorResult of resultsToProcess) {
        if (!collectorResult || !collectorResult.id) {
          continue;
        }
        
        processedCount++;
        
        // Validate required fields
        if (!collectorResult.raw_answer || collectorResult.raw_answer.trim().length === 0) {
          console.warn(`⚠️ Skipping collector_result ${collectorResult.id}: no raw_answer`);
          continue;
        }

        // Atomically claim this result for processing
        const claimed = await this.claimCollectorResult(collectorResult.id);
        if (!claimed) {
          console.log(`   ⏭️ Collector_result ${collectorResult.id} already claimed by another worker, skipping`);
          continue;
        }

        console.log(`   🔒 Successfully claimed collector_result ${collectorResult.id} for processing`);
        claimedResults.set(collectorResult.id, {
          collectorResult,
          step1Success: false,
          step2Success: false,
          step3Success: false,
        });
        
        try {
          // ALWAYS call runConsolidatedAnalysis which uses consolidatedAnalysisService.analyze
          // This handles both caching and new analysis with full metrics tracking
          const analysis = await this.runConsolidatedAnalysis(collectorResult, brandId, customerId);
          
          if (analysis) {
            analysisResults.set(collectorResult.id, analysis);
            result.processed++;
            const status = claimedResults.get(collectorResult.id);
            if (status) {
              status.step1Success = true;
            }

            // Update metrics from analysis
            if (analysis.metrics) {
              result.metrics.totalCitations += analysis.metrics.totalCitations;
              result.metrics.cachedCitations += analysis.metrics.cachedCitations;
              result.metrics.totalOccurrences += analysis.metrics.totalOccurrences;
              result.metrics.cachedOccurrences += analysis.metrics.cachedOccurrences;
            }
          } else {
            throw new Error('Analysis returned no results');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({
            collectorResultId: collectorResult.id,
            error: `Step 1 failed: ${errorMsg}`,
          });
          console.error(`❌ Failed consolidated analysis for collector_result ${collectorResult.id}:`, errorMsg);
          const status = claimedResults.get(collectorResult.id);
          if (status) {
            status.error = `Step 1 failed: ${errorMsg}`;
          }
        }
      }
    }

    // Log completion of Step 1
    console.log(`\n✅ Step 1 Complete: Consolidated analysis finished`);
    console.log(`   Successfully analyzed: ${analysisResults.size} collector results`);
    console.log(`   Total processed: ${result.processed}`);
    console.log(`   Errors: ${result.errors.length}`);
    if (useOllama) {
      console.log(`   Processed ${processedCount} of ${resultsToProcess.length} items (some may have been skipped)`);
    }
    
    // Verify we have results to process in Step 2
    if (analysisResults.size === 0) {
      console.warn(`⚠️ No analysis results to process in Step 2. Skipping position extraction and sentiment storage.`);
      return result;
    }
    
    console.log(`\n🔄 Proceeding to Step 2 with ${analysisResults.size} analyzed results...`);

    // Step 2: Run position extraction (uses cached products from consolidated analysis)
    // This calculates character positions and stores them in extracted_positions
    // IMPORTANT: Pass the specific collector_result IDs that were analyzed to ensure
    // position extraction processes the same results (fixes storage issue)
    console.log(`\n📊 Step 2: Starting position extraction...`);
    console.log(`   Analyzed ${analysisResults.size} collector results`);
    
    try {
      const { positionExtractionService } = await import('./position-extraction.service');
      
      // Get the collector_result IDs that were successfully analyzed
      const analyzedCollectorResultIds = Array.from(analysisResults.keys());
      console.log(`   📋 Passing ${analyzedCollectorResultIds.length} collector_result IDs to position extraction:`, 
        analyzedCollectorResultIds.slice(0, 10).join(', ') + (analyzedCollectorResultIds.length > 10 ? '...' : ''));
      
      const positionResult = await positionExtractionService.extractPositionsForNewResults({
        customerId,
        brandIds: [brandId],
        since,
        limit: limit,
        // Pass specific IDs to ensure we process the same results that were analyzed
        collectorResultIds: analyzedCollectorResultIds.length > 0 ? analyzedCollectorResultIds : undefined,
      });
      result.positionsProcessed = positionResult.count;
      console.log(`   ✅ Position extraction complete: ${positionResult.count} results processed`);
      console.log(`   📊 Position rows should now exist for collector_result IDs:`, 
        analyzedCollectorResultIds.slice(0, 10).join(', ') + (analyzedCollectorResultIds.length > 10 ? '...' : ''));
      
      // Update Step 2 status for successfully processed items
      for (const collectorResultId of analyzedCollectorResultIds) {
        const status = claimedResults.get(collectorResultId);
        if (status) {
          // Check if metric_fact exists (indicates Step 2 succeeded)
          const { data: metricFact } = await this.supabase
            .from('metric_facts')
            .select('id')
            .eq('collector_result_id', collectorResultId)
            .maybeSingle();
          
          if (metricFact) {
            status.step2Success = true;
          } else {
            status.step2Success = false;
            if (!status.error) {
              status.error = 'Step 2 failed: No metric_fact created';
            }
          }
        }
      }
      
      // Verify positions were actually created
      if (positionResult.count === 0 && analyzedCollectorResultIds.length > 0) {
        console.warn(`⚠️ Position extraction returned 0 results but we expected positions for ${analyzedCollectorResultIds.length} collector results`);
        console.warn(`   This might indicate an issue. Check position extraction logs above.`);
        
        // Mark all as Step 2 failed
        for (const collectorResultId of analyzedCollectorResultIds) {
          const status = claimedResults.get(collectorResultId);
          if (status) {
            status.step2Success = false;
            if (!status.error) {
              status.error = 'Step 2 failed: Position extraction returned 0 results';
            }
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        collectorResultId: 0,
        error: `Position extraction failed: ${errorMsg}`,
      });
      console.error(`❌ Position extraction failed:`, errorMsg);
      console.error(`   Stack:`, error instanceof Error ? error.stack : 'No stack trace');
      
      // Mark all claimed items as Step 2 failed
      for (const [collectorResultId, status] of claimedResults.entries()) {
        if (status.step1Success) {
          status.step2Success = false;
          if (!status.error) {
            status.error = `Step 2 failed: ${errorMsg}`;
          }
        }
      }
    }

    // Step 3: Store sentiment in extracted_positions (now that positions exist)
    console.log(`\n📊 Step 3: Starting sentiment storage...`);
    console.log(`   Will attempt to store sentiment for ${resultsToProcess.length} collector results`);
    
    let sentimentStoredCount = 0;
    let sentimentSkippedCount = 0;
    let sentimentErrorCount = 0;
    
    for (const collectorResult of resultsToProcess) {
      if (!collectorResult || !collectorResult.id) {
        continue;
      }
      
      // Try to get analysis from memory first, then from DB cache
      let analysis = analysisResults.get(collectorResult.id);
      
      if (!analysis) {
        // Try loading from DB cache
        analysis = await this.getCachedAnalysisFromDB(collectorResult.id);
        if (analysis) {
          console.log(`   ♻️ Using cached analysis from DB for collector_result ${collectorResult.id}`);
        }
      }
      
      if (!analysis) {
        console.log(`   ⚠️ No analysis found for collector_result ${collectorResult.id}, skipping sentiment`);
        sentimentSkippedCount++;
        // Update status: Step 1 or Step 2 failed
        const status = claimedResults.get(collectorResult.id);
        if (status) {
          status.step3Success = false;
          if (!status.error) {
            status.error = 'Step 3 skipped: No analysis found';
          }
        }
        continue;
      }
      
      if (!analysis.sentiment) {
        console.log(`   ⚠️ No sentiment data in analysis for collector_result ${collectorResult.id}, skipping`);
        sentimentSkippedCount++;
        // Update status: Step 3 skipped (but Steps 1 & 2 succeeded)
        // Check if positions exist (Step 2 succeeded)
        const { data: metricFact } = await this.supabase
          .from('metric_facts')
          .select('id')
          .eq('collector_result_id', collectorResult.id)
          .maybeSingle();
        
        const status = claimedResults.get(collectorResult.id);
        if (status) {
          if (metricFact) {
            // Steps 1 & 2 succeeded, Step 3 skipped (no sentiment data) - still mark as completed
            status.step3Success = true; // Consider skipped as success (no error, just no data)
          } else {
            status.step3Success = false;
            if (!status.error) {
              status.error = 'Step 3 skipped: No sentiment data and no positions found';
            }
          }
        }
        continue;
      }
      
      try {
        // Get competitor names from the analysis
        const competitorNames = analysis.sentiment.competitors 
          ? Object.keys(analysis.sentiment.competitors) 
          : [];
        console.log(`   💾 Storing sentiment for collector_result ${collectorResult.id} (${competitorNames.length} competitors)`);
        
        // OPTIMIZATION: Fetch metric_fact_id and brand_id (single query, avoids redundant brand_id query)
        const { data: metricFact, error: metricFactError } = await this.supabase
          .from('metric_facts')
          .select('id, brand_id')
          .eq('collector_result_id', collectorResult.id)
          .single();
        
        if (metricFactError || !metricFact) {
          console.warn(`   ⚠️ No metric_fact found for collector_result ${collectorResult.id}, skipping sentiment`);
          sentimentSkippedCount++;
          // Update status: Step 2 failed (no positions)
          const status = claimedResults.get(collectorResult.id);
          if (status) {
            status.step2Success = false;
            status.step3Success = false;
            if (!status.error) {
              status.error = 'Step 2 failed: No metric_fact found (positions not extracted)';
            }
          }
          continue;
        }
        
        // OPTIMIZATION: Batch fetch competitor IDs once per brand (cache for reuse)
        let competitorIdMap = new Map<string, string>();
        if (competitorNames.length > 0) {
          const { data: competitorData, error: compFetchError } = await this.supabase
            .from('brand_competitors')
            .select('id, competitor_name')
            .eq('brand_id', metricFact.brand_id)
            .in('competitor_name', competitorNames);
          
          if (!compFetchError && competitorData) {
            competitorData.forEach(comp => {
              competitorIdMap.set(comp.competitor_name, comp.id);
            });
          }
        }
        
        await this.storeSentiment(
          collectorResult, 
          analysis, 
          competitorNames, 
          metricFact.id, 
          metricFact.brand_id, 
          competitorIdMap
        );
        result.sentimentsProcessed++;
        sentimentStoredCount++;
        console.log(`   ✅ Sentiment stored for collector_result ${collectorResult.id}`);
        
        // Update Step 3 status
        const status = claimedResults.get(collectorResult.id);
        if (status) {
          status.step3Success = true;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed to store sentiment for collector_result ${collectorResult.id}:`, errorMsg);
        sentimentErrorCount++;
        
        // Update Step 3 status
        const status = claimedResults.get(collectorResult.id);
        if (status) {
          status.step3Success = false;
          if (!status.error) {
            status.error = `Step 3 failed: ${errorMsg}`;
          }
        }
      }
    }
    
    // Update status for all claimed items based on processing results
    console.log(`\n📊 Updating scoring_status for ${claimedResults.size} claimed items...`);
    for (const [collectorResultId, status] of claimedResults.entries()) {
      if (status.step1Success && status.step2Success && status.step3Success) {
        // All steps succeeded
        await this.markCollectorResultCompleted(collectorResultId);
        console.log(`   ✅ Collector_result ${collectorResultId} marked as completed`);
      } else {
        // One or more steps failed
        const errorMsg = status.error || 'Unknown error during processing';
        await this.markCollectorResultError(collectorResultId, errorMsg);
        console.log(`   ❌ Collector_result ${collectorResultId} marked as error: ${errorMsg}`);
      }
    }
    
    console.log(`\n📊 Sentiment storage summary:`);
    console.log(`   ✅ Stored: ${sentimentStoredCount}`);
    console.log(`   ⚠️ Skipped: ${sentimentSkippedCount}`);
    console.log(`   ❌ Errors: ${sentimentErrorCount}`);
    
    // Final summary
    console.log(`\n🎯 Consolidated Scoring Complete:`);
    console.log(`   Step 1: ${analysisResults.size} results analyzed`);
    console.log(`   Step 2: ${result.positionsProcessed} positions processed`);
    console.log(`   Step 3: ${sentimentStoredCount} sentiments stored`);
    console.log(`   Total errors: ${result.errors.length}`);

    // Efficiency Metrics
    const citationEfficiency = result.metrics.totalCitations > 0 
      ? (result.metrics.cachedCitations / result.metrics.totalCitations) * 100 
      : 0;
    const occurrenceEfficiency = result.metrics.totalOccurrences > 0 
      ? (result.metrics.cachedOccurrences / result.metrics.totalOccurrences) * 100 
      : 0;

    console.log(`\n📈 Efficiency Metrics:`);
    console.log(`   1. Total citations logged: ${result.metrics.totalCitations}`);
    console.log(`   2. Citations from cache: ${result.metrics.cachedCitations} (${citationEfficiency.toFixed(1)}% efficiency)`);
    console.log(`   3. Brand/Competitor/Products occurrences logged: ${result.metrics.totalOccurrences}`);
    console.log(`   4. Brand/Competitor/Products occurrences from cache: ${result.metrics.cachedOccurrences} (${occurrenceEfficiency.toFixed(1)}% efficiency)`);

    // Citations are already stored in runConsolidatedAnalysis
    result.citationsProcessed = result.processed;

    console.log(`\n✅ Consolidated scoring complete!`);
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Errors: ${result.errors.length}`);

    return result;
  }

  /**
   * Retry helper for database operations
   * Handles connection failures with exponential backoff
   */
  private async retryDatabaseOperation<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (result.error) {
          lastError = result.error;
          // Check if it's a connection error that might be retryable
          const errorMsg = result.error.message || String(result.error);
          const isRetryable = errorMsg.includes('fetch failed') || 
                            errorMsg.includes('ECONNREFUSED') ||
                            errorMsg.includes('timeout') ||
                            errorMsg.includes('network') ||
                            errorMsg.includes('TypeError');
          
          if (isRetryable && attempt < maxRetries) {
            const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
            console.warn(`   ⚠️ Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // Non-retryable error or max retries reached
          throw new Error(result.error.message || String(result.error));
        }
        
        // Check for null/undefined (not falsy values like empty arrays, which are valid results)
        // Empty arrays are valid when a query returns no matching rows
        if (result.data == null) {
          throw new Error('No data returned from database operation');
        }
        
        return result.data;
      } catch (error) {
        lastError = error;
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isRetryable = errorMsg.includes('fetch failed') || 
                          errorMsg.includes('ECONNREFUSED') ||
                          errorMsg.includes('timeout') ||
                          errorMsg.includes('network') ||
                          errorMsg.includes('TypeError');
        
        if (isRetryable && attempt < maxRetries) {
          const waitTime = delayMs * Math.pow(2, attempt - 1);
          console.warn(`   ⚠️ Database connection failed (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error(`Database operation failed after ${maxRetries} attempts: ${lastError?.message || String(lastError)}`);
  }

  private async runConsolidatedAnalysis(
    collectorResult: any,
    brandId: string,
    customerId: string
  ): Promise<any> {
    const collectorResultId = collectorResult.id;

    console.log(`\n📊 Processing collector_result ${collectorResultId}...`);

    // Get brand metadata with retry logic for connection failures
    let brand: any;
    try {
      brand = await this.retryDatabaseOperation(
        async () => {
          return await this.supabase
            .from('brands')
            .select('id, name, metadata')
            .eq('id', brandId)
            .single();
        },
        3, // max retries
        1000 // initial delay
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Brand not found: ${brandId} - ${errorMsg}`);
    }

    if (!brand) {
      throw new Error(`Brand not found: ${brandId}`);
    }

    // Ensure brand name exists
    if (!brand.name) {
      throw new Error(`Brand name is missing for brand ${brandId}`);
    }

    // Get competitor metadata (with retry logic)
    let competitorRows: any[] = [];
    try {
      competitorRows = await this.retryDatabaseOperation(
        async () => {
          return await this.supabase
            .from('brand_competitors')
            .select('competitor_name, metadata')
            .eq('brand_id', brandId);
        },
        3,
        1000
      ) || [];
    } catch (error) {
      console.warn(`   ⚠️ Failed to fetch competitors for brand ${brandId}, continuing without competitor metadata`);
      competitorRows = [];
    }

    // Get enriched brand/product data from brand_products table
    let brandProductsData: any = null;
    try {
      const { data: enrichedData } = await this.supabase
        .from('brand_products')
        .select('brand_synonyms, brand_products, competitor_data')
        .eq('brand_id', brandId)
        .maybeSingle();
      brandProductsData = enrichedData;
    } catch (error) {
      console.warn(`   ⚠️ Failed to fetch brand_products for brand ${brandId}, continuing without enriched data`);
    }

    const competitorMetadataMap = new Map<string, any>();
    (competitorRows || []).forEach((row) => {
      competitorMetadataMap.set(row.competitor_name.toLowerCase(), row.metadata);
    });

    // Normalize competitors - ensure it's an array
    const competitors = Array.isArray(collectorResult.competitors) ? collectorResult.competitors : [];
    const normalizedCompetitors = competitors.map((comp: any) =>
      typeof comp === 'string' ? { competitor_name: comp } : comp
    );
    const competitorNames = normalizedCompetitors
      .map((c: any) => c && c.competitor_name ? c.competitor_name : null)
      .filter((name): name is string => Boolean(name));

    // Extract citations - ensure we always have an array
    let citations: string[] = [];
    if (collectorResult.citations) {
      if (Array.isArray(collectorResult.citations)) {
        citations = collectorResult.citations
          .map((c: any) => (typeof c === 'string' ? c : c.url || c))
          .filter((url: any): url is string => typeof url === 'string' && url.startsWith('http'));
      }
    }
    if (citations.length === 0 && collectorResult.urls) {
      if (Array.isArray(collectorResult.urls)) {
        citations = collectorResult.urls.filter((url: any): url is string =>
          typeof url === 'string' && url.startsWith('http')
        );
      }
    }

    // Ensure raw_answer is not null
    const rawAnswer = collectorResult.raw_answer || '';
    
    if (!rawAnswer || rawAnswer.trim().length === 0) {
      throw new Error(`Collector result ${collectorResultId} has no raw_answer`);
    }

    // Call consolidated analysis
    const analysis = await consolidatedAnalysisService.analyze({
      brandName: brand.name || 'Brand',
      brandMetadata: { ...(brand.metadata || {}), customer_id: customerId, brand_id: brandId },
      brandProducts: brandProductsData,
      competitorNames: competitorNames || [],
      competitorMetadata: competitorMetadataMap,
      rawAnswer: rawAnswer,
      citations: citations || [],
      collectorResultId,
      customerId,
      brandId,
    });

    console.log(`   ✅ Consolidated analysis complete`);
    
    // Analyze detection effectiveness
    try {
      const detectedProducts = analysis.products?.brand || [];
      const kbProducts = brandProductsData?.brand_products || [];
      const kbSynonyms = brandProductsData?.brand_synonyms || [];
      const brandName = brand.name?.toLowerCase();
      
      const kbMatches = detectedProducts.filter(p => 
        kbProducts.some(kp => kp.toLowerCase() === p.toLowerCase())
      );
      const llmDiscoveries = detectedProducts.filter(p => 
        !kbProducts.some(kp => kp.toLowerCase() === p.toLowerCase())
      );
      
      const totalDetected = detectedProducts.length;
      const hitRate = totalDetected > 0 ? (kbMatches.length / totalDetected) * 100 : 0;
      
      // Check brand name detection source
       let brandSource = 'None';
       if (detectedProducts.length > 0) {
         // If we detected products, the brand was implicitly or explicitly detected
         const isExactMatch = true; 
         const isSynonymMatch = kbSynonyms.some(s => s.toLowerCase() === brand.name?.toLowerCase());
         brandSource = isExactMatch ? 'Exact Match' : (isSynonymMatch ? 'Synonym Match' : 'LLM Inference');
       }

      console.log(`      📊 Detection Effectiveness:`);
      console.log(`         - Total Brand Products: ${totalDetected}`);
      console.log(`         - KB Matches: ${kbMatches.length} (${hitRate.toFixed(1)}% effectiveness)`);
      console.log(`         - LLM Discoveries: ${llmDiscoveries.length}`);
      if (llmDiscoveries.length > 0) {
        console.log(`         - New Products Found: ${llmDiscoveries.join(', ')}`);
      }
      console.log(`         - Brand Name Source: ${brandSource}`);
    } catch (err) {
      console.warn('      ⚠️ Error calculating detection effectiveness:', err);
    }

    console.log(`      Products: ${(analysis.products?.brand?.length || 0)} brand, ${Object.keys(analysis.products?.competitors || {}).length} competitors`);
    console.log(`      Citations: ${Object.keys(analysis.citations || {}).length}`);
    console.log(`      Sentiment: Brand ${analysis.sentiment?.brand?.label || 'NEUTRAL'} (${analysis.sentiment?.brand?.score || 60})`);

    // Store citations with categories
    await this.storeCitations(collectorResult, analysis, brandId, customerId);

    console.log(`   ✅ Citations stored for collector_result ${collectorResultId}`);

    // Return analysis for later use (sentiment storage after positions are extracted)
    
    // Store keywords if present
    if (analysis.keywords && analysis.keywords.length > 0) {
      console.log(`   💾 Storing ${analysis.keywords.length} keywords for collector_result ${collectorResultId}`);
      // Don't await this to avoid blocking the main flow
      keywordGenerationService.storeKeywords(analysis.keywords, {
        answer: rawAnswer,
        query_id: collectorResult.query_id,
        collector_result_id: collectorResultId,
        brand_id: brandId,
        customer_id: customerId,
        // Optional: pass query_text if available in collectorResult
        query_text: collectorResult.question || undefined
      }).catch(err => {
        console.error(`   ❌ Failed to store keywords for collector_result ${collectorResultId}:`, err);
      });
    }

    return analysis;
  }


  /**
   * Store sentiment in NEW OPTIMIZED SCHEMA
   * Writes to: brand_sentiment, competitor_sentiment
   */
  /**
   * Store sentiment for brand and competitors
   * OPTIMIZATION: Accepts metric_fact_id, brand_id, and competitorIdMap to avoid redundant queries
   * 
   * ATOMICITY NOTE: Uses upsert operations which are atomic at the row level.
   * For full transaction support, consider using Supabase RPC functions with explicit transactions,
   * but current upsert approach provides good reliability and handles concurrent updates better than delete+insert.
   */
  private async storeSentiment(
    collectorResult: any,
    analysis: any,
    competitorNames: string[],
    metricFactId: number,
    brandId: string,
    competitorIdMap: Map<string, string>
  ): Promise<void> {
    const collectorResultId = collectorResult.id;
    
    // Validate analysis has sentiment data
    if (!analysis || !analysis.sentiment) {
      console.warn(`   ⚠️ [storeSentiment] No sentiment data in analysis for collector_result ${collectorResultId}`);
      return;
    }

    // OPTIMIZATION: Use provided metric_fact_id instead of querying
    console.log(`   ✅ [storeSentiment] Using metric_fact_id ${metricFactId} for collector_result ${collectorResultId} (from position extraction)`);

    // Upsert brand sentiment
    if (analysis.sentiment.brand) {
      const brandSentiment = {
        metric_fact_id: metricFactId,
        sentiment_label: analysis.sentiment.brand.label || 'NEUTRAL',
        sentiment_score: analysis.sentiment.brand.score || 60,
        positive_sentences: analysis.sentiment.brand.positive_sentences || [],
        negative_sentences: analysis.sentiment.brand.negative_sentences || [],
      };

      console.log(`   💾 [storeSentiment] Upserting brand sentiment: ${brandSentiment.sentiment_label} (${brandSentiment.sentiment_score})`);
      
      const { error: brandSentimentError } = await this.supabase
        .from('brand_sentiment')
        .upsert(brandSentiment, {
          onConflict: 'metric_fact_id',
          ignoreDuplicates: false,
        });

      if (brandSentimentError) {
        console.error(`   ❌ [storeSentiment] Failed to upsert brand sentiment:`, brandSentimentError.message);
        throw new Error(`Failed to save brand sentiment: ${brandSentimentError.message}`);
      }
      
      console.log(`   ✅ [storeSentiment] Brand sentiment saved`);
    }

    // Upsert competitor sentiment
    if (analysis.sentiment.competitors && competitorNames && competitorNames.length > 0) {
      console.log(`   📝 [storeSentiment] Processing sentiment for ${competitorNames.length} competitors: ${competitorNames.join(', ')}`);
      
      // OPTIMIZATION: Use provided competitorIdMap instead of querying
      // If map is empty, fetch competitor IDs (fallback for edge cases)
      let effectiveCompetitorIdMap = competitorIdMap;
      if (!competitorIdMap || competitorIdMap.size === 0) {
        console.log(`   🔍 [storeSentiment] Competitor ID map empty, fetching from database (fallback)...`);
        const { data: competitorData, error: compFetchError } = await this.supabase
          .from('brand_competitors')
          .select('id, competitor_name')
          .eq('brand_id', brandId)
          .in('competitor_name', competitorNames);

        if (compFetchError) {
          console.error(`   ❌ [storeSentiment] Failed to fetch competitor IDs:`, compFetchError.message);
          throw new Error(`Failed to fetch competitor IDs: ${compFetchError.message}`);
        }

        effectiveCompetitorIdMap = new Map<string, string>();
        (competitorData || []).forEach(comp => {
          effectiveCompetitorIdMap.set(comp.competitor_name, comp.id);
        });
      }
      
      // Build competitor_sentiment rows
      const competitorSentimentRows = [];
      for (const compName of competitorNames) {
        const competitorId = effectiveCompetitorIdMap.get(compName);
        if (!competitorId) {
          console.warn(`   ⚠️ [storeSentiment] Competitor "${compName}" not found in brand_competitors table`);
          continue;
        }

        const compSentiment = analysis.sentiment.competitors[compName];
        if (!compSentiment) {
          console.warn(`   ⚠️ [storeSentiment] No sentiment data for competitor "${compName}"`);
          continue;
        }

        competitorSentimentRows.push({
          metric_fact_id: metricFactId,
          competitor_id: competitorId,
          sentiment_label: compSentiment.label || 'NEUTRAL',
          sentiment_score: compSentiment.score || 60,
          positive_sentences: compSentiment.positive_sentences || [],
          negative_sentences: compSentiment.negative_sentences || [],
        });

        console.log(`   📝 [storeSentiment] Prepared competitor "${compName}" sentiment: ${compSentiment.label} (${compSentiment.score})`);
      }

      if (competitorSentimentRows.length > 0) {
        // OPTIMIZATION: Use upsert with ON CONFLICT instead of delete+insert
        // This is atomic, more efficient, and handles concurrent updates better
        console.log(`   💾 [storeSentiment] Upserting ${competitorSentimentRows.length} competitor_sentiment rows...`);
        
        const { error: compSentimentError } = await this.supabase
          .from('competitor_sentiment')
          .upsert(competitorSentimentRows, {
            onConflict: 'metric_fact_id,competitor_id',
            ignoreDuplicates: false,
          });

        if (compSentimentError) {
          console.error(`   ❌ [storeSentiment] Failed to upsert competitor_sentiment:`, compSentimentError.message);
          throw new Error(`Failed to save competitor sentiment: ${compSentimentError.message}`);
        }

        console.log(`   ✅ [storeSentiment] Upserted ${competitorSentimentRows.length} competitor_sentiment rows`);
      }
    } else {
      console.log(`   ℹ️ [storeSentiment] No competitor sentiment to process (competitors: ${competitorNames.length})`);
    }
    
    console.log(`   ✅ [storeSentiment] Successfully saved sentiment to optimized schema (metric_fact_id: ${metricFactId})`);
  }

  /**
   * Store citations with categories
   */
  private async storeCitations(
    collectorResult: any,
    analysis: any,
    brandId: string,
    customerId: string
  ): Promise<void> {
    // Ensure citations object exists
    if (!analysis.citations || typeof analysis.citations !== 'object') {
      console.log(`   ⚠️ No citations to store for collector_result ${collectorResult.id}`);
      return;
    }

    const citationsToInsert = Object.entries(analysis.citations)
      .filter(([url, cat]: [string, any]) => {
        // Filter out invalid entries
        return url && typeof url === 'string' && cat && cat.category;
      })
      .map(([url, cat]: [string, any]) => {
        // Extract domain from URL
        let domain = '';
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
          domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
        } catch {
          const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
          domain = match ? match[1].toLowerCase() : url.toLowerCase();
        }

        return {
          customer_id: customerId,
          brand_id: brandId,
          query_id: collectorResult.query_id,
          execution_id: collectorResult.execution_id,
          collector_result_id: collectorResult.id,
          url: url,
          domain: domain,
          page_name: cat.pageName || null,
          category: cat.category,
          metadata: {
            categorization_source: 'consolidated_analysis',
          },
        };
      });

    if (citationsToInsert.length === 0) {
      return;
    }

    // Upsert citations
    const { error: insertError } = await this.supabase
      .from('citations')
      .upsert(citationsToInsert, {
        onConflict: 'collector_result_id,url',
        ignoreDuplicates: false,
      });

    if (insertError) {
      throw new Error(`Failed to insert citations: ${insertError.message}`);
    }

    console.log(`   ✅ Stored ${citationsToInsert.length} citations`);
  }

  /**
   * Automatically disable Ollama for a brand if it fails too many times
   * This provides resilience by falling back to OpenRouter for subsequent calls
   */
  private async disableOllamaForBrand(brandId: string): Promise<void> {
    try {
      console.log(`\n🚨 [Resilience] Disabling Ollama for brand ${brandId} due to consecutive failures...`);
      
      // Fetch current brand
      const { data: brand, error: fetchError } = await this.supabase
        .from('brands')
        .select('metadata, local_llm')
        .eq('id', brandId)
        .single();
        
      if (fetchError || !brand) {
        throw new Error(`Failed to fetch brand config: ${fetchError?.message}`);
      }
      
      // Update local_llm field (standard way)
      const currentLLMConfig = (brand.local_llm as any) || {};
      const newLLMConfig = {
        ...currentLLMConfig,
        useOllama: false,
        disabled_at: new Date().toISOString(),
        disable_reason: 'Automatic fallback due to 5 consecutive failures'
      };

      // Also update metadata field for redundancy
      const currentMetadata = brand.metadata || {};
      const newMetadata = {
        ...currentMetadata,
        local_llm: false,
        ollama_disabled_at: new Date().toISOString(),
      };
      
      const { error: updateError } = await this.supabase
        .from('brands')
        .update({ 
          local_llm: newLLMConfig,
          metadata: newMetadata
        })
        .eq('id', brandId);
        
      if (updateError) {
        throw new Error(`Failed to update brand config: ${updateError.message}`);
      }
      
      console.log(`✅ [Resilience] Successfully disabled Ollama for brand ${brandId}. Future requests will use OpenRouter.`);
    } catch (error) {
      console.error(`❌ [Resilience] Failed to disable Ollama for brand ${brandId}:`, error);
    }
  }
}

export const consolidatedScoringService = new ConsolidatedScoringService();
