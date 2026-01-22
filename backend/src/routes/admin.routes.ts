import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminAccess } from '../middleware/admin.middleware';
import { globalSettingsService } from '../services/global-settings.service';
import { customerEntitlementsService } from '../services/customer-entitlements.service';
import { authService } from '../services/auth/auth.service';
import { jobSchedulerService } from '../services/jobs/job-scheduler.service';
import { dataCollectionJobService } from '../services/jobs/data-collection-job.service';
import type { DataCollectionJobResult } from '../services/jobs/data-collection-job.service';
import { brandProductEnrichmentService } from '../services/onboarding/brand-product-enrichment.service';
import { consolidatedScoringService } from '../services/scoring/consolidated-scoring.service';
import { backfillRawAnswerFromSnapshots } from '../scripts/backfill-raw-answer-from-snapshots';
import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = Router();
let isBackfillRawAnswerRunning = false;

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
 * POST /api/admin/brands/:brandId/refresh-products
 * Trigger LLM enrichment for brand synonyms and products
 * If brandId is 'bulk', it looks for customer_id in query and refreshes all brands
 */
router.post('/brands/:brandId/refresh-products', async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const { customer_id } = req.query;

  // Set up SSE for real-time logging
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (message: string) => {
    const data = JSON.stringify({ message, timestamp: new Date().toISOString() });
    res.write(`data: ${data}\n\n`);
  };

  try {
    if (brandId === 'bulk') {
      if (!customer_id) {
        throw new Error('customer_id is required for bulk refresh');
      }

      sendLog(`🚀 Starting bulk enrichment for active brands of customer ID: ${customer_id}`);

      // Fetch all active brands for this customer
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, name')
        .eq('customer_id', customer_id)
        .eq('status', 'active');

      if (brandsError) throw brandsError;
      if (!brands || brands.length === 0) {
        sendLog(`⚠️ No active brands found for customer ${customer_id}`);
      } else {
        sendLog(`📊 Found ${brands.length} brands to enrich`);

        for (const brand of brands) {
          sendLog(`-------------------------------------------`);
          sendLog(`🔄 Processing brand: ${brand.name} (${brand.id})`);
          try {
            await brandProductEnrichmentService.enrichBrand(brand.id, sendLog);
            sendLog(`✅ Successfully enriched ${brand.name}`);
          } catch (err) {
            sendLog(`❌ Failed to enrich ${brand.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } else {
      await brandProductEnrichmentService.enrichBrand(brandId, sendLog);
    }

    res.write(`data: ${JSON.stringify({ status: 'completed' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Brand product enrichment failed:', error);
    res.write(`data: ${JSON.stringify({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })}\n\n`);
    res.end();
  }
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
 * GET /api/admin/global-settings/consolidated-analysis/ollama
 * Get Ollama configuration for consolidated analysis
 */
router.get('/global-settings/consolidated-analysis/ollama', async (req: Request, res: Response) => {
  try {
    const { getOllamaConfigForUI } = await import('../services/scoring/ollama-client.service');
    const config = await getOllamaConfigForUI();

    if (!config) {
      // Return default values if not configured
      return res.json({
        success: true,
        data: {
          ollamaUrl: 'http://localhost:11434',
          ollamaModel: 'qwen2.5:latest',
          useOllama: false,
        }
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting Ollama config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Ollama configuration'
    });
  }
});

/**
 * GET /api/admin/global-settings/consolidated-analysis/ollama/health
 * Check Ollama API health/availability
 */
router.get('/global-settings/consolidated-analysis/ollama/health', async (req: Request, res: Response) => {
  try {
    const { checkOllamaHealth } = await import('../services/scoring/ollama-client.service');
    const health = await checkOllamaHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error checking Ollama health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check Ollama health'
    });
  }
});

/**
 * POST /api/admin/global-settings/consolidated-analysis/ollama/test
 * Test Ollama with a custom prompt
 */
router.post('/global-settings/consolidated-analysis/ollama/test', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'prompt is required and must be a string'
      });
    }

    const { testOllamaPrompt } = await import('../services/scoring/ollama-client.service');
    const result = await testOllamaPrompt(prompt);

    if (result.success) {
      res.json({
        success: true,
        data: {
          response: result.response,
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Test failed'
      });
    }
  } catch (error) {
    console.error('Error testing Ollama prompt:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test Ollama prompt'
    });
  }
});

/**
 * GET /api/admin/brands/:brandId/local-llm
 * Get brand-specific Ollama configuration
 */
router.get('/brands/:brandId/local-llm', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    if (!brandId) {
      return res.status(400).json({
        success: false,
        error: 'brandId is required'
      });
    }

    // Get brand with local_llm column
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('local_llm')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }

    // Return local_llm config or default values
    if (brand.local_llm && typeof brand.local_llm === 'object') {
      const config = brand.local_llm as any;
      return res.json({
        success: true,
        data: {
          ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
          ollamaModel: config.ollamaModel || 'qwen2.5:latest',
          useOllama: config.useOllama || false,
        }
      });
    }

    // Return default values if not configured
    res.json({
      success: true,
      data: {
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:latest',
        useOllama: false,
      }
    });
  } catch (error) {
    console.error('Error getting brand Ollama config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get brand Ollama configuration'
    });
  }
});

