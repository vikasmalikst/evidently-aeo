import { Router, Request, Response } from 'express';
import { brandService } from '../services/brand.service';
import { brandDashboardService, DashboardDateRange } from '../services/brand-dashboard';
import { promptsAnalyticsService } from '../services/prompts-analytics.service';
import { keywordsAnalyticsService } from '../services/keywords-analytics.service';
import { sourceAttributionService } from '../services/source-attribution.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { responseCacheMiddleware } from '../middleware/response-cache.middleware';
import { BrandOnboardingRequest, ApiResponse, DatabaseError } from '../types/auth';
import { supabaseAdmin } from '../config/database';
import { topicConfigurationService } from '../services/topic-configuration.service';
import { competitorCrudService, competitorVersioningService } from '../services/competitor-management';
import { brandProductEnrichmentService, EnrichmentResult } from '../services/onboarding/brand-product-enrichment.service';

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

router.post('/:brandId/brand-products', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    const brand = await brandService.getBrandById(brandId, customerId);
    if (!brand) {
      res.status(404).json({ success: false, error: 'Brand not found' });
      return;
    }

    const enrichment = (req.body?.enrichment ?? req.body) as EnrichmentResult;
    const isValid =
      enrichment &&
      enrichment.brand &&
      Array.isArray(enrichment.brand.synonyms) &&
      Array.isArray(enrichment.brand.products) &&
      enrichment.competitors &&
      typeof enrichment.competitors === 'object';

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid enrichment payload' });
      return;
    }

    await brandProductEnrichmentService.saveEnrichmentToDatabase(brandId, enrichment, (msg: string) => console.log(msg));

    res.json({ success: true, data: { brand_id: brandId } });
  } catch (error) {
    console.error('Error saving brand products:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save brand products'
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
    const collectorType = typeof req.query.collectorType === 'string' ? req.query.collectorType : undefined;
    const collectorTypesParam = req.query.collectorTypes;
    const collectorTypes =
      typeof collectorTypesParam === 'string'
        ? collectorTypesParam.split(',').map((t) => t.trim()).filter(Boolean)
        : Array.isArray(collectorTypesParam)
          ? collectorTypesParam
            .flatMap((t) => (typeof t === 'string' ? t.split(',') : []))
            .map((t) => t.trim())
            .filter(Boolean)
          : undefined;

    const payload = await keywordsAnalyticsService.getKeywordAnalytics({
      brandId,
      customerId,
      startDate,
      endDate,
      collectorType,
      collectorTypes
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

    if (!customerId) {
      res.status(403).json({
        success: false,
        error: 'Customer ID is required. Please ensure you are properly authenticated.'
      });
      return;
    }

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
 * POST /brands/:brandId/collectors
 * Update collectors for a brand
 */
router.post('/:brandId/collectors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const { ai_models } = req.body;

    if (!Array.isArray(ai_models)) {
      res.status(400).json({
        success: false,
        error: 'ai_models must be an array'
      });
      return;
    }

    await brandService.updateBrandCollectors(brandId, customerId, ai_models);

    res.json({
      success: true,
      message: 'Collectors updated successfully'
    });
  } catch (error) {
    console.error('Error updating collectors:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update collectors'
    });
  }
});

/**
 * GET /brands/stats
 * Get aggregated stats for brands
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const customerId = req.user!.customer_id;

    if (!customerId) {
      res.status(403).json({
        success: false,
        error: 'Customer ID is required.'
      });
      return;
    }

    const stats = await brandService.getBrandStats(customerId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching brand stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brand stats'
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

    console.log('📝 Incoming PUT /brands/:brandId request:', {
      brandId,
      customerId,
      body: req.body
    });

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
router.get(
  '/:brandId/dashboard',
  authenticateToken,
  responseCacheMiddleware({ ttlMs: 5 * 60 * 1000 }), // 5 minutes in-memory cache
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const customerId = req.user!.customer_id;
      const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const collectorsQuery = req.query.collectors;
      const collectors =
        typeof collectorsQuery === 'string'
          ? collectorsQuery
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
          : Array.isArray(collectorsQuery)
            ? collectorsQuery
              .map((value) => (typeof value === 'string' ? value : String(value ?? '')))
              .map((value) => value.trim())
              .filter((value) => value.length > 0)
            : undefined;
      const skipCacheQuery = Array.isArray(req.query.skipCache) ? req.query.skipCache[0] : req.query.skipCache;
      const skipCache =
        typeof skipCacheQuery === 'string' &&
        ['true', '1', 'yes'].includes(skipCacheQuery.toLowerCase());

      // Extract timezone offset from header (minutes difference between UTC and local)
      // e.g. 300 for EST (UTC-5)
      // Default to 0 (UTC) if not provided
      const timezoneOffsetHeader = req.headers['x-timezone-offset'];
      const timezoneOffset = timezoneOffsetHeader ? Number(timezoneOffsetHeader) : 0;

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


      if (!brandId) {
        res.status(400).json({ success: false, error: 'Brand ID is required' });
        return;
      }

      const dashboard = await brandDashboardService.getBrandDashboard(brandId, customerId, dateRange, {
        skipCache,
        collectors,
        timezoneOffset
      });

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      if (error instanceof DatabaseError && error.message.toLowerCase().includes('not found')) {
        // Log as warning without stack trace for expected 404s
        console.warn(`[Dashboard] Brand not found: ${req.params.brandId} (Customer: ${req.user!.customer_id})`);
        res.status(404).json({ success: false, error: error.message });
        return;
      }

      console.error('Error fetching brand dashboard:', error);

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch brand dashboard'
      });
    }
  }
);

/**
 * GET /brands/:brandId/prompts
 * Get prompt analytics for a specific brand
 */
router.get(
  '/:brandId/prompts',
  authenticateToken,
  responseCacheMiddleware({ ttlMs: 5 * 60 * 1000 }),
  async (req: Request, res: Response) => {
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
  }
);

/**
 * GET /brands/:id/topics
 * Get AEO topics for a specific brand with analytics
 * Query params: startDate, endDate (optional, defaults to last 30 days)
 */
router.get(
  '/:id/topics',
  authenticateToken,
  responseCacheMiddleware({ ttlMs: 5 * 60 * 1000 }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const customerId = req.user!.customer_id;
      // Accept both 'collectors' (same as Prompts API) and 'collectorType' for backward compatibility
      const { startDate, endDate, collectorType, collectors, country, competitors } = req.query;

      // Use collectors param if provided, otherwise fall back to collectorType
      const modelFilter = collectors || collectorType;

      // Parse competitor filter (comma-separated list of competitor names)
      const competitorFilter = competitors
        ? (typeof competitors === 'string'
          ? competitors.split(',').map(c => c.toLowerCase().trim()).filter(Boolean)
          : Array.isArray(competitors)
            ? competitors.map(c => String(c).toLowerCase().trim()).filter(Boolean)
            : undefined)
        : undefined;

      console.log(`🎯 Fetching AEO topics with analytics for brand ${id}, customer ${customerId}`);
      console.log(`🔍 Filters: model=${modelFilter}, country=${country}, competitors=${competitorFilter?.join(',') || 'all'}, dateRange=${startDate} to ${endDate}`);

      const result = await brandService.getBrandTopicsWithAnalytics(
        id,
        customerId,
        startDate as string | undefined,
        endDate as string | undefined,
        modelFilter as string | undefined,
        country as string | undefined,
        competitorFilter
      );

      // The service always returns { topics: [], availableModels: [] }
      // Return in the format that frontend expects (object with topics array)
      const responseData: { topics: any[]; availableModels?: string[]; avgSoADelta?: number } = {
        topics: result.topics || []
      };

      // Include availableModels in the data object for consistency
      if (result.availableModels && result.availableModels.length > 0) {
        responseData.availableModels = result.availableModels;
      }

      res.json({
        success: true,
        data: responseData,
        availableModels: result.availableModels || [] // Also include at top level for backward compatibility
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
  }
);

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
router.get(
  '/:brandId/sources',
  authenticateToken,
  responseCacheMiddleware({ ttlMs: 10 * 60 * 1000 }),
  async (req: Request, res: Response) => {
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
  }
);

/**
 * GET /brands/:brandId/sources/impact-score-trends
 * Get daily Impact Score trends for sources over the last N days.
 *
 * - Default: returns top 10 sources by avg Impact Score
 * - Optional: pass `sources` (comma-separated) to fetch trends for a custom set (max 10)
 * - Optional: pass `metric` in {impactScore, mentionRate, soa, sentiment, citations}
 */
router.get(
  '/:brandId/sources/impact-score-trends',
  authenticateToken,
  responseCacheMiddleware({ ttlMs: 10 * 60 * 1000 }),
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const customerId = req.user!.customer_id;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

      const sourcesParam = typeof req.query.sources === 'string' ? req.query.sources : '';
      const selectedSources =
        sourcesParam
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .slice(0, 10);

      const metricRaw = typeof req.query.metric === 'string' ? req.query.metric : 'impactScore';
      const metric = (metricRaw || 'impactScore').toString();
      const allowedMetrics = new Set(['impactScore', 'mentionRate', 'soa', 'sentiment', 'citations']);
      const safeMetric = allowedMetrics.has(metric) ? metric : 'impactScore';

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;

      const trends = await sourceAttributionService.getImpactScoreTrends(
        brandId,
        customerId,
        days,
        selectedSources.length ? selectedSources : undefined,
        safeMetric as any,
        dateRange
      );

      res.json({ success: true, data: trends });
    } catch (error) {
      console.error('Error fetching Impact Score trends:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Impact Score trends'
      });
    }
  }
);

