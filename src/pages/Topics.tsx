import { useState, useEffect, useMemo, useRef } from 'react';
import { TopicsAnalysisPage } from './TopicsAnalysis/TopicsAnalysisPage';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useCachedData } from '../hooks/useCachedData';
import { calculatePreviousPeriod } from '../components/DateRangePicker/DateRangePicker';
import type { TopicsAnalysisData, TopicSource } from './TopicsAnalysis/types';

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
  industryAvgSoA?: number | null; // Industry average SOA (0-100 percentage)
  industryAvgSoATrend?: { direction: 'up' | 'down' | 'neutral'; delta: number } | null;
  industryBrandCount?: number; // Number of brands in industry average calculation
}

interface TopicsApiResponse {
  topics?: BackendTopic[];
  availableModels?: string[];
  avgSoADelta?: number; // Change from previous period (percentage points)
}

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
      
      // Transform topSources from backend format to TopicSource format
      const sources: TopicSource[] = (t.topSources || []).map(source => ({
        name: source.name,
        url: source.url,
        type: source.type as 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional',
        citations: source.citations
      }));

      // Calculate industry average SOA (backend returns as percentage 0-100, convert to multiplier 0-5x)
      // Backend returns avgSoA as percentage (0-100) - confirmed in source-attribution.service.ts:666
      const industryAvgSoA = t.industryAvgSoA !== null && t.industryAvgSoA !== undefined
        ? (t.industryAvgSoA / 20) // Convert percentage (0-100) to multiplier (0-5x)
        : null;
      
      // Debug logging for industry SOA
      if (industryAvgSoA !== null) {
        console.log(`📊 Topic "${t.topic_name}": Industry Avg SOA = ${t.industryAvgSoA}% (${industryAvgSoA.toFixed(2)}x multiplier), Brand SOA = ${soAPercentage}%`);
      } else if (t.industryAvgSoA === null || t.industryAvgSoA === undefined) {
        console.log(`⚠️ Topic "${t.topic_name}": No industry Avg SOA data (null/undefined)`);
      }
      
      // Use industry trend if available, otherwise default to neutral
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
        visibilityTrend: Array(12).fill(t.avgVisibility || 0),
        trend: { direction: trendDirection, delta: topicDelta },
        searchVolume: null,
        sentiment,
        sources: sources, // Map topSources from backend
        // Store original priority for fallback sorting (will be removed before returning)
        priority: t.priority || 999,
        // Industry average data
        industryAvgSoA: industryAvgSoA,
        industryTrend: industryTrend,
        industryBrandCount: t.industryBrandCount || 0
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
}

