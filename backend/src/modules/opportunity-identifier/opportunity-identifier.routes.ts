/**
 * Opportunity Identifier Routes
 * 
 * API endpoints for identifying brand performance opportunities.
 */

import { Router, Request, Response } from 'express';
import { opportunityIdentifierService, OpportunityOptions } from './opportunity-identifier.service';
import { opportunityRecommendationService } from './opportunity-recommendation.service';
import { authenticateToken } from '../../middleware/auth.middleware';
import { supabaseAdmin } from '../../config/database';

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

/**
 * GET /api/brands/:brandId/recommendations/map
 * 
 * Get a map of Query ID -> Recommendation ID for active recommendations.
 * Used for "Red Flag" feature in Query Analysis.
 */
router.get('/brands/:brandId/recommendations/map', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;

        if (!customerId) {
            return res.status(403).json({ error: 'Customer ID required' });
        }

        let targetCustomerId = customerId;

        // Check if user is admin to allow fallback to brand owner
        // This handles cases where impersonation header might be missing but access is valid
        const isAdmin = req.user?.role === 'admin' || req.user?.access_level === 'admin';

        if (isAdmin) {
            // Check if we find recs with current customerId
            const { count } = await supabaseAdmin
                .from('recommendations')
                .select('id', { count: 'exact', head: true })
                .eq('brand_id', brandId)
                .eq('customer_id', customerId);

            if (count === 0) {
                // If no recs found for this customer, check who owns the brand
                const { data: brand } = await supabaseAdmin
                    .from('brands')
                    .select('customer_id')
                    .eq('id', brandId)
                    .single();

                if (brand && brand.customer_id && brand.customer_id !== customerId) {
                    console.log(`[RedFlag] Admin accessing brand owned by ${brand.customer_id}. Switching context.`);
                    targetCustomerId = brand.customer_id;
                }
            }
        }

        console.log(`[RedFlag Debug] Fetching map for Brand: ${brandId}, Customer: ${targetCustomerId}`);

        // Debug: Check counts
        const { count: totalRecs } = await supabaseAdmin
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId);

        const { count: linkedRecs } = await supabaseAdmin
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .not('query_id', 'is', null);

        console.log(`[RedFlag Debug] Total Recs for Brand: ${totalRecs}, Linked Recs: ${linkedRecs}`);

        // Fetch recommendations that have a query_id link
        const { data, error } = await supabaseAdmin // Using supabaseAdmin is safe as we validated customerId
            .from('recommendations')
            .select('id, query_id, created_at, customer_id') // Added customer_id to check
            .eq('brand_id', brandId)
            .eq('customer_id', targetCustomerId) // Use potentially corrected customerId
            .not('query_id', 'is', null)
            .order('created_at', { ascending: false }); // Get latest first

        if (error) throw error;

        // Build Map: QueryID -> RecID (Active/Latest)
        const map: Record<string, string> = {};
        if (data) {
            for (const rec of data) {
                // If query_id already exists, we skip (since we ordered by latest first, we keep the newest)
                if (!map[rec.query_id]) {
                    map[rec.query_id] = rec.id;
                }
            }
        }

        return res.json({
            success: true,
            data: {
                map,
                debug: {
                    customerId: targetCustomerId,
                    brandId,
                    totalRecs,
                    linkedRecs,
                    dataLength: data?.length || 0
                }
            }
        });
    } catch (error) {
        console.error('[OpportunityRoutes] Error fetching recommendation map:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

export default router;
