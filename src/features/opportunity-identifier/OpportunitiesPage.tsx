/**
 * OpportunitiesQBRES Page - Query-Based Opportunity Identifier
 * 
 * Displays opportunities where brand performance needs improvement.
 * Categories:
 * 1. Brand + Competitor mentioned - Compare against specific competitor
 * 2. Brand only - Absolute thresholds
 * 3. Unbiased - Compare against any competitor
 */

import { useMemo, useState } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { DateRangePicker } from '../../components/DateRangePicker/DateRangePicker';
import { getDefaultDateRange } from '../../pages/dashboard/utils';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useCachedData } from '../../hooks/useCachedData';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient } from '../../lib/apiClient';
import { OpportunityResponse } from '../../types/opportunity';
import { OpportunityFlagsTable } from './components/OpportunityFlagsTable';

// Severity colors
const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    High: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
    Medium: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
    Low: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' }
};

// Heatmap color for gaps
function getGapColor(gap: number): string {
    if (gap >= 20) return 'rgba(220, 38, 38, 0.15)'; // Critical - red tint
    if (gap >= 10) return 'rgba(234, 88, 12, 0.12)'; // High - orange tint
    if (gap >= 5) return 'rgba(202, 138, 4, 0.10)';  // Medium - yellow tint
    return 'rgba(37, 99, 235, 0.08)';                // Low - blue tint
}

