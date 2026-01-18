/**
 * Types for Recommendation V3 Service
 */

/**
 * Identified KPI for a brand
 */
export interface IdentifiedKPI {
  id?: string;              // Database id (present when loaded from DB)
  kpiName: string;          // e.g., "Visibility Index", "SOA %", "Sentiment Score"
  kpiDescription: string;    // Why this KPI matters for this brand
  currentValue?: number;     // Current KPI value
  targetValue?: number;      // Target/improved value
  displayOrder: number;      // Order in which KPIs should be displayed
}

/**
 * Recommendation for V3 (simplified structure)
 */
export interface RecommendationV3 {
  id?: string;
  action: string;           // What to do
  citationSource: string;   // Source/domain
  focusArea: 'visibility' | 'soa' | 'sentiment';
  priority: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  kpiId?: string;           // Links to identified KPI
  kpi?: string;             // KPI name (for display)

  // Additional fields (stored but not shown in simplified table)
  reason?: string;
  explanation?: string;
  impactScore?: string;
  mentionRate?: string;
  soa?: string;
  sentiment?: string;
  visibilityScore?: string;
  citationCount?: number;
  focusSources?: string;
  contentFocus?: string;
  expectedBoost?: string;
  timeline?: string;
  confidence?: number;

  // Workflow flags
  isApproved?: boolean;
  isContentGenerated?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  kpiBeforeValue?: number;
  kpiAfterValue?: number;
  reviewStatus?: 'pending_review' | 'approved' | 'rejected';
}

/**
 * Response from V3 recommendation service
 */
export interface RecommendationV3Response {
  success: boolean;
  generationId?: string;
  kpis: IdentifiedKPI[];
  recommendations: RecommendationV3[];
  message?: string;
  generatedAt?: string;
  brandId?: string;
  brandName?: string;
}

/**
 * Brand context for KPI identification
 */
export interface BrandContextV3 {
  brandId: string;
  brandName: string;
  industry?: string;
  visibilityIndex?: number;
  shareOfAnswers?: number;
  sentimentScore?: number;
  trends?: {
    visibility?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
    soa?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
    sentiment?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
  };
  competitors?: Array<{
    name: string;
    visibilityIndex?: number;
    shareOfAnswers?: number;
    sentimentScore?: number;
  }>;
  sourceMetrics?: Array<{
    domain: string;
    mentionRate: number;
    soa: number;
    sentiment: number;
    citations: number;
    impactScore: number;
    visibility: number;
    topCompetitor?: {
      name: string;
      soa: number;
      sentiment: number;
    };
  }>;
  // Qualitative context from Analysis Service
  topKeywords?: Array<{ keyword: string; count: number }>;
  strategicNarrative?: string;
  keyQuotes?: string[];
}

/**
 * LLM Chat Response Type
 */
export type CerebrasChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

