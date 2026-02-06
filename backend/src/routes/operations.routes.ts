
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminAccess } from '../middleware/admin.middleware';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = Router();

// Apply auth middleware
router.use(authenticateToken);
router.use(requireAdminAccess);

/**
 * GET /api/operations/dashboard
 * Fetch consolidated operations status
 */
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const { limit = '100', brand_id } = req.query;

        let query = supabase
            .from('collector_results')
            .select(`
        id,
        created_at,
        brand_id,
        brightdata_snapshot_id,
        raw_answer,
        collector_type,
        citations,
        brands:brand_id (name),
        consolidated_analysis_cache:consolidated_analysis_cache!left (collector_result_id),
        metric_facts:metric_facts (
            id,
            brand_sentiment:brand_sentiment (id),
            competitor_sentiment:competitor_sentiment (id)
        )
      `)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (brand_id) {
            query = query.eq('brand_id', brand_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Transform data for dashboard
        const dashboardData = data.map((item: any) => {
            // Check if consolidated analysis has run successfully (cache entry exists)
            const hasConsolidatedAnalysis = !!(
                item.consolidated_analysis_cache &&
                (Array.isArray(item.consolidated_analysis_cache)
                    ? item.consolidated_analysis_cache.length > 0
                    : !!item.consolidated_analysis_cache)
            );

            const metricFact = item.metric_facts?.[0] || item.metric_facts; // Handle array or object return

            return {
                id: item.id,
                brand_name: item.brands?.name || 'Unknown',
                date: item.created_at,
                brightdata_snapshot_id: item.brightdata_snapshot_id,
                collector_type: item.collector_type || 'unknown',
                raw_answer: !!item.raw_answer,
                openrouter_collection: hasConsolidatedAnalysis,
                citation_processed: !!(hasConsolidatedAnalysis && item.citations && item.citations.length > 0),
                sentiment_processed: !!(metricFact?.brand_sentiment?.length > 0 || metricFact?.brand_sentiment?.id),
                brand_scored_process: !!(metricFact?.brand_sentiment?.length > 0 || metricFact?.brand_sentiment?.id),
                competitor_scores_process: !!(metricFact?.competitor_sentiment?.length > 0 || metricFact?.competitor_sentiment?.id),
            };
        });

        // To get competitor scores without exploding the query, maybe we check 'competitor_analytics' or similar?
        // Or just fetch specific competitor score count?
        // Let's keep it simple for now. 

        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Error serving operations dashboard:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
