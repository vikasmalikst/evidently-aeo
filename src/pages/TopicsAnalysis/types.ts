// TypeScript interfaces for Topics Analysis Page

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface Trend {
  direction: TrendDirection;
  delta: number;
}

export interface TopicSource {
  name: string;
  url: string;
  type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
  citations?: number;
  mentionRate?: number;
  pages?: string[];
}

export interface Topic {
  id: string;
  rank: number;
  name: string;
  category: string;
  soA: number; // Share of Answer (0-5x scale)
  currentSoA?: number; // Latest SoA percentage (0-100) - for charts
  currentVisibility?: number | null; // Visibility score (0-100) for the selected period
  currentSentiment?: number | null; // Sentiment score (0-100) for the selected period
  currentBrandPresence?: number | null; // Brand Presence percentage (0-100) for the selected period
  visibilityTrend?: number[]; // 12-week historical [w1, w2, ..., w12] - for line chart
  trend: Trend;
  searchVolume: number | null; // null if missing
  sentiment: 'positive' | 'neutral' | 'negative';
  sources: TopicSource[];
  collectorType?: string; // AI model/collector type (chatgpt, claude, etc.)
  industryAvgSoA?: number | null; // Industry average SOA (0-5x scale)
  industryAvgVisibility?: number | null; // Industry average visibility (0-100)
  industryAvgSentiment?: number | null; // Industry average sentiment (0-100)
  industryTrend?: Trend; // Industry trend
  industryBrandCount?: number; // Number of brands in industry average
  competitorSoAMap?: Record<string, number>; // Map of competitor name to SoA
  competitorVisibilityMap?: Record<string, number>; // Map of competitor name to Visibility
  competitorSentimentMap?: Record<string, number>; // Map of competitor name to Sentiment
}

export interface Category {
  id: string;
  name: string;
  topicCount: number;
  avgSoA: number;
  trend: Trend;
  status: 'leader' | 'emerging' | 'growing' | 'declining';
}

export interface Portfolio {
  totalTopics: number;
  searchVolume: number;
  categories: number;
  lastUpdated: string; // ISO date string
}

export interface Performance {
  avgSoA: number;
  maxSoA: number;
  minSoA: number;
  avgSoADelta?: number; // Change from previous period (percentage points)
  weeklyGainer: {
    topic: string;
    delta: number;
    category: string;
  };
}

export interface TopicsAnalysisData {
  portfolio: Portfolio;
  performance: Performance;
  topics: Topic[];
  categories: Category[];
}

export type SortColumn = 'rank' | 'name' | 'soA' | 'trend' | 'volume' | 'sources';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export type FilterType = 'trending' | 'gaps' | 'growing';
export type DisplayCount = 10 | 15 | 'all';

