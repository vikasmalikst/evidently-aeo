import { Router, Request, Response } from 'express';
import { brandService } from '../services/brand.service';
import { brandDashboardService, DashboardDateRange } from '../services/brand-dashboard';
import { promptsAnalyticsService } from '../services/prompts-analytics.service';
import { keywordsAnalyticsService } from '../services/keywords-analytics.service';
import { sourceAttributionService } from '../services/source-attribution.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { BrandOnboardingRequest, ApiResponse, DatabaseError } from '../types/auth';
import { supabaseAdmin } from '../config/database';

const router = Router();

/**
 * POST /brands
 * Create a new brand
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const brandData: BrandOnboardingRequest = req.body;
    const customerId = req.user!.customer_id;

    const result = await brandService.createBrand(customerId, brandData);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating brand:', error);
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create brand'
    });
  }
});

/**
 * GET /brands/:brandId/keywords
 * Keyword analytics aggregated from generated_keywords and extracted_positions
 */
router.get('/:brandId/keywords', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    const payload = await keywordsAnalyticsService.getKeywordAnalytics({
      brandId,
      customerId,
      startDate,
      endDate
    });

    res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Error fetching keyword analytics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch keyword analytics'
    });
  }
});

/**
 * GET /brands/search
 * Find brand by URL or name (within customer's brands)
 */
router.get('/search', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { url, name } = req.query;
    const customerId = req.user!.customer_id;
    
    console.log('🔍 Brand search request:', { url, name, customerId });
    
    if (!url && !name) {
      res.status(400).json({
        success: false,
        error: 'Either url or name is required'
      });
      return;
    }
    
    const brand = await brandService.findBrandByUrlOrName(
      url as string | undefined, 
      name as string | undefined,
      customerId
    );
    
    if (brand) {
      res.json({
        success: true,
        data: brand
      });
    } else {
      res.json({
        success: false,
        data: null,
        message: 'Brand not found'
      });
    }
  } catch (error) {
    console.error('Error searching brand:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search brand'
    });
  }
});

/**
 * GET /brands
 * Get all brands for the current customer
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const customerId = req.user!.customer_id;
    const brands = await brandService.getBrandsByCustomer(customerId);
    
    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brands'
    });
  }
});

/**
 * GET /brands/:brandId
 * Get a specific brand
 */
router.get('/:brandId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!customerId || !brandId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    const brand = await brandService.getBrandById(brandId, customerId);
    
    if (!brand) {
      res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
      return;
    }

    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brand'
    });
  }
});

/**
 * PUT /brands/:brandId
 * Update a brand
 */
router.put('/:brandId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const updateData: Partial<BrandOnboardingRequest> = req.body;

    if (!customerId || !brandId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    const updatedBrand = await brandService.updateBrand(brandId, customerId, updateData);
    
    res.json({
      success: true,
      data: updatedBrand
    });
  } catch (error) {
    console.error('Error updating brand:', error);
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update brand'
    });
  }
});

/**
 * DELETE /brands/:brandId
 * Delete a brand
 */
router.delete('/:brandId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!customerId || !brandId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    await brandService.deleteBrand(brandId, customerId);
    
    res.json({
      success: true,
      message: 'Brand deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete brand'
    });
  }
});

/**
 * GET /brands/:brandId/artifacts
 * Get onboarding artifacts for a brand
 */
router.get('/:brandId/artifacts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!customerId || !brandId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    const artifacts = await brandService.getOnboardingArtifacts(brandId, customerId);
    
    res.json({
      success: true,
      data: artifacts
    });
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artifacts'
    });
  }
});

/**
 * GET /brands/:brandId/dashboard
 * Get dashboard analytics for a specific brand
 */
