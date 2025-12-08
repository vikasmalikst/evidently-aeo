export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardScoreMetric {
  label: string;
  value: number;
  delta: number;
  description: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'technical' | 'distribution' | 'monitoring';
}

export interface CollectorSummary {
  collectorType?: string;
  status: 'completed' | 'failed' | 'pending' | 'running';
  successRate: number;
  completed: number;
  failed: number;
  lastRunAt?: string | null;
}

export interface DashboardPayload {
  brandId: string;
  brandName: string;
  brandSlug?: string;
  customerId: string;
  dateRange: {
    start: string;
    end: string;
  };
  totalQueries: number;
  queriesWithBrandPresence: number;
  collectorResultsWithBrandPresence: number;
  brandPresenceRows: number;
  totalBrandRows: number;
  totalResponses: number;
  trendPercentage: number;
  visibilityPercentage: number;
  sentimentScore: number;
  scores: DashboardScoreMetric[];
  sourceDistribution: Array<{
    label: string;
    percentage: number;
    color?: string;
  }>;
  topSourcesDistribution?: Array<{
    label: string;
    percentage: number;
    color?: string;
  }>;
  topSourcesByType?: Record<string, Array<{ domain: string; title: string | null; url: string | null; usage: number }>>; // Top 5 sources per source type for tooltips
  llmVisibility: Array<{
    provider: string;
    share: number;
    shareOfSearch?: number;
    visibility?: number;
    delta: number;
    brandPresenceCount: number;
    totalQueries?: number;
    totalCollectorResults?: number; // Total unique collector results (for accurate brand presence %)
    color?: string;
    topTopic?: string | null;
    topTopics?: Array<{
      topic: string;
      occurrences: number;
      share: number;
      visibility: number;
      mentions: number;
    }>;
  }>;
  actionItems?: ActionItem[];
  collectorSummaries?: CollectorSummary[];
  topBrandSources: Array<{
    id: string;
    title: string;
    url: string;
    urls?: string[];
    domain: string;
    impactScore: number | null; // Kept for backward compatibility, but Value should be used
    value?: number; // Composite score based on Visibility, SOA, Sentiment, Citations and Topics
    change: number | null;
    visibility: number;
    share: number;
    usage: number;
  }>;
  topTopics: Array<{
    topic: string;
    promptsTracked: number;
    averageVolume: number;
    sentimentScore: number | null;
    avgVisibility?: number | null;
    avgShare?: number | null;
    brandPresencePercentage?: number | null;
  }>;
}

export interface LLMVisibilitySliceUI {
  provider: string;
  share: number;
  shareOfSearch?: number;
  visibility?: number;
  delta: number;
  brandPresenceCount: number;
  color: string;
  topTopic?: string | null;
  topTopics?: Array<{
    topic: string;
    occurrences: number;
    share: number;
    visibility: number;
    mentions: number;
  }>;
}

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: { direction: 'up' | 'down' | 'stable'; value: number };
  icon: React.ReactNode;
  color: string;
  linkTo: string;
  description?: string;
}

export interface ActionCardProps {
  title: string;
  description: string;
  link: string;
  icon: React.ReactNode;
  color: string;
}

