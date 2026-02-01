import { useState, useEffect, useMemo, useRef } from 'react';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useCachedData } from './useCachedData';
import { getActiveCompetitors, type ManagedCompetitor } from '../api/competitorManagementApi';
import type { TopicsAnalysisData, TopicSource, Topic } from '../pages/TopicsAnalysis/types';
import { calculatePreviousPeriod } from '../components/DateRangePicker/DateRangePicker';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    availableModels?: string[];
    error?: string;
    message?: string;
}

interface BackendTopic {
    id: string;
    brand_id?: string;
    topic_name: string;
    topic?: string;
    category: string;
    description?: string;
    is_active: boolean;
    priority: number;
    created_at: string;
    updated_at: string;
    avgShareOfAnswer?: number; // Percentage (0-100)
    avgSentiment?: number | null;
    avgVisibility?: number | null;
    brandPresencePercentage?: number | null;
    totalQueries?: number;
    availableModels?: string[]; // Available models for this topic (from collector_type)
    topSources?: Array<{ name: string; url: string; type: string; citations: number }>;
    industryAvgSoA?: number | null; // Competitor average SOA (0-100 percentage) - calculated from competitor SOA only
    industryAvgVisibility?: number | null; // Competitor average visibility (0-100)
    industryAvgSentiment?: number | null; // Competitor average sentiment (-1..1, or already normalized by backend)
    industryAvgSoATrend?: { direction: 'up' | 'down' | 'neutral'; delta: number } | null;
    industryBrandCount?: number; // Number of brands in competitor average calculation
    competitorSoAMap?: Record<string, number>;
    competitorVisibilityMap?: Record<string, number>;
    competitorSentimentMap?: Record<string, number>;
}

interface TopicsApiResponse {
    topics?: BackendTopic[];
    availableModels?: string[];
    avgSoADelta?: number; // Change from previous period (percentage points)
}

const toVisibilityScore0To100 = (value: number | null | undefined): number | null => {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    // visibility often arrives as 0..1; convert to 0..100
    if (value >= 0 && value <= 1) {
        return Math.max(0, Math.min(100, value * 100));
    }
    return Math.max(0, Math.min(100, value));
};

const toSentimentScore0To100 = (value: number | null | undefined): number | null => {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    // sentiment often arrives as -1..1; convert to 0..100
    if (value >= -1 && value <= 1) {
        return Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
    }
    return Math.max(0, Math.min(100, value));
};

