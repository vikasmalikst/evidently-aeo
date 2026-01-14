/**
 * Executive Report Orchestration Service
 * 
 * Main service that orchestrates the entire report generation process.
 * Coordinates data aggregation, summary generation, and persistence.
 */

import { supabase } from '../../config/supabase';
import { dataAggregationService } from './data-aggregation.service';
import { executiveSummaryService } from './executive-summary.service';
import type { ExecutiveReport, GenerateReportRequest, ReportDataSnapshot } from './types';

export class ReportOrchestrationService {
    /**
     * Generate a new executive report
     */
    async generateReport(request: GenerateReportRequest, userId: string): Promise<ExecutiveReport> {
        console.log(`📊 [REPORT-ORCH] Generating report for brand ${request.brand_id}`);

        // Calculate date ranges
        const { periodStart, periodEnd, comparisonStart, comparisonEnd } = this.calculateDateRanges(
            request.period_days,
            request.end_date
        );

        console.log(`📊 [REPORT-ORCH] Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
        console.log(`📊 [REPORT-ORCH] Comparison: ${comparisonStart.toISOString()} to ${comparisonEnd.toISOString()}`);

        // Step 1: Aggregate all data
        const dataSnapshot = await dataAggregationService.aggregateReportData(
            request.brand_id,
            periodStart,
            periodEnd,
            comparisonStart,
            comparisonEnd
        );

        // Step 2: Generate executive summary
        const executiveSummary = await executiveSummaryService.generateExecutiveSummary(dataSnapshot);

        // Step 3: Save report to database
        const report = await this.saveReport(
            request.brand_id,
            periodStart,
            periodEnd,
            comparisonStart,
            comparisonEnd,
            dataSnapshot,
            executiveSummary,
            userId
        );

        console.log(`✅ [REPORT-ORCH] Report generated successfully: ${report.id}`);

        return report;
    }

    /**
     * Get an existing report by ID
     */
    async getReport(reportId: string): Promise<ExecutiveReport | null> {
        const { data, error } = await supabase
            .from('executive_reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (error) {
            console.error('❌ [REPORT-ORCH] Error fetching report:', error);
            return null;
        }

        return data as ExecutiveReport;
    }

    /**
     * Get latest report for a brand
     */
    async getLatestReport(brandId: string): Promise<ExecutiveReport | null> {
        const { data, error } = await supabase
            .from('executive_reports')
            .select('*')
            .eq('brand_id', brandId)
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('❌ [REPORT-ORCH] Error fetching latest report:', error);
            return null;
        }

        return data as ExecutiveReport;
    }

    /**
     * List all reports for a brand
     */
    async listReports(brandId: string, limit: number = 20): Promise<ExecutiveReport[]> {
        const { data, error } = await supabase
            .from('executive_reports')
            .select('*')
            .eq('brand_id', brandId)
            .order('generated_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('❌ [REPORT-ORCH] Error listing reports:', error);
            return [];
        }

        return data as ExecutiveReport[];
    }

    /**
     * Delete a report
     */
    async deleteReport(reportId: string): Promise<boolean> {
        const { error } = await supabase
            .from('executive_reports')
            .delete()
            .eq('id', reportId);

        if (error) {
            console.error('❌ [REPORT-ORCH] Error deleting report:', error);
            return false;
        }

        return true;
    }

    /**
     * Save report to database
     */
    private async saveReport(
        brandId: string,
        periodStart: Date,
        periodEnd: Date,
        comparisonStart: Date,
        comparisonEnd: Date,
        dataSnapshot: ReportDataSnapshot,
        executiveSummary: string,
        userId: string
    ): Promise<ExecutiveReport> {
        const { data, error } = await supabase
            .from('executive_reports')
            .insert({
                brand_id: brandId,
                report_period_start: periodStart.toISOString().split('T')[0],
                report_period_end: periodEnd.toISOString().split('T')[0],
                comparison_period_start: comparisonStart.toISOString().split('T')[0],
                comparison_period_end: comparisonEnd.toISOString().split('T')[0],
                data_snapshot: dataSnapshot,
                executive_summary: executiveSummary,
                generated_by: userId === 'system' ? null : userId,
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [REPORT-ORCH] Error saving report:', error);
            throw new Error(`Failed to save report: ${error.message}`);
        }

        return data as ExecutiveReport;
    }

    /**
     * Calculate date ranges for report and comparison periods
     */
    private calculateDateRanges(
        periodDays: number,
        endDateStr?: string
    ): {
        periodStart: Date;
        periodEnd: Date;
        comparisonStart: Date;
        comparisonEnd: Date;
    } {
        // End date defaults to today
        const periodEnd = endDateStr ? new Date(endDateStr) : new Date();
        periodEnd.setHours(23, 59, 59, 999);

        // Start date is N days before end date
        const periodStart = new Date(periodEnd);
        periodStart.setDate(periodStart.getDate() - periodDays + 1);
        periodStart.setHours(0, 0, 0, 0);

        // Comparison period is the same duration immediately before current period
        const comparisonEnd = new Date(periodStart);
        comparisonEnd.setDate(comparisonEnd.getDate() - 1);
        comparisonEnd.setHours(23, 59, 59, 999);

        const comparisonStart = new Date(comparisonEnd);
        comparisonStart.setDate(comparisonStart.getDate() - periodDays + 1);
        comparisonStart.setHours(0, 0, 0, 0);

        return {
            periodStart,
            periodEnd,
            comparisonStart,
            comparisonEnd,
        };
    }
}

export const reportOrchestrationService = new ReportOrchestrationService();
