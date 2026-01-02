/**
 * Recommendation V3 Service - Main Entry Point
 * 
 * Orchestrates all modules to provide the recommendation generation service.
 * This is a modular refactoring of the original recommendation-v3.service.ts
 */

import { getCerebrasKey, getCerebrasModel } from '../../../utils/api-key-resolver';
import { contextBuilderService } from './context-builder.service';
import { databaseService } from './database.service';
import type { RecommendationV3Response } from './types';

// Note: This is a simplified version showing how modules connect.
// The full implementation would extract LLM, KPI identification, and recommendation generation modules.
// For now, these remain in the original service file and should be extracted following the pattern
// shown in context-builder.service.ts and database.service.ts

/**
 * Main Recommendation V3 Service
 * 
 * TODO: Extract remaining modules:
 * - LLM service (OpenRouter, Cerebras, Ollama)
 * - KPI identification service
 * - Recommendation generation service
 */
class RecommendationV3Service {
  private cerebrasApiKey: string | null;
  private cerebrasModel: string;

  constructor() {
    this.cerebrasApiKey = getCerebrasKey();
    this.cerebrasModel = getCerebrasModel();
    
    if (!this.cerebrasApiKey) {
      console.warn('⚠️ [RecommendationV3Service] CEREBRAS_API_KEY not configured');
    }
    console.log(`🤖 [RecommendationV3Service] Initialized with modular architecture`);
  }

  /**
   * Generate recommendations for a brand
   * 
   * This method orchestrates the following steps:
   * 1. Gather brand context (context-builder.service.ts)
   * 2. Generate recommendations (to be extracted to recommendation-generation.service.ts)
   * 3. Save to database (database.service.ts)
   */
  async generateRecommendations(
    brandId: string,
    customerId: string
  ): Promise<RecommendationV3Response> {
    console.log(`📊 [RecommendationV3Service] Generating recommendations for brand: ${brandId}`);

    try {
      // Step 1: Gather brand context using context builder service
      console.log('📊 [RecommendationV3Service] Step 1: Gathering brand context...');
      const contextStartTime = Date.now();
      const context = await contextBuilderService.gatherBrandContext(brandId, customerId);
      console.log(`✅ [RecommendationV3Service] Context gathered in ${Date.now() - contextStartTime}ms`);
      
      if (!context) {
        return {
          success: false,
          kpis: [],
          recommendations: [],
          message: 'Failed to gather brand context.'
        };
      }

      // Step 2: Generate recommendations
      // TODO: Extract to recommendation-generation.service.ts
      // For now, this would call the original method or be refactored
      console.log('📝 [RecommendationV3Service] Step 2: Generating recommendations with LLM...');
      
      // Placeholder - this should be extracted to recommendation-generation.service.ts
      // const recommendations = await recommendationGenerationService.generateRecommendationsDirect(context);
      
      // For now, return error indicating extraction needed
      return {
        success: false,
        kpis: [],
        recommendations: [],
        message: 'Recommendation generation module not yet extracted. See MODULARIZATION_GUIDE.md'
      };

      // Step 3: Save to database using database service
      // const generationId = await databaseService.saveToDatabase(brandId, customerId, [], recommendations, context);
      
      // if (!generationId) {
      //   return {
      //     success: false,
      //     kpis: [],
      //     recommendations: [],
      //     message: 'Failed to save recommendations to database.'
      //   };
      // }

      // return {
      //   success: true,
      //   generationId,
      //   kpis: [],
      //   recommendations: recommendations.filter(rec => rec.id),
      //   generatedAt: new Date().toISOString(),
      //   brandId: context.brandId,
      //   brandName: context.brandName
      // };

    } catch (error) {
      console.error('❌ [RecommendationV3Service] Error:', error);
      return {
        success: false,
        kpis: [],
        recommendations: [],
        message: 'Failed to generate recommendations.'
      };
    }
  }
}

// Export singleton instance
export const recommendationV3Service = new RecommendationV3Service();

// Re-export types for convenience
export * from './types';

