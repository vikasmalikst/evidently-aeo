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
import { OpportunitiesSection } from './components/OpportunitiesSection';
import { TopMoversSection } from './components/TopMoversSection';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { ReportGenerationModal } from './components/ReportGenerationModal';
import { EmailReportModal } from './components/EmailReportModal';
import { ReportCoverPage } from './components/ReportCoverPage';
import { ReportTableOfContents } from './components/ReportTableOfContents';
import { FeedbackSideModal } from './components/FeedbackSideModal';
import { ExportSuccessModal } from './components/ExportSuccessModal';
import { IconMail } from '@tabler/icons-react';
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
    const [generating, setGenerating] = useState(false);
    const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);
    const [isEmailV2ModalOpen, setIsEmailV2ModalOpen] = useState(false);
    const [isPrintMode, setIsPrintMode] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [isExportSuccessModalOpen, setIsExportSuccessModalOpen] = useState(false);
    const [exportingStatus, setExportingStatus] = useState<'idle' | string>('idle');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('printMode') === 'true') {
            setIsPrintMode(true);
        }
    }, []);

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
                {}
            );

            if (response.success && response.data) {
                setReport(response.data);
            } else {
                throw new Error('Failed to generate report');
            }
        } catch (err) {
            console.error('Error generating report:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate report');
            // Re-throw so modal knows about error
            throw err;
        } finally {
            setGenerating(false);
        }
    };

    const handleUpdateSummary = async (newSummary: string) => {
        if (!report || !selectedBrandId) return;

        try {
            const response = await apiClient.patch<{ success: boolean; data: ExecutiveReport }>(
                `/brands/${selectedBrandId}/executive-reports/${report.id}`,
                { executive_summary: newSummary }
            );

            if (response.success && response.data) {
                setReport(response.data);
            }
        } catch (err) {
            console.error('Error updating summary:', err);
            throw err;
        }
    };

    const handleRegenerateSummary = async (feedback: string) => {
        if (!report || !selectedBrandId) return;

        try {
            const response = await apiClient.post<{ success: boolean; data: ExecutiveReport }>(
                `/brands/${selectedBrandId}/executive-reports/${report.id}/regenerate-summary`,
                { user_feedback: feedback }
            );

            if (response.success && response.data) {
                setReport(response.data);
            }
        } catch (err) {
            console.error('Error regenerating summary:', err);
            throw err;
        }
    };

    const handleEmailReportV2 = async (email: string) => {
        if (!report || !selectedBrandId) return;

        try {
            const response = await apiClient.post<{ success: boolean }>(
                `/brands/${selectedBrandId}/executive-reports/${report.id}/email-v2`,
                { email }
            );

            if (!response.success) {
                throw new Error('Failed to email report');
            }
        } catch (err: any) {
            console.error('Error emailing report:', err);
            throw new Error(err.message || 'Failed to email report');
        }
    };

    const exportPDFV2 = async () => {
        if (!report) return;

        try {
            setExportingStatus('Initializing browser...');
            const token = apiClient.getAccessToken();

            // Start the request
            const responsePromise = fetch(
                `${apiClient.baseUrl}/brands/${selectedBrandId}/executive-reports/${report.id}/export/pdf-v2`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            // Simulate progress while waiting for the response
            const progressSteps = [
                'Navigating to report...',
                'Rendering charts...',
                'Generating high-fidelity PDF...',
                'Finalizing report layout...'
            ];

            let stepIndex = 0;
            const interval = setInterval(() => {
                if (stepIndex < progressSteps.length) {
                    setExportingStatus(progressSteps[stepIndex]);
                    stepIndex++;
                }
            }, 5000); // Change status every 5 seconds

            const response = await responsePromise;
            clearInterval(interval);

            if (!response.ok) {
                throw new Error('Failed to export PDF');
            }

            setExportingStatus('Downloading...');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Format: {brand_name}{dd_mm_YYYY_hh_MM}
            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}`;
            const cleanBrandName = selectedBrand?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'report';
            const fileName = `${cleanBrandName}_${dateStr}.pdf`;

            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success modal
            setIsExportSuccessModalOpen(true);
        } catch (err) {
            console.error('Error exporting PDF:', err);
            setError(err instanceof Error ? err.message : 'Failed to export PDF');
        } finally {
            setExportingStatus('idle');
        }
    };

    if (loading) {
        return (
            <Layout hideSidebar={isPrintMode} hideHeader={isPrintMode}>
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

    // Prepare filename for success modal preview (re-calculate or store in state - re-calc is cheap enough here for display)
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}_${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}`;
    const cleanBrandName = selectedBrand?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'report';
    const displayFileName = `${cleanBrandName}_${dateStr}.pdf`;

    return (
        <Layout hideSidebar={isPrintMode} hideHeader={isPrintMode}>
            {isPrintMode && selectedBrand && report && (
                <>
                    <ReportCoverPage
                        brandName={selectedBrand.name}
                        brandLogo={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                        brandDomain={selectedBrand.homepage_url || undefined}
                        reportPeriod={`${new Date(report.report_period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} – ${new Date(report.report_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                    />
                    <ReportTableOfContents />
                </>
            )}
            <div className="executive-report-container">
                {/* Header Section */}
                {!isPrintMode && (
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
                                    <button
                                        onClick={() => setIsGenerationModalOpen(true)}
                                        // disabled={generating} // Let modal handle strict state or concurrent check if needed
                                        className="executive-btn-primary"
                                    >
                                        <IconFileText className="w-4 h-4" />
                                        Update Report
                                    </button>

                                    {report && (
                                        <>
                                            <button onClick={() => setIsEmailV2ModalOpen(true)} className="executive-btn-secondary" title="Send Email Report">
                                                <IconMail className="w-4 h-4" />
                                                Email Report
                                            </button>
                                            <button
                                                onClick={exportPDFV2}
                                                className="executive-btn-secondary"
                                                title="Download PDF Report"
                                                disabled={exportingStatus !== 'idle'}
                                            >
                                                {exportingStatus === 'idle' ? (
                                                    <>
                                                        <IconDownload className="w-4 h-4" />
                                                        Export PDF
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconLoader className="w-4 h-4 animate-spin" />
                                                        {exportingStatus}
                                                    </>
                                                )}
                                            </button>
                                        </>
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
                )}

                {/* Report Content */}
                < div className="max-w-7xl mx-auto p-6" >
                    {
                        report ? (
                            <div className="space-y-6" >
                                {/* Report Info Bar */}
                                < div className="executive-info-bar" >
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
                                        <div id="executive-summary" className="scroll-mt-8">
                                            <ExecutiveSummarySection
                                                summary={report.executive_summary}
                                                onUpdate={handleUpdateSummary}
                                                onOpenFeedback={() => setIsFeedbackModalOpen(true)}
                                            />
                                        </div>
                                    )}
                                    <div id="brand-performance" className="scroll-mt-8">
                                        <BrandPerformanceSection data={report.data_snapshot.brand_performance} />
                                    </div>
                                    <div id="llm-performance" className="scroll-mt-8">
                                        <LLMPerformanceSection data={report.data_snapshot.llm_performance} />
                                    </div>
                                    <div id="competitive-landscape" className="scroll-mt-8">
                                        <CompetitiveLandscapeSection data={report.data_snapshot.competitive_landscape} />
                                    </div>
                                    <div id="domain-readiness" className="scroll-mt-8">
                                        <DomainReadinessSection data={report.data_snapshot.domain_readiness} />
                                    </div>
                                    <div id="actions-impact" className="scroll-mt-8">
                                        <ActionsImpactSection data={report.data_snapshot.actions_impact} />
                                    </div>
                                    <div id="opportunities" className="scroll-mt-8">
                                        <OpportunitiesSection data={report.data_snapshot.opportunities} />
                                    </div>
                                    <div id="top-movers" className="scroll-mt-8">
                                        <TopMoversSection data={report.data_snapshot.top_movers} />
                                    </div>
                                </div>
                            </div >
                        ) : (
                            <div className="executive-empty-state">
                                <IconFileText className="executive-empty-icon" />
                                <h3 className="executive-empty-title">No Reports Yet</h3>
                                <p className="executive-empty-text">
                                    Generate your first executive report to get comprehensive AEO insights
                                </p>
                                <button
                                    onClick={() => setIsGenerationModalOpen(true)}
                                    className="executive-btn-primary"
                                >
                                    <IconFileText className="w-4 h-4" />
                                    Generate First Report
                                </button>
                            </div>
                        )}
                </div >
            </div >
            {/* Generation Modal */}
            <ReportGenerationModal
                isOpen={isGenerationModalOpen}
                onClose={() => setIsGenerationModalOpen(false)}
                brandName={selectedBrand?.name || 'Brand'}
                onGenerate={generateReport}
            />

            {/* Email V2 Modal */}
            <EmailReportModal
                isOpen={isEmailV2ModalOpen}
                onClose={() => setIsEmailV2ModalOpen(false)}
                brandName={selectedBrand?.name || 'Brand'}
                onSend={handleEmailReportV2}
                themeColor={selectedBrand?.metadata?.brand_color || undefined}
            />

            {/* Feedback Side Modal */}
            <FeedbackSideModal
                isOpen={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
                currentSummary={report?.executive_summary || ''}
                onRegenerate={handleRegenerateSummary}
                brandId={selectedBrandId || undefined}
            />

            {/* Export Success Modal */}
            <ExportSuccessModal
                isOpen={isExportSuccessModalOpen}
                onClose={() => setIsExportSuccessModalOpen(false)}
                fileName={displayFileName}
                themeColor={selectedBrand?.metadata?.brand_color || undefined}
            />
        </Layout >
    );
};
