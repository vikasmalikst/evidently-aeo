/**
 * Brand Scoring Service
 * Orchestrates all scoring operations (position extraction, sentiment scoring, citation extraction) for a specific brand
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { positionExtractionService } from './position-extraction.service';
import { sentimentScoringService } from './sentiment-scoring.service';
import { citationExtractionService } from '../citations/citation-extraction.service';

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
  citationsProcessed: number;
  errors: Array<{ operation: string; error: string }>;
}

export class BrandScoringService {
  /**
   * Run all scoring operations for a specific brand
   * 
   * @param options - Scoring options
   * @returns Summary of processed results
   */
  async scoreBrand(options: BrandScoringOptions): Promise<BrandScoringResult> {
    const { brandId, customerId, since, positionLimit, sentimentLimit, parallel = false } = options;
    
    console.log(`\n🎯 Starting brand scoring for brand ${brandId} (customer: ${customerId})`);
    if (since) {
      console.log(`   ▶ since: ${since}`);
    }
    console.log(`   ▶ parallel: ${parallel}\n`);

    const result: BrandScoringResult = {
      positionsProcessed: 0,
      sentimentsProcessed: 0,
      citationsProcessed: 0,
      errors: []
    };

    const positionOptions = {
      customerId,
      brandIds: [brandId],
      since,
      limit: positionLimit ?? 50
    };

    const sentimentOptions = {
      customerId,
      brandIds: [brandId],
      since,
      limit: sentimentLimit ?? 50
    };

    try {
      if (parallel) {
        // Run all scoring operations in parallel
        console.log('⚡ Running scoring operations in parallel...');
        
        const [positionsResult, sentimentsResult, citationsResult] = await Promise.allSettled([
          positionExtractionService.extractPositionsForNewResults(positionOptions),
          sentimentScoringService.scorePending(sentimentOptions),
          citationExtractionService.extractAndStoreCitations(brandId)
        ]);

        // Process positions result
        if (positionsResult.status === 'fulfilled') {
          result.positionsProcessed = positionsResult.value;
          console.log(`✅ Position extraction completed: ${result.positionsProcessed} positions processed`);
        } else {
          const errorMsg = positionsResult.reason instanceof Error 
            ? positionsResult.reason.message 
            : String(positionsResult.reason);
          result.errors.push({ operation: 'position_extraction', error: errorMsg });
          console.error(`❌ Position extraction failed:`, errorMsg);
        }

        // Process sentiments result
        if (sentimentsResult.status === 'fulfilled') {
          result.sentimentsProcessed = sentimentsResult.value;
          console.log(`✅ Sentiment scoring completed: ${result.sentimentsProcessed} sentiments processed`);
        } else {
          const errorMsg = sentimentsResult.reason instanceof Error 
            ? sentimentsResult.reason.message 
            : String(sentimentsResult.reason);
          result.errors.push({ operation: 'sentiment_scoring', error: errorMsg });
          console.error(`❌ Sentiment scoring failed:`, errorMsg);
        }

        // Process citations result
        if (citationsResult.status === 'fulfilled') {
          result.citationsProcessed = citationsResult.value.processed || citationsResult.value.inserted || 0;
          console.log(`✅ Citation extraction completed: ${result.citationsProcessed} citations processed (${citationsResult.value.inserted} inserted)`);
        } else {
          const errorMsg = citationsResult.reason instanceof Error 
            ? citationsResult.reason.message 
            : String(citationsResult.reason);
          result.errors.push({ operation: 'citation_extraction', error: errorMsg });
          console.error(`❌ Citation extraction failed:`, errorMsg);
        }
      } else {
        // Run scoring operations sequentially (safer, better error handling)
        console.log('🔄 Running scoring operations sequentially...');

        // 1. Position extraction
        try {
          result.positionsProcessed = await positionExtractionService.extractPositionsForNewResults(positionOptions);
          console.log(`✅ Position extraction completed: ${result.positionsProcessed} positions processed`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'position_extraction', error: errorMsg });
          console.error(`❌ Position extraction failed:`, errorMsg);
        }

        // 2. Sentiment scoring
        try {
          result.sentimentsProcessed = await sentimentScoringService.scorePending(sentimentOptions);
          console.log(`✅ Sentiment scoring completed: ${result.sentimentsProcessed} sentiments processed`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'sentiment_scoring', error: errorMsg });
          console.error(`❌ Sentiment scoring failed:`, errorMsg);
        }

        // 3. Citation extraction
        try {
          const citationStats = await citationExtractionService.extractAndStoreCitations(brandId);
          result.citationsProcessed = citationStats.processed || citationStats.inserted || 0;
          console.log(`✅ Citation extraction completed: ${result.citationsProcessed} citations processed (${citationStats.inserted} inserted)`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'citation_extraction', error: errorMsg });
          console.error(`❌ Citation extraction failed:`, errorMsg);
        }
      }

      console.log(`\n✅ Brand scoring complete for brand ${brandId}:`);
      console.log(`   ▶ Positions: ${result.positionsProcessed}`);
      console.log(`   ▶ Sentiments: ${result.sentimentsProcessed}`);
      console.log(`   ▶ Citations: ${result.citationsProcessed}`);
      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.length}`);
      }
      console.log('');

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Brand scoring failed for brand ${brandId}:`, errorMsg);
      throw error;
    }
  }

  /**
   * Run scoring operations asynchronously (fire and forget)
   * Useful for triggers that shouldn't block the main operation
   */
  async scoreBrandAsync(options: BrandScoringOptions): Promise<void> {
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
}

export const brandScoringService = new BrandScoringService();