function transformTopicsData(backendTopics: BackendTopic[], topicDeltaMap?: Map<string, number>): TopicsAnalysisData {
    const totalSearchVolume = 0;
    const uniqueCategories = new Set(backendTopics.map(t => t.category));

    const topicsWithData = backendTopics
        .filter(t => t.is_active !== false)
        .map((t, index) => {
            const soAPercentage = t.avgShareOfAnswer || 0;
            const soAMultiplier = soAPercentage / 20;

            const sentimentScore = t.avgSentiment;
            let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
            if (sentimentScore !== null && sentimentScore !== undefined) {
                if (sentimentScore >= 0.1) sentiment = 'positive';
                else if (sentimentScore <= -0.1) sentiment = 'negative';
            }

            const currentVisibility = toVisibilityScore0To100(t.avgVisibility);
            const currentSentiment = toSentimentScore0To100(t.avgSentiment);

            const sources: TopicSource[] = (t.topSources || []).map(source => ({
                name: source.name,
                url: source.url,
                type: source.type as any,
                citations: source.citations
            }));

            const industryAvgSoA = t.industryAvgSoA !== null && t.industryAvgSoA !== undefined
                ? (t.industryAvgSoA / 20)
                : null;

            const industryAvgVisibility = toVisibilityScore0To100(t.industryAvgVisibility);
            const industryAvgSentiment = toSentimentScore0To100(t.industryAvgSentiment);

            const industryTrend = t.industryAvgSoATrend || { direction: 'neutral' as const, delta: 0 };

            const topicKey = t.topic_name || t.topic || '';
            const topicDelta = topicDeltaMap?.get(topicKey) || 0;
            const trendDirection: 'up' | 'down' | 'neutral' =
                topicDelta > 0 ? 'up' : topicDelta < 0 ? 'down' : 'neutral';

            return {
                id: t.id || `topic-${index}`,
                rank: 0,
                name: t.topic_name || t.topic || 'Unnamed Topic',
                category: t.category || 'uncategorized',
                soA: soAMultiplier,
                currentSoA: soAPercentage,
                currentVisibility,
                currentSentiment,
                visibilityTrend: Array(12).fill(t.avgVisibility || 0),
                trend: { direction: trendDirection, delta: topicDelta },
                searchVolume: null,
                sentiment,
                sources: sources,
                priority: t.priority || 999,
                industryAvgSoA: industryAvgSoA,
                industryAvgVisibility,
                industryAvgSentiment,
                industryTrend: industryTrend,
                industryBrandCount: t.industryBrandCount || 0,
                competitorSoAMap: t.competitorSoAMap,
                competitorVisibilityMap: t.competitorVisibilityMap,
                competitorSentimentMap: t.competitorSentimentMap
            };
        })
        .sort((a, b) => {
            if (b.currentSoA !== a.currentSoA) {
                return b.currentSoA - a.currentSoA;
            }
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return a.name.localeCompare(b.name);
        });

    const topics = topicsWithData.map((topic, index) => {
        const { priority, ...topicWithoutPriority } = topic;
        return {
            ...topicWithoutPriority,
            rank: index + 1
        };
    });

    const categoryMap = new Map<string, typeof topics>();
    topics.forEach(topic => {
        const categoryTopics = categoryMap.get(topic.category) || [];
        categoryTopics.push(topic);
        categoryMap.set(topic.category, categoryTopics);
    });

    const categories = Array.from(categoryMap.entries()).map(([name, categoryTopics]) => {
        const avgSoA = categoryTopics.reduce((sum, t) => sum + t.soA, 0) / categoryTopics.length;
        return {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name: name,
            topicCount: categoryTopics.length,
            avgSoA: avgSoA,
            trend: { direction: 'neutral' as const, delta: 0 },
            status: 'emerging' as const,
        };
    });

    const soAValues = topics.map(t => t.soA).filter(v => v > 0);
    const avgSoA = soAValues.length > 0
        ? soAValues.reduce((sum, v) => sum + v, 0) / soAValues.length
        : 0;
    const maxSoA = soAValues.length > 0 ? Math.max(...soAValues) : 0;
    const minSoA = soAValues.length > 0 ? Math.min(...soAValues) : 0;

    const weeklyGainer = topics.length > 0
        ? topics.reduce((best, current) => {
            const currentDelta = current.trend?.delta || 0;
            const bestDelta = best.trend?.delta || 0;
            if (currentDelta > 0 && bestDelta <= 0) return current;
            if (bestDelta > 0 && currentDelta <= 0) return best;
            return currentDelta > bestDelta ? current : best;
        }, topics[0])
        : { name: 'N/A', category: 'N/A', trend: { delta: 0 } };

    return {
        portfolio: {
            totalTopics: topics.length,
            searchVolume: totalSearchVolume,
            categories: uniqueCategories.size,
            lastUpdated: new Date().toISOString(),
        },
        performance: {
            avgSoA,
            maxSoA,
            minSoA,
            avgSoADelta: undefined,
            weeklyGainer: {
                topic: weeklyGainer.name,
                delta: weeklyGainer.trend.delta,
                category: weeklyGainer.category,
            },
        },
        topics,
        categories,
    };
}

