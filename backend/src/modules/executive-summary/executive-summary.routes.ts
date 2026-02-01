import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import { executiveSummaryService } from './executive-summary.service';
import { executiveLLMService } from './executive-summary-llm.service';
import { supabase } from '../../config/supabase';

const router = Router();

/**
 * GET /api/brands/:brandId/executive-summary
 * 
 * Generates a full Executive Summary report including:
 * 1. Aggregated Data Stats (Health Score, Head-to-Head, Topics)
 * 2. LLM Generated Narrative based on the stats
 * 
 * Query Params:
 * - days: number (default 7)
 */
// 1. GET Stats Only
router.get('/brands/:brandId/executive-summary', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;
        const days = parseInt(req.query.days as string) || 7;

        if (!customerId) return res.status(403).json({ error: 'Customer ID required' });

        // 1. Get Calculated Facts only
        const data = await executiveSummaryService.generateSummaryData(brandId, customerId, days);

        // 2. Check for cached narrative for TODAY
        const existingReport = await executiveSummaryService.getLatestReport(brandId);
        let narrative = null;
        let generatedAt = null;

        if (existingReport) {
            // Check if it's the new structured object or legacy string/wrapper
            if (existingReport.llm_response && typeof existingReport.llm_response === 'object' && !existingReport.llm_response.text) {
                // New Structured Format (saving the raw JSON object)
                narrative = existingReport.llm_response;
            } else {
                // Legacy or Simple Data Wrapper
                narrative = typeof existingReport.llm_response === 'string'
                    ? existingReport.llm_response
                    : existingReport.llm_response?.text;
            }
            generatedAt = existingReport.created_at;
        }

        return res.json({
            meta: {
                brandId,
                generatedAt: generatedAt || new Date().toISOString(),
                daysAnalyzed: days,
                isCached: !!existingReport
            },
            data: data,
            narrative: narrative
        });

    } catch (error) {
        console.error('[ExecutiveSummary] Error:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

// 2. POST Generate Narrative
router.post('/brands/:brandId/executive-summary/generate', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;
        const days = parseInt(req.body.days as string) || 7;

        if (!customerId) return res.status(403).json({ error: 'Customer ID required' });

        // 1. Calculate Stats (The "Input")
        const data = await executiveSummaryService.generateSummaryData(brandId, customerId, days);

        // 2. Calculate Hash
        const currentHash = executiveSummaryService.generateDataHash(data);

        // 3. Check DB for Today's Report
        const existingReport = await executiveSummaryService.getLatestReport(brandId);

        if (existingReport) {
            // 4a. Check Hash (Smart Cache)
            if (existingReport.data_hash === currentHash) {
                console.log(`[ExecSummary] Cache HIT for brand ${brandId}. Data unchanged.`);

                let cachedNarrative;
                if (existingReport.llm_response && typeof existingReport.llm_response === 'object' && !existingReport.llm_response.text) {
                    cachedNarrative = existingReport.llm_response;
                } else {
                    cachedNarrative = typeof existingReport.llm_response === 'string'
                        ? existingReport.llm_response
                        : existingReport.llm_response?.text;
                }

                return res.json({
                    text: cachedNarrative || "Error retrieving cached text",
                    generatedAt: existingReport.created_at,
                    cached: true
                });
            } else {
                console.log(`[ExecSummary] Cache MISS (Data Changed) for brand ${brandId}. Regenerating.`);
            }
        } else {
            console.log(`[ExecSummary] Cache MISS (No Report Today) for brand ${brandId}. Generating.`);
        }

        // 4b. Generate New Narrative (Cache Miss)
        const narrative = await executiveLLMService.generateExecutiveNarrative(brandId, data);

        // 5. Fetch Brand Name for DB Storage
        const { data: brandInfo } = await supabase
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .single();

        const brandName = brandInfo?.name || 'Unknown Brand';

        // 6. Upsert to DB
        await executiveSummaryService.upsertReport(brandId, brandName, customerId, data, narrative);

        return res.json({
            text: narrative,
            generatedAt: new Date().toISOString(),
            cached: false
        });

    } catch (error) {
        console.error('[ExecutiveSummary] Generate Error:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

export default router;
