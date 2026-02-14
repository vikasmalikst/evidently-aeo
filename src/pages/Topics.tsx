import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { TopicsAnalysisPage } from './TopicsAnalysis/TopicsAnalysisPage';
import { Layout } from '../components/Layout/Layout';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useCachedData } from '../hooks/useCachedData';
import { calculatePreviousPeriod } from '../components/DateRangePicker/DateRangePicker';
import { getActiveCompetitors, type ManagedCompetitor } from '../api/competitorManagementApi';
import type { TopicsAnalysisData, TopicSource } from './TopicsAnalysis/types';

import { useDashboardStore } from '../store/dashboardStore';
// QueryTagFilter moved to TopicsAnalysisPage
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

  // Include active topics (relaxed filter - show topics even if totalQueries is 0 or undefined)
  // This allows showing topics that might not have analytics data yet
  const topicsWithData = backendTopics
    .filter(t => t.is_active !== false) // Include topics that are active or undefined (default to active)
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

      // Transform topSources from backend format to TopicSource format
      const sources: TopicSource[] = (t.topSources || []).map(source => ({
        name: source.name,
        url: source.url,
        type: source.type as 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional',
        citations: source.citations
      }));

      // Calculate competitor average SOA (backend returns as percentage 0-100, convert to multiplier 0-5x)
      // Backend returns avgSoA as percentage (0-100) - calculated from competitor SOA values only
      const industryAvgSoA = t.industryAvgSoA !== null && t.industryAvgSoA !== undefined
        ? (t.industryAvgSoA / 20) // Convert percentage (0-100) to multiplier (0-5x)
        : null;

      const industryAvgVisibility = toVisibilityScore0To100(t.industryAvgVisibility);
      const industryAvgSentiment = toSentimentScore0To100(t.industryAvgSentiment);

      // Debug logging for competitor SOA

      // Use competitor trend if available, otherwise default to neutral
      const industryTrend = t.industryAvgSoATrend || { direction: 'neutral' as const, delta: 0 };

      // Get delta for this topic if available
      const topicKey = t.topic_name || t.topic || '';
      const topicDelta = topicDeltaMap?.get(topicKey) || 0;
      const trendDirection: 'up' | 'down' | 'neutral' =
        topicDelta > 0 ? 'up' : topicDelta < 0 ? 'down' : 'neutral';

      return {
        id: t.id || `topic-${index}`,
        rank: 0, // Will be assigned after sorting
        name: t.topic_name || t.topic || 'Unnamed Topic',
        category: t.category || 'uncategorized',
        soA: soAMultiplier, // Keep for internal calculations
        currentSoA: soAPercentage, // Percentage (0-100) for display
        currentVisibility,
        currentSentiment,
        currentBrandPresence: t.brandPresencePercentage !== null && t.brandPresencePercentage !== undefined
          ? Math.max(0, Math.min(100, t.brandPresencePercentage))
          : null,
        visibilityTrend: Array(12).fill(t.avgVisibility || 0),
        trend: { direction: trendDirection, delta: topicDelta },
        searchVolume: null,
        sentiment,
        sources: sources, // Map topSources from backend
        // Store original priority for fallback sorting (will be removed before returning)
        priority: t.priority || 999,
        // Competitor average data (calculated from competitor SOA values only)
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
    // Sort by SoA (descending), then by priority, then alphabetically
    .sort((a, b) => {
      // Primary sort: by SoA percentage (descending)
      if (b.currentSoA !== a.currentSoA) {
        return b.currentSoA - a.currentSoA;
      }
      // Secondary sort: by priority (ascending - lower is better)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Tertiary sort: alphabetically by name
      return a.name.localeCompare(b.name);
    });

  // Assign ranks based on sorted order (1 = highest SoA)
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

  // Find the topic with the highest positive delta (trending/gaining topic)
  // If no positive deltas, find the one with the least negative delta
  const weeklyGainer = topics.length > 0
    ? topics.reduce((best, current) => {
      const currentDelta = current.trend?.delta || 0;
      const bestDelta = best.trend?.delta || 0;

      // Prefer positive deltas
      if (currentDelta > 0 && bestDelta <= 0) return current;
      if (bestDelta > 0 && currentDelta <= 0) return best;

      // If both positive or both negative, pick the one with higher delta
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
      avgSoADelta: undefined, // Will be set from API response if available
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

interface TopicsFilters {
  startDate?: string;
  endDate?: string;
  collectorType?: string;
  country?: string;
  competitors?: string[]; // Array of competitor names (lowercase)
}

import { getDefaultDateRange } from './dashboard/utils';

export const Topics = () => {
  const { queryTags, startDate, endDate, setStartDate, setEndDate } = useDashboardStore();
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();
  const [filters, setFilters] = useState<TopicsFilters>(() => {
    return { startDate, endDate };
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const lastEndpointRef = useRef<string | null>(null);

  // Define updateFilters first so it can be used in competitor handlers
  const updateFilters = useCallback((next: TopicsFilters) => {
    if (next.startDate) setStartDate(next.startDate);
    if (next.endDate) setEndDate(next.endDate);

    setFilters((prev) => {
      const updated = { ...prev, ...next };
      // If competitors filter is provided, ensure it's properly set
      if (next.competitors !== undefined) {
        updated.competitors = next.competitors;
      }
      return updated;
    });
  }, [setStartDate, setEndDate]);

  // Fetch competitors early to avoid delay in TopicsAnalysisPage
  const [competitors, setCompetitors] = useState<ManagedCompetitor[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [isLoadingCompetitors, setIsLoadingCompetitors] = useState(false);

  useEffect(() => {
    const fetchCompetitors = async () => {
      if (!selectedBrandId) {
        setCompetitors([]);
        setSelectedCompetitors(new Set());
        setIsLoadingCompetitors(false);
        return;
      }

      setIsLoadingCompetitors(true);
      try {
        const data = await getActiveCompetitors(selectedBrandId);
        const competitorsList = data.competitors || [];
        setCompetitors(competitorsList);
        // Default: select all competitors (show average) if not already set
        setSelectedCompetitors((prev) => {
          if (prev.size === 0) {
            return new Set(competitorsList.map(c => c.name.toLowerCase()));
          }
          return prev;
        });
      } catch (error) {
        console.error('Error fetching competitors:', error);
        setCompetitors([]);
        setSelectedCompetitors(new Set());
      } finally {
        setIsLoadingCompetitors(false);
      }
    };

    fetchCompetitors();
  }, [selectedBrandId]);

  const handleCompetitorToggle = useCallback((competitorName: string) => {
    setSelectedCompetitors((prev) => {
      const allCompetitorKeys = new Set(competitors.map(c => c.name.toLowerCase()));
      const isAllSelected = prev.size === competitors.length &&
        competitors.every(c => prev.has(c.name.toLowerCase()));

      const key = competitorName.toLowerCase();
      let newSet: Set<string>;

      // If all are selected and user clicks a competitor, select only that competitor
      if (isAllSelected) {
        newSet = new Set([key]);
      } else {
        // Normal toggle behavior
        newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
          // If no competitors selected after removal, select all (show average)
          if (newSet.size === 0) {
            newSet = allCompetitorKeys;
          }
        } else {
          newSet.add(key);
        }
      }

      // Update filters to trigger API call
      updateFilters({
        competitors: Array.from(newSet),
      });
      return newSet;
    });
  }, [competitors, updateFilters]);

  const handleSelectAllCompetitors = useCallback(() => {
    const allSelected = new Set(competitors.map(c => c.name.toLowerCase()));
    setSelectedCompetitors(allSelected);
    updateFilters({
      competitors: Array.from(allSelected),
    });
  }, [competitors, updateFilters]);

  const handleDeselectAllCompetitors = useCallback(() => {
    // When deselecting all, select all again (to show average)
    const allSelected = new Set(competitors.map(c => c.name.toLowerCase()));
    setSelectedCompetitors(allSelected);
    updateFilters({
      competitors: Array.from(allSelected),
    });
  }, [competitors, updateFilters]);

  // Build endpoint with filters - SAME AS PROMPTS PAGE
  // Memoize filters to prevent unnecessary endpoint recalculations
  const filtersKey = useMemo(() => {
    return JSON.stringify({
      startDate: startDate || '',
      endDate: endDate || '',
      collectorType: filters.collectorType || '',
      country: filters.country || '',
      competitors: filters.competitors ? filters.competitors.sort().join(',') : ''
    });
  }, [filters.startDate, filters.endDate, filters.collectorType, filters.country, filters.competitors]);

  // Convert date strings to ISO format for API
  // Treat startDate/endDate as calendar dates (YYYY-MM-DD) and convert to UTC boundaries
  const isoDateRange = useMemo(() => {
    if (!filters.startDate || !filters.endDate) return null;

    // Parse calendar dates (YYYY-MM-DD)
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    // Create local date boundaries
    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, [startDate, endDate]);

  const topicsEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams();

    // Use ISO strings if available, otherwise fallback (though should be available)
    if (isoDateRange) {
      params.append('startDate', isoDateRange.startDate);
      params.append('endDate', isoDateRange.endDate);
    } else {
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
    }

    // Use 'collectors' parameter (same as Prompts page) instead of 'collectorType'
    if (filters.collectorType) params.append('collectorType', filters.collectorType);
    if (filters.country) params.append('country', filters.country);
    if (filters.competitors && filters.competitors.length > 0) {
      params.append('competitors', filters.competitors.sort().join(','));
    }
    if (queryTags && queryTags.length > 0) {
      params.append('queryTags', queryTags.join(','));
    }

    // Always fetch available models (even if not filtering by collector type) to show in UI
    // The backend should handle this optimally
    const queryString = params.toString();
    const endpoint = `/brands/${selectedBrandId}/topics${queryString ? `?${queryString}` : ''}`;

    // Only update ref if endpoint actually changed
    if (endpoint !== lastEndpointRef.current) {
      lastEndpointRef.current = endpoint;
    }
    return endpoint;
  }, [selectedBrandId, isoDateRange, filters.collectorType, filters.country, filters.competitors, queryTags]);

  // Use cached data hook - refetch when filters change
  // Response can be either BackendTopic[] (old format) or { topics: BackendTopic[], availableModels: string[], avgSoADelta?: number } (new format)
  const {
    data: response,
    loading: isLoading,
    error: fetchError
  } = useCachedData<ApiResponse<BackendTopic[] | TopicsApiResponse>>(
    topicsEndpoint,
    {},
    { requiresAuth: true },
    {
      enabled: !brandsLoading && !!topicsEndpoint,
      // Avoid forcing a refetch on every mount; rely on cache for fast navigation.
      // Users can change filters (or add an explicit refresh) to revalidate.
      refetchOnMount: false
    }
  );

  // Extract available models from response
  useEffect(() => {
    if (response?.success && response.availableModels) {
      setAvailableModels(response.availableModels);
    }
  }, [response]);

  // Calculate previous period date range for comparison
  const previousPeriodRange = useMemo(() => {
    if (!startDate || !endDate) return null;
    return calculatePreviousPeriod(startDate, endDate);
  }, [startDate, endDate]);

  // Build previous period endpoint
  const previousPeriodEndpoint = useMemo(() => {
    if (!selectedBrandId || !previousPeriodRange) return null;

    // Convert previous period dates to ISO strings
    const [startYear, startMonth, startDay] = previousPeriodRange.start.split('-').map(Number);
    const [endYear, endMonth, endDay] = previousPeriodRange.end.split('-').map(Number);

    const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    const params = new URLSearchParams();
    params.append('startDate', start.toISOString());
    params.append('endDate', end.toISOString());
    if (filters.collectorType) params.append('collectors', filters.collectorType);
    if (filters.country) params.append('country', filters.country);
    return `/brands/${selectedBrandId}/topics?${params.toString()}`;
  }, [selectedBrandId, previousPeriodRange, filters.collectorType, filters.country]);

  // Fetch previous period data
  const {
    data: previousResponse,
    loading: previousLoading
  } = useCachedData<ApiResponse<BackendTopic[] | TopicsApiResponse>>(
    previousPeriodEndpoint,
    {},
    { requiresAuth: true },
    {
      enabled: !brandsLoading && !!previousPeriodEndpoint,
      refetchOnMount: false
    }
  );

  // Transform and process data
  const topicsData = useMemo(() => {
    if (!response?.success || !response.data) {
      return null;
    }

    try {
      // Handle both old format (array) and new format (object with topics array)
      const topicsArray = Array.isArray(response.data)
        ? response.data
        : (response.data as TopicsApiResponse)?.topics || [];

      // Extract avgSoADelta from response if available
      let avgSoADelta = Array.isArray(response.data)
        ? undefined
        : (response.data as TopicsApiResponse)?.avgSoADelta;

      // Calculate avgSoADelta from previous period if not provided by backend
      // Also calculate per-topic deltas for trending topic calculation
      const topicDeltaMap = new Map<string, number>();
      if (avgSoADelta === undefined && previousResponse?.success && previousResponse.data) {
        const previousTopicsArray = Array.isArray(previousResponse.data)
          ? previousResponse.data
          : (previousResponse.data as TopicsApiResponse)?.topics || [];

        // Create a map of previous period topics by topic_name for quick lookup
        const previousTopicsMap = new Map<string, BackendTopic>();
        previousTopicsArray.forEach((t: BackendTopic) => {
          const key = t.topic_name || t.topic || '';
          if (key) {
            previousTopicsMap.set(key, t);
          }
        });

        // Calculate per-topic deltas
        topicsArray.forEach((t: BackendTopic) => {
          const key = t.topic_name || t.topic || '';
          const currentSoA = t.avgShareOfAnswer || 0;
          const previousTopic = previousTopicsMap.get(key);
          const previousSoA = previousTopic?.avgShareOfAnswer || 0;
          const delta = currentSoA - previousSoA;
          topicDeltaMap.set(key, delta);
        });

        // Calculate current period avg SOA
        const currentSoAValues = topicsArray
          .map(t => t.avgShareOfAnswer || 0)
          .filter(v => v > 0);
        const currentAvgSoA = currentSoAValues.length > 0
          ? currentSoAValues.reduce((sum, v) => sum + v, 0) / currentSoAValues.length
          : 0;

        // Calculate previous period avg SOA
        const previousSoAValues = previousTopicsArray
          .map(t => t.avgShareOfAnswer || 0)
          .filter(v => v > 0);
        const previousAvgSoA = previousSoAValues.length > 0
          ? previousSoAValues.reduce((sum, v) => sum + v, 0) / previousSoAValues.length
          : 0;

        // Calculate delta (percentage points difference)
        avgSoADelta = currentAvgSoA - previousAvgSoA;
      }

      const transformed = transformTopicsData(topicsArray, topicDeltaMap);

      if (avgSoADelta !== undefined) {
        transformed.performance.avgSoADelta = avgSoADelta;
      }

      return transformed;
    } catch (e) {
      console.error('Error transforming topics data:', e);
      return null;
    }
  }, [response, previousResponse]);

  const hasTransformedData = !!topicsData;
  const isRefreshing = (isLoading || previousLoading) && hasTransformedData;

  if (isLoading && !topicsData) {
    return (
      <Layout>
        <LoadingScreen message="Loading topics analysis..." />
      </Layout>
    );
  }

  // If no data available (error or empty), provide empty structure
  const dataToShow = topicsData || {
    portfolio: { totalTopics: 0, searchVolume: 0, categories: 0, lastUpdated: new Date().toISOString() },
    performance: { avgSoA: 0, maxSoA: 0, minSoA: 0, weeklyGainer: { topic: '', delta: 0, category: '' } },
    topics: [],
    categories: []
  };

  const error = fetchError?.message || (response && !response.success ? (response.error || response.message || 'Failed to load topics') : null);

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: '#fff8f0',
          border: '1px solid #f9db43',
          borderRadius: '8px',
          padding: '12px 20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          maxWidth: '600px',
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1d29', marginBottom: '4px' }}>
                Unable to load topics data
              </div>
              <div style={{ fontSize: '13px', color: '#393e51' }}>
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      <TopicsAnalysisPage
        data={dataToShow}
        isLoading={false}
        isRefreshing={isRefreshing}
        onTopicClick={(topic) => {
          console.log('Topic clicked:', topic);
        }}
        onFiltersChange={updateFilters}
        availableModels={availableModels}
        currentCollectorType={filters.collectorType}
        currentStartDate={startDate}
        currentEndDate={endDate}
        competitors={competitors}
        selectedCompetitors={selectedCompetitors}
        onCompetitorToggle={handleCompetitorToggle}
        onSelectAllCompetitors={handleSelectAllCompetitors}
        onDeselectAllCompetitors={handleDeselectAllCompetitors}
        isLoadingCompetitors={isLoadingCompetitors}
      />
    </>
  );
};
