/**
 * Executive Reporting Routes
 * 
 * API endpoints for executive reporting functionality.
 */

import { Router, Request, Response } from 'express';
import { reportOrchestrationService } from '../services/executive-reporting/report-orchestration.service';
import { scheduleService } from '../services/executive-reporting/schedule.service';
import { annotationService } from '../services/executive-reporting/annotation.service';
import { pdfExportService } from '../services/executive-reporting/pdf-export.service';
import { pdfExportServiceV2 } from '../services/executive-reporting/pdf-export-v2.service';
import { emailService } from '../services/email/email.service';
import { emailServiceV2 } from '../services/email/email-v2.service';
import type {
    GenerateReportRequest,
    CreateScheduleRequest,
    AddCommentRequest,
    ExportReportRequest,
} from '../services/executive-reporting/types';
import { supabase } from '../config/supabase';
import { reportSettingsService } from '../services/report-settings.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireFeatureEntitlement } from '../middleware/entitlements.middleware';

const router = Router();

/**
 * GET /api/brands/:brandId/executive-reports
 * List all reports for a brand
 */
router.get('/brands/:brandId/executive-reports', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        const reports = await reportOrchestrationService.listReports(brandId, limit);

        res.json({
            success: true,
            data: reports,
        });
    } catch (error) {
        console.error('Error listing executive reports:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list executive reports',
        });
    }
});

/**
 * GET /api/brands/:brandId/executive-reports/latest
 * Get the most recent report for a brand
 */
router.get('/brands/:brandId/executive-reports/latest', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;

        const report = await reportOrchestrationService.getLatestReport(brandId);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: 'No reports found for this brand',
            });
        }

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Error fetching latest report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch latest report',
        });
    }
});

/**
 * GET /api/brands/:brandId/executive-reports/:reportId
 * Get a specific report
 */
router.get('/brands/:brandId/executive-reports/:reportId', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;

        const report = await reportOrchestrationService.getReport(reportId);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: 'Report not found',
            });
        }

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch report',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports
 * Generate a new report
 */
router.post('/brands/:brandId/executive-reports', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        let { period_days, end_date, queryTags } = req.body;

        // If period_days is not provided, fetch from report settings
        if (!period_days) {
            console.log(`ℹ️ [EXEC-REPORT] No period_days provided, fetching settings for brand ${brandId}`);
            // Default to 1 (system user or generic) - in real app should come from auth but for now using system context
            // Actually reportSettingsService requires customerId, but getReportSettings uses brandId and customerId.
            // We need to resolve customerId from brandId or just use brand_id to find settings if unique constraint is brand_id+customer_id.
            // However, reportSettingsService methods require both. Let's look up the brand first to get customer_id.

            // Wait, we can't easily get customer_id here without auth context or brand lookup. 
            // Assuming the settings service might have a method to get by brandId only or we fetch brand first.
            // The service has `getReportSettings(brandId, customerId)`.
            // Let's assume for now we can get the brand to find the customer_id.
            // Or better, let's look at how we can get settings more easily.
            // For now, let's query the settings directly or assume we can get it via the service if we had customer_id.
            // Given the auth middleware sets req.user, we might have customer_id there?
            // The route uses `const userId = (req as any).user?.id || 'system';`

            // Let's fetch the brand to get the customer_id
            const { data: brand, error: brandError } = await supabase
                .from('brands')
                .select('customer_id')
                .eq('id', brandId)
                .single();

            if (brandError || !brand) {
                return res.status(404).json({ success: false, error: 'Brand not found' });
            }

            const settings = await reportSettingsService.getReportSettings(brandId, brand.customer_id);

            if (settings) {
                switch (settings.frequency) {
                    case 'weekly':
                        period_days = 7;
                        break;
                    case 'bi-weekly':
                        period_days = 14;
                        break;
                    case 'monthly':
                        period_days = 30;
                        break;
                    case 'quarterly':
                        period_days = 90;
                        break;
                    case 'custom':
                        // Use custom interval or default to 7 if missing
                        period_days = settings.custom_interval || 7;
                        break;
                    default:
                        period_days = 30;
                }
                console.log(`✅ [EXEC-REPORT] Using configured frequency: ${settings.frequency} -> ${period_days} days`);
            } else {
                console.log(`⚠️ [EXEC-REPORT] No settings found, defaulting to 30 days`);
                period_days = 30;
            }
        }

        // Validate period_days if it was passed manually, ensuring it is a number
        // Note: The service types restrict to 7|30|60|90 but we are effectively allowing dynamic days now
        // We should likely case period_days to number for the service call

        const request: GenerateReportRequest = {
            brand_id: brandId,
            period_days: Number(period_days) as any, // Cast to any to bypass strict literal type if needed, or update type definition
            end_date,
            queryTags,
        };

        const userId = (req as any).user?.id || 'system';

        const report = await reportOrchestrationService.generateReport(request, userId);

        res.status(201).json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * PATCH /api/brands/:brandId/executive-reports/:reportId
 * Update a report (e.g., manual summary edit)
 */
router.patch('/brands/:brandId/executive-reports/:reportId', async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;
        const updates = req.body;

        const report = await reportOrchestrationService.updateReport(reportId, updates);

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports/:reportId/regenerate-summary
 * Regenerate executive summary with optional user feedback
 */
router.post('/brands/:brandId/executive-reports/:reportId/regenerate-summary', async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;
        const { user_feedback } = req.body;

        const report = await reportOrchestrationService.regenerateSummary(reportId, user_feedback);

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Error regenerating summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to regenerate summary',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * DELETE /api/brands/:brandId/executive-reports/:reportId
 * Delete a report
 */
router.delete('/brands/:brandId/executive-reports/:reportId', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;

        const success = await reportOrchestrationService.deleteReport(reportId);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Failed to delete report',
            });
        }

        res.json({
            success: true,
            message: 'Report deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete report',
        });
    }
});

