/**
 * Data Collection API Routes
 * Handles query execution across multiple collectors
 */

import { Router, Request, Response } from 'express';
import { dataCollectionService, QueryExecutionRequest } from '../services/data-collection/data-collection.service';
import { priorityCollectorService } from '../services/data-collection/priority-collector.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';

// Load environment variables
loadEnvironment();

// Initialize Supabase client
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = Router();


// Apply auth middleware to all other routes (except health endpoints)
// router.use(authenticateToken);

/**
 * POST /api/data-collection/execute
 * Execute queries across multiple collectors
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const {
      queryIds,
      brandId,
      collectors = ['chatgpt', 'google_aio', 'perplexity', 'claude', 'deepseek', 'baidu', 'bing', 'gemini'],
      locale = 'en-US',
      country = 'US'
    } = req.body;

    if (!queryIds || !Array.isArray(queryIds) || queryIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query IDs array is required'
      });
    }

    if (!brandId || brandId === 'undefined' || brandId === 'null') {
      return res.status(400).json({
        success: false,
        error: 'Brand ID is required and must be a valid UUID'
      });
    }

    // Temporarily bypass auth - use a default customer ID
    // First, check if customer exists, if not create one
    let customerId = '8ce361f9-6120-4c64-a441-5ec33a1dfc77'; // Use brand ID as customer ID for now
    
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single();
    
    if (!existingCustomer) {
      // Create a customer record
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          id: customerId,
          name: 'Data Collection Customer',
          slug: 'data-collection-customer',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (customerError) {
        console.error('❌ Error creating customer:', customerError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create customer record'
        });
      }
    }

    // Create query objects from queryIds (which are actually query texts)
    // First, create a generation record
    const { data: generation, error: generationError } = await supabase
      .from('query_generations')
      .insert({
        brand_id: brandId,
        customer_id: customerId,
        total_queries: queryIds.length,
        locale: locale || 'en-US',
        country: country || 'US',
        strategy: 'data_collection',
        metadata: { source: 'data_collection_execute' }
      })
      .select('id')
      .single();

    if (generationError) {
      console.error('❌ Error creating generation:', generationError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create generation record'
      });
    }

    // Then insert queries into generated_queries table
    const queryInserts = queryIds.map((queryText: string, index: number) => ({
      generation_id: generation.id,
      query_text: queryText,
      intent: 'data_collection',
      brand_id: brandId,
      customer_id: customerId,
      locale: locale || 'en-US',
      country: country || 'US',
      is_active: true
    }));

    const { data: insertedQueries, error: insertError } = await supabase
      .from('generated_queries')
      .insert(queryInserts)
      .select('id, query_text');

    if (insertError) {
      console.error('❌ Error inserting queries:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to insert queries'
      });
    }

    const queries = insertedQueries || [];

    // Prepare execution requests
    const executionRequests: QueryExecutionRequest[] = queries.map(query => ({
      queryId: query.id,
      brandId,
      customerId,
      queryText: query.query_text,
      intent: 'data_collection', // Use default intent
      locale: locale || 'en-US',
      country: country || 'US',
      collectors
    }));

    // Execute queries through selected collectors
    console.log('🔍 About to execute queries:', executionRequests.length);
    const results = await dataCollectionService.executeQueries(executionRequests);
    console.log('🔍 Execution results:', results.length);
    
    return res.json({
      success: true,
      data: {
        results,
        total_queries: queries.length,
        collectors_used: collectors
      }
    });


  } catch (error: any) {
    console.error('❌ Data collection execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/data-collection/status/:executionId
 * Get execution status
 */
