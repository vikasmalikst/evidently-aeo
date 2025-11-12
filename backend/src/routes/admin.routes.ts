import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminAccess } from '../middleware/admin.middleware';
import { globalSettingsService } from '../services/global-settings.service';
import { customerEntitlementsService } from '../services/customer-entitlements.service';
import { authService } from '../services/auth/auth.service';

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

export default router;
