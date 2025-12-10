/**
 * Recommendations API Routes
 * 
 * Endpoints for generating AI-powered brand improvement recommendations.
 * Uses Cerebras API with QWEN model to analyze brand data and generate
 * actionable recommendations for improving visibility, SOA, and sentiment.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { recommendationService } from '../services/recommendations/recommendation.service';
import { brandService } from '../services/brand.service';

const router = express.Router();

/**
 * POST /api/recommendations
 * 
 * Generate AI-powered recommendations for a brand.
 * 
 * Request body:
 *   - brandId (optional): The brand ID to generate recommendations for.
 *                         If not provided, uses the customer's first brand.
 * 
 * Response:
 *   - success: boolean
 *   - data: {
 *       recommendations: Recommendation[]  // Up to 10 recommendations
 *       generatedAt: string               // ISO timestamp
 *       brandId: string
 *       brandName: string
 *     }
 *   - message: string (if no recommendations generated)
 * 
 * Recommendation object:
 *   - action: string          // What to do
 *   - reason: string          // Why/reasoning
 *   - kpi: string             // KPI impacted (Visibility Index, SOA %, Sentiment Score)
 *   - expectedBoost: string   // Expected improvement
 *   - effort: Low|Medium|High // Level of effort
 *   - timeline: string        // Estimated time
 *   - confidence: number      // 0-100%
 *   - priority: High|Medium|Low
 *   - focusArea: visibility|soa|sentiment
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    let { brandId } = req.body;

    // If no brandId provided, get the customer's first brand
    if (!brandId) {
      console.log('📍 [Recommendations] No brandId provided, fetching first brand for customer');
      const brands = await brandService.getBrandsByCustomer(customerId);
      
      if (!brands || brands.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No brands found. Please complete brand onboarding first.'
        });
      }
      
      brandId = brands[0].id;
      console.log(`📍 [Recommendations] Using first brand: ${brandId}`);
    }

    // Generate recommendations
    console.log(`🚀 [Recommendations] Generating recommendations for brand: ${brandId}`);
    const result = await recommendationService.generateRecommendations(brandId, customerId);

    if (!result.success) {
      return res.json({
        success: true,
        data: {
          recommendations: [],
          message: result.message || 'No recommendations generated at this time.'
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
    console.error('❌ [Recommendations] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations. Please try again later.'
    });
  }
});

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
 * GET /api/recommendations/health
 * 
 * Health check endpoint for the recommendations service.
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Recommendations service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;