// ===== Schedule Management =====

/**
 * GET /api/brands/:brandId/executive-reports/schedules
 * Get all schedules for a brand
 */
router.get('/brands/:brandId/executive-reports-schedules', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;

        const schedules = await scheduleService.getSchedules(brandId);

        res.json({
            success: true,
            data: schedules,
        });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch schedules',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports/schedules
 * Create a new schedule
 */
router.post('/brands/:brandId/executive-reports-schedules', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const { frequency, reporting_period_days, recipients } = req.body;

        const request: CreateScheduleRequest = {
            brand_id: brandId,
            frequency,
            reporting_period_days,
            recipients,
        };

        const schedule = await scheduleService.createSchedule(request);

        res.status(201).json({
            success: true,
            data: schedule,
        });
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create schedule',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * PUT /api/brands/:brandId/executive-reports/schedules/:scheduleId
 * Update a schedule
 */
router.put('/brands/:brandId/executive-reports-schedules/:scheduleId', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { scheduleId } = req.params;
        const updates = req.body;

        const schedule = await scheduleService.updateSchedule(scheduleId, updates);

        res.json({
            success: true,
            data: schedule,
        });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update schedule',
        });
    }
});

/**
 * DELETE /api/brands/:brandId/executive-reports/schedules/:scheduleId
 * Delete a schedule
 */
router.delete('/brands/:brandId/executive-reports-schedules/:scheduleId', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { scheduleId } = req.params;

        const success = await scheduleService.deleteSchedule(scheduleId);

        res.json({
            success: true,
            message: 'Schedule deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete schedule',
        });
    }
});

// ===== Annotations =====

/**
 * GET /api/brands/:brandId/executive-reports/:reportId/comments
 * Get all comments for a report
 */
router.get('/brands/:brandId/executive-reports/:reportId/comments', async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;

        const comments = await annotationService.getComments(reportId);

        res.json({
            success: true,
            data: comments,
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch comments',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports/:reportId/comments
 * Add a new comment
 */
router.post('/brands/:brandId/executive-reports/:reportId/comments', async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;
        const userId = (req as any).user?.id || 'system';

        const request: AddCommentRequest = {
            report_id: reportId,
            ...req.body,
        };

        const comment = await annotationService.addComment(request, userId);

        res.status(201).json({
            success: true,
            data: comment,
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add comment',
        });
    }
});

/**
 * PUT /api/brands/:brandId/executive-reports/:reportId/comments/:commentId
 * Update a comment
 */
router.put('/brands/:brandId/executive-reports/:reportId/comments/:commentId', async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const updates = req.body;

        const comment = await annotationService.updateComment(commentId, updates);

        res.json({
            success: true,
            data: comment,
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update comment',
        });
    }
});

