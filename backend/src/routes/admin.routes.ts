import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminAccess } from '../middleware/admin.middleware';
import { globalSettingsService } from '../services/global-settings.service';
import { customerEntitlementsService } from '../services/customer-entitlements.service';
import { authService } from '../services/auth/auth.service';
import { jobSchedulerService } from '../services/jobs/job-scheduler.service';
import { dataCollectionJobService } from '../services/jobs/data-collection-job.service';
import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = Router();

// Apply authentication and admin access to all routes
// TEMPORARY: Skip authentication for testing
// router.use(authenticateToken);
// router.use(requireAdminAccess);

// TEMPORARY: Mock admin middleware for testing
router.use((req, res, next) => {
  // Check if we have a real user from authentication
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    
    // If it's a mock token, extract the user ID
    if (token.startsWith('mock-jwt-token-for-')) {
      const userId = token.replace('mock-jwt-token-for-', '');
      
      // Get real user data from database
      authService.getUserProfile(userId).then(user => {
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            customer_id: user.customer_id,
            role: user.role,
            full_name: user.full_name
          };
        } else {
          // Fallback to mock data
          req.user = {
            id: 'temp-admin-user',
            email: 'admin@anvayalabs.com',
            customer_id: 'temp-customer-id'
          };
        }
        next();
      }).catch(() => {
        // Fallback to mock data on error
        req.user = {
          id: 'temp-admin-user',
          email: 'admin@anvayalabs.com',
          customer_id: 'temp-customer-id'
        };
        next();
      });
      return;
    }
  }
  
  // Fallback to mock data
  req.user = {
    id: 'temp-admin-user',
    email: 'admin@anvayalabs.com',
    customer_id: 'temp-customer-id'
  };
  next();
});

/**
 * GET /api/admin/health
 * Health check for admin API
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Admin API is healthy',
      timestamp: new Date().toISOString(),
      user: {
        id: req.user?.id,
        email: req.user?.email
      }
    });
  } catch (error) {
    console.error('Admin health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

// =====================================================
// Global Settings Routes
// =====================================================

/**
 * GET /api/admin/global-settings
 * Get all global settings
 */
router.get('/global-settings', async (req: Request, res: Response) => {
  try {
    const settings = await globalSettingsService.getGlobalSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching global settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch global settings'
    });
  }
});

/**
 * GET /api/admin/global-settings/:serviceName
 * Get specific global setting
 */
router.get('/global-settings/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const setting = await globalSettingsService.getGlobalSetting(serviceName);
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Global setting not found'
      });
    }
    
    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('Error fetching global setting:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch global setting'
    });
  }
});

/**
 * PUT /api/admin/global-settings/:serviceName
 * Update global setting
 */
router.put('/global-settings/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const updateData = req.body;
    
    // Validate required fields
    if (updateData.enabled_providers && !Array.isArray(updateData.enabled_providers)) {
      return res.status(400).json({
        success: false,
        error: 'enabled_providers must be an array'
      });
    }
    
    const updatedSetting = await globalSettingsService.updateGlobalSetting(serviceName, updateData);
    
    res.json({
      success: true,
      data: updatedSetting,
      message: 'Global setting updated successfully'
    });
  } catch (error) {
    console.error('Error updating global setting:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update global setting'
    });
  }
});

/**
 * POST /api/admin/global-settings
 * Create new global setting
 */
router.post('/global-settings', async (req: Request, res: Response) => {
  try {
    const settingData = req.body;
    
    // Validate required fields
    if (!settingData.service_name || !settingData.enabled_providers || !settingData.default_provider) {
      return res.status(400).json({
        success: false,
        error: 'service_name, enabled_providers, and default_provider are required'
      });
    }
    
    if (!Array.isArray(settingData.enabled_providers)) {
      return res.status(400).json({
        success: false,
        error: 'enabled_providers must be an array'
      });
    }
    
    const newSetting = await globalSettingsService.createGlobalSetting(settingData);
    
    res.status(201).json({
      success: true,
      data: newSetting,
      message: 'Global setting created successfully'
    });
  } catch (error) {
    console.error('Error creating global setting:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create global setting'
    });
  }
});

