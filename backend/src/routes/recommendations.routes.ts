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
import { recommendationContentService } from '../services/recommendations/recommendation-content.service';
import * as recommendationActionsService from '../services/recommendations/recommendation-actions.service';
import { brandService } from '../services/brand.service';
import { supabaseAdmin } from '../config/supabase';

const router = express.Router();

/**
 * GET /api/recommendations/:recommendationId/content
 *
 * Fetch latest generated content draft for a recommendation (if any).
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

/**
 * POST /api/recommendations/:recommendationId/content
 *
 * Generate a content draft for a recommendation and persist it.
 * Uses Cerebras as primary provider and OpenRouter as fallback.
 */
router.post('/:recommendationId/content', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { recommendationId } = req.params;
    const { contentType } = req.body || {};
    const result = await recommendationContentService.generateContent(recommendationId, customerId, { contentType });

    if (!result?.record) {
      return res.status(500).json({ success: false, error: 'Failed to generate content.' });
    }

    return res.json({
      success: true,
      data: {
        content: result.record,
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed
      }
    });
  } catch (error) {
    console.error('❌ [Recommendations Content POST] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate content.' });
  }
});

/**
 * PATCH /api/recommendations/content/:contentId
 *
 * Update content status (accepted/rejected).
 */
router.patch('/content/:contentId', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { contentId } = req.params;
    const { status } = req.body || {};
    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ success: false, error: 'Invalid status. Use accepted or rejected.' });
    }

    const updated = await recommendationContentService.updateStatus(contentId, customerId, status);
    if (!updated) {
      return res.status(500).json({ success: false, error: 'Failed to update content status.' });
    }

    return res.json({ success: true, data: { content: updated } });
  } catch (error) {
    console.error('❌ [Recommendations Content PATCH] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update content status.' });
  }
});

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
 * GET /api/recommendations/:recommendationId/status
 * 
 * Get the current status of a recommendation.
 */
router.get('/:recommendationId/status', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { recommendationId } = req.params;
    const status = await recommendationActionsService.getRecommendationStatus(recommendationId, customerId);

    return res.json({ success: true, data: { status } });
  } catch (error) {
    console.error('❌ [Recommendations Status GET] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch recommendation status.' });
  }
});

/**
 * PATCH /api/recommendations/:recommendationId/status
 * 
 * Update the status of a recommendation.
 * 
 * Request body:
 *   - status: 'not_started' | 'in_progress' | 'completed' | 'dismissed'
 *   - notes (optional): Additional notes
 */
router.patch('/:recommendationId/status', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { recommendationId } = req.params;
    const { status, notes } = req.body || {};

    if (!status || !['not_started', 'in_progress', 'completed', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: not_started, in_progress, completed, dismissed'
      });
    }

    // Get brand_id from the recommendation
    const recommendations = await recommendationService.getLatestRecommendations('', customerId);
    const recommendation = recommendations.recommendations?.find((r) => r.id === recommendationId);
    
    if (!recommendation) {
      // Try to get brand_id from recommendation directly
      const { data: recData } = await supabaseAdmin
        .from('recommendations')
        .select('brand_id')
        .eq('id', recommendationId)
        .eq('customer_id', customerId)
        .single();

      if (!recData) {
        return res.status(404).json({ success: false, error: 'Recommendation not found' });
      }

      const action = await recommendationActionsService.updateRecommendationStatus(
        recommendationId,
        customerId,
        recData.brand_id,
        status,
        req.user?.id,
        notes
      );

      if (!action) {
        return res.status(500).json({ success: false, error: 'Failed to update recommendation status.' });
      }

      return res.json({ success: true, data: { action, status } });
    }

    // If status is 'not_started', we don't need to create an action (it's the default)
    if (status === 'not_started') {
      return res.json({ success: true, data: { status: 'not_started' } });
    }

    const action = await recommendationActionsService.updateRecommendationStatus(
      recommendationId,
      customerId,
      recommendations.brandId || '',
      status,
      req.user?.id,
      notes
    );

    if (!action) {
      return res.status(500).json({ success: false, error: 'Failed to update recommendation status.' });
    }

    return res.json({ success: true, data: { action, status } });
  } catch (error) {
    console.error('❌ [Recommendations Status PATCH] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update recommendation status.' });
  }
});

/**
 * POST /api/recommendations/statuses
 * 
 * Get statuses for multiple recommendations in batch.
 * 
 * Request body:
 *   - recommendationIds: string[]
 */
router.post('/statuses', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { recommendationIds } = req.body || {};
    if (!Array.isArray(recommendationIds)) {
      return res.status(400).json({ success: false, error: 'recommendationIds must be an array' });
    }

    const statusMap = await recommendationActionsService.getRecommendationStatuses(recommendationIds, customerId);
    const statuses = Object.fromEntries(statusMap);

    return res.json({ success: true, data: { statuses } });
  } catch (error) {
    console.error('❌ [Recommendations Statuses POST] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch recommendation statuses.' });
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







