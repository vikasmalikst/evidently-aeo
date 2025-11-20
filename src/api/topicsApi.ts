import { apiClient } from '../lib/apiClient';
import type { TopicsAnalysisData, Topic, Category, Portfolio, Performance } from '../pages/TopicsAnalysis/types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface BackendTopic {
  id: string;
  brand_id: string;
  topic_name: string;
  topic?: string;
  category: string;
  description?: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  // Analytics fields (when available)
  avgShareOfAnswer?: number;
  avgSentiment?: number | null;
  avgVisibility?: number | null;
  brandPresencePercentage?: number | null;
  totalQueries?: number;
  // Collector/Model info
  collectorType?: string;
}

/**
 * Fetch topics for a specific brand (only topics with collector_results)
 * @param brandId - Brand ID
 * @param startDate - Optional start date (ISO string, defaults to 30 days ago)
 * @param endDate - Optional end date (ISO string, defaults to today)
 */
export async function fetchBrandTopics(
  brandId: string,
  startDate?: string,
  endDate?: string
): Promise<TopicsAnalysisData> {
  try {
    // Build query params if date range provided
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const endpoint = `/brands/${brandId}/topics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.request<ApiResponse<BackendTopic[]>>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch topics');
    }

    const backendTopics = response.data;
    
    // Transform backend data to match the UI structure
    return transformTopicsData(backendTopics);
  } catch (error) {
    console.error('Error fetching brand topics:', error);
    throw error;
  }
}

/**
 * Transform backend topics data to match the TopicsAnalysisData interface
 */
function transformTopicsData(backendTopics: BackendTopic[]): TopicsAnalysisData {
  // Calculate total search volume (placeholder since we don't have real data)
  const totalSearchVolume = 0; // We don't have this data yet
  
  // Get unique categories
  const uniqueCategories = new Set(backendTopics.map(t => t.category));
  
  // Transform topics with real analytics data
  // Only include topics that have actual collector_results data (totalQueries > 0)
  const topics: Topic[] = backendTopics
    .filter(t => t.is_active && (t.totalQueries || 0) > 0)
    .map((t, index) => {
      // Convert Share of Answer from percentage (0-100) to multiplier scale (0-5x)
      // Formula: SoA% = 0-100, so 20% = 1x, 100% = 5x
      const soAPercentage = t.avgShareOfAnswer || 0;
      const soAMultiplier = soAPercentage / 20; // 20% = 1x, 40% = 2x, etc.
      
      // Get sentiment - already in -1 to 1 scale
      const sentimentScore = t.avgSentiment;
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (sentimentScore !== null && sentimentScore !== undefined) {
        if (sentimentScore >= 0.1) sentiment = 'positive';
        else if (sentimentScore <= -0.1) sentiment = 'negative';
      }
      
      return {
        id: t.id || `topic-${index}`,
        rank: t.priority || index + 1,
        name: t.topic_name || t.topic || 'Unnamed Topic',
        category: t.category || 'uncategorized',
        soA: soAMultiplier,
        currentSoA: soAPercentage,
        visibilityTrend: Array(12).fill(t.avgVisibility || 0), // No historical trend yet, use current
        trend: { direction: 'neutral' as const, delta: 0 }, // Need historical data for trend
        searchVolume: null, // Removed per user request
        sentiment,
        sources: [], // Will need separate query for sources
        collectorType: t.collectorType, // AI model/collector type from backend
      };
    })
    .sort((a, b) => a.rank - b.rank);

  // Group topics by category for analytics
  const categoryMap = new Map<string, Topic[]>();
  topics.forEach(topic => {
    const categoryTopics = categoryMap.get(topic.category) || [];
    categoryTopics.push(topic);
    categoryMap.set(topic.category, categoryTopics);
  });

  // Build categories data
  const categories: Category[] = Array.from(categoryMap.entries()).map(([name, categoryTopics]) => {
    const avgSoA = categoryTopics.reduce((sum, t) => sum + t.soA, 0) / categoryTopics.length;
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      topicCount: categoryTopics.length,
      avgSoA: avgSoA,
      trend: { direction: 'neutral' as const, delta: 0 },
      status: 'emerging' as const, // Default status since we don't have trend data
    };
  });

  // Calculate performance metrics
  const soAValues = topics.map(t => t.soA).filter(v => v > 0);
  const avgSoA = soAValues.length > 0 
    ? soAValues.reduce((sum, v) => sum + v, 0) / soAValues.length 
    : 0;
  const maxSoA = soAValues.length > 0 ? Math.max(...soAValues) : 0;
  const minSoA = soAValues.length > 0 ? Math.min(...soAValues) : 0;

  // Find weekly gainer (placeholder since we don't have trend data)
  const weeklyGainer = topics.length > 0 
    ? topics[0] 
    : { name: 'N/A', category: 'N/A', trend: { delta: 0 } };

  const portfolio: Portfolio = {
    totalTopics: topics.length,
    searchVolume: totalSearchVolume,
    categories: uniqueCategories.size,
    lastUpdated: new Date().toISOString(),
  };

  const performance: Performance = {
    avgSoA,
    maxSoA,
    minSoA,
    weeklyGainer: {
      topic: weeklyGainer.name,
      delta: weeklyGainer.trend.delta,
      category: weeklyGainer.category,
    },
  };

  return {
    portfolio,
    performance,
    topics,
    categories,
  };
}

/**
 * Fetch categories with topics for a specific brand
 */
export async function fetchBrandCategories(brandId: string): Promise<any[]> {
  try {
    const response = await apiClient.request<ApiResponse<any[]>>(
      `/brands/${brandId}/categories`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch categories');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching brand categories:', error);
    throw error;
  }
}

