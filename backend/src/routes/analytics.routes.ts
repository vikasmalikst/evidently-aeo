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
    try {
      const { brandId } = req.params;
      const { customer_id, property_id, service_account_key } = req.body;

      if (!brandId) {
        res.status(400).json({
          success: false,
          error: 'Brand ID is required',
        });
        return;
      }

      if (!customer_id || !property_id || !service_account_key) {
        res.status(400).json({
          success: false,
          error: 'customer_id, property_id and service_account_key are required',
        });
        return;
      }

      // Validate service account key structure
      if (
        typeof service_account_key !== 'object' ||
        !service_account_key.type ||
        !service_account_key.project_id ||
        !service_account_key.private_key
      ) {
        res.status(400).json({
          success: false,
          error: 'Invalid service account key format',
        });
        return;
      }

      await ga4AnalyticsService.saveCredentials(
        brandId,
        customer_id,
        property_id,
        service_account_key
      );

      res.status(201).json({
        success: true,
        message: 'GA4 configuration saved',
        propertyId: property_id,
      });
    } catch (error) {
      console.error('Error saving GA4 credentials:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save GA4 credentials',
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

export default router;

