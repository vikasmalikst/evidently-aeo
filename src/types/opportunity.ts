export interface Opportunity {
    id: string;
    queryId: string;
    queryText: string;
    queryCategory: 1 | 2 | 3;
    metricName: 'visibility' | 'soa' | 'sentiment';
    brandValue: number;
    targetValue: number;
    gap: number;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    priorityScore: number;
    competitor: string | null;
    topSources: Array<{ domain: string; url?: string; impactScore: number }>;
    responseCount: number;
    topic: string | null;
}

export interface OpportunitySummary {
    total: number;
    bySeverity: { critical: number; high: number; medium: number; low: number };
    byCategory: { 1: number; 2: number; 3: number };
    byMetric: { visibility: number; soa: number; sentiment: number };
}

export interface OpportunityResponse {
    opportunities: Opportunity[];
    summary: OpportunitySummary;
    dateRange: { start: string; end: string };
}