/**
 * PUT /api/admin/brands/:brandId/local-llm
 * Update brand-specific Ollama configuration
 */
router.put('/brands/:brandId/local-llm', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { ollamaUrl, ollamaModel, useOllama } = req.body;

    if (!brandId) {
      return res.status(400).json({
        success: false,
        error: 'brandId is required'
      });
    }

    // Validate inputs
    if (ollamaUrl && typeof ollamaUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ollamaUrl must be a string'
      });
    }

    if (ollamaModel && typeof ollamaModel !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ollamaModel must be a string'
      });
    }

    if (useOllama !== undefined && typeof useOllama !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'useOllama must be a boolean'
      });
    }

    // Validate URL format if provided
    if (ollamaUrl) {
      try {
        new URL(ollamaUrl);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format for ollamaUrl'
        });
      }
    }

    // Get existing brand to check if it exists
    const { data: existingBrand, error: fetchError } = await supabase
      .from('brands')
      .select('local_llm')
      .eq('id', brandId)
      .single();

    if (fetchError || !existingBrand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }

    // Build local_llm config
    const existingConfig = (existingBrand.local_llm as any) || {};
    const newConfig = {
      useOllama: useOllama !== undefined ? useOllama : (existingConfig.useOllama || false),
      ollamaUrl: ollamaUrl || existingConfig.ollamaUrl || 'http://localhost:11434',
      ollamaModel: ollamaModel || existingConfig.ollamaModel || 'qwen2.5:latest',
    };

    // If useOllama is false, set to null (clean up)
    const localLlmValue = newConfig.useOllama ? newConfig : null;

    // Update brand with new local_llm config
    const { error: updateError } = await supabase
      .from('brands')
      .update({ local_llm: localLlmValue })
      .eq('id', brandId);

    if (updateError) {
      throw new Error(`Failed to update brand: ${updateError.message}`);
    }

    res.json({
      success: true,
      data: {
        ollamaUrl: newConfig.ollamaUrl,
        ollamaModel: newConfig.ollamaModel,
        useOllama: newConfig.useOllama,
      },
      message: 'Brand Ollama configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating brand Ollama config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update brand Ollama configuration'
    });
  }
});

/**
 * GET /api/admin/brands/:brandId/local-llm/health
 * Check Ollama API health/availability for a specific brand
 */
