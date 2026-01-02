
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { moversShakersOrchestrator } from '../services/movers-and-shakers/orchestrator.service';

const router = Router();

/**
 * GET /movers-shakers/:brandId/report
 * Generate Movers & Shakers report for a brand
 */
router.get('/:brandId/report', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 48;

    const report = await moversShakersOrchestrator.generateReport(brandId, hours);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating Movers & Shakers report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report'
    });
  }
});

/**
 * POST /movers-shakers/:brandId/custom-source
 * Add a custom source for a brand
 */
router.post('/:brandId/custom-source', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { domain } = req.body;

    if (!domain) {
      res.status(400).json({ success: false, error: 'Domain is required' });
      return;
    }

    await moversShakersOrchestrator.addCustomSource(brandId, domain);
    
    res.json({
      success: true,
      message: 'Custom source added successfully'
    });
  } catch (error) {
    console.error('Error adding custom source:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add custom source'
    });
  }
});

export default router;
