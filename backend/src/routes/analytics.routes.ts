import { Router, Request, Response } from 'express';
import { ga4AnalyticsService } from '../services/ga4-analytics.service';

const router = Router();

/**
 * POST /api/brands/:brandId/analytics/credentials
 * Save GA4 credentials for a brand
 */
router.post(
  '/:brandId/analytics/credentials',
  async (req: Request, res: Response) => {
    console.log('📝 POST /api/brands/:brandId/analytics/credentials - Route hit');
    console.log('   Brand ID:', req.params.brandId);
    console.log('   Body keys:', Object.keys(req.body || {}));
    try {
      const { brandId } = req.params;
      const { 
        customer_id, 
        property_id, 
        service_account_key,
        auth_type = 'service_account',
        bearer_token,
        project_id
      } = req.body;

      if (!brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID is required',
        });
        return;
      }

      if (!customer_id || !property_id) {
        res.status(400).json({
          success: false,
          error: 'customer_id and property_id are required',
        });
        return;
      }

      // Validate auth type
      if (!['service_account', 'gcloud', 'bearer_token'].includes(auth_type)) {
        res.status(400).json({
          success: false,
          error: 'Invalid auth_type. Must be one of: service_account, gcloud, bearer_token',
        });
        return;
      }

      // Validate required fields based on auth type
      if (auth_type === 'service_account' && !service_account_key) {
        res.status(400).json({
          success: false,
          error: 'service_account_key is required when auth_type is "service_account"',
        });
        return;
      }

      if (auth_type === 'bearer_token' && !bearer_token) {
        res.status(400).json({
          success: false,
          error: 'bearer_token is required when auth_type is "bearer_token"',
        });
        return;
      }

      if (auth_type === 'gcloud' && !project_id) {
        res.status(400).json({
          success: false,
          error: 'project_id is required when auth_type is "gcloud"',
        });
        return;
      }

      // Only validate service account key if auth_type is service_account
      let parsedKey = service_account_key;
      if (auth_type === 'service_account') {
        // Handle case where service_account_key might be a string (double JSON encoding)
        if (typeof service_account_key === 'string') {
          try {
            parsedKey = JSON.parse(service_account_key);
          } catch (err) {
            res.status(400).json({
              success: false,
              error: 'service_account_key is invalid JSON. Please ensure it is a valid JSON object or string.',
            });
            return;
          }
        }

        // Validate service account key structure
        if (typeof parsedKey !== 'object' || parsedKey === null || Array.isArray(parsedKey)) {
          res.status(400).json({
            success: false,
            error: 'service_account_key must be a JSON object',
            details: 'The service account key should be a valid JSON object, not a string or array.',
          });
          return;
        }

        // Check for required fields
        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = requiredFields.filter(field => !parsedKey[field]);

        if (missingFields.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid service account key format',
            details: `Missing required fields: ${missingFields.join(', ')}`,
            requiredFields: ['type', 'project_id', 'private_key', 'client_email', 'private_key_id', 'auth_uri', 'token_uri'],
          });
          return;
        }

        // Validate type
        if (parsedKey.type !== 'service_account') {
          res.status(400).json({
            success: false,
            error: 'Invalid service account type',
            details: `Expected type "service_account", got "${parsedKey.type}"`,
          });
          return;
        }

        // Validate private key format
        if (typeof parsedKey.private_key !== 'string' || !parsedKey.private_key.includes('BEGIN PRIVATE KEY')) {
          res.status(400).json({
            success: false,
            error: 'Invalid private key format',
            details: 'The private_key field must contain a valid PEM-encoded private key starting with "-----BEGIN PRIVATE KEY-----"',
          });
          return;
        }

        // Fix private key newlines if they are escaped (common when JSON is stringified)
        if (parsedKey.private_key.includes('\\n')) {
          parsedKey.private_key = parsedKey.private_key.replace(/\\n/g, '\n');
        }

        // Ensure private key ends with newline if it doesn't already
        if (!parsedKey.private_key.endsWith('\n')) {
          parsedKey.private_key += '\n';
        }
      }

      try {
        await ga4AnalyticsService.saveCredentials(
          brandId,
          customer_id,
          property_id,
          parsedKey,
          auth_type,
          bearer_token,
          project_id
        );

        res.status(201).json({
          success: true,
          message: 'GA4 configuration saved',
          propertyId: property_id,
        });
      } catch (serviceError) {
        console.error('Error in saveCredentials service:', serviceError);
        res.status(500).json({
          success: false,
          error: serviceError instanceof Error ? serviceError.message : 'Failed to save GA4 credentials',
          details: serviceError instanceof Error ? serviceError.stack : undefined,
        });
        return;
      }
    } catch (error) {
      console.error('Error saving GA4 credentials:', error);
      // Ensure we always return JSON, even on unexpected errors
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save GA4 credentials',
          details: error instanceof Error ? error.stack : undefined,
        });
      }
    }
  }
);