router.get('/brands/:brandId/local-llm/health', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    if (!brandId) {
      return res.status(400).json({
        success: false,
        error: 'brandId is required'
      });
    }

    // Verify brand exists first
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }

    // Import and use brand-specific health check
    const { checkOllamaHealthForBrand } = await import('../services/scoring/ollama-client.service');
    const health = await checkOllamaHealthForBrand(brandId);

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error checking brand Ollama health:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check brand Ollama health';
    console.error('Error details:', error instanceof Error ? error.stack : error);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * POST /api/admin/brands/:brandId/local-llm/test
 * Test Ollama with a custom prompt for a specific brand
 */
router.post('/brands/:brandId/local-llm/test', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { prompt } = req.body;

    if (!brandId) {
      return res.status(400).json({
        success: false,
        error: 'brandId is required'
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'prompt is required and must be a string'
      });
    }

    const { testOllamaPromptForBrand } = await import('../services/scoring/ollama-client.service');
    const result = await testOllamaPromptForBrand(brandId, prompt);

    if (result.success) {
      res.json({
        success: true,
        data: {
          response: result.response,
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Test failed'
      });
    }
  } catch (error) {
    console.error('Error testing brand Ollama prompt:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test brand Ollama prompt'
    });
  }
});

/**
 * PUT /api/admin/global-settings/consolidated-analysis/ollama
 * Update Ollama configuration for consolidated analysis (DEPRECATED - use brand-specific endpoints)
 */
