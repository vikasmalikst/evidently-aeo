import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { onboardingV2ResearchService } from '../services/onboarding-v2/research.service';

const router = Router();

/**
 * POST /onboarding-v2/research
 * 
 * Run the AI-powered research pipeline to generate brand info,
 * competitors, and queries for a new brand onboarding.
 * 
 * Body: { brandName, country, websiteUrl, maxCompetitors?, maxQueries? }
 */
router.post('/research', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandName, country, websiteUrl, maxCompetitors, maxQueries } = req.body ?? {};

        // Validation
        if (!brandName || typeof brandName !== 'string') {
            res.status(400).json({ success: false, error: 'brandName is required' });
            return;
        }
        if (!websiteUrl || typeof websiteUrl !== 'string') {
            res.status(400).json({ success: false, error: 'websiteUrl is required' });
            return;
        }
        if (!country || typeof country !== 'string') {
            res.status(400).json({ success: false, error: 'country is required' });
            return;
        }

        // Read user entitlements to cap query count
        const user = req.user as any;
        const entitlementMaxQueries = user?.settings?.entitlements?.max_queries;

        let effectiveMaxQueries = maxQueries ?? 20;
        if (entitlementMaxQueries && effectiveMaxQueries > entitlementMaxQueries) {
            console.log(`⚠️ [OnboardingV2] Capping queries from ${effectiveMaxQueries} to entitlement max: ${entitlementMaxQueries}`);
            effectiveMaxQueries = entitlementMaxQueries;
        }

        console.log(`🎯 [OnboardingV2 Route] Research request: ${brandName} (${country}), URL: ${websiteUrl}`);
        console.log(`   MaxCompetitors: ${maxCompetitors ?? 5}, MaxQueries: ${effectiveMaxQueries}`);

        const result = await onboardingV2ResearchService.research({
            brandName,
            country,
            websiteUrl,
            maxCompetitors: maxCompetitors ?? 10,
            maxQueries: effectiveMaxQueries,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('❌ [OnboardingV2 Route] Research failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Research failed. Please try again.',
        });
    }
});

export default router;
