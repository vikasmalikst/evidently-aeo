import { useMemo, useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { DateRangePicker } from '../../components/DateRangePicker/DateRangePicker';
import { getDefaultDateRange } from '../dashboard/utils';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useCachedData } from '../../hooks/useCachedData';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { motion } from 'framer-motion';

// Components
import { QueriesRankedTable } from './components/QueriesRankedTable';

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

    // Date Range State
    const { start: defaultStart, end: defaultEnd } = getDefaultDateRange();
    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);

    // LLM Filters
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [hoveredLlmIndex, setHoveredLlmIndex] = useState<number | null>(null);

    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>('All');

    // Data Fetching
    const promptsEndpoint = useMemo(() => {
        if (!selectedBrandId) return null;
        const params = new URLSearchParams({
            startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : '',
            endDate: endDate ? new Date(endDate + 'T23:59:59.999').toISOString() : ''
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
            // Calculate SoA if responses are available, respecting selectedModels if present
            // Note: If backend handles filtering, p.responses might already be filtered. 
            // unique topic filtering happens later, but here we define the query object.

            // We'll calculate "Client-Side SoA" based on available responses in the payload 
            // that match the selected models (if any are selected).
            let relevantResponses = p.responses || [];
            if (selectedModels.length > 0) {
                relevantResponses = relevantResponses.filter(r => selectedModels.includes(r.collectorType));
            }

            let soa: number | null = null;
            let brandPresence: number | null = null;

            if (relevantResponses.length > 0) {
                // 1. Brand Presence: % of responses where brand appears (frequency)
                // Based on: (Count of responses where brand appears) / (Total responses) * 100
                const responsesWithBrand = relevantResponses.filter(r => (r.brandMentions || 0) > 0).length;
                brandPresence = (responsesWithBrand / relevantResponses.length) * 100;

                // 2. Share of Answers (SoA): Share of Voice
                // Based on: (Total Brand Mentions) / (Total Brand Mentions + Total Competitor Mentions) * 100
                let totalBrandMentions = 0;
                let totalCompetitorMentions = 0;

                relevantResponses.forEach(r => {
                    totalBrandMentions += (r.brandMentions || 0);
                    totalCompetitorMentions += (r.competitorMentions || 0);
                });

                const totalMentions = totalBrandMentions + totalCompetitorMentions;
                if (totalMentions > 0) {
                    soa = (totalBrandMentions / totalMentions) * 100;
                } else {
                    // If no one is mentioned, SoA is 0 (or null? standard practice is 0 if no voice exists)
                    soa = 0;
                }
            }

            return {
                id: p.id,
                promptId: p.id,
                rank: index + 1,
                text: p.question,
                topic: p.topic,
                visibilityScore: p.visibilityScore,
                soa,
                brandPresence,
                sentimentScore: p.sentimentScore,
                trend: { direction: 'neutral', delta: 0 },
                searchVolume: p.volumeCount,
                sentiment: p.sentimentScore && p.sentimentScore > 60 ? 'positive' : p.sentimentScore && p.sentimentScore < 40 ? 'negative' : 'neutral',
                collectorTypes: p.collectorTypes
            };
        });

        // Portfolio Stats (Kept for structure but unused in UI currently)
        const portfolio: QueriesPortfolio = {
            totalQueries: rawData.totalPrompts,
            avgVisibility: 0,
            avgSentiment: 0,
            lastUpdated: new Date().toISOString(),
        };

        const performance: QueriesPerformance = {
            avgVisibility: 0,
            avgVisibilityDelta: 0,
            topGainer: { query: '-', delta: 0 },
            topLoser: { query: '-', delta: 0 }
        };

        return { portfolio, performance, queries };

    }, [response, selectedModels]);

    // Filter queries based on selected Topic AND selected LLMs
    // (Even if backend filters, we double check here to be sure, and to handle empty states correctly)
    const filteredQueries = useMemo(() => {
        if (!analysisData?.queries) return [];

        let filtered = analysisData.queries;

        // 1. Filter by Topic
        if (selectedTopic !== 'All') {
            filtered = filtered.filter(q => q.topic === selectedTopic);
        }

        // 2. Filter by LLM (if query wasn't run on selected LLM, hide it)
        if (selectedModels.length > 0) {
            filtered = filtered.filter(q => {
                if (!q.collectorTypes) return false;
                return q.collectorTypes.some(type => selectedModels.includes(type));
            });
        }

        return filtered;
    }, [analysisData, selectedTopic, selectedModels]);

    // Extract available topics
    const availableTopics = useMemo(() => {
        if (!analysisData?.queries) return [];
        const topics = new Set(analysisData.queries.map(q => q.topic));
        return Array.from(topics).sort();
    }, [analysisData]);

    const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());

    const handleQueryClick = useCallback((query: Query) => {
        console.log("Clicked query", query);
    }, []);

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
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '-24px', paddingBottom: '24px' }}>
                            <DateRangePicker
                                key={`${startDate}-${endDate}`}
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={setStartDate}
                                onEndDateChange={setEndDate}
                                showComparisonInfo={false}
                                className="flex-shrink-0"
                            />

                            {/* LLM Selector/Filter Icons */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">LLMs</span>
                                    <div className="relative flex items-center bg-[#f1f5f9] rounded-xl p-1 gap-0.5">
                                        {/* "All" Button */}
                                        <button
                                            type="button"
                                            onClick={() => setSelectedModels([])}
                                            onMouseEnter={() => setHoveredLlmIndex(-1)}
                                            onMouseLeave={() => setHoveredLlmIndex(null)}
                                            className="relative px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors z-10 cursor-pointer border-0"
                                        >
                                            {hoveredLlmIndex === -1 && (
                                                <motion.span
                                                    className="absolute inset-0 bg-white/80 rounded-lg -z-10 shadow-sm"
                                                    layoutId="llm-filter-hover"
                                                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                                />
                                            )}
                                            <span className={`relative z-10 ${selectedModels.length === 0 ? 'text-[#1a1d29] font-bold' : 'text-[#64748b]'}`}>
                                                All
                                            </span>
                                        </button>

                                        {/* Individual LLM Buttons */}
                                        {availableModels.map((model, index) => {
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
                                                    onMouseEnter={() => setHoveredLlmIndex(index)}
                                                    onMouseLeave={() => setHoveredLlmIndex(null)}
                                                    className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors z-10 cursor-pointer border-0"
                                                    title={model}
                                                >
                                                    {hoveredLlmIndex === index && (
                                                        <motion.span
                                                            className="absolute inset-0 bg-white/80 rounded-lg -z-10 shadow-sm"
                                                            layoutId="llm-filter-hover"
                                                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                                        />
                                                    )}
                                                    <span className={`relative z-10 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                                                        {getLLMIcon(model)}
                                                    </span>
                                                    {isActive && (
                                                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#06b6d4] rounded-full" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 flex items-center justify-start gap-80 flex-wrap">
                    {/* Topic Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Topic:</span>
                        <select
                            value={selectedTopic}
                            onChange={(e) => setSelectedTopic(e.target.value)}
                            className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all cursor-pointer"
                            style={{ backgroundImage: 'none', appearance: 'auto' }} // Simple native select for now
                        >
                            <option value="All">All Topics</option>
                            {availableTopics.map(topic => (
                                <option key={topic} value={topic}>{topic}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                {analysisData && (
                    <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <QueriesRankedTable
                            queries={filteredQueries}
                            selectedQueries={selectedQueries}
                            onSelectedQueriesChange={setSelectedQueries}
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
        </Layout >
    );
};