router.put('/global-settings/consolidated-analysis/ollama', async (req: Request, res: Response) => {
  try {
    const { ollamaUrl, ollamaModel, useOllama } = req.body;

    // Validate inputs
    if (ollamaUrl && typeof ollamaUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ollamaUrl must be a string'
      });
    }

    if (ollamaModel && typeof ollamaModel !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ollamaModel must be a string'
      });
    }

    if (useOllama !== undefined && typeof useOllama !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'useOllama must be a boolean'
      });
    }

    // Get existing setting or create default
    let setting = await globalSettingsService.getGlobalSetting('consolidated_analysis');

    const existingMetadata = setting?.metadata || {};

    // Compute the actual useOllama value (use provided value or fall back to existing/default)
    const computedUseOllama = useOllama !== undefined ? useOllama : (existingMetadata.useOllama || false);

    const newMetadata = {
      ...existingMetadata,
      ollamaUrl: ollamaUrl || existingMetadata.ollamaUrl || 'http://localhost:11434',
      ollamaModel: ollamaModel || existingMetadata.ollamaModel || 'qwen2.5:latest',
      useOllama: computedUseOllama,
      // Explicitly set provider values based on computed useOllama value
      // When disabling Ollama, reset to OpenRouter (don't preserve stale Ollama values)
      default_provider: computedUseOllama ? 'ollama' : 'openrouter',
      enabled_providers: computedUseOllama ? ['ollama'] : ['openrouter'],
    };

    if (!setting) {
      // Create new setting
      setting = await globalSettingsService.createGlobalSetting({
        service_name: 'consolidated_analysis',
        P1: null,
        P2: null,
        P3: null,
        P4: null,
        metadata: newMetadata,
      });
    } else {
      // Update existing setting
      setting = await globalSettingsService.updateGlobalSetting('consolidated_analysis', {
        metadata: newMetadata,
      });
    }

    res.json({
      success: true,
      data: {
        ollamaUrl: newMetadata.ollamaUrl,
        ollamaModel: newMetadata.ollamaModel,
        useOllama: newMetadata.useOllama,
      },
      message: 'Ollama configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating Ollama config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update Ollama configuration'
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
 * GET /api/admin/customers/:customerId/brands
 * Get all brands for a specific customer
 */
router.get('/customers/:customerId/brands', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    // Fetch brands for the customer - include metadata and homepage_url for logos
    const { data: brands, error } = await supabase
      .from('brands')
      .select('id, name, slug, customer_id, status, metadata, homepage_url')
      .eq('customer_id', customerId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching brands for customer:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to fetch brands: ${error.message}`
      });
    }

    res.json({
      success: true,
      data: brands || []
    });
  } catch (error) {
    console.error('Error fetching customer brands:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch customer brands'
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

    // Only set created_by if it's a valid UUID, otherwise set to null
    const userId = req.user?.id;
    const createdBy = userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;

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
 * POST /api/admin/scoring/backfill-from-cache
 * Backfill scoring for results that have cached analysis but are not marked as completed
 */
router.post('/scoring/backfill-from-cache', async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.body;

    console.log(`\n🔄 API Triggered: Backfilling scoring from cache (limit: ${limit})`);

    const result = await consolidatedScoringService.backfillScoringFromCache(limit);

    res.json({
      success: true,
      data: result,
      message: `Successfully processed ${result.processed} items from cache`
    });
  } catch (error) {
    console.error('Error in backfill-from-cache API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to backfill scoring from cache'
    });
  }
});

router.get('/scheduled-jobs/backfill-raw-answer-from-snapshots/stream', async (_req: Request, res: Response) => {
  if (isBackfillRawAnswerRunning) {
    res.status(409).json({
      success: false,
      error: 'Backfill is already running',
    });
    return;
  }

  isBackfillRawAnswerRunning = true;

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const maybeFlush = (res as any).flushHeaders;
  if (typeof maybeFlush === 'function') {
    maybeFlush.call(res);
  }

  const writeEvent = (event: string, payload: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  let clientClosed = false;
  res.on('close', () => {
    clientClosed = true;
  });

  writeEvent('start', { ok: true, ts: new Date().toISOString() });

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const formatArgs = (args: unknown[]) =>
    args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.stack || arg.message;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

  const forward = (level: 'log' | 'info' | 'warn' | 'error') => {
    return (...args: unknown[]) => {
      const message = formatArgs(args);
      if (!clientClosed) {
        writeEvent('log', { level, message, ts: new Date().toISOString() });
      }

      if (level === 'log') originalLog.apply(console, args as any);
      else if (level === 'info') originalInfo.apply(console, args as any);
      else if (level === 'warn') originalWarn.apply(console, args as any);
      else originalError.apply(console, args as any);
    };
  };

  console.log = forward('log') as any;
  console.info = forward('info') as any;
  console.warn = forward('warn') as any;
  console.error = forward('error') as any;

  try {
    await backfillRawAnswerFromSnapshots();
    writeEvent('done', { ok: true, ts: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeEvent('done', { ok: false, error: message, ts: new Date().toISOString() });
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    isBackfillRawAnswerRunning = false;
    res.end();
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
 * GET /api/admin/brands/:brandId/scoring-diagnostic
 * Get diagnostic info specifically for scoring
 */
router.get('/brands/:brandId/scoring-diagnostic', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id query parameter is required',
      });
    }

    // 1. Get count of results to be scored
    const { count: pendingScoringCount, error: pendingError } = await supabase
      .from('collector_results')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .neq('status', 'failed')
      .not('status', 'eq', 'running')
      .or('scoring_status.is.null,scoring_status.neq.completed');

    // 2. Get last scoring date from consolidated_analysis_cache
    // We need to join with collector_results to filter by brand
    const { data: lastScored, error: lastScoredError } = await supabase
      .from('consolidated_analysis_cache')
      .select('created_at, collector_results!inner(brand_id)')
      .eq('collector_results.brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) throw pendingError;

    res.json({
      success: true,
      data: {
        pendingScoringCount: pendingScoringCount || 0,
        lastScoredAt: lastScored?.created_at || null,
      }
    });
  } catch (error) {
    console.error('Error in scoring diagnostic:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scoring diagnostic',
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
      .select('id, created_at, status')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .limit(100);

    const statusCounts: Record<string, number> = {};
    const nowMs = Date.now();
    const pendingOver2h: number[] = [];
    const pendingOver8h: number[] = [];

    (collectorResults || []).forEach((r: any) => {
      const status = r.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if ((status === 'pending' || status === 'running') && r.created_at) {
        const ageMs = nowMs - new Date(r.created_at).getTime();
        if (ageMs >= 8 * 60 * 60 * 1000) {
          pendingOver8h.push(r.id);
        } else if (ageMs >= 2 * 60 * 60 * 1000) {
          pendingOver2h.push(r.id);
        }
      }
    });

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
          statusCounts,
          pendingOver2hCount: pendingOver2h.length,
          pendingOver8hCount: pendingOver8h.length,
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
 * GET /api/admin/collector-results
 * List collector_results across brands with filters for admin monitoring
 */
router.get('/collector-results', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      brand_id,
      collector,
      from,
      to,
      scoring_status,
      collection_status,
      raw_answer,
      limit,
      offset,
    } = req.query;

    if (!customer_id || typeof customer_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'customer_id query parameter is required',
      });
    }

    const parsedLimit = Math.min(Math.max(Number(limit ?? 100), 1), 500);
    const parsedOffset = Math.max(Number(offset ?? 0), 0);

    const selectColumns =
      'id, brand_id, collector_type, status, scoring_status, raw_answer, created_at, scoring_error, error_message';

    let query = supabase
      .from('collector_results')
      .select(selectColumns, { count: 'exact' })
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    if (brand_id && typeof brand_id === 'string') {
      query = query.eq('brand_id', brand_id);
    }

    if (collector && typeof collector === 'string') {
      const collectorMap: Record<string, string> = {
        'chatgpt': 'ChatGPT',
        'google_aio': 'Google AIO',
        'perplexity': 'Perplexity',
        'claude': 'Claude',
        'gemini': 'Gemini',
        'bing_copilot': 'Bing Copilot',
        'grok': 'Grok',
        'deepseek': 'DeepSeek',
        'mistral': 'Mistral'
      };
      const dbCollector = collectorMap[collector] || collector;
      query = query.eq('collector_type', dbCollector);
    }

    if (scoring_status && typeof scoring_status === 'string') {
      if (scoring_status === 'null') {
        query = query.is('scoring_status', null);
      } else {
        query = query.eq('scoring_status', scoring_status);
      }
    }

    if (collection_status && typeof collection_status === 'string') {
      query = query.eq('status', collection_status);
    }

    if (raw_answer === 'missing') {
      query = query.is('raw_answer', null);
    } else if (raw_answer === 'present') {
      query = query.not('raw_answer', 'is', null);
    }

    if (from && typeof from === 'string') {
      const fromIso = from.includes('T') ? from : new Date(`${from}T00:00:00.000Z`).toISOString();
      query = query.gte('created_at', fromIso);
    }

    if (to && typeof to === 'string') {
      const toIso = to.includes('T') ? to : new Date(`${to}T23:59:59.999Z`).toISOString();
      query = query.lte('created_at', toIso);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const brandIds = Array.from(
      new Set((rows || []).map((r: any) => r.brand_id).filter(Boolean))
    ) as string[];

    let brandsById: Record<string, { id: string; name: string }> = {};
    if (brandIds.length > 0) {
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, name')
        .in('id', brandIds);

      if (!brandsError && brands) {
        brandsById = brands.reduce((acc: any, b: any) => {
          if (b?.id) acc[b.id] = { id: b.id, name: b.name };
          return acc;
        }, {});
      }
    }

    const enrichedRows = (rows || []).map((r: any) => ({
      id: r.id != null ? String(r.id) : '', // Convert BigInt to string
      brandId: r.brand_id,
      brandName: brandsById?.[r.brand_id]?.name || null,
      collectorType: r.collector_type,
      status: r.status,
      scoringStatus: r.scoring_status,
      rawAnswerPresent: r.raw_answer !== null && r.raw_answer !== undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      errorMessage: r.error_message ?? null,
      scoringError:
        typeof r.scoring_error === 'string'
          ? r.scoring_error
          : r.scoring_error
            ? JSON.stringify(r.scoring_error, null, 2)
            : null,
    }));

    res.json({
      success: true,
      data: {
        rows: enrichedRows,
        total: count ?? 0,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error) {
    console.error('Error listing collector results:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list collector results',
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

    // Determine which collectors to use
    let collectorsToUse = collectors;

    // If collectors not explicitly provided, fetch brand's selected collectors from onboarding
    if (!collectorsToUse || collectorsToUse.length === 0) {
      try {
        const { data: brand, error: brandError } = await supabase
          .from('brands')
          .select('metadata')
          .eq('id', brandId)
          .single();

        if (brandError) {
          console.warn(`[Admin] Failed to fetch brand ai_models: ${brandError.message}, using default collectors`);
        } else {
          const metadata =
            typeof brand === 'object' && brand !== null && 'metadata' in brand
              ? (brand as { metadata?: unknown }).metadata
              : undefined;
          const metadataHasAiModelsKey =
            typeof metadata === 'object' &&
            metadata !== null &&
            Object.prototype.hasOwnProperty.call(metadata, 'ai_models');

          const aiModelsValue =
            typeof metadata === 'object' && metadata !== null && 'ai_models' in metadata
              ? (metadata as { ai_models?: unknown }).ai_models
              : undefined;

          const rawAiModels = Array.isArray(aiModelsValue)
            ? aiModelsValue.filter((value): value is string => typeof value === 'string')
            : undefined;

          if (Array.isArray(rawAiModels) && rawAiModels.length > 0) {
            collectorsToUse = mapAIModelsToCollectors(rawAiModels);
            console.log(`[Admin] Using brand's selected collectors: ${collectorsToUse.join(', ')} (from ai_models: ${rawAiModels.join(', ')})`);
          } else if (metadataHasAiModelsKey) {
            collectorsToUse = [];
            console.log(`[Admin] Brand ${brandId} has an explicit empty collectors selection`);
          } else {
            console.log(`[Admin] Brand has no ai_models selected, using default collectors`);
          }
        }
      } catch (error) {
        console.warn(`[Admin] Error fetching brand ai_models: ${error instanceof Error ? error.message : String(error)}, using default collectors`);
      }
    } else {
      console.log(`[Admin] Using explicitly provided collectors: ${collectorsToUse.join(', ')}`);
    }

    const { executeAdhocDataCollection } = await import('../services/data-collection/adhoc_data_collector');
    const result = await executeAdhocDataCollection(brandId, customer_id, {
      collectors: collectorsToUse,
      locale,
      country,
    });

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
 * Returns immediately and runs the work in the background to avoid timeout issues
 * (especially important when using Ollama which processes sequentially and can take longer)
 */
