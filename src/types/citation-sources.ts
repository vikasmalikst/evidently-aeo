export interface SourceData {
    name: string;
    url: string;
    type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
    mentionRate: number;
    mentionChange: number;
    soa: number;
    soaChange: number;
    sentiment: number;
    sentimentChange: number;
    citations: number;
    topics: string[];
    prompts: string[];
    pages: string[];
    topPages?: Array<{ url: string, count: number }>;
    value?: number;
    visibility?: number;
}

export interface EnhancedSource {
    name: string;
    topPages?: Array<{ url: string, count: number }>;
    type: string;
    mentionRate: number; // %
    soa: number; // %
    sentiment: number; // -1..1 or scaled
    citations: number;
    valueScore: number; // 0..100
    quadrant: 'priority' | 'reputation' | 'growth' | 'monitor';
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface SourceAttributionResponse {
    sources: SourceData[];
    overallMentionRate: number;
    overallMentionChange: number;
    avgSentiment: number;
    avgSentimentChange: number;
    availableModels?: string[];
}

export interface NumericFilter {
    operator: 'gt' | 'lt' | 'eq' | 'range' | null;
    value?: number;
    min?: number;
    max?: number;
}

export interface NumericFilters {
    valueScore: NumericFilter;    // Impact
    mentionRate: NumericFilter;   // Mention
    soa: NumericFilter;           // SOA
    sentiment: NumericFilter;     // Sentiment
    citations: NumericFilter;     // Citations
}