export const OpportunitiesQBRES = () => {
    const { selectedBrand, selectedBrandId } = useManualBrandDashboard();

    // Date Range State
    const { start: defaultStart, end: defaultEnd } = getDefaultDateRange();
    const [startDate, setStartDate] = useState<string>(defaultStart);
    const [endDate, setEndDate] = useState<string>(defaultEnd);

    // Filters
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
    const [selectedMetric, setSelectedMetric] = useState<string>('All');
    const [sortField, setSortField] = useState<'priorityScore' | 'gap'>('priorityScore');
    const [sortAsc, setSortAsc] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    // View Mode State
    const [viewMode, setViewMode] = useState<'grouped' | 'flags'>('grouped');

    // Calculate days from date range
    const days = useMemo(() => {
        if (!startDate || !endDate) return 14;
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, [startDate, endDate]);

    // Data Fetching
    const endpoint = useMemo(() => {
        if (!selectedBrandId) return null;
        const params = new URLSearchParams({ days: String(days) });
        return `/brands/${selectedBrandId}/opportunities?${params.toString()}`;
    }, [selectedBrandId, days]);

    const { data: response, loading, error } = useCachedData<OpportunityResponse>(
        endpoint,
        {},
        { requiresAuth: true },
        { enabled: !!endpoint, refetchOnMount: true }
    );

    // Filter opportunities
    const filteredOpportunities = useMemo(() => {
        if (!response?.opportunities) return [];

        let filtered = [...response.opportunities];

        // Filter by category
        if (selectedCategory !== 'All') {
            const cat = parseInt(selectedCategory);
            filtered = filtered.filter(o => o.queryCategory === cat);
        }

        // Filter by severity
        if (selectedSeverity !== 'All') {
            filtered = filtered.filter(o => o.severity === selectedSeverity);
        }

        // Filter by metric
        if (selectedMetric !== 'All') {
            filtered = filtered.filter(o => o.metricName === selectedMetric);
        }

        // Sort
        filtered.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            return sortAsc ? aVal - bVal : bVal - aVal;
        });

        return filtered;
    }, [response, selectedCategory, selectedSeverity, selectedMetric, sortField, sortAsc]);

    // Unique Flags Logic (One per query, highest priority)
    const uniqueFlags = useMemo(() => {
        const unique = new Map<string, typeof filteredOpportunities[0]>();

        filteredOpportunities.forEach(opp => {
            const existing = unique.get(opp.queryId);
            if (!existing || opp.priorityScore > existing.priorityScore) {
                unique.set(opp.queryId, opp);
            }
        });

        // Convert to array and sort by priority
        return Array.from(unique.values()).sort((a, b) => b.priorityScore - a.priorityScore);
    }, [filteredOpportunities]);

    // Group opportunities by query (for Grouped View)
    const groupedOpportunities = useMemo(() => {
        const queryGroups = new Map<string, any>();

        filteredOpportunities.forEach(opp => {
            if (!queryGroups.has(opp.queryId)) {
                queryGroups.set(opp.queryId, {
                    queryId: opp.queryId,
                    queryText: opp.queryText,
                    queryCategory: opp.queryCategory,
                    topic: opp.topic,
                    responseCount: opp.responseCount,
                    metrics: {},
                    highestSeverity: opp.severity,
                    topSources: [...opp.topSources]
                });
            }

            const group = queryGroups.get(opp.queryId);
            group.metrics[opp.metricName] = opp;

            // Track highest severity
            const severityOrder: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
            if (severityOrder[opp.severity] > severityOrder[group.highestSeverity]) {
                group.highestSeverity = opp.severity;
            }

            // Consolidate top sources (avoiding duplicates)
            opp.topSources.forEach(source => {
                if (!group.topSources.some((s: { domain: string }) => s.domain === source.domain)) {
                    group.topSources.push(source);
                }
            });
        });

        return Array.from(queryGroups.values());
    }, [filteredOpportunities]);

    const handleSort = (field: 'priorityScore' | 'gap') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const handleGenerateRecommendations = async () => {
        if (!selectedBrandId) return;

        setIsGenerating(true);
        try {
            console.log(`🚀 [OpportunitiesPage] Generating recommendations for brand: ${selectedBrandId}`);
            const result = await apiClient.post<any>(`/brands/${selectedBrandId}/recommendations`, {}, { timeout: 180000 });

            if (result.success) {
                alert(`✅ Successfully generated ${result.recommendationsCount} recommendations! You can view them on the Improve -> Recommendations page.`);
            } else {
                alert(`❌ Failed to generate recommendations: ${result.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('[OpportunitiesPage] Error generating recommendations:', err);
            alert(`❌ Error: ${err instanceof Error ? err.message : 'An unexpected error occurred'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading && !response) {
        return (
            <Layout>
                <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
                    <LoadingScreen message="Identifying opportunities..." />
                </div>
            </Layout>
        );
    }

    const brandName = selectedBrand?.name || 'Your Brand';
    const summary = response?.summary;

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
                        marginBottom: '24px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
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
                                    Query-Based Opportunities — {brandName}
                                </h1>
                                <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
                                    Opportunities identified where {brandName} performance needs improvement.
                                </p>
                            </div>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                            <DateRangePicker
                                key={`${startDate}-${endDate}`}
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={setStartDate}
                                onEndDateChange={setEndDate}
                                showComparisonInfo={false}
                            />
                            <button
                                onClick={handleGenerateRecommendations}
                                disabled={isGenerating || (response?.opportunities?.length === 0)}
                                className={`mt-4 w-full h-11 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all shadow-sm ${isGenerating || (response?.opportunities?.length === 0)
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:transform active:scale-[0.98] border border-indigo-700'
                                    }`}
                                style={{ fontFamily: 'Sora, sans-serif' }}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Generating Strategy...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                                        </svg>
                                        <span>Generate AI Recommendations</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                            <div className="text-3xl font-bold text-[#1a1d29]">{summary.total}</div>
                            <div className="text-sm text-slate-500">Total Opportunities</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-red-600">{summary.bySeverity.critical}</span>
                                <span className="text-xl font-bold text-orange-500">{summary.bySeverity.high}</span>
                                <span className="text-xl font-bold text-yellow-600">{summary.bySeverity.medium}</span>
                                <span className="text-xl font-bold text-blue-600">{summary.bySeverity.low}</span>
                            </div>
                            <div className="text-sm text-slate-500">By Severity</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-sm"><span className="font-bold">{summary.byCategory[1]}</span> B+C</span>
                                <span className="text-sm"><span className="font-bold">{summary.byCategory[2]}</span> Brand</span>
                                <span className="text-sm"><span className="font-bold">{summary.byCategory[3]}</span> Unbiased</span>
                            </div>
                            <div className="text-sm text-slate-500">By Category</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-sm"><span className="font-bold">{summary.byMetric.visibility}</span> Vis</span>
                                <span className="text-sm"><span className="font-bold">{summary.byMetric.soa}</span> SOA</span>
                                <span className="text-sm"><span className="font-bold">{summary.byMetric.sentiment}</span> Sent</span>
                            </div>
                            <div className="text-sm text-slate-500">By Metric</div>
                        </div>
                    </div>
                )}

                {/* Controls Bar */}
                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                    {/* Filters */}
                    <div className="flex items-center gap-6 flex-wrap">
                        {/* Category Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category:</span>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all cursor-pointer"
                            >
                                <option value="All">All Categories</option>
                                <option value="1">Brand + Competitor</option>
                                <option value="2">Brand Only</option>
                                <option value="3">Unbiased</option>
                            </select>
                        </div>

                        {/* Severity Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Severity:</span>
                            <select
                                value={selectedSeverity}
                                onChange={(e) => setSelectedSeverity(e.target.value)}
                                className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all cursor-pointer"
                            >
                                <option value="All">All Severities</option>
                                <option value="Critical">Critical</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>

                        {/* Metric Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metric:</span>
                            <select
                                value={selectedMetric}
                                onChange={(e) => setSelectedMetric(e.target.value)}
                                className="h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all cursor-pointer"
                            >
                                <option value="All">All Metrics</option>
                                <option value="visibility">Visibility</option>
                                <option value="soa">Share of Answer</option>
                                <option value="sentiment">Sentiment</option>
                            </select>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grouped')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'grouped'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Grouped
                        </button>
                        <button
                            onClick={() => setViewMode('flags')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'flags'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Detailed Flags
                        </button>
                    </div>
                </div>

                {/* Content */}
                {viewMode === 'flags' ? (
                    <OpportunityFlagsTable opportunities={uniqueFlags} />
                ) : (
                    <>
                        {/* Grouped Opportunities Table */}
                        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-gray-200">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Query</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-24">Category</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Visibility</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">SOA</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">Sentiment</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-24">Severity</th>
                                        <th className="text-left px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider w-48">Top Sources</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedOpportunities.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-500">
                                                {response?.opportunities?.length === 0
                                                    ? 'No opportunities identified. Great job!'
                                                    : 'No opportunities match the selected filters.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedOpportunities.map((group) => (
                                            <tr
                                                key={group.queryId}
                                                className="border-b border-gray-100 hover:bg-slate-50 transition-colors"
                                            >
                                                {/* Query Text */}
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-slate-800 max-w-md" title={group.queryText}>
                                                        {group.queryText}
                                                    </div>
                                                    {group.topic && (
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{group.topic}</div>
                                                    )}
                                                </td>

                                                {/* Category */}
                                                <td className="text-center px-3 py-3">
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                                        CAT {group.queryCategory}
                                                    </span>
                                                </td>

                                                {/* Metrics - Visibility */}
                                                <td className="px-3 py-3 border-x border-slate-50">
                                                    {group.metrics.visibility ? (
                                                        <div className="flex flex-col items-center">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-semibold text-slate-700">{group.metrics.visibility.brandValue.toFixed(1)}%</span>
                                                                <span className="text-[10px] text-slate-400" title={group.metrics.visibility.competitor || 'Absolute Threshold'}>
                                                                    vs {group.metrics.visibility.targetValue.toFixed(0)}%
                                                                    {group.metrics.visibility.competitor && ` (${group.metrics.visibility.competitor})`}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                                style={{ backgroundColor: getGapColor(group.metrics.visibility.gap), color: SEVERITY_COLORS[group.metrics.visibility.severity].text }}
                                                            >
                                                                -{group.metrics.visibility.gap.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-200 text-xs">—</div>
                                                    )}
                                                </td>

                                                {/* Metrics - SOA */}
                                                <td className="px-3 py-3 border-x border-slate-50">
                                                    {group.metrics.soa ? (
                                                        <div className="flex flex-col items-center">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-semibold text-slate-700">{group.metrics.soa.brandValue.toFixed(1)}%</span>
                                                                <span className="text-[10px] text-slate-400" title={group.metrics.soa.competitor || 'Absolute Threshold'}>
                                                                    vs {group.metrics.soa.targetValue.toFixed(0)}%
                                                                    {group.metrics.soa.competitor && ` (${group.metrics.soa.competitor})`}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                                style={{ backgroundColor: getGapColor(group.metrics.soa.gap), color: SEVERITY_COLORS[group.metrics.soa.severity].text }}
                                                            >
                                                                -{group.metrics.soa.gap.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-200 text-xs">—</div>
                                                    )}
                                                </td>

                                                {/* Metrics - Sentiment */}
                                                <td className="px-3 py-3 border-x border-slate-50">
                                                    {group.metrics.sentiment ? (
                                                        <div className="flex flex-col items-center">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-semibold text-slate-700">{group.metrics.sentiment.brandValue.toFixed(1)}%</span>
                                                                <span className="text-[10px] text-slate-400" title={group.metrics.sentiment.competitor || 'Absolute Threshold'}>
                                                                    vs {group.metrics.sentiment.targetValue.toFixed(0)}%
                                                                    {group.metrics.sentiment.competitor && ` (${group.metrics.sentiment.competitor})`}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                                style={{ backgroundColor: getGapColor(group.metrics.sentiment.gap), color: SEVERITY_COLORS[group.metrics.sentiment.severity].text }}
                                                            >
                                                                -{group.metrics.sentiment.gap.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-200 text-xs">—</div>
                                                    )}
                                                </td>

                                                {/* Highest Severity */}
                                                <td className="text-center px-3 py-3">
                                                    <span
                                                        className="inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                                                        style={{
                                                            backgroundColor: SEVERITY_COLORS[group.highestSeverity].bg,
                                                            color: SEVERITY_COLORS[group.highestSeverity].text,
                                                            border: `1px solid ${SEVERITY_COLORS[group.highestSeverity].border}`
                                                        }}
                                                    >
                                                        {group.highestSeverity}
                                                    </span>
                                                </td>

                                                {/* Top Sources */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {group.topSources.slice(0, 3).map((source: any, idx: number) => (
                                                            <a
                                                                key={idx}
                                                                href={source.url || `https://${source.domain}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-colors truncate max-w-[100px]"
                                                                title={`${source.domain} (Impact: ${source.impactScore})`}
                                                            >
                                                                {source.domain}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Results Count */}
                        {groupedOpportunities.length > 0 && (
                            <div className="mt-4 text-sm text-slate-500">
                                Showing {groupedOpportunities.length} unique queries with {filteredOpportunities.length} opportunities
                            </div>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};