/**
 * GET /brands/:brandId/topic-configuration/current
 * Get current topic configuration for a brand
 */
router.get('/:brandId/topic-configuration/current', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const config = await topicConfigurationService.getCurrentConfiguration(brandId, customerId, req.user?.id);

    // Log the topic IDs being returned
    console.log('📤 Returning topic configuration with topics:', config.topics?.map(t => ({ id: t.id, name: t.name })));

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching current topic configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch topic configuration'
    });
  }
});

/**
 * GET /brands/:brandId/topic-configuration/history
 * Get topic configuration history for a brand
 */
router.get('/:brandId/topic-configuration/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const history = await topicConfigurationService.getConfigurationHistory(brandId, customerId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching topic configuration history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch topic configuration history'
    });
  }
});

/**
 * POST /brands/:brandId/topic-configuration/update
 * Update topic configuration for a brand
 */
router.post('/:brandId/topic-configuration/update', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const { topics } = req.body;

    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        error: 'Topics array is required'
      });
    }

    const newConfig = await topicConfigurationService.createNewVersion(
      brandId,
      customerId,
      topics,
      req.user?.id
    );

    res.json({ success: true, data: newConfig });
  } catch (error) {
    console.error('Error updating topic configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update topic configuration'
    });
  }
});

