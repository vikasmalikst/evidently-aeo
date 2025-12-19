/**
 * Recommendations V3 API
 * 
 * Frontend API client for the Recommendations V3 workflow:
 * - KPI-first approach (identify KPIs, then generate recommendations per KPI)
 * - 4-step workflow (Generate → Approve → Content → Complete)
 */

import { apiClient } from '../lib/apiClient';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Identified KPI for a brand
 */
export interface IdentifiedKPI {
  id?: string;
  kpiName: string;
  kpiDescription: string;
  currentValue?: number;
  targetValue?: number;
  displayOrder: number;
}

/**
 * Recommendation for V3 (simplified structure)
 */
export interface RecommendationV3 {
  id?: string;
  action: string;
  citationSource: string;
  focusArea: 'visibility' | 'soa' | 'sentiment';
  priority: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  kpiId?: string;
  kpi?: string;
  
  // Additional fields
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
}

/**
 * Response from generate endpoint
 */
export interface GenerateRecommendationsV3Response {
  success: boolean;
  data?: {
    generationId: string;
    kpis: IdentifiedKPI[];
    recommendations: RecommendationV3[];
    generatedAt: string;
    brandId: string;
    brandName: string;
  };
  error?: string;
}

/**
 * Response from get generation endpoint
 */
export interface GetGenerationV3Response {
  success: boolean;
  data?: {
    generationId: string;
    kpis: IdentifiedKPI[];
    recommendations: RecommendationV3[];
    generatedAt: string;
    brandId: string;
    brandName: string;
  };
  error?: string;
}

/**
 * Response from get by step endpoint
 */
export interface GetByStepV3Response {
  success: boolean;
  data?: {
    step: number;
    recommendations: RecommendationV3[];
  };
  error?: string;
}

/**
 * Response from get KPIs endpoint
 */
export interface GetKPIsV3Response {
  success: boolean;
  data?: {
    kpis: IdentifiedKPI[];
  };
  error?: string;
}

/**
 * Request body for generating recommendations
 */
export interface GenerateRecommendationsV3Request {
  brandId?: string;
}

/**
 * Request body for approving recommendations
 */
export interface ApproveRecommendationsV3Request {
  recommendationIds?: string[];
}

/**
 * Request body for generating content
 */
export interface GenerateContentV3Request {
  contentType?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Generate recommendations using KPI-first approach
 * Uses a longer timeout (60 seconds) since LLM generation can take time
 */
export async function generateRecommendationsV3(
  request: GenerateRecommendationsV3Request = {}
): Promise<GenerateRecommendationsV3Response> {
  try {
    // Use direct fetch with longer timeout for this long-running operation
    const timeoutMs = 60000; // 60 seconds
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    const url = `${apiClient.baseUrl}/recommendations-v3/generate`;
    const accessToken = apiClient.getAccessToken();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(request),
        signal: timeoutController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json() as GenerateRecommendationsV3Response;
      return data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it's a timeout/abort error
      if (timeoutController.signal.aborted || fetchError.name === 'AbortError' || 
          fetchError.message?.includes('timeout') || fetchError.message?.includes('timed out') ||
          fetchError.message?.includes('aborted')) {
        console.warn('⚠️ Generate request timed out after 60s. Backend may have completed.');
        // Return a response that indicates we should try to fetch by generationId
        return {
          success: false,
          error: 'Request timed out. The generation may have completed. Please wait a moment.',
          data: undefined
        };
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error generating recommendations V3:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate recommendations'
    };
  }
}

/**
 * Get all recommendations for a generation
 */
export async function getGenerationV3(
  generationId: string
): Promise<GetGenerationV3Response> {
  try {
    // apiClient.get returns the parsed JSON response directly, not wrapped in .data
    const response = await apiClient.get<GetGenerationV3Response>(
      `/recommendations-v3/${generationId}`
    );
    // Response is already the parsed JSON object with { success, data, error }
    return response;
  } catch (error: any) {
    console.error('Error fetching generation V3:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch generation'
    };
  }
}

/**
 * Get recommendations filtered by workflow step
 */
export async function getRecommendationsByStepV3(
  generationId: string,
  step: number
): Promise<GetByStepV3Response> {
  try {
    // apiClient.get returns the parsed JSON response directly, not wrapped in .data
    const response = await apiClient.get<GetByStepV3Response>(
      `/recommendations-v3/${generationId}/steps/${step}`
    );
    // Response is already the parsed JSON object with { success, data, error }
    return response;
  } catch (error: any) {
    console.error('Error fetching recommendations by step:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch recommendations'
    };
  }
}

/**
 * Approve recommendation(s) (Step 1 → Step 2)
 */
export async function approveRecommendationsV3(
  recommendationId: string,
  request?: ApproveRecommendationsV3Request
): Promise<{ success: boolean; data?: { approvedCount: number }; error?: string }> {
  try {
    const response = await apiClient.patch<{ success: boolean; data?: { approvedCount: number }; error?: string }>(
      `/recommendations-v3/${recommendationId}/approve`,
      request || {}
    );
    // apiClient.patch returns response.data, so we need to check the structure
    // If response has a 'data' property, it's the nested response, otherwise it's the response itself
    if (response && typeof response === 'object' && 'success' in response) {
      return response as { success: boolean; data?: { approvedCount: number }; error?: string };
    } else if (response && typeof response === 'object' && 'data' in response) {
      // Response is wrapped in a data property
      return (response as any).data;
    }
    return response as { success: boolean; data?: { approvedCount: number }; error?: string };
  } catch (error: any) {
    console.error('Error approving recommendations:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to approve recommendations'
    };
  }
}

/**
 * Generate content for all approved recommendations in bulk (Step 2 → Step 3)
 */
export async function generateContentBulkV3(
  generationId: string
): Promise<{ success: boolean; data?: { total: number; successful: number; failed: number; results: any[] }; error?: string }> {
  try {
    // Use direct fetch with longer timeout for bulk content generation (can take 20-30 seconds)
    const timeoutMs = 120000; // 120 seconds (2 minutes) for bulk generation
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    const url = `${apiClient.baseUrl}/recommendations-v3/generate-content-bulk`;
    const accessToken = apiClient.getAccessToken();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ generationId }),
        signal: timeoutController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it's a timeout/abort error
      if (timeoutController.signal.aborted || fetchError.name === 'AbortError' || 
          fetchError.message?.includes('timeout') || fetchError.message?.includes('timed out')) {
        console.warn('⚠️ Bulk content generation timed out after 120s. Backend may have completed.');
        // Return a response indicating timeout but don't fail completely
        return {
          success: false,
          error: 'Request timed out. Content generation may still be in progress. Please check Step 3 in a moment.'
        };
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error generating content bulk V3:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate content'
    };
  }
}

