/**
 * Executive Reporting Page
 * 
 * Main page for viewing and generating executive reports
 */

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Layout } from '../../components/Layout/Layout';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { IconDownload, IconCalendar, IconFileText, IconLoader } from '@tabler/icons-react';
import { BrandPerformanceSection } from './components/BrandPerformanceSection';
import { ExecutiveSummarySection } from './components/ExecutiveSummarySection';
import { LLMPerformanceSection } from './components/LLMPerformanceSection';
import { CompetitiveLandscapeSection } from './components/CompetitiveLandscapeSection';
import { DomainReadinessSection } from './components/DomainReadinessSection';
import { ActionsImpactSection } from './components/ActionsImpactSection';
import { TopMoversSection } from './components/TopMoversSection';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';

interface ExecutiveReport {
    id: string;
    brand_id: string;
    report_period_start: string;
    report_period_end: string;
    generated_at: string;
    data_snapshot: any;
    executive_summary: string | null;
}

export const ExecutiveReportingPage = () => {
    const { selectedBrandId, selectedBrand, brands, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
    const [report, setReport] = useState<ExecutiveReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [periodDays, setPeriodDays] = useState<7 | 30 | 60 | 90>(30);
    const [generating, setGenerating] = useState(false);

    // Fetch latest report on mount
    useEffect(() => {
        if (selectedBrandId) {
            fetchLatestReport();
        }
    }, [selectedBrandId]);

    const fetchLatestReport = async () => {
        if (!selectedBrandId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.get<{ success: boolean; data: ExecutiveReport }>(
                `/brands/${selectedBrandId}/executive-reports/latest`
            );

            if (response.success && response.data) {
                setReport(response.data);
            } else {
                setReport(null);
            }
        } catch (err: any) {
            // Ignore 404s (no reports yet)
            if (err.message && err.message.includes('404')) {
                setReport(null);
            } else {
                console.error('Error fetching report:', err);
                setError(err instanceof Error ? err.message : 'Failed to load report');
            }
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        if (!selectedBrandId) return;

        setGenerating(true);
        setError(null);

        try {
            const response = await apiClient.post<{ success: boolean; data: ExecutiveReport }>(
                `/brands/${selectedBrandId}/executive-reports`,
                {
                    period_days: periodDays,
                }
            );

            if (response.success && response.data) {
                setReport(response.data);
            } else {
                throw new Error('Failed to generate report');
            }
        } catch (err) {
            console.error('Error generating report:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const exportPDF = async () => {
        if (!report) return;

        try {
            // For binary downloads like PDF, we still need fetch to handle the blob response
            // properly, but we can reuse the token from apiClient
            const token = apiClient.getAccessToken();
            const response = await fetch(
                `${apiClient.baseUrl}/brands/${selectedBrandId}/executive-reports/${report.id}/export/pdf`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        include_annotations: false,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to export PDF');
            }

            // Download PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `executive-report-${report.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Error exporting PDF:', err);
            setError(err instanceof Error ? err.message : 'Failed to export PDF');
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-screen">
                    <div className="flex flex-col items-center gap-4">
                        <IconLoader className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
                        <p className="text-[var(--text-body)]">Loading report...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-[var(--bg-primary)] p-6">
                {/* Header */}
                <div className="max-w-7xl mx-auto mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {selectedBrand && (
                                <SafeLogo
                                    src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                                    domain={selectedBrand.homepage_url || undefined}
                                    alt={selectedBrand.name}
                                    size={48}
                                    className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
                                />
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-[var(--text-headings)]">
                                    Executive Reporting
                                </h1>
                                <p className="text-[var(--text-body)] text-sm">
                                    Comprehensive AEO performance insights for leadership
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Brand Selector */}
                            {brands.length > 1 && (
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Brand
                                    </label>
                                    <select
                                        value={selectedBrandId || ''}
                                        onChange={(e) => selectBrand(e.target.value)}
                                        disabled={brandsLoading || loading}
                                        className="px-3 py-2 border border-[var(--border-default)] rounded-lg bg-white text-[var(--text-body)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                    >
                                        {brands.map((brand) => (
                                            <option key={brand.id} value={brand.id}>
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <select
                                value={periodDays}
                                onChange={(e) => setPeriodDays(Number(e.target.value) as 7 | 30 | 60 | 90)}
                                className="px-4 py-2 border border-[var(--border-default)] rounded-lg bg-white text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                            >
                                <option value={7}>Last 7 Days</option>
                                <option value={30}>Last 30 Days</option>
                                <option value={60}>Last 60 Days</option>
                                <option value={90}>Last 90 Days</option>
                            </select>

                            {/* Generate Report Button */}
                            <button
                                onClick={generateReport}
                                disabled={generating}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {generating ? (
                                    <>
                                        <IconLoader className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <IconFileText className="w-4 h-4" />
                                        Generate Report
                                    </>
                                )}
                            </button>

                            {/* Export PDF Button */}
                            {report && (
                                <button
                                    onClick={exportPDF}
                                    className="flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] rounded-lg text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                    <IconDownload className="w-4 h-4" />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Report Content */}
                {report ? (
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Report Info */}
                        <div className="bg-white rounded-lg p-4 border border-[var(--border-default)]">
                            <div className="flex items-center gap-4 text-sm text-[var(--text-body)]">
                                <div className="flex items-center gap-2">
                                    <IconCalendar className="w-4 h-4" />
                                    <span>
                                        Period: {new Date(report.report_period_start).toLocaleDateString()} -{' '}
                                        {new Date(report.report_period_end).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="h-4 w-px bg-[var(--border-default)]" />
                                <span>
                                    Generated: {new Date(report.generated_at).toLocaleDateString()} at{' '}
                                    {new Date(report.generated_at).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>

                        {/* Executive Summary */}
                        {report.executive_summary && (
                            <ExecutiveSummarySection summary={report.executive_summary} />
                        )}

                        {/* Brand Performance */}
                        <BrandPerformanceSection data={report.data_snapshot.brand_performance} />

                        {/* LLM Performance */}
                        <LLMPerformanceSection data={report.data_snapshot.llm_performance} />

                        {/* Competitive Landscape */}
                        <CompetitiveLandscapeSection data={report.data_snapshot.competitive_landscape} />

                        {/* Domain Readiness */}
                        <DomainReadinessSection data={report.data_snapshot.domain_readiness} />

                        {/* Actions & Impact */}
                        <ActionsImpactSection data={report.data_snapshot.actions_impact} />

                        {/* Top Movers */}
                        <TopMoversSection data={report.data_snapshot.top_movers} />
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-white rounded-lg p-12 border border-[var(--border-default)] text-center">
                            <IconFileText className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" />
                            <h3 className="text-xl font-semibold text-[var(--text-headings)] mb-2">
                                No Reports Yet
                            </h3>
                            <p className="text-[var(--text-body)] mb-6">
                                Generate your first executive report to get started
                            </p>
                            <button
                                onClick={generateReport}
                                disabled={generating}
                                className="px-6 py-3 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {generating ? 'Generating...' : 'Generate First Report'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};
