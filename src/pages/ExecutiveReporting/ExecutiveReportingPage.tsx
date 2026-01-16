/**
 * Executive Reporting Page
 * 
 * Main page for viewing and generating executive reports
 * Features modern UI with animations and premium styling
 */

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { Layout } from '../../components/Layout/Layout';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { IconDownload, IconCalendar, IconFileText, IconLoader, IconClock } from '@tabler/icons-react';
import { BrandPerformanceSection } from './components/BrandPerformanceSection';
import { ExecutiveSummarySection } from './components/ExecutiveSummarySection';
import { LLMPerformanceSection } from './components/LLMPerformanceSection';
import { CompetitiveLandscapeSection } from './components/CompetitiveLandscapeSection';
import { DomainReadinessSection } from './components/DomainReadinessSection';
import { ActionsImpactSection } from './components/ActionsImpactSection';
import { TopMoversSection } from './components/TopMoversSection';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import '../../styles/executive-reporting.css';

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
                <div className="executive-report-container flex items-center justify-center min-h-screen">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[#0096b0] flex items-center justify-center shadow-lg">
                            <IconLoader className="w-8 h-8 animate-spin text-white" />
                        </div>
                        <p className="text-[var(--text-body)] font-medium">Loading executive report...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="executive-report-container">
                {/* Header Section */}
                <div className="executive-header">
                    <div className="executive-header-content">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Title Group */}
                            <div className="executive-title-group">
                                {selectedBrand && (
                                    <SafeLogo
                                        src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                                        domain={selectedBrand.homepage_url || undefined}
                                        alt={selectedBrand.name}
                                        size={56}
                                        className="executive-brand-logo"
                                    />
                                )}
                                <div>
                                    <h1 className="executive-title">Executive Reporting</h1>
                                    <p className="executive-subtitle">
                                        Comprehensive AEO performance insights for leadership
                                    </p>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="executive-controls">
                                {brands.length > 1 && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Brand
                                        </label>
                                        <select
                                            value={selectedBrandId || ''}
                                            onChange={(e) => selectBrand(e.target.value)}
                                            disabled={brandsLoading || loading}
                                            className="executive-select"
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
                                    className="executive-select"
                                >
                                    <option value={7}>Last 7 Days</option>
                                    <option value={30}>Last 30 Days</option>
                                    <option value={60}>Last 60 Days</option>
                                    <option value={90}>Last 90 Days</option>
                                </select>

                                <button
                                    onClick={generateReport}
                                    disabled={generating}
                                    className="executive-btn-primary"
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

                                {report && (
                                    <button onClick={exportPDF} className="executive-btn-secondary">
                                        <IconDownload className="w-4 h-4" />
                                        Export PDF
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Report Content */}
                <div className="max-w-7xl mx-auto p-6">
                    {report ? (
                        <div className="space-y-6">
                            {/* Report Info Bar */}
                            <div className="executive-info-bar">
                                <div className="executive-info-item">
                                    <IconCalendar className="w-4 h-4" />
                                    <span className="font-medium">Period:</span>
                                    <span>
                                        {new Date(report.report_period_start).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric',
                                            year: 'numeric'
                                        })} – {new Date(report.report_period_end).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className="executive-info-divider" />
                                <div className="executive-info-item">
                                    <IconClock className="w-4 h-4" />
                                    <span className="font-medium">Generated:</span>
                                    <span>
                                        {new Date(report.generated_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })} at {new Date(report.generated_at).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>

                            {/* Sections */}
                            <div className="space-y-6">
                                {report.executive_summary && (
                                    <ExecutiveSummarySection summary={report.executive_summary} />
                                )}
                                <BrandPerformanceSection data={report.data_snapshot.brand_performance} />
                                <LLMPerformanceSection data={report.data_snapshot.llm_performance} />
                                <CompetitiveLandscapeSection data={report.data_snapshot.competitive_landscape} />
                                <DomainReadinessSection data={report.data_snapshot.domain_readiness} />
                                <ActionsImpactSection data={report.data_snapshot.actions_impact} />
                                <TopMoversSection data={report.data_snapshot.top_movers} />
                            </div>
                        </div>
                    ) : (
                        <div className="executive-empty-state">
                            <IconFileText className="executive-empty-icon" />
                            <h3 className="executive-empty-title">No Reports Yet</h3>
                            <p className="executive-empty-text">
                                Generate your first executive report to get comprehensive AEO insights
                            </p>
                            <button
                                onClick={generateReport}
                                disabled={generating}
                                className="executive-btn-primary"
                            >
                                {generating ? (
                                    <>
                                        <IconLoader className="w-4 h-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <IconFileText className="w-4 h-4" />
                                        Generate First Report
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};
