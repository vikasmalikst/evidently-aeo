/**
 * Recommendations API
 * 
 * Frontend API client for fetching recommendations.
 * Note: Recommendations V3 uses its own API (recommendationsV3Api.ts) for generation.
 * This API is kept for backward compatibility with SearchSourcesR2 page.
 */

import { cachedRequest } from '../lib/apiCache';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Single recommendation from the LLM
 */
export interface Recommendation {
  id?: string;              // DB id (available after persisted fetch)
  action: string;           // What to do
  reason: string;           // Short rationale: investing in a source/content combo toward a KPI
  explanation: string;      // Longer, 4-5 sentence rationale behind the recommendation
  citationSource: string;   // Source referenced on the Citations Sources screen
  impactScore: string;      // Impact score read from the source data
  mentionRate: string;      // Mention rate read from the source data
  soa: string;              // SOA % read from the source data
  sentiment: string;        // Sentiment score read from the source data
  citationCount: number;    // Number of citations for this source
  visibilityScore: string;  // Visibility score read from the source data
  focusSources: string;     // What sources to prioritize
  contentFocus: string;     // What content types or topics to focus on
  kpi: string;              // Which KPI it impacts (Visibility Index, SOA %, Sentiment Score, etc.)
  expectedBoost: string;    // Expected improvement (e.g., "+5-10%")
  effort: 'Low' | 'Medium' | 'High';  // Level of effort
  timeline: string;         // Estimated time (e.g., "2-4 weeks")
  confidence: number;       // 0-100%
  priority: 'High' | 'Medium' | 'Low';  // Priority level
  focusArea: 'visibility' | 'soa' | 'sentiment';  // Which area this targets
  trend?: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
  };
  calculatedScore?: number; // Scientific score for ranking
  citationCategory?: 'Priority Partnerships' | 'Reputation Management' | 'Growth Opportunities' | 'Monitor';
}

/**
 * Root cause diagnostic insight
 */
export interface DiagnosticInsight {
  type: 'content_structure' | 'authority_gap' | 'reputation_risk' | 'coverage_gap' | 'sentiment_issue';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string;
}

/**
 * Response from the recommendations endpoint
 */
export interface RecommendationsResponse {
  success: boolean;
  data?: {
    recommendations: Recommendation[];
    generatedAt?: string;
    brandId?: string;
    brandName?: string;
    message?: string;
    problemsDetected?: number;  // Number of data problems detected
    diagnostics?: DiagnosticInsight[];  // Root cause analysis
    trends?: {
      visibility: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
      soa: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
      sentiment: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
    };
  };
  error?: string;
}

/**
 * Request body for generating recommendations
 */
export interface GenerateRecommendationsRequest {
  brandId?: string;  // Optional - uses first brand if not provided
}

export interface RecommendationGeneratedContent {
  id: string;
  recommendation_id: string;
  generation_id: string;
  brand_id: string;
  customer_id: string;
  status: 'generated' | 'accepted' | 'rejected';
  content_type: string;
  content: string;
  model_provider: 'cerebras' | 'openrouter';
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchRecommendationContentLatest(recommendationId: string): Promise<{
  success: boolean;
  data?: { content: RecommendationGeneratedContent } | null;
  error?: string;
}> {
  try {
    const response = await cachedRequest<{
      success: boolean;
      data?: { content: RecommendationGeneratedContent } | null;
      error?: string;
    }>(`/recommendations-v3/${recommendationId}/content`, { method: 'GET' }, { requiresAuth: true });
    return response;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recommendation content'
    };
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch the latest recommendations for a brand from the database
 * 
 * @param request - Optional request with brandId
 * @returns RecommendationsResponse with persisted recommendations
 * 
 * @example
 * ```ts
 * // Fetch for specific brand
 * const result = await fetchRecommendations({ brandId: 'abc-123' });
 * 
 * // Fetch for default (first) brand
 * const result = await fetchRecommendations();
 * ```
 */
export async function fetchRecommendations(
  request: GenerateRecommendationsRequest = {}
): Promise<RecommendationsResponse> {
  try {
    console.log('📥 [RecommendationsApi] Fetching recommendations...', request);

    const params = new URLSearchParams();
    if (request.brandId) {
      params.append('brandId', request.brandId);
    }

    const url = `/recommendations${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await cachedRequest<RecommendationsResponse>(
      url,
      { method: 'GET' },
      { requiresAuth: true }
    );

    console.log('✅ [RecommendationsApi] Response received:', {
      success: response.success,
      count: response.data?.recommendations?.length || 0
    });

    return response;
  } catch (error) {
    console.error('❌ [RecommendationsApi] Error fetching recommendations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch recommendations'
    };
  }
}