/**
 * POST /brands/:brandId/topic-configuration/:versionId/revert
 * Revert to a previous topic configuration version
 * Note: This is a simplified version. In production, you'd want a proper versioning table.
 */
router.post('/:brandId/topic-configuration/:versionId/revert', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId, versionId } = req.params;
    const customerId = req.user!.customer_id;
    const config = await topicConfigurationService.revertToVersion(
      brandId,
      customerId,
      versionId,
      req.user?.id
    );

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error reverting topic configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revert topic configuration'
    });
  }
});

/**
 * GET /brands/:brandId/data-updates
 * Check if there are recent collector_results updates (for dashboard refresh detection)
 * Query params: since (ISO timestamp) - check for updates since this time
 */
router.get('/:brandId/data-updates', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const sinceParam = typeof req.query.since === 'string' ? req.query.since : undefined;

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    // Check if there are collector_results with raw_answer populated that were updated since the given time
    // This helps detect when async BrightData responses have been populated
    let query = supabaseAdmin
      .from('collector_results')
      .select('id, updated_at', { count: 'exact' })
      .eq('brand_id', brandId)
      .not('raw_answer', 'is', null)
      .neq('raw_answer', '');

    if (sinceParam) {
      query = query.gte('updated_at', sinceParam);
    } else {
      // Default to last 2 minutes if no since param
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      query = query.gte('updated_at', twoMinutesAgo);
    }

    const { data, error, count } = await query.limit(1);

    if (error) {
      console.error('Error checking for data updates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check for data updates'
      });
      return;
    }

    const hasUpdates = (count || 0) > 0;

    res.json({
      success: true,
      data: {
        hasUpdates,
        count: count || 0
      }
    });
  } catch (error) {
    console.error('Error checking for data updates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check for data updates'
    });
  }
});