// =====================================================
// Customer Entitlements Routes
// =====================================================

/**
 * GET /api/admin/customers
 * Get all customers with their entitlements
 */
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const customers = await customerEntitlementsService.getAllCustomerEntitlements();
    
    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch customers'
    });
  }
});

/**
 * GET /api/admin/customers/:customerId/entitlements
 * Get customer entitlements
 */
router.get('/customers/:customerId/entitlements', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const customer = await customerEntitlementsService.getCustomerEntitlements(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer entitlements:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch customer entitlements'
    });
  }
});

/**
 * PUT /api/admin/customers/:customerId/entitlements
 * Update customer entitlements
 */
router.put('/customers/:customerId/entitlements', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const entitlements = req.body;
    
    // Validate entitlements
    const validationErrors = customerEntitlementsService.validateEntitlements(entitlements);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    const updatedCustomer = await customerEntitlementsService.updateCustomerEntitlements(
      customerId, 
      entitlements
    );
    
    res.json({
      success: true,
      data: updatedCustomer,
      message: 'Customer entitlements updated successfully'
    });
  } catch (error) {
    console.error('Error updating customer entitlements:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update customer entitlements'
    });
  }
});

/**
 * POST /api/admin/customers/:customerId/entitlements
 * Create default entitlements for customer
 */
router.post('/customers/:customerId/entitlements', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const customEntitlements = req.body;
    
    const updatedCustomer = await customerEntitlementsService.createCustomerEntitlements(
      customerId,
      customEntitlements
    );
    
    res.status(201).json({
      success: true,
      data: updatedCustomer,
      message: 'Customer entitlements created successfully'
    });
  } catch (error) {
    console.error('Error creating customer entitlements:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create customer entitlements'
    });
  }
});

/**
 * GET /api/admin/customers/:customerId/entitlements/defaults
 * Get default entitlements template
 */
router.get('/customers/:customerId/entitlements/defaults', async (req: Request, res: Response) => {
  try {
    const defaultEntitlements = customerEntitlementsService.getDefaultEntitlements();
    
    res.json({
      success: true,
      data: defaultEntitlements
    });
  } catch (error) {
    console.error('Error fetching default entitlements:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch default entitlements'
    });
  }
});

// =====================================================
// Scheduled Jobs Routes
// =====================================================

/**
 * GET /api/admin/scheduled-jobs
 * Get all scheduled jobs (optionally filtered by customer or brand)
 */
router.get('/scheduled-jobs', async (req: Request, res: Response) => {
  try {
    const { customer_id, brand_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id query parameter is required',
      });
    }

    const jobs = await jobSchedulerService.getScheduledJobs(
      customer_id as string,
      brand_id as string | undefined
    );

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('Error fetching scheduled jobs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch scheduled jobs',
    });
  }
});

/**
 * GET /api/admin/scheduled-jobs/:jobId
 * Get a specific scheduled job
 */
router.get('/scheduled-jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await jobSchedulerService.getScheduledJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled job not found',
      });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Error fetching scheduled job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch scheduled job',
    });
  }
});

/**
 * POST /api/admin/scheduled-jobs
 * Create a new scheduled job
 */
router.post('/scheduled-jobs', async (req: Request, res: Response) => {
  try {
    const {
      brand_id,
      customer_id,
      job_type,
      cron_expression,
      timezone,
      is_active,
      metadata,
    } = req.body;

    // Validation
    if (!brand_id || !customer_id || !job_type || !cron_expression) {
      return res.status(400).json({
        success: false,
        error: 'brand_id, customer_id, job_type, and cron_expression are required',
      });
    }

    if (!['data_collection', 'scoring', 'data_collection_and_scoring'].includes(job_type)) {
      return res.status(400).json({
        success: false,
        error: 'job_type must be one of: data_collection, scoring, data_collection_and_scoring',
      });
    }

    const createdBy = req.user?.id || null;

    const job = await jobSchedulerService.createScheduledJob({
      brand_id,
      customer_id,
      job_type,
      cron_expression,
      timezone,
      is_active,
      created_by: createdBy,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: job,
      message: 'Scheduled job created successfully',
    });
  } catch (error) {
    console.error('Error creating scheduled job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scheduled job',
    });
  }
});