router.get('/:brandId/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    let dateRange: DashboardDateRange | undefined;

    if (startQuery || endQuery) {
      try {
        const parseDate = (value: string): Date => {
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime())) {
            throw new Error(`Invalid date: ${value}`);
          }
          return parsed;
        };

        let startDate = startQuery ? parseDate(startQuery) : undefined;
        let endDate = endQuery ? parseDate(endQuery) : undefined;

        if (endDate && !startDate) {
          startDate = new Date(endDate);
          startDate.setUTCDate(startDate.getUTCDate() - 30);
        }

        if (startDate && !endDate) {
          endDate = new Date(startDate);
        }

        if (!startDate || !endDate) {
          throw new Error('Both startDate and endDate are required');
        }

        startDate.setUTCHours(0, 0, 0, 0);
        endDate.setUTCHours(23, 59, 59, 999);

        if (startDate.getTime() > endDate.getTime()) {
          throw new Error('startDate must be before or equal to endDate');
        }

        dateRange = {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid date range';
        res.status(400).json({ success: false, error: message });
        return;
      }
    }

    console.log(`[Dashboard Route] brandId=${brandId}, customerId=${customerId}, user=${req.user?.email}`);

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    const dashboard = await brandDashboardService.getBrandDashboard(brandId, customerId, dateRange);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error fetching brand dashboard:', error);

    if (error instanceof DatabaseError && error.message.toLowerCase().includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch brand dashboard'
    });
  }
});

/**
 * GET /brands/:brandId/prompts
 * Get prompt analytics for a specific brand
 */
router.get('/:brandId/prompts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const collectorsQuery = req.query.collectors;

    let collectors: string[] | undefined;
    if (typeof collectorsQuery === 'string') {
      collectors = collectorsQuery
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    } else if (Array.isArray(collectorsQuery)) {
      collectors = collectorsQuery
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);
    }

    const payload = await promptsAnalyticsService.getPromptAnalytics({
      brandId,
      customerId,
      startDate,
      endDate,
      collectors
    });

    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('Error fetching prompt analytics:', error);

    if (error instanceof DatabaseError && error.message.toLowerCase().includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    if (error instanceof Error && error.message.toLowerCase().includes('invalid')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prompt analytics'
    });
  }
});

/**
 * GET /brands/:id/topics
 * Get AEO topics for a specific brand with analytics
 * Query params: startDate, endDate (optional, defaults to last 30 days)
 */
router.get('/:id/topics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.customer_id;
    const { startDate, endDate, collectorType, country } = req.query;
    
    console.log(`🎯 Fetching AEO topics with analytics for brand ${id}, customer ${customerId}`);
    console.log(`🔍 Filters: collectorType=${collectorType}, country=${country}, dateRange=${startDate} to ${endDate}`);
    
    const result = await brandService.getBrandTopicsWithAnalytics(
      id, 
      customerId,
      startDate as string | undefined,
      endDate as string | undefined,
      collectorType as string | undefined,
      country as string | undefined
    );
    
    res.json({
      success: true,
      data: result.topics || result, // Handle both old format (array) and new format (object)
      availableModels: result.availableModels || []
    });
  } catch (error) {
    console.error('Error fetching brand topics:', error);
    
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brand topics'
    });
  }
});

/**
 * GET /brands/:id/categories
 * Get categories with topics for a specific brand
 */
router.get('/:id/categories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.customer_id;

    const categories = await brandService.getBrandCategoriesWithTopics(id, customerId);
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching brand categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch brand categories' });
  }
});

/**
 * POST /brands/:id/categorize-topics
 * Manually categorize topics for a specific brand
 */