/**
 * POST /api/brands/:brandId/analytics/test-connection
 * GET /api/brands/:brandId/analytics/test-connection
 * Test GA4 connection with real-time report (like Python script)
 * Query param: customer_id
 */
router.post(
  '/:brandId/analytics/test-connection',
  async (req: Request, res: Response) => {
    console.log('📝 POST /api/brands/:brandId/analytics/test-connection - Route hit');
    console.log('   Brand ID:', req.params.brandId);
    console.log('   Query:', req.query);
    console.log('   Body:', req.body);
    
    try {
      const { brandId } = req.params;
      const customer_id = (req.query?.customer_id as string) || (req.body?.customer_id as string);

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      // Get credentials
      const credential = await ga4AnalyticsService.getCredentials(brandId, customer_id as string);
      if (!credential) {
        res.status(404).json({
          success: false,
          error: 'GA4 not configured for this brand. Please save credentials first.',
        });
        return;
      }

      try {
        // Test with real-time report (same as Python script)
        const realtimeReport = await ga4AnalyticsService.getRealtimeReport(
          brandId,
          customer_id as string,
          ['country'], // Simple dimension
          ['activeUsers'], // Simple metric
          10 // Small limit for test
        );

        // Match Python script output format
        // totals can be array or object - handle both
        const totals = realtimeReport.totals || [];
        const totalsObj = realtimeReport.totalsObject || {};
        const activeUsersValue = totalsObj['activeUsers'] || totals.find((t: any) => t.metric === 'activeUsers')?.value || 0;
        
        res.json({
          success: true,
          message: 'GA4 connection test successful!',
          data: {
            propertyId: credential.property_id,
            activeUsers: activeUsersValue,
            rowCount: realtimeReport.rowCount,
            timestamp: realtimeReport.timestamp,
            headers: realtimeReport.headers,
            rows: realtimeReport.rows,
            totals: totals,
            totalsObject: totalsObj,
            // Match Python script format
            output: {
              headers: realtimeReport.headers,
              rows: realtimeReport.rows.map((r: any) => r.flat || r.dimensions?.concat(r.metrics) || []),
              totals: realtimeReport.totals,
              rowCount: realtimeReport.rowCount,
            }
          },
        });
      } catch (testError) {
        console.error('GA4 connection test failed:', testError);
        res.status(500).json({
          success: false,
          error: testError instanceof Error ? testError.message : 'Failed to connect to GA4',
          details: testError instanceof Error && testError.message.includes('PERMISSION_DENIED') 
            ? 'Service account may not have access to this property. Check GA4 Property Access Management.' 
            : undefined,
        });
      }
    } catch (error) {
      console.error('Error testing GA4 connection:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test GA4 connection',
      });
    }
  }
);