/**
 * GET /brands/:brandId/onboarding-progress
 * Get real-time progress of data collection and scoring for onboarding
 */
router.get('/:brandId/onboarding-progress', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!brandId || !customerId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    // Fetch counts and statuses in parallel
    // IMPORTANT: Count unique query_ids, not total collector_results
    const [
      { count: totalQueries, error: totalError },
      { data: collectedResults, error: collectedError },
      { data: scoredResults, error: scoredError },
      { data: readinessAudits, error: readinessError },
      { data: recommendations, error: recommendationsError }
    ] = await Promise.all([
      supabaseAdmin
        .from('generated_queries')
        .select('id', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('customer_id', customerId),
      supabaseAdmin
        .from('collector_results')
        .select('query_id')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .eq('status', 'completed')
        .not('query_id', 'is', null),
      supabaseAdmin
        .from('collector_results')
        .select('query_id')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .eq('scoring_status', 'completed')
        .not('query_id', 'is', null),
      // Check for most recent domain readiness audit
      supabaseAdmin
        .from('domain_readiness_audits')
        .select('created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1),
      // Check for most recent recommendation generation
      supabaseAdmin
        .from('recommendation_generations')
        .select('generated_at')
        .eq('brand_id', brandId)
        .order('generated_at', { ascending: false })
        .limit(1)
    ]);

    if (totalError || collectedError || scoredError || readinessError || recommendationsError) {
      console.error('Error fetching onboarding progress counts:', {
        totalError,
        collectedError,
        scoredError,
        readinessError, // Log new errors
        recommendationsError,
        brandId,
        customerId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch progress details', // Generic message
      });
      return;
    }

    // Handle null/undefined data arrays
    const collectedData = collectedResults || [];
    const scoredData = scoredResults || [];

    const total = totalQueries || 0;

    // Count unique query_ids (not total collector_results)
    const uniqueCollectedQueryIds = new Set(
      collectedData
        .map((r: any) => r.query_id)
        .filter((id: any) => id != null)
    );
    const collected = uniqueCollectedQueryIds.size;

    const uniqueScoredQueryIds = new Set(
      scoredData
        .map((r: any) => r.query_id)
        .filter((id: any) => id != null)
    );
    const scored = uniqueScoredQueryIds.size;

    // Determine Stage Statuses
    let collectionStatus: 'pending' | 'active' | 'completed' = 'pending';
    if (total > 0) {
      if (collected >= total) collectionStatus = 'completed';
      else collectionStatus = 'active';
    }

    let scoringStatus: 'pending' | 'active' | 'completed' = 'pending';
    // Scoring is active if we have collected something
    if (collected > 0) {
      if (scored >= total && total > 0) scoringStatus = 'completed';
      else scoringStatus = 'active';
    }

    // New Stages Analysis
    const lastAudit = readinessAudits && readinessAudits.length > 0 ? readinessAudits[0] : null;
    let readinessStatus: 'pending' | 'active' | 'completed' = 'pending';
    if (lastAudit) {
      // Assume existence means completed unless we track explicit status columns, 
      // usually availability of rows means it ran.
      readinessStatus = 'completed';
    } else if (scoringStatus === 'completed') {
      // If scoring done but no audit, it's pending (ready to run)
      // or could be considered 'active' if we had a job running state.
      // For simple UI logic: if previous step done, this is 'pending' (waiting for trigger)
      // or 'active' if user clicked. 
      // Let's call it 'pending' until a row appears.
      readinessStatus = 'pending';
    }

    const lastRecommendation = recommendations && recommendations.length > 0 ? recommendations[0] : null;
    let recommendationStatus: 'pending' | 'active' | 'completed' = 'pending';
    if (lastRecommendation) {
      recommendationStatus = 'completed';
    }

    let finalizationStatus: 'pending' | 'active' | 'completed' = 'pending';
    if (collectionStatus === 'completed' && scoringStatus === 'completed' && readinessStatus === 'completed' && recommendationStatus === 'completed') {
      finalizationStatus = 'active'; // Or completed? Keeping logic similar to before
    }

    // Determine current operation (backward compatibility + high level state)
    let currentOperation: 'collecting' | 'scoring' | 'finalizing' | 'domain_readiness' | 'recommendations' = 'collecting';
    if (collectionStatus === 'completed') {
      if (scoringStatus === 'completed') {
        if (readinessStatus === 'completed') {
          if (recommendationStatus === 'completed') {
            currentOperation = 'finalizing';
          } else {
            currentOperation = 'recommendations';
          }
        } else {
          currentOperation = 'domain_readiness';
        }
      } else {
        currentOperation = 'scoring';
      }
    }

    // Check if all scoring types are complete
    const allScoringComplete = total > 0 && scored >= total;

    res.json({
      success: true,
      data: {
        stages: {
          collection: {
            total: total,
            completed: collected,
            status: collectionStatus
          },
          scoring: {
            total: total,
            completed: scored,
            status: scoringStatus
          },
          domain_readiness: {
            status: readinessStatus,
            last_run: lastAudit ? lastAudit.created_at : null
          },
          recommendations: {
            status: recommendationStatus,
            last_run: lastRecommendation ? lastRecommendation.generated_at : null
          },
          finalization: {
            status: finalizationStatus
          }
        },
        // Keep backward compatibility
        queries: { total: total, completed: collected },
        scoring: {
          positions: allScoringComplete,
          sentiments: allScoringComplete,
          citations: allScoringComplete
        },
        currentOperation
      }
    });
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch progress',
    });
  }
});

