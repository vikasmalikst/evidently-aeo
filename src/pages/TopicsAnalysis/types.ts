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
  visibilityTrend?: number[]; // 12-week historical [w1, w2, ..., w12] - for line chart
  trend: Trend;
  searchVolume: number | null; // null if missing
  sentiment: 'positive' | 'neutral' | 'negative';
  sources: TopicSource[];
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

