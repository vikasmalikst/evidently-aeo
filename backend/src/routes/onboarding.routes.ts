import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { onboardingIntelService } from '../services/onboarding-intel.service';

const router = Router();

/**
 * POST /onboarding/brand-intel
 * Resolve brand information and suggested competitors for onboarding flow
 */
router.post('/brand-intel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { input, locale, country } = req.body ?? {};

    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Brand input is required',
      });
      return;
    }

    const data = await onboardingIntelService.lookupBrandIntel({
      input,
      locale,
      country,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Failed to generate onboarding brand intel:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to resolve brand information',
    });
  }
});

/**
 * POST /onboarding/competitors
 * Regenerate competitor suggestions (optional refresh endpoint)
 */
router.post('/competitors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { companyName, industry, domain, locale, country } = req.body ?? {};

    if (!companyName || typeof companyName !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Company name is required to generate competitors',
      });
      return;
    }

    const competitors = await onboardingIntelService.generateCompetitorsForRequest({
      companyName,
      industry,
      domain,
      locale,
      country,
    });

    res.json({
      success: true,
      data: competitors,
    });
  } catch (error) {
    console.error('❌ Competitor generation failed:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate competitor suggestions',
    });
  }
});

export default router;

