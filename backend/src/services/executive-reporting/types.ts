/**
 * Types and interfaces for Executive Reporting feature
 */

export interface ExecutiveReport {
    id: string;
    brand_id: string;
    report_period_start: string; // ISO date
    report_period_end: string; // ISO date
    comparison_period_start: string; // ISO date
    comparison_period_end: string; // ISO date
    generated_at: string; // ISO timestamp
    generated_by: string | null;
    data_snapshot: ReportDataSnapshot;
    executive_summary: string | null;
    created_at: string;
    updated_at: string;
}

export interface ReportDataSnapshot {
    brand_performance: BrandPerformanceData;
    llm_performance: LLMPerformanceData;
    competitive_landscape: CompetitiveLandscapeData;
    domain_readiness: DomainReadinessData;
    traffic_attribution?: TrafficAttributionData; // Optional if GA not connected
    actions_impact: ActionsImpactData;
    top_movers: TopMoversData;
}

export interface BrandPerformanceData {
    current: {
        visibility: number;
        average_position: number;
        appearance_rate: number;
        share_of_answer: number;
        sentiment: number;
    };
    previous: {
        visibility: number;
        average_position: number;
        appearance_rate: number;
        share_of_answer: number;
        sentiment: number;
    };
    deltas: {
        visibility: { absolute: number; percentage: number };
        average_position: { absolute: number; percentage: number };
        appearance_rate: { absolute: number; percentage: number };
        share_of_answer: { absolute: number; percentage: number };
        sentiment: { absolute: number; percentage: number };
    };
    twelve_week_trends: {
        visibility: TrendDataPoint[];
        average_position: TrendDataPoint[];
        appearance_rate: TrendDataPoint[];
        share_of_answer: TrendDataPoint[];
        sentiment: TrendDataPoint[];
    };
}

export interface TrendDataPoint {
    week_start: string; // ISO date
    week_end: string; // ISO date
    value: number;
}

export interface LLMPerformanceData {
    by_llm: {
        [llm_name: string]: {
            visibility: number;
            average_position: number;
            appearance_rate: number;
            share_of_answer: number;
        };
    };
    twelve_week_trends_by_llm: {
        [llm_name: string]: {
            visibility: TrendDataPoint[];
            share_of_answer: TrendDataPoint[];
        };
    };
}

export interface CompetitiveLandscapeData {
    competitors: CompetitorMetrics[];
    twelve_week_trends: {
        brand: {
            visibility: TrendDataPoint[];
            share_of_answer: TrendDataPoint[];
        };
        competitors: {
            [competitor_name: string]: {
                visibility: TrendDataPoint[];
                share_of_answer: TrendDataPoint[];
            };
        };
    };
}

export interface CompetitorMetrics {
    name: string;
    current: {
        visibility: number;
        average_position: number;
        appearance_rate: number;
        share_of_answer: number;
        sentiment: number;
    };
    previous: {
        visibility: number;
        average_position: number;
        appearance_rate: number;
        share_of_answer: number;
        sentiment: number;
    };
    deltas: {
        visibility: { absolute: number; percentage: number };
        average_position: { absolute: number; percentage: number };
        appearance_rate: { absolute: number; percentage: number };
        share_of_answer: { absolute: number; percentage: number };
        sentiment: { absolute: number; percentage: number };
    };
}

export interface DomainReadinessData {
    overall_score: number;
    previous_overall_score: number;
    score_delta: { absolute: number; percentage: number };
    sub_scores: {
        [dimension: string]: {
            score: number;
            label: string;
        };
    };
    twelve_week_trend: TrendDataPoint[];
    key_deficiencies: {
        category: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        description: string;
    }[];
}

export interface TrafficAttributionData {
    current: {
        sessions: number;
        conversions: number;
        revenue: number | null;
    };
    previous: {
        sessions: number;
        conversions: number;
        revenue: number | null;
    };
    deltas: {
        sessions: { absolute: number; percentage: number };
        conversions: { absolute: number; percentage: number };
        revenue: { absolute: number; percentage: number } | null;
    };
    twelve_week_trends: {
        sessions: TrendDataPoint[];
        conversions: TrendDataPoint[];
    };
}

export interface ActionsImpactData {
    recommendations: {
        provided: number;
        approved: number;
        content_generated: number;
        implemented: number;
    };
    average_impact: {
        visibility: number | null;
        share_of_answer: number | null;
        sentiment: number | null;
        average_position: number | null;
        mention_frequency: number | null;
    };
}

export interface TopMoversData {
    queries: {
        gains: TopMoverItem[];
        losses: TopMoverItem[];
    };
    topics: {
        gains: TopMoverItem[];
        losses: TopMoverItem[];
    };
    sources: {
        gains: TopMoverItem[];
        losses: TopMoverItem[];
    };
}

export interface TopMoverItem {
    name: string;
    id: string;
    changes: {
        visibility?: { absolute: number; percentage: number };
        position?: { absolute: number; percentage: number };
        share_of_answer?: { absolute: number; percentage: number };
        sentiment?: { absolute: number; percentage: number };
    };
}

export interface ReportSchedule {
    id: string;
    brand_id: string;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    reporting_period_days: 7 | 30 | 60 | 90;
    recipients: string[]; // Array of email addresses
    is_active: boolean;
    last_sent_at: string | null;
    next_send_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ReportAnnotation {
    id: string;
    report_id: string;
    section_id: string; // e.g., 'brand_performance', 'competitive_landscape'
    target_id: string | null; // Optional specific data point
    comment: string;
    author_id: string;
    mentions: string[]; // Array of user IDs mentioned
    status: 'discuss' | 'action_required' | 'resolved' | null;
    parent_comment_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface GAIntegration {
    id: string;
    brand_id: string;
    ga_property_id: string;
    ga_view_id: string | null;
    access_token: string | null;
    refresh_token: string | null;
    token_expiry: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface GenerateReportRequest {
    brand_id: string;
    period_days: 7 | 30 | 60 | 90;
    end_date?: string; // Optional, defaults to today
}

export interface CreateScheduleRequest {
    brand_id: string;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    reporting_period_days: 7 | 30 | 60 | 90;
    recipients: string[];
}

export interface AddCommentRequest {
    report_id: string;
    section_id: string;
    target_id?: string;
    comment: string;
    mentions?: string[];
    status?: 'discuss' | 'action_required' | 'resolved';
    parent_comment_id?: string;
}

export interface ExportReportRequest {
    report_id: string;
    format: 'pdf' | 'ppt';
    include_annotations: boolean;
}

// Executive Summary generation types
export interface SummaryFact {
    type: 'visibility_gain' | 'visibility_loss' | 'ranking_gain' | 'ranking_loss' | 'competitive_threat' | 'sentiment_shift' | 'traffic_change' | 'other';
    severity: 'high' | 'medium' | 'low';
    description: string;
    metrics: Record<string, number>;
}

export interface ExecutiveSummaryInput {
    current_metrics: BrandPerformanceData['current'];
    previous_metrics: BrandPerformanceData['previous'];
    deltas: BrandPerformanceData['deltas'];
    summary_facts: SummaryFact[];
    top_movers: {
        biggest_gain: TopMoverItem;
        biggest_loss: TopMoverItem;
    };
    competitive_threats: CompetitorMetrics[];
    traffic_impact?: {
        sessions_change: number;
        conversions_change: number;
    };
}
