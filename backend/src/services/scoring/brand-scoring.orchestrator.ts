/**
 * Brand Scoring Service
 * Orchestrates all scoring operations (position extraction, sentiment scoring, citation extraction) for a specific brand
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { positionExtractionService } from './position-extraction.service';
import { brandSentimentService } from './sentiment/brand-sentiment.service';
import { competitorSentimentService } from './sentiment/competitor-sentiment.service';
import { combinedSentimentService } from './sentiment/combined-sentiment.service';
import { citationExtractionService } from '../citations/citation-extraction.service';
import { consolidatedScoringService } from './consolidated-scoring.service';

// Note: Consolidated scoring service combines all operations in a single API call
// Set USE_CONSOLIDATED_ANALYSIS=true to use the new approach
// Combined sentiment service is still available for backward compatibility

// Load environment variables
loadEnvironment();

// Feature flag: Use consolidated analysis service
const USE_CONSOLIDATED_ANALYSIS = process.env.USE_CONSOLIDATED_ANALYSIS === 'true';

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
   * 
   * @param options - Scoring options
   * @returns Summary of processed results
   */
  async scoreBrand(options: BrandScoringOptions): Promise<BrandScoringResult> {
    // Use consolidated scoring if enabled
    if (USE_CONSOLIDATED_ANALYSIS) {
      return await this.scoreBrandWithConsolidatedAnalysis(options);
    }

    // Fallback to original approach
    return await this.scoreBrandLegacy(options);
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
   * Score brand using legacy approach (original method)
   */
  private async scoreBrandLegacy(options: BrandScoringOptions): Promise<BrandScoringResult> {
    const { brandId, customerId, since, positionLimit, sentimentLimit, parallel = false } = options;
    if (since) {
    }
    const result: BrandScoringResult = {
      positionsProcessed: 0,
      sentimentsProcessed: 0, // collector-level sentiment is deprecated; kept for compatibility
      competitorSentimentsProcessed: 0,
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
        // Using combined sentiment service (brand + competitors in single API call) for efficiency
        const [positionsResult, combinedSentimentsResult, citationsResult] = await Promise.allSettled([
          positionExtractionService.extractPositionsForNewResults(positionOptions),
          combinedSentimentService.scoreCombinedSentiment(sentimentOptions),
          citationExtractionService.extractAndStoreCitations(brandId)
        ]);

        // Process positions result
        if (positionsResult.status === 'fulfilled') {
          result.positionsProcessed = positionsResult.value;
        } else {
          const errorMsg = positionsResult.reason instanceof Error 
            ? positionsResult.reason.message 
            : String(positionsResult.reason);
          result.errors.push({ operation: 'position_extraction', error: errorMsg });
          console.error(`❌ Position extraction failed:`, errorMsg);
        }

        // Process combined sentiments result (brand + competitors in single call)
        if (combinedSentimentsResult.status === 'fulfilled') {
          result.competitorSentimentsProcessed = combinedSentimentsResult.value;
        } else {
          const errorMsg = combinedSentimentsResult.reason instanceof Error 
            ? combinedSentimentsResult.reason.message 
            : String(combinedSentimentsResult.reason);
          result.errors.push({ operation: 'combined_sentiment_scoring', error: errorMsg });
          console.error(`❌ Combined sentiment scoring failed:`, errorMsg);
        }

        // Process citations result
        if (citationsResult.status === 'fulfilled') {
          result.citationsProcessed = citationsResult.value.processed || citationsResult.value.inserted || 0;
        } else {
          const errorMsg = citationsResult.reason instanceof Error 
            ? citationsResult.reason.message 
            : String(citationsResult.reason);
          result.errors.push({ operation: 'citation_extraction', error: errorMsg });
          console.error(`❌ Citation extraction failed:`, errorMsg);
        }
      } else {
        // Run scoring operations sequentially (safer, better error handling)
        // 1. Position extraction
        try {
          result.positionsProcessed = await positionExtractionService.extractPositionsForNewResults(positionOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'position_extraction', error: errorMsg });
          console.error(`❌ Position extraction failed:`, errorMsg);
        }

        // 2. Combined sentiment scoring (brand + competitors in single API call - more efficient)
        try {
          result.competitorSentimentsProcessed = await combinedSentimentService.scoreCombinedSentiment(sentimentOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'combined_sentiment_scoring', error: errorMsg });
          console.error(`❌ Combined sentiment scoring failed:`, errorMsg);
        }

        // 3. Citation extraction
        try {
          const citationStats = await citationExtractionService.extractAndStoreCitations(brandId);
          result.citationsProcessed = citationStats.processed || citationStats.inserted || 0;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'citation_extraction', error: errorMsg });
          console.error(`❌ Citation extraction failed:`, errorMsg);
        }
      }
      if (result.errors.length > 0) {
      }
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Brand scoring failed for brand ${brandId}:`, errorMsg);
      throw error;
    }
  }

  /**
   * Run scoring operations with combined sentiment analysis (brand + competitors in single API call)
   * More efficient than separate brand/competitor scoring
   */
  async scoreBrandWithCombinedSentiment(options: BrandScoringOptions): Promise<BrandScoringResult> {
    const { brandId, customerId, since, positionLimit, sentimentLimit, parallel = false } = options;

    const result: BrandScoringResult = {
      positionsProcessed: 0,
      sentimentsProcessed: 0, // collector-level sentiment is deprecated; kept for compatibility
      competitorSentimentsProcessed: 0,
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
        const [positionsResult, combinedSentimentsResult, citationsResult] = await Promise.allSettled([
          positionExtractionService.extractPositionsForNewResults(positionOptions),
          combinedSentimentService.scoreCombinedSentiment(sentimentOptions),
          citationExtractionService.extractAndStoreCitations(brandId)
        ]);

        // Process positions result
        if (positionsResult.status === 'fulfilled') {
          result.positionsProcessed = positionsResult.value;
        } else {
          const errorMsg = positionsResult.reason instanceof Error
            ? positionsResult.reason.message
            : String(positionsResult.reason);
          result.errors.push({ operation: 'position_extraction', error: errorMsg });
          console.error(`❌ Position extraction failed:`, errorMsg);
        }

        // Process combined sentiments result
        if (combinedSentimentsResult.status === 'fulfilled') {
          result.competitorSentimentsProcessed = combinedSentimentsResult.value;
        } else {
          const errorMsg = combinedSentimentsResult.reason instanceof Error
            ? combinedSentimentsResult.reason.message
            : String(combinedSentimentsResult.reason);
          result.errors.push({ operation: 'combined_sentiment_scoring', error: errorMsg });
          console.error(`❌ Combined sentiment scoring failed:`, errorMsg);
        }

        // Process citations result
        if (citationsResult.status === 'fulfilled') {
          result.citationsProcessed = citationsResult.value.processed || citationsResult.value.inserted || 0;
        } else {
          const errorMsg = citationsResult.reason instanceof Error
            ? citationsResult.reason.message
            : String(citationsResult.reason);
          result.errors.push({ operation: 'citation_extraction', error: errorMsg });
          console.error(`❌ Citation extraction failed:`, errorMsg);
        }
      } else {
        // Run scoring operations sequentially (safer, better error handling)
        // 1. Position extraction
        try {
          result.positionsProcessed = await positionExtractionService.extractPositionsForNewResults(positionOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'position_extraction', error: errorMsg });
          console.error(`❌ Position extraction failed:`, errorMsg);
        }

        // 2. Combined sentiment scoring (brand + competitors in single API call)
        try {
          result.competitorSentimentsProcessed = await combinedSentimentService.scoreCombinedSentiment(sentimentOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'combined_sentiment_scoring', error: errorMsg });
          console.error(`❌ Combined sentiment scoring failed:`, errorMsg);
        }

        // 3. Citation extraction
        try {
          const citationStats = await citationExtractionService.extractAndStoreCitations(brandId);
          result.citationsProcessed = citationStats.processed || citationStats.inserted || 0;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'citation_extraction', error: errorMsg });
          console.error(`❌ Citation extraction failed:`, errorMsg);
        }
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Brand scoring with combined sentiment failed for brand ${brandId}:`, errorMsg);
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