/**
 * PUT /api/admin/scheduled-jobs/:jobId
 * Update a scheduled job
 */
router.put('/scheduled-jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { cron_expression, timezone, is_active, metadata } = req.body;

    const job = await jobSchedulerService.updateScheduledJob(jobId, {
      cron_expression,
      timezone,
      is_active,
      metadata,
    });

    res.json({
      success: true,
      data: job,
      message: 'Scheduled job updated successfully',
    });
  } catch (error) {
    console.error('Error updating scheduled job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update scheduled job',
    });
  }
});

/**
 * DELETE /api/admin/scheduled-jobs/:jobId
 * Delete a scheduled job
 */
router.delete('/scheduled-jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    await jobSchedulerService.deleteScheduledJob(jobId);

    res.json({
      success: true,
      message: 'Scheduled job deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting scheduled job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete scheduled job',
    });
  }
});

/**
 * POST /api/admin/scheduled-jobs/:jobId/trigger
 * Manually trigger a job run
 */
router.post('/scheduled-jobs/:jobId/trigger', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const runId = await jobSchedulerService.triggerJobRun(jobId);

    res.json({
      success: true,
      data: { run_id: runId },
      message: 'Job run triggered successfully',
    });
  } catch (error) {
    console.error('Error triggering job run:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger job run',
    });
  }
});

/**
 * GET /api/admin/job-runs
 * Get job run history (optionally filtered)
 */
router.get('/job-runs', async (req: Request, res: Response) => {
  try {
    const { customer_id, brand_id, scheduled_job_id, status, limit = 50 } = req.query;

    let query = supabase
      .from('job_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }

    if (brand_id) {
      query = query.eq('brand_id', brand_id);
    }

    if (scheduled_job_id) {
      query = query.eq('scheduled_job_id', scheduled_job_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching job runs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job runs',
    });
  }
});

/**
 * GET /api/admin/job-runs/:runId
 * Get a specific job run
 */
router.get('/job-runs/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const { data, error } = await supabase
      .from('job_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Job run not found',
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching job run:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job run',
    });
  }
});

/**
 * GET /api/admin/brands/:brandId/topics-queries
 * Get active topics and queries for a brand (from onboarding)
 */
router.get('/brands/:brandId/topics-queries', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id query parameter is required',
      });
    }

    const result = await dataCollectionJobService.getBrandTopicsAndQueries(
      brandId,
      customer_id as string
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching brand topics and queries:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch brand topics and queries',
    });
  }
});

/**
 * GET /api/admin/brands/:brandId/queries-diagnostic
 * Diagnostic endpoint to check queries and data for a brand
 */
router.get('/brands/:brandId/queries-diagnostic', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id query parameter is required',
      });
    }

    // Check brand exists
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, customer_id')
      .eq('id', brandId)
      .single();

    // Check all queries (active and inactive)
    const { data: allQueries, error: queriesError } = await supabase
      .from('generated_queries')
      .select('id, query_text, topic, is_active, created_at')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false });

    // Check active queries only
    const { data: activeQueries } = await supabase
      .from('generated_queries')
      .select('id')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .eq('is_active', true);

    // Check collector results
    const { data: collectorResults, error: resultsError } = await supabase
      .from('collector_results')
      .select('id, created_at')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      data: {
        brand: brand || null,
        brandError: brandError?.message || null,
        queries: {
          total: allQueries?.length || 0,
          active: activeQueries?.length || 0,
          inactive: (allQueries?.length || 0) - (activeQueries?.length || 0),
          list: allQueries || [],
          error: queriesError?.message || null,
        },
        collectorResults: {
          count: collectorResults?.length || 0,
          recent: collectorResults || [],
          error: resultsError?.message || null,
        },
        diagnostic: {
          hasBrand: !!brand,
          hasQueries: (allQueries?.length || 0) > 0,
          hasActiveQueries: (activeQueries?.length || 0) > 0,
          hasCollectorResults: (collectorResults?.length || 0) > 0,
          canCollectData: (activeQueries?.length || 0) > 0,
          canScore: (collectorResults?.length || 0) > 0,
        },
      },
    });
  } catch (error) {
    console.error('Error in diagnostic query:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run diagnostic',
    });
  }
});

