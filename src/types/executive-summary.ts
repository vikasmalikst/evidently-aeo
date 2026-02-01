export interface CompetitorInsight {
    competitorName: string;
    totalGaps: number;
    metrics: {
        soa: { gapCount: number; percentage: number };
        sentiment: { gapCount: number; percentage: number };
        visibility: { gapCount: number; percentage: number };
    };
    primaryWeakness: string;
    opportunities: Opportunity[];
}

export interface TopicGapStat {
    topic: string;
    avgGap: number;
    gapDensity: number;
    criticalCount: number;
    primaryWeakness: string;
    leadingCompetitor: string;
}

export interface VolumeContext {
    totalQueries: number;
    gapPercentage: number;
    criticalPercentage: number;
    healthScore: number;
    gapCount: number;
    criticalCount: number;
}

export interface Opportunity {
    id: string;
    queryId: string;
    queryText: string;
    queryCategory: number;
    metricName: string;
    brandValue: number;
    targetValue: number;
    gap: number;
    severity: string;
    priorityScore: number;
    competitor: string | null;
    topSources: Array<{ domain: string; url?: string; impactScore: number }>;
    topic?: string | null;
}

export interface CitationSourceStat {
    name: string;
    url: string;
    type: string;
    percentCitations: number;
    sentiment: number;
    soa: number;
    mentionRate: number;
}

export interface ExecutiveSummaryResponse {
    meta: {
        brandId: string;
        generatedAt: string;
        daysAnalyzed: number;
    };
    summary: {
        text: string;
        healthScore: number;
    };
    data: {
        volumeContext: VolumeContext;
        competitorInsights: CompetitorInsight[];
        topicGaps: TopicGapStat[];
        topQueries: Opportunity[];
        topCitationSources: CitationSourceStat[];
        dateRange: { start: string; end: string };
        topicLeadership?: {
            visibility: number;
            soa: number;
            sentiment: number;
            presence: number;
        };
    };
}
