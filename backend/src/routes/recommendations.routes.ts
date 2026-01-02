/**
 * Recommendations API Routes
 * 
 * Legacy endpoints kept for backward compatibility:
 * - GET /api/recommendations - Used by SearchSourcesR2 page
 * - GET /api/recommendations/:recommendationId/content - Used by RecommendationsV3
 * 
 * Note: Recommendations V3 uses its own routes (recommendations-v3.routes.ts) for generation.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { recommendationService } from '../services/recommendations/recommendation.service';
import { recommendationContentService } from '../services/recommendations/recommendation-content.service';
import { brandService } from '../services/brand.service';

const router = express.Router();

/**
 * GET /api/recommendations
 * 
 * Fetch the latest recommendations for a brand from the database.
 * 
 * Query params:
 *   - brandId (optional): The brand ID to fetch recommendations for.
 *                         If not provided, uses the customer's first brand.
 * 
 * Response:
 *   - success: boolean
 *   - data: {
 *       recommendations: Recommendation[]
 *       generatedAt: string
 *       brandId: string
 *       brandName: string
 *       problemsDetected: number
 *       diagnostics: DiagnosticInsight[]
 *       trends: TrendData
 *     }
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    let { brandId } = req.query;

    // If no brandId provided, get the customer's first brand
    if (!brandId) {
      console.log('📍 [Recommendations GET] No brandId provided, fetching first brand for customer');
      const brands = await brandService.getBrandsByCustomer(customerId);
      
      if (!brands || brands.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No brands found. Please complete brand onboarding first.'
        });
      }
      
      brandId = brands[0].id;
      console.log(`📍 [Recommendations GET] Using first brand: ${brandId}`);
    }

    // Fetch latest recommendations from database
    console.log(`📥 [Recommendations GET] Fetching latest recommendations for brand: ${brandId}`);
    const result = await recommendationService.getLatestRecommendations(brandId as string, customerId);

    if (!result.success) {
      return res.json({
        success: true,
        data: {
          recommendations: [],
          message: result.message || 'No recommendations found.'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        generatedAt: result.generatedAt,
        brandId: result.brandId,
        brandName: result.brandName,
        problemsDetected: result.problemsDetected,
        diagnostics: result.diagnostics,
        trends: result.trends
      }
    });

  } catch (error) {
    console.error('❌ [Recommendations GET] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations. Please try again later.'
    });
  }
});

/**
 * GET /api/recommendations/:recommendationId/content
 *
 * Fetch latest generated content draft for a recommendation (if any).
 * Used by RecommendationsV3.
 */
router.get('/:recommendationId/content', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { recommendationId } = req.params;
    const latest = await recommendationContentService.getLatestContent(recommendationId, customerId);
    return res.json({ success: true, data: latest ? { content: latest } : null });
  } catch (error) {
    console.error('❌ [Recommendations Content GET] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch recommendation content.' });
  }
});

export default router;