/**
 * POST /api/admin/brands/:brandId/collect-data-now
 * Immediately trigger data collection for a brand (no schedule needed)
 */
router.post('/brands/:brandId/collect-data-now', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id, collectors, locale, country } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id is required',
      });
    }

    console.log(`[Admin] Immediate data collection requested for brand ${brandId}, customer ${customer_id}`);

    // Execute data collection immediately
    const result = await dataCollectionJobService.executeDataCollection(
      brandId,
      customer_id,
      {
        collectors,
        locale,
        country,
      }
    );

    res.json({
      success: true,
      data: result,
      message: 'Data collection started successfully',
    });
  } catch (error) {
    console.error('Error triggering immediate data collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger data collection',
    });
  }
});

/**
 * POST /api/admin/brands/:brandId/score-now
 * Immediately trigger scoring for a brand (no schedule needed)
 */
router.post('/brands/:brandId/score-now', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id, since, positionLimit, sentimentLimit, parallel } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id is required',
      });
    }

    console.log(`[Admin] Immediate scoring requested for brand ${brandId}`);

    // Import brand scoring service
    const { brandScoringService } = await import('../services/scoring/brand-scoring.orchestrator');

    // Execute scoring immediately
    const result = await brandScoringService.scoreBrand({
      brandId,
      customerId: customer_id,
      since,
      positionLimit,
      sentimentLimit,
      parallel: parallel || false,
    });

    res.json({
      success: true,
      data: result,
      message: 'Scoring completed successfully',
    });
  } catch (error) {
    console.error('Error triggering immediate scoring:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger scoring',
    });
  }
});

/**
 * POST /api/admin/brands/:brandId/collect-and-score-now
 * Immediately trigger data collection followed by scoring (no schedule needed)
 */
router.post('/brands/:brandId/collect-and-score-now', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id, collectors, locale, country, positionLimit, sentimentLimit, parallel } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id is required',
      });
    }

    console.log(`[Admin] Immediate data collection + scoring requested for brand ${brandId}, customer ${customer_id}`);

    const results: any = {
      dataCollection: null,
      scoring: null,
      errors: [],
    };

    // Step 1: Execute data collection
    try {
      console.log(`[Admin] Step 1: Starting data collection for brand ${brandId}, customer ${customer_id}...`);
      const collectionResult = await dataCollectionJobService.executeDataCollection(
        brandId,
        customer_id,
        {
          collectors,
          locale,
          country,
        }
      );
      results.dataCollection = collectionResult;
      console.log(`[Admin] Step 1: Data collection completed - ${collectionResult.queriesExecuted} queries executed`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Admin] Data collection failed:`, errorMsg);
      results.errors.push({ operation: 'data_collection', error: errorMsg });
    }

    // Step 2: Execute scoring (only if data collection succeeded or partially succeeded)
    if (results.dataCollection && results.dataCollection.successfulExecutions > 0) {
      try {
        console.log(`[Admin] Step 2: Starting scoring...`);
        const { brandScoringService } = await import('../services/scoring/brand-scoring.orchestrator');
        const scoringResult = await brandScoringService.scoreBrand({
          brandId,
          customerId: customer_id,
          positionLimit,
          sentimentLimit,
          parallel: parallel || false,
        });
        results.scoring = scoringResult;
        console.log(`[Admin] Step 2: Scoring completed - ${scoringResult.positionsProcessed} positions, ${scoringResult.sentimentsProcessed} sentiments`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Admin] Scoring failed:`, errorMsg);
        results.errors.push({ operation: 'scoring', error: errorMsg });
      }
    } else {
      console.warn(`[Admin] Skipping scoring - no successful data collection results`);
      results.errors.push({
        operation: 'scoring',
        error: 'Skipped: No successful data collection results to score',
      });
    }

    res.json({
      success: results.errors.length === 0 || (results.dataCollection && results.scoring),
      data: results,
      message: 'Data collection and scoring completed',
    });
  } catch (error) {
    console.error('Error triggering immediate data collection and scoring:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger data collection and scoring',
    });
  }
});

export default router;