router.post('/brands/:brandId/score-now', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { customer_id, since, positionLimit, sentimentLimit, parallel } = req.body;

    // Validate required parameters
    if (!brandId) {
      return res.status(400).json({
        success: false,
        error: 'brandId is required in URL parameters',
      });
    }

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'customer_id is required in request body',
      });
    }

    console.log(`[Admin] Immediate scoring requested for brand ${brandId}, customer ${customer_id}`);

    // Return immediately to avoid timeout (especially important with Ollama which is slower)
    res.json({
      success: true,
      message: 'Scoring started in background. This process may take 5-30 minutes depending on the number of results and whether Ollama is enabled. Check job run history for progress.',
      data: {
        brandId,
        status: 'started',
        startedAt: new Date().toISOString(),
      },
    });

    // Run the scoring in the background (don't await - let it run asynchronously)
    setImmediate(async () => {
      try {
        console.log(`[Admin] Starting background scoring for brand ${brandId}...`);

        // Import brand scoring service
        const { brandScoringService } = await import('../services/scoring/brand-scoring.orchestrator');

        // Execute scoring
        const result = await brandScoringService.scoreBrand({
          brandId,
          customerId: customer_id,
          since,
          positionLimit,
          sentimentLimit,
          parallel: parallel || false,
        });

        console.log(`[Admin] Background scoring completed for brand ${brandId}:`, {
          positionsProcessed: result.positionsProcessed,
          sentimentsProcessed: result.sentimentsProcessed,
          citationsProcessed: result.citationsProcessed,
          errors: result.errors.length,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Admin] Background scoring failed for brand ${brandId}:`, errorMsg);
      }
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
 * Helper function to map AI model names to collector names
 * Matches the logic in brand.service.ts
 */
function mapAIModelsToCollectors(aiModels: string[]): string[] {
  if (!aiModels || aiModels.length === 0) {
    // Default to common collectors if none selected
    return ['chatgpt', 'google_aio', 'perplexity', 'claude'];
  }

  const modelToCollectorMap: Record<string, string> = {
    'chatgpt': 'chatgpt',
    'openai': 'chatgpt',
    'gpt-4': 'chatgpt',
    'gpt-3.5': 'chatgpt',
    'google_aio': 'google_aio',
    'google-ai': 'google_aio',
    'google': 'google_aio',
    'perplexity': 'perplexity',
    'claude': 'claude',
    'anthropic': 'claude',
    'deepseek': 'deepseek',
    'baidu': 'baidu',
    'bing': 'bing',
    'bing_copilot': 'bing_copilot',
    'copilot': 'bing_copilot',
    'microsoft-copilot': 'bing_copilot',
    'gemini': 'gemini',
    'google-gemini': 'gemini',
    'grok': 'grok',
    'x-ai': 'grok',
    'mistral': 'mistral'
  };

  const collectors = aiModels
    .map(model => {
      const normalizedModel = model.toLowerCase().trim();
      return modelToCollectorMap[normalizedModel] || null;
    })
    .filter((collector): collector is string => collector !== null);

  // Remove duplicates
  return [...new Set(collectors)];
}

/**
 * POST /api/admin/brands/:brandId/collect-and-score-now
 * Immediately trigger data collection followed by scoring (no schedule needed)
 * Returns immediately and runs the work in the background to avoid timeout issues
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

    // Return immediately to avoid timeout
    res.json({
      success: true,
      message: 'Data collection and scoring started in background. This process may take 10-30 minutes. Check job run history for progress.',
      data: {
        brandId,
        status: 'started',
        startedAt: new Date().toISOString(),
      },
    });

    // Run the work in the background (don't await - let it run asynchronously)
    setImmediate(async () => {
      const results: {
        dataCollection: DataCollectionJobResult | null;
        scoring: unknown;
        errors: Array<{ operation: string; error: string }>;
      } = {
        dataCollection: null,
        scoring: null,
        errors: [],
      };

      try {
        // Ensure brand enrichment (synonyms/products) exists before data collection
        // This is critical for scoring accuracy
        try {
          const hasEnrichment = await brandProductEnrichmentService.hasEnrichment(brandId);
          if (!hasEnrichment) {
            console.log(`[Admin] ⚠️ Enrichment missing for brand ${brandId}. Running enrichment now...`);
            await brandProductEnrichmentService.enrichBrand(brandId, (msg) => console.log(`[Admin-LazyEnrichment] ${msg}`));
          }
        } catch (enrichError) {
          console.warn(`[Admin] ⚠️ Lazy enrichment failed, proceeding anyway:`, enrichError);
        }

        // Step 1: Determine which collectors to use
        let collectorsToUse = collectors;

        // If collectors not explicitly provided, fetch brand's selected collectors from onboarding
        if (!collectorsToUse || collectorsToUse.length === 0) {
          try {
            const { data: brand, error: brandError } = await supabase
              .from('brands')
              .select('metadata')
              .eq('id', brandId)
              .single();

            if (brandError) {
              console.warn(`[Admin] Failed to fetch brand ai_models: ${brandError.message}, using default collectors`);
            } else {
              const metadata =
                typeof brand === 'object' && brand !== null && 'metadata' in brand
                  ? (brand as { metadata?: unknown }).metadata
                  : undefined;
              const metadataHasAiModelsKey =
                typeof metadata === 'object' &&
                metadata !== null &&
                Object.prototype.hasOwnProperty.call(metadata, 'ai_models');

              const aiModelsValue =
                typeof metadata === 'object' && metadata !== null && 'ai_models' in metadata
                  ? (metadata as { ai_models?: unknown }).ai_models
                  : undefined;

              const rawAiModels = Array.isArray(aiModelsValue)
                ? aiModelsValue.filter((value): value is string => typeof value === 'string')
                : undefined;

              if (Array.isArray(rawAiModels) && rawAiModels.length > 0) {
                collectorsToUse = mapAIModelsToCollectors(rawAiModels);
                console.log(`[Admin] Using brand's selected collectors: ${collectorsToUse.join(', ')} (from ai_models: ${rawAiModels.join(', ')})`);
              } else if (metadataHasAiModelsKey) {
                collectorsToUse = [];
                console.log(`[Admin] Brand ${brandId} has an explicit empty collectors selection`);
              } else {
                console.log(`[Admin] Brand has no ai_models selected, using default collectors`);
              }
            }
          } catch (error) {
            console.warn(`[Admin] Error fetching brand ai_models: ${error instanceof Error ? error.message : String(error)}, using default collectors`);
          }
        } else {
          console.log(`[Admin] Using explicitly provided collectors: ${collectorsToUse.join(', ')}`);
        }

        // Step 2: Execute data collection
        try {
          console.log(`[Admin] Step 1: Starting data collection for brand ${brandId}, customer ${customer_id}...`);
          const collectionResult = await dataCollectionJobService.executeDataCollection(
            brandId,
            customer_id,
            {
              collectors: collectorsToUse,
              locale,
              country,
              suppressScoring: true,
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

        console.log(`[Admin] Background job completed for brand ${brandId}:`, {
          dataCollection: results.dataCollection ? 'completed' : 'failed',
          scoring: results.scoring ? 'completed' : 'skipped/failed',
          errors: results.errors.length,
        });
      } catch (error) {
        console.error(`[Admin] Background job error for brand ${brandId}:`, error);
      }
    });
  } catch (error) {
    console.error('Error triggering immediate data collection and scoring:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger data collection and scoring',
    });
  }
});

