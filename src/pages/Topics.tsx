import { useState, useEffect, useMemo } from 'react';
import { TopicsAnalysisPage } from './TopicsAnalysis/TopicsAnalysisPage';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useCachedData } from '../hooks/useCachedData';
import type { TopicsAnalysisData } from './TopicsAnalysis/types';

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
}

function transformTopicsData(backendTopics: BackendTopic[]): TopicsAnalysisData {
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
      
      return {
        id: t.id || `topic-${index}`,
        rank: 0, // Will be assigned after sorting
        name: t.topic_name || t.topic || 'Unnamed Topic',
        category: t.category || 'uncategorized',
        soA: soAMultiplier, // Keep for internal calculations
        currentSoA: soAPercentage, // Percentage (0-100) for display
        visibilityTrend: Array(12).fill(t.avgVisibility || 0),
        trend: { direction: 'neutral' as const, delta: 0 },
        searchVolume: null,
        sentiment,
        sources: [],
        // Store original priority for fallback sorting (will be removed before returning)
        priority: t.priority || 999
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

  const weeklyGainer = topics.length > 0 
    ? topics[0] 
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

  // Build endpoint with filters
  const topicsEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.collectorType) params.append('collectorType', filters.collectorType);
    if (filters.country) params.append('country', filters.country);
    const queryString = params.toString();
    const endpoint = `/brands/${selectedBrandId}/topics${queryString ? `?${queryString}` : ''}`;
    console.log('🔗 Topics endpoint built:', { endpoint, filters, queryString });
    return endpoint;
  }, [selectedBrandId, filters]);

  // Use cached data hook - refetch when filters change
  // Response can be either BackendTopic[] (old format) or { topics: BackendTopic[], availableModels: string[] } (new format)
  const {
    data: response,
    loading: isLoading,
    error: fetchError
  } = useCachedData<ApiResponse<BackendTopic[] | { topics: BackendTopic[]; availableModels: string[] }>>(
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
    }
  }, [response]);
  
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
        : (response.data as any)?.topics || [];
      
      console.log('📊 Transforming topics data:', { 
        backendTopicsCount: topicsArray.length,
        availableModels: response?.availableModels || [],
        backendTopics: topicsArray.map((t: BackendTopic) => ({ 
          id: t.id, 
          topic_name: t.topic_name, 
          totalQueries: t.totalQueries,
          is_active: t.is_active,
          availableModels: t.availableModels
        }))
      });
      const transformed = transformTopicsData(topicsArray);
      console.log('📊 Transformed topics:', { 
        topicsCount: transformed.topics.length,
        topics: transformed.topics.map(t => ({ id: t.id, name: t.name }))
      });
      return transformed;
    } catch (err) {
      console.error('Error transforming topics:', err);
      setError(err instanceof Error ? err.message : 'Failed to transform topics');
      return null;
    }
  }, [response]);

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
      />
    );
  }

  // Use real data only - no mock fallback
  if (!topicsData) {
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
      />
    </>
  );
};
