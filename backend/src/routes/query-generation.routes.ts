import express from 'express';
import { queryGenerationService, QueryGenerationRequest } from '../services/query-generation.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * POST /api/query-generation/seed-queries
 * Generate seed queries from brand information
 */
router.post('/seed-queries', authenticateToken, async (req, res) => {
  try {
    const {
      url,
      locale = 'en-US',
      country = 'US',
      industry,
      competitors,
      keywords,
      llm_provider = 'cerebras',
      brand_id,
      guided_prompts
    } = req.body;

    // Validate required fields
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    if (!['cerebras', 'openai'].includes(llm_provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid LLM provider. Must be "cerebras" or "openai"'
      });
    }

    // Get customer_id from authenticated user
    const customer_id = req.user?.customer_id;
    if (!customer_id) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // If no brand_id provided, get the user's first brand
    let final_brand_id = brand_id;
    if (!final_brand_id || final_brand_id === 'undefined') {
      try {
        const { brandService } = await import('../services/brand.service');
        const brands = await brandService.getBrandsByCustomer(customer_id);
        if (brands.length > 0) {
          final_brand_id = brands[0].id;
          console.log('🎯 Using first available brand:', final_brand_id);
        } else {
          return res.status(400).json({
            success: false,
            error: 'No brands found. Please complete brand onboarding first.'
          });
        }
      } catch (error) {
        console.error('Error fetching user brands:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user brands'
        });
      }
    }

    const request: QueryGenerationRequest = {
      url,
      locale,
      country,
      industry,
      competitors,
      keywords,
      llm_provider,
      brand_id: final_brand_id,
      customer_id,
      guided_prompts
    };

    const result = await queryGenerationService.generateSeedQueries(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Query generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Query generation failed'
    });
  }
});

/**
 * GET /api/query-generation/health
 * Health check for query generation service
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Query Generation service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