/**
 * GET /brands/:brandId/competitors
 * Get all competitors for a brand (with versioning)
 */
router.get('/:brandId/competitors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!brandId || !customerId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    const result = await competitorCrudService.getActiveCompetitors(brandId, customerId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching competitors:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch competitors'
    });
  }
});

/**
 * POST /brands/:brandId/competitors
 * Add a new competitor
 */
router.post('/:brandId/competitors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const userId = req.user!.id;
    const competitor = req.body;

    if (!brandId || !customerId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    if (!competitor.name) {
      res.status(400).json({
        success: false,
        error: 'Competitor name is required'
      });
      return;
    }

    const result = await competitorCrudService.addCompetitor(
      brandId,
      customerId,
      competitor,
      userId
    );

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error adding competitor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add competitor'
    });
  }
});

/**
 * DELETE /brands/:brandId/competitors/:competitorName
 * Remove a competitor
 */
router.delete('/:brandId/competitors/:competitorName', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId, competitorName } = req.params;
    const customerId = req.user!.customer_id;
    const userId = req.user!.id;

    if (!brandId || !customerId || !competitorName) {
      res.status(400).json({
        success: false,
        error: 'Brand ID, Customer ID, and Competitor Name are required'
      });
      return;
    }

    await competitorCrudService.removeCompetitor(
      brandId,
      customerId,
      decodeURIComponent(competitorName),
      userId
    );

    res.json({
      success: true,
      message: 'Competitor removed successfully'
    });
  } catch (error) {
    console.error('Error removing competitor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove competitor'
    });
  }
});

/**
 * PUT /brands/:brandId/competitors/:competitorName
 * Update a competitor
 */
