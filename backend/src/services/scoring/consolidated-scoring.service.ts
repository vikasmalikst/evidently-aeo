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
      try {
        const { positionExtractionService } = await import('./position-extraction.service');
        const positionsCount = await positionExtractionService.extractPositionsForNewResults({
          customerId,
          brandIds: [brandId],
          collectorResultIds: [collectorResultId], // Process only this one
        });
        
        if (positionsCount > 0) {
          result.positionsProcessed += positionsCount;
          console.log(`   ✅ Positions extracted for collector_result ${collectorResultId}`);
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
      if (analysis && analysis.sentiment) {
        console.log(`   💾 [Item ${processedCount}/${totalCount}] Storing sentiment for collector_result ${collectorResultId}...`);
        try {
          const competitorNames = analysis.sentiment.competitors 
            ? Object.keys(analysis.sentiment.competitors) 
            : [];
          await this.storeSentiment(collectorResult, analysis, competitorNames);
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
   * Score brand using consolidated analysis
   */
  async scoreBrand(options: ConsolidatedScoringOptions): Promise<ConsolidatedScoringResult> {
    const { brandId, customerId, since, limit = 50 } = options;

    console.log(`\n🎯 Starting consolidated scoring for brand ${brandId}...`);
    if (since) console.log(`   ▶ since: ${since}`);
    console.log(`   ▶ limit: ${limit}\n`);

    const result: ConsolidatedScoringResult = {
      processed: 0,
      positionsProcessed: 0,
      sentimentsProcessed: 0,
      citationsProcessed: 0,
      errors: [],
    };

    // Fetch collector results that need processing
    let query = this.supabase
      .from('collector_results')
      .select('id, customer_id, brand_id, query_id, question, execution_id, collector_type, raw_answer, brand, competitors, created_at, metadata, citations, urls, topic')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .not('raw_answer', 'is', null) // Only process results with raw_answer
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

    // Check if Ollama is enabled (for sequential processing)
    const { shouldUseOllama } = await import('./ollama-client.service');
    const useOllama = await shouldUseOllama();
    
    if (useOllama) {
      console.log(`🦙 Ollama is enabled - processing sequentially (one answer at a time)...`);
    }

    console.log(`📊 Processing ${resultsToProcess.length} collector results...\n`);

    // HYBRID APPROACH: Incremental processing for Ollama, batch processing for OpenRouter
    const analysisResults = new Map<number, any>();
    let processedCount = 0;

    if (useOllama) {
      // INCREMENTAL PROCESSING: Process each item completely (Step 1 → Step 2 → Step 3) before moving to next
      // This provides real-time results and better fault tolerance
      console.log(`\n🔄 Using incremental processing (Ollama enabled)`);
      console.log(`   Each item will be fully processed (analysis → positions → sentiment) before moving to next`);
      
      for (const collectorResult of resultsToProcess) {
        if (!collectorResult || !collectorResult.id) {
          continue;
        }
        
        processedCount++;
        
        // Validate required fields
        if (!collectorResult.raw_answer || collectorResult.raw_answer.trim().length === 0) {
          console.warn(`⚠️ Skipping collector_result ${collectorResult.id}: no raw_answer`);
          console.log(`   ⏭️ Skipping item ${processedCount} of ${resultsToProcess.length} (no raw_answer)`);
          continue;
        }

        // Process this item completely (all 3 steps)
        await this.processSingleResultIncrementally(
          collectorResult,
          brandId,
          customerId,
          result,
          processedCount,
          resultsToProcess.length
        );
      }

      // For Ollama, we're done - all steps completed incrementally
      // Note: citationsProcessed is tracked during processSingleResultIncrementally
      // when Step 1 succeeds (citations are stored during analysis, independent of Steps 2/3)
      console.log(`\n✅ Incremental processing complete!`);
      console.log(`   Processed: ${result.processed}`);
      console.log(`   Citations: ${result.citationsProcessed}`);
      console.log(`   Positions: ${result.positionsProcessed}`);
      console.log(`   Sentiments: ${result.sentimentsProcessed}`);
      console.log(`   Errors: ${result.errors.length}`);
      return result;
    } else {
      // BATCH PROCESSING: Step 1 → Step 2 → Step 3 (for OpenRouter - faster)
      console.log(`\n🔄 Using batch processing (OpenRouter enabled)`);
      console.log(`   Step 1: Analyze all → Step 2: Extract all positions → Step 3: Store all sentiment`);
      
      // Step 1: Run consolidated analysis for all results
      for (const collectorResult of resultsToProcess) {
        if (!collectorResult || !collectorResult.id) {
          continue;
        }
        
        processedCount++;
        
        try {
          // Validate required fields
          if (!collectorResult.raw_answer || collectorResult.raw_answer.trim().length === 0) {
            console.warn(`⚠️ Skipping collector_result ${collectorResult.id}: no raw_answer`);
            continue;
          }

          // Check DB cache first
          let analysis = await this.getCachedAnalysisFromDB(collectorResult.id);
          
          if (!analysis) {
            // Run new analysis
            analysis = await this.runConsolidatedAnalysis(collectorResult, brandId, customerId);
          } else {
            console.log(`   ♻️ Using cached analysis from DB for collector_result ${collectorResult.id}`);
          }
          
          if (analysis) {
            analysisResults.set(collectorResult.id, analysis);
            result.processed++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({
            collectorResultId: collectorResult.id,
            error: errorMsg,
          });
          console.error(`❌ Failed consolidated analysis for collector_result ${collectorResult.id}:`, errorMsg);
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
      
      const positionsCount = await positionExtractionService.extractPositionsForNewResults({
        customerId,
        brandIds: [brandId],
        since,
        limit: limit,
        // Pass specific IDs to ensure we process the same results that were analyzed
        collectorResultIds: analyzedCollectorResultIds.length > 0 ? analyzedCollectorResultIds : undefined,
      });
      result.positionsProcessed = positionsCount;
      console.log(`   ✅ Position extraction complete: ${positionsCount} results processed`);
      console.log(`   📊 Position rows should now exist for collector_result IDs:`, 
        analyzedCollectorResultIds.slice(0, 10).join(', ') + (analyzedCollectorResultIds.length > 10 ? '...' : ''));
      
      // Verify positions were actually created
      if (positionsCount === 0 && analyzedCollectorResultIds.length > 0) {
        console.warn(`⚠️ Position extraction returned 0 results but we expected positions for ${analyzedCollectorResultIds.length} collector results`);
        console.warn(`   This might indicate an issue. Check position extraction logs above.`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push({
        collectorResultId: 0,
        error: `Position extraction failed: ${errorMsg}`,
      });
      console.error(`❌ Position extraction failed:`, errorMsg);
      console.error(`   Stack:`, error instanceof Error ? error.stack : 'No stack trace');
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
        continue;
      }
      
      if (!analysis.sentiment) {
        console.log(`   ⚠️ No sentiment data in analysis for collector_result ${collectorResult.id}, skipping`);
        sentimentSkippedCount++;
        continue;
      }
      
      try {
        // Get competitor names from the analysis
        const competitorNames = analysis.sentiment.competitors 
          ? Object.keys(analysis.sentiment.competitors) 
          : [];
        console.log(`   💾 Storing sentiment for collector_result ${collectorResult.id} (${competitorNames.length} competitors)`);
        await this.storeSentiment(collectorResult, analysis, competitorNames);
        result.sentimentsProcessed++;
        sentimentStoredCount++;
        console.log(`   ✅ Sentiment stored for collector_result ${collectorResult.id}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed to store sentiment for collector_result ${collectorResult.id}:`, errorMsg);
        sentimentErrorCount++;
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
      competitorNames: competitorNames || [],
      competitorMetadata: competitorMetadataMap,
      rawAnswer: rawAnswer,
      citations: citations || [],
      collectorResultId,
      customerId,
      brandId,
    });

    console.log(`   ✅ Consolidated analysis complete`);
    console.log(`      Products: ${(analysis.products?.brand?.length || 0)} brand, ${Object.keys(analysis.products?.competitors || {}).length} competitors`);
    console.log(`      Citations: ${Object.keys(analysis.citations || {}).length}`);
    console.log(`      Sentiment: Brand ${analysis.sentiment?.brand?.label || 'NEUTRAL'} (${analysis.sentiment?.brand?.score || 60})`);

    // Store citations with categories
    await this.storeCitations(collectorResult, analysis, brandId, customerId);

    console.log(`   ✅ Citations stored for collector_result ${collectorResultId}`);

    // Return analysis for later use (sentiment storage after positions are extracted)
    return analysis;
  }


  /**
   * Store sentiment in NEW OPTIMIZED SCHEMA
   * Writes to: brand_sentiment, competitor_sentiment
   */
  private async storeSentiment(
    collectorResult: any,
    analysis: any,
    competitorNames: string[]
  ): Promise<void> {
    const collectorResultId = collectorResult.id;
    
    // Validate analysis has sentiment data
    if (!analysis || !analysis.sentiment) {
      console.warn(`   ⚠️ [storeSentiment] No sentiment data in analysis for collector_result ${collectorResultId}`);
      return;
    }

    console.log(`   🔍 [storeSentiment] Looking for metric_fact for collector_result ${collectorResultId}...`);

    // Get metric_fact for this collector_result
    const { data: metricFact, error: metricFactError } = await this.supabase
      .from('metric_facts')
      .select('id, brand_id')
      .eq('collector_result_id', collectorResultId)
      .single();

    if (metricFactError || !metricFact) {
      console.error(`   ❌ [storeSentiment] No metric_fact found for collector_result ${collectorResultId}:`, metricFactError?.message);
      console.error(`      This means position extraction did not create a metric_fact for this collector_result`);
      console.error(`      Check if position extraction processed collector_result ${collectorResultId}`);
      return;
    }

    const metricFactId = metricFact.id;
    console.log(`   ✅ [storeSentiment] Found metric_fact (id: ${metricFactId}) for collector_result ${collectorResultId}`);

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
      
      // Get competitor IDs from brand_competitors table
      const { data: competitorData, error: compFetchError } = await this.supabase
        .from('brand_competitors')
        .select('id, competitor_name')
        .eq('brand_id', metricFact.brand_id)
        .in('competitor_name', competitorNames);

      if (compFetchError) {
        console.error(`   ❌ [storeSentiment] Failed to fetch competitor IDs:`, compFetchError.message);
        throw new Error(`Failed to fetch competitor IDs: ${compFetchError.message}`);
      }

      // Create a map of competitor_name -> competitor_id
      const competitorIdMap = new Map<string, string>();
      (competitorData || []).forEach(comp => {
        competitorIdMap.set(comp.competitor_name, comp.id);
      });
      
      // Delete existing competitor_sentiment for this metric_fact (for idempotency)
      console.log(`   🗑️ [storeSentiment] Deleting existing competitor_sentiment...`);
      const { error: deleteCompError } = await this.supabase
        .from('competitor_sentiment')
        .delete()
        .eq('metric_fact_id', metricFactId);

      if (deleteCompError) {
        console.warn(`   ⚠️ [storeSentiment] Warning deleting competitor_sentiment:`, deleteCompError.message);
        // Don't throw - might not exist
      }

      // Build competitor_sentiment rows
      const competitorSentimentRows = [];
      for (const compName of competitorNames) {
        const competitorId = competitorIdMap.get(compName);
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
        console.log(`   💾 [storeSentiment] Inserting ${competitorSentimentRows.length} competitor_sentiment rows...`);
        
        const { error: compSentimentError } = await this.supabase
          .from('competitor_sentiment')
          .insert(competitorSentimentRows);

        if (compSentimentError) {
          console.error(`   ❌ [storeSentiment] Failed to insert competitor_sentiment:`, compSentimentError.message);
          throw new Error(`Failed to save competitor sentiment: ${compSentimentError.message}`);
        }

        console.log(`   ✅ [storeSentiment] Inserted ${competitorSentimentRows.length} competitor_sentiment rows`);
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
}

export const consolidatedScoringService = new ConsolidatedScoringService();