/**
 * Generate content for a recommendation (Step 2 → Step 3)
 * @deprecated Use generateContentBulkV3 for bulk generation
 */
export async function generateContentV3(
  recommendationId: string,
  request?: GenerateContentV3Request
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // apiClient.post returns the parsed JSON response directly, not wrapped in .data
    const response = await apiClient.post<{ success: boolean; data?: any; error?: string }>(
      `/recommendations-v3/${recommendationId}/content`,
      request || {}
    );
    // Response is already the parsed JSON object with { success, data, error }
    return response;
  } catch (error: any) {
    console.error('Error generating content:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate content'
    };
  }
}

/**
 * Mark recommendation as completed (Step 3 → Step 4)
 */
export async function completeRecommendationV3(
  recommendationId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // apiClient.patch returns the parsed JSON response directly, not wrapped in .data
    const response = await apiClient.patch<{ success: boolean; data?: any; error?: string }>(
      `/recommendations-v3/${recommendationId}/complete`
    );
    // Response is already the parsed JSON object with { success, data, error }
    return response;
  } catch (error: any) {
    console.error('Error completing recommendation:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to complete recommendation'
    };
  }
}

/**
 * Get identified KPIs for a generation
 */
export async function getKPIsV3(
  generationId: string
): Promise<GetKPIsV3Response> {
  try {
    // apiClient.get returns the parsed JSON response directly, not wrapped in .data
    const response = await apiClient.get<GetKPIsV3Response>(
      `/recommendations-v3/${generationId}/kpis`
    );
    // Response is already the parsed JSON object with { success, data, error }
    return response;
  } catch (error: any) {
    console.error('Error fetching KPIs:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch KPIs'
    };
  }
}

/**
 * Get latest generation for a brand (useful for recovery after timeout)
 */
export async function getLatestGenerationV3(
  brandId: string
): Promise<GetGenerationV3Response> {
  try {
    // apiClient.get returns the parsed JSON response directly, not wrapped in .data
    const response = await apiClient.get<GetGenerationV3Response>(
      `/recommendations-v3/brand/${brandId}/latest`
    );
    // Response is already the parsed JSON object with { success, data, error }
    return response;
  } catch (error: any) {
    console.error('Error fetching latest generation V3:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch latest generation'
    };
  }
}