router.put('/:brandId/competitors/:competitorName', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId, competitorName } = req.params;
    const customerId = req.user!.customer_id;
    const userId = req.user!.id;
    const updates = req.body;

    if (!brandId || !customerId || !competitorName) {
      res.status(400).json({
        success: false,
        error: 'Brand ID, Customer ID, and Competitor Name are required'
      });
      return;
    }

    const result = await competitorCrudService.updateCompetitor(
      brandId,
      customerId,
      decodeURIComponent(competitorName),
      updates,
      userId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update competitor'
    });
  }
});

/**
 * PUT /brands/:brandId/competitors
 * Bulk update competitors (for reordering, bulk operations)
 */
router.put('/:brandId/competitors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;
    const userId = req.user!.id;
    const { competitors, changeSummary } = req.body;

    if (!brandId || !customerId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    if (!Array.isArray(competitors)) {
      res.status(400).json({
        success: false,
        error: 'Competitors must be an array'
      });
      return;
    }

    const result = await competitorCrudService.bulkUpdateCompetitors(
      brandId,
      customerId,
      competitors,
      changeSummary,
      userId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error bulk updating competitors:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update competitors'
    });
  }
});

/**
 * GET /brands/:brandId/competitors/versions
 * Get version history for competitors
 */
router.get('/:brandId/competitors/versions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const customerId = req.user!.customer_id;

    if (!brandId || !customerId) {
      res.status(400).json({
        success: false,
        error: 'Brand ID and Customer ID are required'
      });
      return;
    }

    const result = await competitorVersioningService.getVersionHistory(brandId, customerId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching competitor version history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch version history'
    });
  }
});

/**
 * GET /brands/:brandId/competitors/:competitorName/sources
 * Get source attribution data for a specific competitor
 */
router.get('/:brandId/competitors/:competitorName/sources', authenticateToken, async (req: Request, res: Response) => {
  const requestStartTime = Date.now();
  const requestId = `req-comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`\n[CompetitorSourceAttribution API] 🚀 Request ${requestId} started at ${new Date().toISOString()}`);

    const { brandId, competitorName } = req.params;
    const customerId = req.user!.customer_id;
    const startQuery = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endQuery = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    console.log(`[CompetitorSourceAttribution API] 📊 Params: brandId=${brandId}, competitor=${competitorName}, customerId=${customerId}`);
    console.log(`[CompetitorSourceAttribution API] 📅 Date Range: startDate=${startQuery || 'default'}, endDate=${endQuery || 'default'}`);

    if (!brandId || !customerId || !competitorName) {
      res.status(400).json({
        success: false,
        error: 'Brand ID, Customer ID, and Competitor Name are required'
      });
      return;
    }

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

    const serviceStartTime = Date.now();
    console.log(`[CompetitorSourceAttribution API] ⏱️  Calling service.getCompetitorSourceAttribution()...`);

    const sourceData = await sourceAttributionService.getCompetitorSourceAttribution(
      brandId,
      customerId,
      decodeURIComponent(competitorName),
      dateRange
    );

    const serviceEndTime = Date.now();
    const serviceDuration = serviceEndTime - serviceStartTime;
    console.log(`[CompetitorSourceAttribution API] ✅ Service completed in ${serviceDuration}ms`);
    console.log(`[CompetitorSourceAttribution API] 📦 Response: ${sourceData.sources.length} sources, ${sourceData.totalSources} total`);

    res.json({ success: true, data: sourceData });

    const totalDuration = Date.now() - requestStartTime;
    console.log(`[CompetitorSourceAttribution API] ⏱️  Total request duration: ${totalDuration}ms`);
    console.log(`[CompetitorSourceAttribution API] ✅ Request ${requestId} completed successfully\n`);
  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`[CompetitorSourceAttribution API] ❌ Request ${requestId} failed after ${totalDuration}ms:`, error);

    if (error instanceof DatabaseError && error.message.toLowerCase().includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch competitor source attribution'
    });
  }
});

export default router;
