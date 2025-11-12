import { Router, Request, Response } from 'express';
import { brandService } from '../services/brand.service';
import { brandDashboardService } from '../services/brand-dashboard.service';
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

    console.log(`[Dashboard Route] brandId=${brandId}, customerId=${customerId}, user=${req.user?.email}`);

    if (!brandId) {
      res.status(400).json({ success: false, error: 'Brand ID is required' });
      return;
    }

    const dashboard = await brandDashboardService.getBrandDashboard(brandId, customerId);

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
 * GET /brands/:id/topics
 * Get AEO topics for a specific brand
 */
router.get('/:id/topics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.customer_id;
    
    console.log(`🎯 Fetching AEO topics for brand ${id}, customer ${customerId}`);
    
    const topics = await brandService.getBrandTopics(id, customerId);
    
    res.json({
      success: true,
      data: topics
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

export default router;
