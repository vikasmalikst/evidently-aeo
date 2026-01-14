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
import type {
    GenerateReportRequest,
    CreateScheduleRequest,
    AddCommentRequest,
    ExportReportRequest,
} from '../services/executive-reporting/types';

const router = Router();

/**
 * GET /api/brands/:brandId/executive-reports
 * List all reports for a brand
 */
router.get('/brands/:brandId/executive-reports', async (req: Request, res: Response) => {
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
router.get('/brands/:brandId/executive-reports/latest', async (req: Request, res: Response) => {
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
router.get('/brands/:brandId/executive-reports/:reportId', async (req: Request, res: Response) => {
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
router.post('/brands/:brandId/executive-reports', async (req: Request, res: Response) => {
    try {
        const { brandId } = req.params;
        const { period_days, end_date } = req.body;

        // Validate period_days
        if (![7, 30, 60, 90].includes(period_days)) {
            return res.status(400).json({
                success: false,
                error: 'period_days must be one of: 7, 30, 60, 90',
            });
        }

        const request: GenerateReportRequest = {
            brand_id: brandId,
            period_days,
            end_date,
        };

        // Get user ID from auth (assuming auth middleware sets req.user)
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
 * DELETE /api/brands/:brandId/executive-reports/:reportId
 * Delete a report
 */
router.delete('/brands/:brandId/executive-reports/:reportId', async (req: Request, res: Response) => {
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
router.get('/brands/:brandId/executive-reports-schedules', async (req: Request, res: Response) => {
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
router.post('/brands/:brandId/executive-reports-schedules', async (req: Request, res: Response) => {
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
router.put('/brands/:brandId/executive-reports-schedules/:scheduleId', async (req: Request, res: Response) => {
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
router.delete('/brands/:brandId/executive-reports-schedules/:scheduleId', async (req: Request, res: Response) => {
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
router.post('/brands/:brandId/executive-reports/:reportId/export/pdf', async (req: Request, res: Response) => {
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

export default router;
