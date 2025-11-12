/**
 * Trending Keywords API Routes
 * 
 * Handles requests for trending keywords and prompts from multiple sources
 */

import { Router, Request, Response } from 'express';
import { trendingKeywordsService } from '../services/keywords/trending-keywords.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/trending-keywords
 * Get trending keywords for a brand
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      brand,
      industry,
      competitors,
      locale = 'en-US',
      country = 'US',
      max_keywords = 50,
      sources = 'oxylabs,google_aio,news',
      brandId
    } = req.query;

    if (!brand) {
      return res.status(400).json({
        success: false,
        error: 'Brand parameter is required'
      });
    }

    const competitorsList = competitors 
      ? (typeof competitors === 'string' ? competitors.split(',') : competitors as string[])
      : [];

    const sourcesList = typeof sources === 'string' 
      ? sources.split(',') 
      : sources as string[];

    const request = {
      brand: brand as string,
      industry: industry as string,
      competitors: competitorsList,
      locale: locale as string,
      country: country as string,
      max_keywords: parseInt(max_keywords as string) || 50,
      sources: sourcesList
    };

    // Get customerId from auth middleware, brandId from query params
    const customerId = req.user?.customer_id;
    const brandIdParam = brandId as string;
    
    const result = await trendingKeywordsService.getTrendingKeywords(request, brandIdParam, customerId);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch trending keywords'
      });
    }
  } catch (error) {
    console.error('❌ Trending keywords API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/trending-keywords/category/:category
 * Get trending keywords by category
 */
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const {
      brand,
      industry,
      competitors,
      locale = 'en-US',
      country = 'US',
      max_keywords = 50,
      sources = 'oxylabs,google_aio,news'
    } = req.query;

    if (!brand) {
      return res.status(400).json({
        success: false,
        error: 'Brand parameter is required'
      });
    }

    const competitorsList = competitors 
      ? (typeof competitors === 'string' ? competitors.split(',') : competitors as string[])
      : [];

    const sourcesList = typeof sources === 'string' 
      ? sources.split(',') 
      : sources as string[];

    const request = {
      brand: brand as string,
      industry: industry as string,
      competitors: competitorsList,
      locale: locale as string,
      country: country as string,
      max_keywords: parseInt(max_keywords as string) || 50,
      sources: sourcesList
    };

    const result = await trendingKeywordsService.getTrendingKeywordsByCategory(request, category);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch trending keywords by category'
      });
    }
  } catch (error) {
    console.error('❌ Trending keywords by category API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/trending-keywords
 * Get trending keywords with POST body
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      brand,
      industry,
      competitors = [],
      locale = 'en-US',
      country = 'US',
      max_keywords = 50,
      sources = ['gemini'],
      brandId
    } = req.body;

    if (!brand) {
      return res.status(400).json({
        success: false,
        error: 'Brand is required'
      });
    }

    const request = {
      brand,
      industry,
      competitors,
      locale,
      country,
      max_keywords,
      sources
    };

    // Get customerId from auth middleware, brandId from query params
    const customerId = req.user?.customer_id;
    const brandIdParam = brandId as string;
    
    const result = await trendingKeywordsService.getTrendingKeywords(request, brandIdParam, customerId);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch trending keywords'
      });
    }
  } catch (error) {
    console.error('❌ Trending keywords POST API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