/**
 * DELETE /api/brands/:brandId/executive-reports/:reportId/comments/:commentId
 * Delete a comment
 */
router.delete('/brands/:brandId/executive-reports/:reportId/comments/:commentId', async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;

        const success = await annotationService.deleteComment(commentId);

        res.json({
            success: true,
            message: 'Comment deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete comment',
        });
    }
});

// ===== Export =====

/**
 * POST /api/brands/:brandId/executive-reports/:reportId/export/pdf
 * Export report as PDF
 */
router.post('/brands/:brandId/executive-reports/:reportId/export/pdf', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;
        const { include_annotations = false } = req.body;

        const pdfBuffer = await pdfExportService.generatePDF(reportId, include_annotations);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="executive-report-${reportId}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate PDF',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports/:reportId/email
 * Email report to a specific address
 */
router.post('/brands/:brandId/executive-reports/:reportId/email', authenticateToken, requireFeatureEntitlement('executive_reporting'), async (req: Request, res: Response) => {
    try {
        const { reportId, brandId } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email address is required',
            });
        }

        // 1. Get the report to check existence and get dates/brand info
        const report = await reportOrchestrationService.getReport(reportId);
        if (!report) {
            return res.status(404).json({
                success: false,
                error: 'Report not found',
            });
        }

        // 2. Get the brand details for the name
        const { data: brand, error: brandError } = await supabase
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .single();

        if (brandError || !brand) {
            return res.status(404).json({ success: false, error: 'Brand not found' });
        }

        // 3. Generate PDF Buffer and HTML Content
        // Note: Reusing pdfExportService logic but getting buffer directly
        const pdfBuffer = await pdfExportService.generatePDF(reportId, false);
        const reportData = await reportOrchestrationService.getReport(reportId);

        let htmlContent = '';
        if (reportData) {
            htmlContent = pdfExportService.generateHTML(reportData, []);
        }

        // 4. Send Email
        const period = `${new Date(report.report_period_start).toLocaleDateString()} - ${new Date(report.report_period_end).toLocaleDateString()}`;
        await emailService.sendExecutiveReport(email, reportId, brand.name, period, pdfBuffer, htmlContent);

        res.json({
            success: true,
            message: 'Report emailed successfully',
        });
    } catch (error: any) {
        console.error('Error emailing report:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to email report',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports/:reportId/export/pdf-v2
 * Export report as PDF (V2 - Visual Mirror)
 */
router.post('/brands/:brandId/executive-reports/:reportId/export/pdf-v2', async (req: Request, res: Response) => {
    try {
        const { reportId, brandId } = req.params;

        console.log(`📄 [API] Generating V2 PDF for report ${reportId}`);
        const pdfBuffer = await pdfExportServiceV2.generatePDF(reportId, brandId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="executive-report-v2-${reportId}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating V2 PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate V2 PDF',
        });
    }
});

/**
 * POST /api/brands/:brandId/executive-reports/:reportId/email-v2
 * Email report to a specific address (V2 - Visual Mirror)
 */
router.post('/brands/:brandId/executive-reports/:reportId/email-v2', async (req: Request, res: Response) => {
    try {
        const { reportId, brandId } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email address is required',
            });
        }

        console.log(`📧 [API] Sending V2 Email for report ${reportId} to ${email}`);

        // 1. Get brand details for the email subject/body
        const { data: brand, error: brandError } = await supabase
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .single();

        if (brandError || !brand) {
            return res.status(404).json({ success: false, error: 'Brand not found' });
        }

        // 2. Send Email
        await emailServiceV2.sendExecutiveReport(email, reportId, brandId, brand.name);

        res.json({
            success: true,
            message: 'Report emailed successfully (V2)',
        });
    } catch (error: any) {
        console.error('Error emailing V2 report:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to email report',
        });
    }
});

export default router;
