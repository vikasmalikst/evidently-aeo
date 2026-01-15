import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import { KpiToggle } from '../../components/Visibility/KpiToggle';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { DateRangePicker } from '../../components/DateRangePicker/DateRangePicker';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useCachedData } from '../../hooks/useCachedData';
import { formatDateWithYear } from '../../utils/dateFormatting';
import { LoadingScreen } from '../../components/common/LoadingScreen';

// Components
import { QueriesRankedTable } from './components/QueriesRankedTable';
import { QueryAnalysisMultiView } from './components/QueryAnalysisMultiView';
import { CompactMetricsPods } from './components/CompactMetricsPods';

// Types
import type { QueriesAnalysisData, Query, QueriesPortfolio, QueriesPerformance } from './types';
import type { PromptAnalyticsPayload, PromptEntry } from '../../types/prompts';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const QueriesAnalysisPage = () => {
    const { selectedBrand, selectedBrandId } = useManualBrandDashboard();
    const [metricType, setMetricType] = useState<'visibility' | 'sentiment'>('visibility');
    
    // Date Range State
    const [startDate, setStartDate] = useState<string>(() => {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 29);
        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        return formatDate(start);
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });

    // LLM Filters
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    // Determine normalized models for API call (currently not strictly used for filtering locally, 
    // but typically passed to backend. In Prompts.tsx logic, backend filters by collector if passed).
    
    // Data Fetching
    const promptsEndpoint = useMemo(() => {
        if (!selectedBrandId) return null;
        const params = new URLSearchParams({
            startDate: startDate ? new Date(startDate + 'T00:00:00Z').toISOString() : '',
            endDate: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : ''
        });
        if (selectedModels.length > 0) {
            params.set('collectors', selectedModels.join(','));
        }
        return `/brands/${selectedBrandId}/prompts?${params.toString()}`;
    }, [selectedBrandId, startDate, endDate, selectedModels]);

    const { data: response, loading, error } = useCachedData<ApiResponse<PromptAnalyticsPayload>>(
        promptsEndpoint,
        {},
        { requiresAuth: true },
        { enabled: !!promptsEndpoint, refetchOnMount: false }
    );

    // Update Available LLMs from response (collectors list)
    useEffect(() => {
        if (response?.data?.collectors) {
             // Union existing available models with new ones to avoid flickering
             setAvailableModels(prev => {
                 const newSet = new Set([...prev, ...response.data!.collectors]);
                 return Array.from(newSet).sort();
             });
        }
    }, [response]);


    // Transform Data
    const analysisData = useMemo<QueriesAnalysisData | null>(() => {
        if (!response?.success || !response.data) return null;

        const rawData = response.data;
        const allPrompts: PromptEntry[] = rawData.topics.flatMap(t => t.prompts);

        // Map PromptEntry to Query
        const queries: Query[] = allPrompts.map((p, index) => {
            return {
                id: p.id,
                promptId: p.id,
                rank: index + 1, // Simple rank for now based on order
                text: p.question,
                topic: p.topic,
                visibilityScore: p.visibilityScore,
                sentimentScore: p.sentimentScore,
                trend: { direction: 'neutral', delta: 0 }, // Placeholder for trend
                searchVolume: p.volumeCount,
                sentiment: p.sentimentScore && p.sentimentScore > 60 ? 'positive' : p.sentimentScore && p.sentimentScore < 40 ? 'negative' : 'neutral',
            };
        });

        // Portfolio Stats
        const portfolio: QueriesPortfolio = {
            totalQueries: rawData.totalPrompts,
            avgVisibility: queries.reduce((S, q) => S + (q.visibilityScore || 0), 0) / (queries.length || 1),
            avgSentiment: queries.reduce((S, q) => S + (q.sentimentScore || 0), 0) / (queries.length || 1),
            lastUpdated: new Date().toISOString(), // Mock for now
        };

        // Performance Stats (Mocking Deltas for now as API might not provide historical directly here without comparison)
        const performance: QueriesPerformance = {
            avgVisibility: portfolio.avgVisibility,
            avgVisibilityDelta: 0,
            topGainer: { query: '-', delta: 0 },
            topLoser: { query: '-', delta: 0 }
        };

        return { portfolio, performance, queries };

    }, [response]);

    const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());

    // Effect to select all queries by default when data loads
    useEffect(() => {
        if (analysisData?.queries) {
             // Select top 20 by default so chart isn't empty but also not overwhelmed
             // Or select all? Let's select top 10 for chart clarity
             const ids = analysisData.queries.slice(0, 10).map(q => q.id);
             setSelectedQueries(new Set(ids));
        }
    }, [analysisData?.queries]);

    const handleQueryClick = useCallback((query: Query) => {
        // Maybe open a modal detail view? For now just log
        console.log("Clicked query", query);
    }, []);

    // Filter queries for chart based on selection
    const chartQueries = useMemo(() => {
        if (!analysisData?.queries) return [];
        return analysisData.queries.filter(q => selectedQueries.has(q.id));
    }, [analysisData, selectedQueries]);


    if (loading && !response) {
        return (
            <Layout>
                <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
                     <LoadingScreen message="Loading queries analysis..." />
                </div>
            </Layout>
        );
    }
    
    const brandName = selectedBrand?.name || 'Your Brand';

    return (
        <Layout>
            <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
                {/* Header */}
                 <div
                    style={{
                        backgroundColor: '#ffffff',
                        padding: '24px',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        marginBottom: '24px',
                        position: 'relative',
                        minHeight: '80px'
                    }}
                >
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flex: 1 }}>
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
                                <h1 className="text-2xl font-bold text-[#1a1d29] tracking-tight m-0 mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                                    Queries Analysis {brandName && `— ${brandName}`}
                                </h1>
                                <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
                                    Detailed analysis of query performance and visibility.
                                </p>
                            </div>
                        </div>
                        <div style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: '-24px', paddingBottom: '24px' }}>
                            <DateRangePicker
                                key={`${startDate}-${endDate}`}
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={setStartDate}
                                onEndDateChange={setEndDate}
                                showComparisonInfo={false}
                                className="flex-shrink-0"
                            />
                        </div>
                     </div>
                </div>

                {/* Controls */}
                <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                    <KpiToggle
                        metricType={metricType === 'visibility' ? 'visibility' : 'sentiment'}
                        onChange={(val: any) => setMetricType(val)} // Cast because KpiToggle accepts broader types
                        allowedMetricTypes={['visibility', 'sentiment']}
                    />

                    {/* LLM Filter */}
                     <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedModels([])}
                            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${selectedModels.length === 0
                                ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48]'
                                : 'bg-white border-[#e4e7ec] text-[#6c7289] hover:border-[#cfd4e3]'
                            }`}
                        >
                            All
                        </button>
                        {availableModels.map((model) => {
                            const isActive = selectedModels.includes(model);
                            return (
                                <button
                                    key={model}
                                    type="button"
                                    onClick={() =>
                                        setSelectedModels((prev) =>
                                            prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
                                        )
                                    }
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${isActive
                                        ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48] shadow-sm'
                                        : 'bg-white border-[#e4e7ec] text-[#1a1d29] hover:border-[#cfd4e3]'
                                    }`}
                                    title={model}
                                >
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white">
                                        {getLLMIcon(model)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Metrics Pods */}
                {analysisData && (
                     <div className="mb-6">
                        <CompactMetricsPods
                            portfolio={analysisData.portfolio}
                            performance={analysisData.performance}
                            queries={analysisData.queries}
                            metricType={metricType}
                        />
                    </div>
                )}

                {/* Charts */}
                {analysisData && (
                    <div className="mb-6">
                        <QueryAnalysisMultiView
                            queries={chartQueries}
                            metricType={metricType}
                            isLoading={loading}
                        />
                    </div>
                )}


                {/* Table */}
                {analysisData && (
                    <div className="mb-6">
                        <QueriesRankedTable
                            queries={analysisData.queries}
                            selectedQueries={selectedQueries}
                            onSelectedQueriesChange={setSelectedQueries}
                            metricType={metricType}
                            onRowClick={handleQueryClick}
                        />
                    </div>
                )}

                 {/* Fallback Empty */}
                 {!analysisData && !loading && (
                      <div className="bg-white p-8 rounded-lg border border-gray-200 text-center">
                          <p>No data found for this period.</p>
                      </div>
                 )}

            </div>
        </Layout>
    );
};
