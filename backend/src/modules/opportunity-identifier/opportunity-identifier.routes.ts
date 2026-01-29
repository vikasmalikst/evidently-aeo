/**
 * Opportunity Identifier Routes
 * 
 * API endpoints for identifying brand performance opportunities.
 */

import { Router, Request, Response } from 'express';
import { opportunityIdentifierService, OpportunityOptions } from './opportunity-identifier.service';
import { opportunityRecommendationService } from './opportunity-recommendation.service';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/brands/:brandId/opportunities
 * 
 * Identify opportunities for a brand based on performance gaps.
 * 
 * Query Parameters:
 * - days: Lookback period (default: 14)
 * - collectors: Comma-separated list of collector slugs (e.g., chatgpt,perplexity)
 * - topics: Comma-separated list of topic names
 */
router.get('/brands/:brandId/opportunities', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;

        if (!customerId) {
            return res.status(403).json({
                error: 'Customer ID is required. Please ensure you are properly authenticated.'
            });
        }

        // Parse query parameters
        const days = parseInt(req.query.days as string) || 14;
        const collectors = req.query.collectors
            ? (req.query.collectors as string).split(',').map(s => s.trim()).filter(Boolean)
            : undefined;
        const topics = req.query.topics
            ? (req.query.topics as string).split(',').map(s => s.trim()).filter(Boolean)
            : undefined;

        const options: OpportunityOptions = {
            brandId,
            customerId,
            days,
            collectors,
            topics
        };

        console.log(`[OpportunityRoutes] GET /opportunities - Brand: ${brandId}, Days: ${days}, Customer: ${customerId}`);

        const result = await opportunityIdentifierService.identifyOpportunities(options);

        return res.json(result);
    } catch (error) {
        console.error('[OpportunityRoutes] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

/**
 * GET /api/brands/:brandId/opportunities/summary
 * 
 * Get just the summary statistics (lighter endpoint for dashboard widgets).
 */
router.get('/brands/:brandId/opportunities/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;

        if (!customerId) {
            return res.status(403).json({
                error: 'Customer ID is required. Please ensure you are properly authenticated.'
            });
        }

        const days = parseInt(req.query.days as string) || 14;

        const result = await opportunityIdentifierService.identifyOpportunities({
            brandId,
            customerId,
            days
        });

        return res.json({
            summary: result.summary,
            dateRange: result.dateRange
        });
    } catch (error) {
        console.error('[OpportunityRoutes] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

/**
 * POST /api/brands/:brandId/recommendations
 * 
 * Convert identified opportunities into actionable recommendations using AI.
 */
router.post('/brands/:brandId/recommendations', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;

        if (!customerId) {
            return res.status(403).json({
                error: 'Customer ID is required. Please ensure you are properly authenticated.'
            });
        }

        console.log(`[OpportunityRoutes] POST /recommendations - Brand: ${brandId}, Customer: ${customerId}`);

        const result = await opportunityRecommendationService.convertToRecommendations(brandId, customerId);

        return res.json(result);
    } catch (error) {
        console.error('[OpportunityRoutes] Error converting opportunities:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

export default router;