router.post('/:id/categorize-topics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.customer_id;

    console.log(`🎯 Manual categorization requested for brand ${id}`);
    
    // Get topics for this brand
    const topics = await brandService.getBrandTopics(id, customerId);
    console.log(`📋 Found ${topics.length} topics to categorize`);
    
    // Try AI categorization first (Cerebras primary, OpenAI fallback, rules final)
    const topicLabels = topics.map(topic => 
      typeof topic === 'string' ? topic : (topic.topic_name || topic.name || topic)
    );
    
    try {
      // Use the same AI categorization logic as brand creation
      await brandService.categorizeTopicsWithAI(id, topicLabels);
      console.log('✅ AI categorization completed successfully');
    } catch (error) {
      console.error('❌ AI categorization failed, using rule-based fallback:', error);
      
      // Fallback to rule-based categorization
      for (const topic of topics) {
        const topicName = typeof topic === 'string' ? topic : (topic.topic_name || topic.name || topic);
        const category = brandService.categorizeTopicByRules(topicName);
        console.log(`🎯 Rule-categorizing "${topicName}" as "${category}"`);
        
        // Update the topic with its category
                 const { error: updateError } = await supabaseAdmin
                   .from('brand_topics')
                   .update({ category: category })
                   .eq('brand_id', id)
                   .eq('topic_name', topicName); // Fixed: use topic_name instead of topic
        
        if (updateError) {
          console.error(`❌ Failed to update topic ${topicName}:`, updateError);
        } else {
          console.log(`✅ Updated "${topicName}" with category "${category}"`);
        }
      }
    }
    
    res.json({ success: true, message: 'Topics categorized successfully' });
  } catch (error) {
    console.error('Error categorizing topics:', error);
    res.status(500).json({ success: false, error: 'Failed to categorize topics' });
  }
});

/**
 * GET /brands/:brandId/sources
 * Get source attribution data for a specific brand
 */
router.get('/:brandId/sources', authenticateToken, async (req: Request, res: Response) => {
  const requestStartTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`\n[SourceAttribution API] 🚀 Request ${requestId} started at ${new Date().toISOString()}`);
    console.log(`[SourceAttribution API] 📍 Endpoint: GET /brands/:brandId/sources`);
    
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    
    console.log(`[SourceAttribution API] 📊 Params: brandId=${brandId}, customerId=${customerId}`);
    console.log(`[SourceAttribution API] 📅 Date Range: startDate=${startQuery || 'default'}, endDate=${endQuery || 'default'}`);
    
    let dateRange: { start: string; end: string } | undefined;
    
    if (startQuery || endQuery) {
      try {
        const parseDate = (value: string): Date => {
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime())) {
            throw new Error(`Invalid date: ${value}`);
          }
          return parsed;
        };

        let startDate = startQuery ? parseDate(startQuery) : undefined;
        let endDate = endQuery ? parseDate(endQuery) : undefined;

        if (endDate && !startDate) {
          startDate = new Date(endDate);
          startDate.setUTCDate(startDate.getUTCDate() - 30);
        }

        if (startDate && !endDate) {
          endDate = new Date(startDate);
          endDate.setUTCDate(endDate.getUTCDate() + 30);
        }

        if (!startDate || !endDate) {
          throw new Error('Both startDate and endDate are required');
        }

        startDate.setUTCHours(0, 0, 0, 0);
        endDate.setUTCHours(23, 59, 59, 999);

        if (startDate.getTime() > endDate.getTime()) {
          throw new Error('startDate must be before or equal to endDate');
        }

        dateRange = {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid date range';
        res.status(400).json({ success: false, error: message });
        return;
      }
    }

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    const serviceStartTime = Date.now();
    console.log(`[SourceAttribution API] ⏱️  Calling service.getSourceAttribution()...`);
    
    const sourceData = await sourceAttributionService.getSourceAttribution(
      brandId,
      customerId,
      dateRange
    );
    
    const serviceEndTime = Date.now();
    const serviceDuration = serviceEndTime - serviceStartTime;
    console.log(`[SourceAttribution API] ✅ Service completed in ${serviceDuration}ms`);
    console.log(`[SourceAttribution API] 📦 Response: ${sourceData.sources.length} sources, ${sourceData.totalSources} total`);

    const responseStartTime = Date.now();
    res.json({ success: true, data: sourceData });
    
    const totalDuration = Date.now() - requestStartTime;
    const responseDuration = Date.now() - responseStartTime;
    console.log(`[SourceAttribution API] 📤 Response sent in ${responseDuration}ms`);
    console.log(`[SourceAttribution API] ⏱️  Total request duration: ${totalDuration}ms`);
    console.log(`[SourceAttribution API] ✅ Request ${requestId} completed successfully\n`);
  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`[SourceAttribution API] ❌ Request ${requestId} failed after ${totalDuration}ms:`, error);

    if (error instanceof DatabaseError && error.message.toLowerCase().includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch source attribution'
    });
  }
});

export default router;