export const useTopicsAnalysisData = (filters?: { startDate?: string; endDate?: string; collectorType?: string; country?: string; competitors?: string[] }) => {
    const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();

    // Internal Competitor Fetching
    const [competitors, setCompetitors] = useState<ManagedCompetitor[]>([]);
    const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
    const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);

    useEffect(() => {
        const fetchCompetitors = async () => {
            if (!selectedBrandId) {
                setCompetitors([]);
                setSelectedCompetitors(new Set());
                return;
            }
            setIsLoadingCompetitors(true);
            try {
                const data = await getActiveCompetitors(selectedBrandId);
                const competitorsList = data.competitors || [];
                setCompetitors(competitorsList);
                setSelectedCompetitors(new Set(competitorsList.map(c => c.name.toLowerCase())));
            } catch (error) {
                console.error('Error fetching competitors:', error);
            } finally {
                setIsLoadingCompetitors(false);
            }
        };
        fetchCompetitors();
    }, [selectedBrandId]);

    // Construct Endpoint
    const topicsEndpoint = useMemo(() => {
        if (!selectedBrandId) return null;
        const params = new URLSearchParams();

        // Use provided filters or defaults (defaults hardcoded for now if missing)
        // Ideally pass these in
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
        if (filters?.collectorType) params.append('collectors', filters.collectorType);
        if (filters?.country) params.append('country', filters.country);
        if (filters?.competitors && filters.competitors.length > 0) {
            params.append('competitors', filters.competitors.join(','));
        }

        const queryString = params.toString();
        return `/brands/${selectedBrandId}/topics${queryString ? `?${queryString}` : ''}`;
    }, [selectedBrandId, filters]);

    const {
        data: response,
        loading: isLoading,
        error: fetchError
    } = useCachedData<ApiResponse<BackendTopic[] | TopicsApiResponse>>(
        topicsEndpoint,
        {},
        { requiresAuth: true },
        { enabled: !brandsLoading && !!topicsEndpoint, refetchOnMount: false }
    );

    // Calc Previous Period
    const previousPeriodRange = useMemo(() => {
        if (!filters?.startDate || !filters?.endDate) return null;
        return calculatePreviousPeriod(filters.startDate, filters.endDate);
    }, [filters]);

    const previousPeriodEndpoint = useMemo(() => {
        if (!selectedBrandId || !previousPeriodRange) return null;
        const [startYear, startMonth, startDay] = previousPeriodRange.start.split('T')[0].split('-').map(Number);
        const [endYear, endMonth, endDay] = previousPeriodRange.end.split('T')[0].split('-').map(Number);

        const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

        const params = new URLSearchParams();
        params.append('startDate', start.toISOString());
        params.append('endDate', end.toISOString());
        if (filters?.collectorType) params.append('collectors', filters.collectorType);

        return `/brands/${selectedBrandId}/topics?${params.toString()}`;
    }, [selectedBrandId, previousPeriodRange, filters]);

    const {
        data: previousResponse,
    } = useCachedData<ApiResponse<BackendTopic[] | TopicsApiResponse>>(
        previousPeriodEndpoint,
        {},
        { requiresAuth: true },
        { enabled: !brandsLoading && !!previousPeriodEndpoint, refetchOnMount: false }
    );

    // Transform Data
    const topicsData = useMemo(() => {
        if (!response?.success || !response.data) return null;

        try {
            const topicsArray = Array.isArray(response.data)
                ? response.data
                : (response.data as TopicsApiResponse)?.topics || [];

            let avgSoADelta = Array.isArray(response.data)
                ? undefined
                : (response.data as TopicsApiResponse)?.avgSoADelta;

            const topicDeltaMap = new Map<string, number>();
            if (avgSoADelta === undefined && previousResponse?.success && previousResponse.data) {
                const previousTopicsArray = Array.isArray(previousResponse.data)
                    ? previousResponse.data
                    : (previousResponse.data as TopicsApiResponse)?.topics || [];

                const previousTopicsMap = new Map<string, BackendTopic>();
                previousTopicsArray.forEach((t: BackendTopic) => {
                    const key = t.topic_name || t.topic || '';
                    if (key) previousTopicsMap.set(key, t);
                });

                topicsArray.forEach((t: BackendTopic) => {
                    const key = t.topic_name || t.topic || '';
                    const currentSoA = t.avgShareOfAnswer || 0;
                    const previousTopic = previousTopicsMap.get(key);
                    const previousSoA = previousTopic?.avgShareOfAnswer || 0;
                    topicDeltaMap.set(key, currentSoA - previousSoA);
                });
            }

            return transformTopicsData(topicsArray, topicDeltaMap);
        } catch (e) {
            console.error('Error transforming topics data:', e);
            return null;
        }
    }, [response, previousResponse]);

    return {
        topicsData,
        isLoading,
        competitors,
        selectedCompetitors,
        isLoadingCompetitors
    };
};
