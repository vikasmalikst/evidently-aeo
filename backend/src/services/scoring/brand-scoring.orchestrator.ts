/**
 * Brand Scoring Service
 * Orchestrates all scoring operations (position extraction, sentiment scoring, citation extraction) for a specific brand
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { positionExtractionService } from './position-extraction.service';
import { brandSentimentService } from './sentiment/brand-sentiment.service';
import { competitorSentimentService } from './sentiment/competitor-sentiment.service';
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
        const [positionsResult, brandSentimentsResult, competitorSentimentsResult, citationsResult] = await Promise.allSettled([
          positionExtractionService.extractPositionsForNewResults(positionOptions),
          brandSentimentService.scoreBrandSentiment(sentimentOptions),
          competitorSentimentService.scoreCompetitorSentiment(sentimentOptions),
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

        // Process brand sentiments result (extracted_positions)
        if (brandSentimentsResult.status === 'fulfilled') {
          // Note: Brand sentiment is tracked separately but not in result object for now
        } else {
          const errorMsg = brandSentimentsResult.reason instanceof Error 
            ? brandSentimentsResult.reason.message 
            : String(brandSentimentsResult.reason);
          result.errors.push({ operation: 'brand_sentiment_scoring', error: errorMsg });
          console.error(`❌ Brand sentiment scoring failed:`, errorMsg);
        }

        // Process competitor sentiments result
        if (competitorSentimentsResult.status === 'fulfilled') {
          result.competitorSentimentsProcessed = competitorSentimentsResult.value;
        } else {
          const errorMsg = competitorSentimentsResult.reason instanceof Error 
            ? competitorSentimentsResult.reason.message 
            : String(competitorSentimentsResult.reason);
          result.errors.push({ operation: 'competitor_sentiment_scoring', error: errorMsg });
          console.error(`❌ Competitor sentiment scoring failed:`, errorMsg);
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

        // 2. Brand sentiment scoring (for extracted_positions - brand only, priority)
        try {
          const brandSentimentsProcessed = await brandSentimentService.scoreBrandSentiment(sentimentOptions);
          // Note: This is separate from competitorSentimentsProcessed for tracking
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'brand_sentiment_scoring', error: errorMsg });
          console.error(`❌ Brand sentiment scoring failed:`, errorMsg);
          // Don't block competitor scoring if brand fails
        }

        // 3. Competitor sentiment scoring (for extracted_positions - competitors only, secondary)
        try {
          result.competitorSentimentsProcessed = await competitorSentimentService.scoreCompetitorSentiment(sentimentOptions);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push({ operation: 'competitor_sentiment_scoring', error: errorMsg });
          console.error(`❌ Competitor sentiment scoring failed:`, errorMsg);
        }

        // 4. Citation extraction
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

