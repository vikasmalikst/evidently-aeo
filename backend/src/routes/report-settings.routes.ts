import { Router, Request, Response } from 'express';
import { reportSettingsService } from '../services/report-settings.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /report-settings/:brandId
 * Get report settings for a specific brand
 */
router.get('/:brandId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;

        if (!brandId) {
            res.status(400).json({
                success: false,
                error: 'Brand ID is required'
            });
            return;
        }

        const settings = await reportSettingsService.getReportSettings(brandId, customerId);

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching report settings:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch report settings'
        });
    }
});

/**
 * POST /report-settings/:brandId
 * Create or update report settings for a specific brand
 */
router.post('/:brandId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;
        const { frequency, distribution_emails, is_active } = req.body;

        if (!brandId) {
            res.status(400).json({
                success: false,
                error: 'Brand ID is required'
            });
            return;
        }

        if (!frequency) {
            res.status(400).json({
                success: false,
                error: 'Frequency is required'
            });
            return;
        }

        if (!distribution_emails || !Array.isArray(distribution_emails)) {
            res.status(400).json({
                success: false,
                error: 'Distribution emails must be provided as an array'
            });
            return;
        }

        const settings = await reportSettingsService.saveReportSettings(brandId, customerId, {
            frequency,
            distribution_emails,
            is_active
        });

        res.json({
            success: true,
            data: settings,
            message: 'Report settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving report settings:', error);

        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 400;

        res.status(statusCode).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save report settings'
        });
    }
});

/**
 * DELETE /report-settings/:brandId
 * Delete report settings for a specific brand
 */
router.delete('/:brandId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const customerId = req.user!.customer_id;

        if (!brandId) {
            res.status(400).json({
                success: false,
                error: 'Brand ID is required'
            });
            return;
        }

        await reportSettingsService.deleteReportSettings(brandId, customerId);

        res.json({
            success: true,
            message: 'Report settings deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting report settings:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete report settings'
        });
    }
});

/**
 * GET /report-settings
 * Get all report settings for the current customer
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const customerId = req.user!.customer_id;

        const settings = await reportSettingsService.getCustomerReportSettings(customerId);

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching customer report settings:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch report settings'
        });
    }
});

export default router;
