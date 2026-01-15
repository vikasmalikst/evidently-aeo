// TypeScript interfaces for Queries Analysis Page
import { PromptEntry } from '../../types/prompts';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface Trend {
    direction: TrendDirection;
    delta: number;
}

// Re-using TopicSource if applicable, or defining a QuerySource if it's different.
// For Queries, sources are usually the URLs in the answer.
export interface QuerySource {
    name: string;
    url: string;
    type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
    citations?: number;
    mentionRate?: number;
    pages?: string[];
}

export interface Query {
    id: string; // This will likely be the prompt ID or query text
    rank: number;
    text: string; // The query/question text
    topic: string; // The topic this query belongs to
    visibilityScore: number | null; // 0-100
    sentimentScore: number | null; // 0-100
    trend: Trend;
    searchVolume: number | null;
    sentiment: 'positive' | 'neutral' | 'negative';
    // Additional fields mapping to PromptEntry
    promptId?: string;
}

// Portfolio/Performance stats for Queries
export interface QueriesPortfolio {
    totalQueries: number;
    avgVisibility: number;
    avgSentiment: number;
    lastUpdated: string;
}

export interface QueriesPerformance {
    avgVisibility: number;
    avgVisibilityDelta: number;
    topGainer: {
        query: string;
        delta: number;
    };
    topLoser: {
        query: string;
        delta: number;
    };
}

export interface QueriesAnalysisData {
    portfolio: QueriesPortfolio;
    performance: QueriesPerformance;
    queries: Query[];
}

export type SortColumn = 'rank' | 'text' | 'visibility' | 'sentiment' | 'trend' | 'topic';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
    column: SortColumn;
    direction: SortDirection;
}