/**
 * POST /api/admin/brands/:brandId/backfill-scoring
 * Trigger scoring backfill for a specific brand and time period
 */
router.post('/brands/:brandId/backfill-scoring', async (req: Request, res: Response) => {
  const { brandId } = req.params;
  const { startDate, endDate, force, preserveDates } = req.body;
  const { customer_id } = req.user as any; // Assuming auth middleware populates this, or pass from body if admin

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  // Set up SSE for real-time logging
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (message: string) => {
    const data = JSON.stringify({ message, timestamp: new Date().toISOString() });
    res.write(`data: ${data}\n\n`);
  };

  try {
    // Always fetch customer_id from the brand directly - more reliable for admin operations
    // The user's customer_id might be a placeholder or incorrect for multi-tenant scenarios
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('customer_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand?.customer_id) {
      throw new Error(`Customer ID not found for brand ${brandId}`);
    }

    const targetCustomerId = brand.customer_id;

    // Dynamic import to avoid circular dependencies if any
    const { brandScoringService } = await import('../services/scoring/brand-scoring.orchestrator');

    const result = await brandScoringService.backfillBrand({
      brandId,
      customerId: targetCustomerId,
      startDate,
      endDate,
      force: force === true, // Explicit boolean conversion
      preserveDates: preserveDates !== false, // Default true
      sendLog
    });

    sendLog(`\n✨ Backfill complete!`);
    sendLog(`Processed: ${result.processed}`);
    sendLog(`Errors: ${result.errorCount}`);

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in backfill scoring:', error);
    sendLog(`❌ Critical error: ${errorMsg}`);
    res.write(`data: [ERROR]\n\n`);
    res.end();
  }
});

export default router;