// Also support GET for test-connection (easier to test)
router.get(
  '/:brandId/analytics/test-connection',
  async (req: Request, res: Response) => {
    console.log('📝 GET /api/brands/:brandId/analytics/test-connection - Route hit');
    console.log('   Brand ID:', req.params.brandId);
    console.log('   Query:', req.query);
    
    try {
      const { brandId } = req.params;
      const customer_id = req.query?.customer_id as string;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      // Get credentials
      const credential = await ga4AnalyticsService.getCredentials(brandId, customer_id);
      if (!credential) {
        res.status(404).json({
          success: false,
          error: 'GA4 not configured for this brand. Please save credentials first.',
        });
        return;
      }

      try {
        // Test with real-time report (same as Python script)
        const realtimeReport = await ga4AnalyticsService.getRealtimeReport(
          brandId,
          customer_id,
          ['country'], // Simple dimension
          ['activeUsers'], // Simple metric
          10 // Small limit for test
        );

        // Match Python script output format
        // totals can be array or object - handle both
        const totals = realtimeReport.totals || [];
        const totalsObj = realtimeReport.totalsObject || {};
        const activeUsersValue = totalsObj['activeUsers'] || totals.find((t: any) => t.metric === 'activeUsers')?.value || 0;
        
        res.json({
          success: true,
          message: 'GA4 connection test successful!',
          data: {
            propertyId: credential.property_id,
            activeUsers: activeUsersValue,
            rowCount: realtimeReport.rowCount,
            timestamp: realtimeReport.timestamp,
            headers: realtimeReport.headers,
            rows: realtimeReport.rows,
            totals: totals,
            totalsObject: totalsObj,
            // Match Python script format
            output: {
              headers: realtimeReport.headers,
              rows: realtimeReport.rows.map((r: any) => r.flat || r.dimensions?.concat(r.metrics) || []),
              totals: realtimeReport.totals,
              rowCount: realtimeReport.rowCount,
            }
          },
        });
      } catch (testError) {
        console.error('GA4 connection test failed:', testError);
        res.status(500).json({
          success: false,
          error: testError instanceof Error ? testError.message : 'Failed to connect to GA4',
          details: testError instanceof Error && testError.message.includes('PERMISSION_DENIED') 
            ? 'Service account may not have access to this property. Check GA4 Property Access Management.' 
            : undefined,
        });
      }
    } catch (error) {
      console.error('Error testing GA4 connection:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test GA4 connection',
      });
    }
  }
);

/**
 * GET /api/brands/:brandId/analytics/credentials
 * Check if GA4 is configured for a brand
 * Query param: customer_id
 */
router.get(
  '/:brandId/analytics/credentials',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const { customer_id } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      const credential = await ga4AnalyticsService.getCredentials(brandId, customer_id as string);

      if (!credential) {
        res.json({
          success: true,
          configured: false,
          data: null,
        });
        return;
      }

      res.json({
        success: true,
        configured: true,
        data: {
          property_id: credential.property_id,
          configured_at: credential.configured_at,
        },
      });
    } catch (error) {
      console.error('Error checking GA4 credentials:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check GA4 credentials',
      });
    }
  }
);

/**
 * DELETE /api/brands/:brandId/analytics/credentials
 * Delete GA4 credentials for a brand
 * Query param: customer_id
 */
router.delete(
  '/:brandId/analytics/credentials',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const { customer_id } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      await ga4AnalyticsService.deleteCredentials(brandId, customer_id as string);

      res.json({
        success: true,
        message: 'GA4 configuration deleted',
      });
    } catch (error) {
      console.error('Error deleting GA4 credentials:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete GA4 credentials',
      });
    }
  }
);

/**
 * GET /api/brands/:brandId/analytics/reports
 * Fetch GA4 analytics report
 * Query params: customer_id, metric, dimension, days
 */
router.get(
  '/:brandId/analytics/reports',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const {
        customer_id,
        metric = 'eventCount',
        dimension = 'date',
        days = '7',
      } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      const daysNum = parseInt(days as string, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        res.status(400).json({
          success: false,
          error: 'days must be between 1 and 90',
        });
        return;
      }

      const report = await ga4AnalyticsService.getAnalyticsReport(
        brandId,
        customer_id as string,
        metric as string,
        dimension as string,
        daysNum
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error fetching analytics report:', error);
      
      if (error instanceof Error && error.message.includes('not configured')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics report',
      });
    }
  }
);