export const Topics = () => {
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TopicsFilters>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const lastEndpointRef = useRef<string | null>(null);

  // Build endpoint with filters - SAME AS PROMPTS PAGE
  // Memoize filters to prevent unnecessary endpoint recalculations
  const filtersKey = useMemo(() => {
    return JSON.stringify({
      startDate: filters.startDate || '',
      endDate: filters.endDate || '',
      collectorType: filters.collectorType || '',
      country: filters.country || ''
    });
  }, [filters.startDate, filters.endDate, filters.collectorType, filters.country]);

  const topicsEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    // Use 'collectors' parameter (same as Prompts page) instead of 'collectorType'
    if (filters.collectorType) params.append('collectors', filters.collectorType);
    if (filters.country) params.append('country', filters.country);
    const queryString = params.toString();
    const endpoint = `/brands/${selectedBrandId}/topics${queryString ? `?${queryString}` : ''}`;
    
    // Only log if endpoint actually changed
    if (endpoint !== lastEndpointRef.current) {
      console.log('🔗 Topics endpoint built:', { endpoint, filters, queryString, previous: lastEndpointRef.current });
      lastEndpointRef.current = endpoint;
    }
    return endpoint;
  }, [selectedBrandId, filtersKey]);

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
      refetchOnMount: true
    }
  );

  // Extract available models from response
  useEffect(() => {
    if (response?.success && response.availableModels) {
      setAvailableModels(response.availableModels);
      console.log('📊 Available models from backend:', response.availableModels);
    } else {
      console.log('⚠️ No available models in response:', {
        success: response?.success,
        hasAvailableModels: !!response?.availableModels,
        availableModels: response?.availableModels
      });
    }
  }, [response]);
  
  // Calculate previous period date range for comparison
  const previousPeriodRange = useMemo(() => {
    if (!filters.startDate || !filters.endDate) return null;
    return calculatePreviousPeriod(filters.startDate, filters.endDate);
  }, [filters.startDate, filters.endDate]);

  // Build previous period endpoint
  const previousPeriodEndpoint = useMemo(() => {
    if (!selectedBrandId || !previousPeriodRange) return null;
    const params = new URLSearchParams();
    params.append('startDate', previousPeriodRange.start);
    params.append('endDate', previousPeriodRange.end);
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
      console.log('📊 Topics API Response:', { 
        success: response?.success, 
        hasData: !!response?.data,
        dataLength: response?.data ? (Array.isArray(response.data) ? response.data.length : 0) : 0,
        availableModels: response?.availableModels || [],
        error: response?.error,
        message: response?.message 
      });
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
        
        console.log('📊 Calculated avgSoADelta from previous period:', {
          currentAvgSoA: currentAvgSoA.toFixed(2),
          previousAvgSoA: previousAvgSoA.toFixed(2),
          delta: avgSoADelta.toFixed(2),
          currentTopicsCount: topicsArray.length,
          previousTopicsCount: previousTopicsArray.length,
          topicDeltas: Array.from(topicDeltaMap.entries()).map(([name, delta]) => ({ name, delta: delta.toFixed(2) }))
        });
      }
      
      console.log('📊 Transforming topics data:', { 
        backendTopicsCount: topicsArray.length,
        availableModels: response?.availableModels || [],
        avgSoADelta,
        topicDeltaMapSize: topicDeltaMap.size,
        backendTopics: topicsArray.map((t: BackendTopic) => ({ 
          id: t.id, 
          topic_name: t.topic_name, 
          totalQueries: t.totalQueries,
          is_active: t.is_active,
          availableModels: t.availableModels
        }))
      });
      const transformed = transformTopicsData(topicsArray, topicDeltaMap);
      
      // Set avgSoADelta from API response or calculated value
      if (avgSoADelta !== undefined && avgSoADelta !== null) {
        transformed.performance.avgSoADelta = avgSoADelta;
      }
      
      console.log('📊 Transformed topics:', { 
        topicsCount: transformed.topics.length,
        avgSoADelta: transformed.performance.avgSoADelta,
        topics: transformed.topics.map(t => ({ id: t.id, name: t.name }))
      });
      return transformed;
    } catch (err) {
      console.error('Error transforming topics:', err);
      setError(err instanceof Error ? err.message : 'Failed to transform topics');
      return null;
    }
  }, [response, previousResponse]);

  useEffect(() => {
    if (fetchError) {
      setError(fetchError.message || 'Failed to load topics');
    } else if (response && !response.success) {
      setError(response.error || response.message || 'Failed to load topics');
    }
  }, [fetchError, response]);

  // Show loading state
  if (isLoading || brandsLoading) {
    return (
      <TopicsAnalysisPage
        data={{
          portfolio: { totalTopics: 0, searchVolume: 0, categories: 0, lastUpdated: new Date().toISOString() },
          performance: { avgSoA: 0, maxSoA: 0, minSoA: 0, weeklyGainer: { topic: '', delta: 0, category: '' } },
          topics: [],
          categories: []
        }}
        isLoading={true}
        onTopicClick={(topic) => {
          console.log('Topic clicked:', topic);
        }}
        onCategoryFilter={(categoryId) => {
          console.log('Category filtered:', categoryId);
        }}
        currentCollectorType={filters.collectorType}
      />
    );
  }

  // Use real data - allow empty topics array (filtering might return empty results)
  if (!topicsData) {
    // Only show empty state if we don't have a response at all
    // If we have a response with empty topics, still show the page so filters work
    if (!response || !response.success) {
      return (
        <TopicsAnalysisPage
          data={{
            portfolio: { totalTopics: 0, searchVolume: 0, categories: 0, lastUpdated: new Date().toISOString() },
            performance: { avgSoA: 0, maxSoA: 0, minSoA: 0, weeklyGainer: { topic: '', delta: 0, category: '' } },
            topics: [],
            categories: []
          }}
          isLoading={false}
          onTopicClick={(topic) => {
            console.log('Topic clicked:', topic);
          }}
          onCategoryFilter={(categoryId) => {
            console.log('Category filtered:', categoryId);
          }}
          onFiltersChange={setFilters}
          availableModels={availableModels}
          currentCollectorType={filters.collectorType}
        />
      );
    }
    // If response is successful but transformation failed, show error
    return (
      <TopicsAnalysisPage
        data={{
          portfolio: { totalTopics: 0, searchVolume: 0, categories: 0, lastUpdated: new Date().toISOString() },
          performance: { avgSoA: 0, maxSoA: 0, minSoA: 0, weeklyGainer: { topic: '', delta: 0, category: '' } },
          topics: [],
          categories: []
        }}
        isLoading={false}
        onTopicClick={(topic) => {
          console.log('Topic clicked:', topic);
        }}
        onCategoryFilter={(categoryId) => {
          console.log('Category filtered:', categoryId);
        }}
        onFiltersChange={setFilters}
        availableModels={availableModels}
        currentCollectorType={filters.collectorType}
      />
    );
  }

  const dataToShow = topicsData;

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
        onTopicClick={(topic) => {
          console.log('Topic clicked:', topic);
        }}
        onCategoryFilter={(categoryId) => {
          console.log('Category filtered:', categoryId);
        }}
        onFiltersChange={setFilters}
        availableModels={availableModels}
        currentCollectorType={filters.collectorType}
      />
    </>
  );
};
