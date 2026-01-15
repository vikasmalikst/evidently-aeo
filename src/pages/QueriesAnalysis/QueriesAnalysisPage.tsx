import { useMemo, useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { DateRangePicker } from '../../components/DateRangePicker/DateRangePicker';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useCachedData } from '../../hooks/useCachedData';
import { LoadingScreen } from '../../components/common/LoadingScreen';

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
    const [selectedTopic, setSelectedTopic] = useState<string>('All');

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
            if (relevantResponses.length > 0) {
                 const mentions = relevantResponses.filter(r => (r.brandMentions || 0) > 0).length;
                 soa = (mentions / relevantResponses.length) * 100;
            }

            return {
                id: p.id,
                promptId: p.id,
                rank: index + 1,
                text: p.question,
                topic: p.topic,
                visibilityScore: p.visibilityScore,
                soa,
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

                    <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>

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
        </Layout>
    );
};