/**
 * GET /api/brands/:brandId/analytics/top-events
 * Get top events from GA4
 * Query params: customer_id, days
 */
router.get(
  '/:brandId/analytics/top-events',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const { customer_id, days = '7' } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      const daysNum = parseInt(days as string, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        res.status(400).json({
          success: false,
          error: 'days must be between 1 and 90',
        });
        return;
      }

      const events = await ga4AnalyticsService.getTopEvents(
        brandId,
        customer_id as string,
        daysNum
      );

      res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      console.error('Error fetching top events:', error);
      
      if (error instanceof Error && error.message.includes('not configured')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top events',
      });
    }
  }
);

/**
 * GET /api/brands/:brandId/analytics/traffic-sources
 * Get traffic sources from GA4
 * Query params: customer_id, days
 */
router.get(
  '/:brandId/analytics/traffic-sources',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const { customer_id, days = '7' } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      const daysNum = parseInt(days as string, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        res.status(400).json({
          success: false,
          error: 'days must be between 1 and 90',
        });
        return;
      }

      const sources = await ga4AnalyticsService.getTrafficSources(
        brandId,
        customer_id as string,
        daysNum
      );

      res.json({
        success: true,
        data: sources,
      });
    } catch (error) {
      console.error('Error fetching traffic sources:', error);
      
      if (error instanceof Error && error.message.includes('not configured')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch traffic sources',
      });
    }
  }
);

/**
 * GET /api/brands/:brandId/analytics/active-users-by-city
 * Get active users by city from GA4
 * Query params: customer_id, days, start_date, end_date
 */
router.get(
  '/:brandId/analytics/active-users-by-city',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const { customer_id, days = '7', start_date, end_date } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      const daysNum = parseInt(days as string, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        res.status(400).json({
          success: false,
          error: 'days must be between 1 and 90',
        });
        return;
      }

      // Validate date format if provided
      if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(start_date as string)) {
        res.status(400).json({
          success: false,
          error: 'start_date must be in YYYY-MM-DD format',
        });
        return;
      }

      if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(end_date as string)) {
        res.status(400).json({
          success: false,
          error: 'end_date must be in YYYY-MM-DD format',
        });
        return;
      }

      const users = await ga4AnalyticsService.getActiveUsersByCity(
        brandId,
        customer_id as string,
        daysNum,
        start_date as string | undefined,
        end_date as string | undefined
      );

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error('Error fetching active users by city:', error);
      
      if (error instanceof Error && error.message.includes('not configured')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active users by city',
      });
    }
  }
);

/**
 * GET /api/brands/:brandId/analytics/realtime
 * Get real-time analytics report from GA4
 * Query params: customer_id, dimensions (comma-separated), metrics (comma-separated), limit
 */
router.get(
  '/:brandId/analytics/realtime',
  async (req: Request, res: Response) => {
    try {
      const { brandId } = req.params;
      const {
        customer_id,
        dimensions = '',
        metrics = 'activeUsers',
        limit = '10000',
      } = req.query;

      if (!customer_id || !brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID and Customer ID are required',
        });
        return;
      }

      // Parse dimensions and metrics from comma-separated strings
      const dimensionsArray = typeof dimensions === 'string' && dimensions.length > 0
        ? dimensions.split(',').map(d => d.trim()).filter(d => d.length > 0)
        : [];
      
      const metricsArray = typeof metrics === 'string' && metrics.length > 0
        ? metrics.split(',').map(m => m.trim()).filter(m => m.length > 0)
        : ['activeUsers']; // Default to activeUsers if none provided

      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100000) {
        res.status(400).json({
          success: false,
          error: 'limit must be between 1 and 100000',
        });
        return;
      }

      const report = await ga4AnalyticsService.getRealtimeReport(
        brandId,
        customer_id as string,
        dimensionsArray,
        metricsArray,
        limitNum
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error fetching real-time analytics report:', error);
      
      if (error instanceof Error && error.message.includes('not configured')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch real-time analytics report',
      });
    }
  }
);

export default router;