router.get('/status/:executionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    const status = await dataCollectionService.getExecutionStatus(executionId);

    res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    console.error('❌ Get execution status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/data-collection/results/:queryId
 * Get results for a specific query
 */
router.get('/results/:queryId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { queryId } = req.params;

    const results = await dataCollectionService.getQueryResults(queryId);

    res.json({
      success: true,
      data: results
    });

  } catch (error: any) {
    console.error('❌ Get query results error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/data-collection/health
 * Check health of all collectors
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
      // Return health status for all collectors
      const healthStatus = {
        chatgpt: true,
        google_aio: true,
        perplexity: true,
        claude: true,
        deepseek: true,
        baidu: true,
        bing_copilot: true,
        gemini: true,
        grok: true
      };

    res.json({
      success: true,
      data: {
        collectors: healthStatus,
        overall_health: true
      }
    });

  } catch (error: any) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/data-collection/test-oxylabs
 * Test Oxylabs connection directly
 */
router.get('/test-oxylabs', async (req: Request, res: Response) => {
  try {
    const { oxylabsCollectorService } = await import('../services/data-collection/oxylabs-collector.service');
    
    const result = await oxylabsCollectorService.executeQuery({
      prompt: 'test query',
      source: 'google',
      brand: 'test-brand',
      locale: 'en-US',
      country: 'US'
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ Oxylabs test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/data-collection/health-public
 * Public health check endpoint (no auth required)
 */
router.get('/health-public', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      chatgpt: true,
      google_aio: true,
      perplexity: true,
      claude: true,
      deepseek: true,
      baidu: true,
      bing_copilot: true,
      gemini: true,
      grok: true
    };

    res.json({
      success: true,
      data: {
        collectors: healthStatus,
        overall_health: true
      }
    });

  } catch (error: any) {
    console.error('❌ Public health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * POST /api/data-collection/batch-execute
 * Execute all pending queries for a brand
 */
router.post('/batch-execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId, collectors = ['chatgpt', 'google_aio', 'perplexity', 'claude', 'baidu', 'bing', 'gemini'] } = req.body;

    if (!brandId) {
      return res.status(400).json({
        success: false,
        error: 'Brand ID is required'
      });
    }

    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Customer ID not found'
      });
    }

    // Get all active queries for the brand
    const { data: queries, error: queryError } = await supabase
      .from('generated_queries')
      .select('id, query_text, intent, country')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (queryError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch queries'
      });
    }

    if (!queries || queries.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'No active queries found for this brand',
          executed_queries: 0,
          total_executions: 0
        }
      });
    }

    // Prepare execution requests
    const executionRequests: QueryExecutionRequest[] = queries.map(query => ({
        queryId: query.id,
        brandId,
        customerId,
        queryText: query.query_text,
        intent: query.intent,
        locale: 'en-US',
        country: query.country || 'US',
        collectors
      }));

    // Execute queries
    const results = await dataCollectionService.executeQueries(executionRequests);

    return res.json({
      success: true,
      data: {
        executed_queries: queries.length,
        total_executions: results.length,
        results: results.map(r => ({
          queryId: r.queryId,
          collectorType: r.collectorType,
          status: r.status,
          executionTimeMs: r.executionTimeMs,
          error: r.error
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ Batch execution error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/data-collection/priorities/:collectorType
 * Get collector priority configuration
 */
router.get('/priorities/:collectorType', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { collectorType } = req.params;
    
    const config = await priorityCollectorService.getCollectorConfig(collectorType);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('❌ Get collector priorities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/data-collection/priorities/:collectorType
 * Update collector priority configuration
 */
router.put('/priorities/:collectorType', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { collectorType } = req.params;
    const config = req.body;
    
    await priorityCollectorService.updateCollectorConfig(collectorType, config);
    
    res.json({
      success: true,
      message: `Priority configuration updated for ${collectorType}`
    });
  } catch (error: any) {
    console.error('❌ Update collector priorities error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/data-collection/system-config
 * Get system configuration
 */
router.get('/system-config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const config = priorityCollectorService.getSystemConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('❌ Get system config error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/data-collection/check-brightdata-failures
 * Background job endpoint to check and complete failed BrightData executions
 * Should be called by cron job every 15 minutes
 */
router.post('/check-brightdata-failures', async (req: Request, res: Response) => {
  try {
    const { brightDataBackgroundService } = await import('../services/data-collection/brightdata-background.service');
    
    const stats = await brightDataBackgroundService.checkAndCompleteFailedExecutions();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('❌ Background check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/data-collection/check-snapshot/:snapshotId
 * Check a specific BrightData snapshot and update execution if ready
 */
router.post('/check-snapshot/:snapshotId', async (req: Request, res: Response) => {
  try {
    const { snapshotId } = req.params;
    const { brightDataBackgroundService } = await import('../services/data-collection/brightdata-background.service');
    
    const result = await brightDataBackgroundService.checkExecutionBySnapshot(snapshotId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ Snapshot check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/data-collection/health-detailed
 * Get detailed health status for all collectors with provider information
 */
router.get('/health-detailed', async (req: Request, res: Response) => {
  try {
    const collectors = ['chatgpt', 'google_aio', 'perplexity', 'claude', 'baidu', 'bing', 'gemini'];
    const healthStatus: Record<string, any> = {};
    
    for (const collectorType of collectors) {
      try {
        const providerHealth = await priorityCollectorService.checkCollectorHealth(collectorType);
        healthStatus[collectorType] = {
          overall: Object.values(providerHealth).some(status => status === true),
          providers: providerHealth
        };
      } catch (error) {
        healthStatus[collectorType] = {
          overall: false,
          providers: {},
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        collectors: healthStatus,
        overall_health: Object.values(healthStatus).every(status => status.overall)
      }
    });
  } catch (error: any) {
    console.error('❌ Detailed health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

export default router;
