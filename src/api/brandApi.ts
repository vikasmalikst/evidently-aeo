import { apiClient } from '../lib/apiClient';
import { ApiResponse } from '../pages/dashboard/types';
import { invalidateCache, cachedRequest } from '../lib/apiCache';
import type { BrandProductsEnrichment } from '../types/onboarding';

export interface BrandOnboardingData {
  brand_name: string;
  website_url: string;
  description?: string;
  industry?: string;
  competitors?: Array<{
    name: string;
    domain?: string;
    url?: string;
    relevance?: string;
    industry?: string;
    logo?: string;
    source?: string;
  }> | string[];
  keywords?: string[];
  aeo_topics?: Array<{
    label: string;
    weight: number;
    source?: any;
    category?: any;
  }>;
  ai_models?: string[];
  metadata?: Record<string, any>;
}

export interface BrandResponse {
  id: string;
  customer_id: string;
  name: string;
  slug: string;
  homepage_url: string;
  industry?: string;
  summary?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface BrandStats {
  totalBrands: number;
  totalTopics: number;
  totalQueries: number;
  avgLlmsPerBrand: number;
  totalAnswers: number;
}

/**
 * Get all brands for the current customer
 */
export async function getBrands(forceRefresh = false): Promise<ApiResponse<BrandResponse[]>> {
  try {
    const endpoint = forceRefresh ? '/brands?skipCache=true' : '/brands';
    const response = await cachedRequest<ApiResponse<BrandResponse[]>>(
      endpoint,
      { method: 'GET' },
      { requiresAuth: true }
    );
    return response;
  } catch (error) {
    console.error('❌ Fetch brands failed:', error);
    throw error;
  }
}

/**
 * Update brand status
 */
export async function updateBrandStatus(brandId: string, status: 'active' | 'inactive'): Promise<ApiResponse<BrandResponse>> {
  try {
    const response = await apiClient.request<ApiResponse<BrandResponse>>(
      `/brands/${brandId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status: status }),
      },
      { requiresAuth: true }
    );
    
    // Invalidate brands cache so dropdowns update immediately
    invalidateCache('/brands');
    // Also invalidate stats since they only count active brands now
    invalidateCache('/brands/stats');
    
    return response;
  } catch (error) {
    console.error('❌ Update brand status failed:', error);
    throw error;
  }
}

export async function updateBrandWebsiteUrl(brandId: string, websiteUrl: string): Promise<ApiResponse<BrandResponse>> {
  try {
    const response = await apiClient.request<ApiResponse<BrandResponse>>(
      `/brands/${brandId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ website_url: websiteUrl }),
      },
      { requiresAuth: true }
    );

    invalidateCache(`/brands/${brandId}`);
    invalidateCache('/brands');

    return response;
  } catch (error) {
    console.error('❌ Update brand website URL failed:', error);
    throw error;
  }
}

/**
 * Update brand collectors (AI models)
 */
export async function updateBrandCollectors(brandId: string, aiModels: string[]): Promise<ApiResponse<any>> {
  try {
    const response = await apiClient.request<ApiResponse<any>>(
      `/brands/${brandId}/collectors`,
      {
        method: 'POST',
        body: JSON.stringify({ ai_models: aiModels }),
      },
      { requiresAuth: true }
    );
    
    // Invalidate brand cache
    invalidateCache(`/brands/${brandId}`);
    invalidateCache('/brands');
    
    return response;
  } catch (error) {
    console.error('❌ Update brand collectors failed:', error);
    throw error;
  }
}

/**
 * Get aggregated stats for brands
 */
export async function getBrandStats(forceRefresh = false): Promise<ApiResponse<BrandStats>> {
  try {
    const endpoint = forceRefresh ? '/brands/stats?skipCache=true' : '/brands/stats';
    const response = await cachedRequest<ApiResponse<BrandStats>>(
      endpoint,
      { method: 'GET' },
      { requiresAuth: true }
    );
    return response;
  } catch (error) {
    console.error('❌ Fetch brand stats failed:', error);
    throw error;
  }
}

export interface BrandOnboardingResponse {
  success: boolean;
  data?: {
    brand: BrandResponse;
    artifact_id: string;
    message: string;
  };
  error?: string;
}

/**
 * Submit brand onboarding data to create a new brand
 * This triggers:
 * 1. Brand creation in database
 * 2. Competitor insertion
 * 3. Topic insertion and AI categorization
 * 4. Cerebras AI query generation based on topics
 */
export async function submitBrandOnboarding(
  data: BrandOnboardingData
): Promise<BrandOnboardingResponse> {
  try {
    console.log('📤 Submitting brand onboarding data:', {
      brand_name: data.brand_name,
      website_url: data.website_url,
      industry: data.industry,
      competitors_count: data.competitors?.length || 0,
      topics_count: data.aeo_topics?.length || 0,
      ai_models_count: data.ai_models?.length || 0,
    });

    const response = await apiClient.request<BrandOnboardingResponse>(
      '/brands',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      { requiresAuth: true }
    );

    console.log('✅ Brand onboarding successful:', response);
    
    // Invalidate brands cache so the new brand appears in the list immediately
    invalidateCache('/brands');
    invalidateCache('/brands/stats');
    
    return response;
  } catch (error) {
    console.error('❌ Brand onboarding failed:', error);
    throw error;
  }
}

/**
 * Search for a brand by URL or name
 */
export async function searchBrand(params: {
  url?: string;
  name?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params.url) queryParams.append('url', params.url);
    if (params.name) queryParams.append('name', params.name);

    const response = await apiClient.request<{ success: boolean; data?: any; error?: string }>(
      `/brands/search?${queryParams.toString()}`,
      {
        method: 'GET',
      },
      { requiresAuth: true }
    );

    return response;
  } catch (error) {
    console.error('❌ Brand search failed:', error);
    throw error;
  }
}

/**
 * Get brand by ID
 */
export async function getBrandById(brandId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await apiClient.request<{ success: boolean; data?: any; error?: string }>(
      `/brands/${brandId}`,
      {
        method: 'GET',
      },
      { requiresAuth: true }
    );

    return response;
  } catch (error) {
    console.error('❌ Get brand failed:', error);
    throw error;
  }
}

export async function upsertBrandProducts(
  brandId: string,
  enrichment: BrandProductsEnrichment
): Promise<ApiResponse<{ brand_id: string }>> {
  try {
    return apiClient.request<ApiResponse<{ brand_id: string }>>(
      `/brands/${brandId}/brand-products`,
      {
        method: 'POST',
        body: JSON.stringify({ enrichment }),
      },
      { requiresAuth: true, timeout: 120000 }
    );
  } catch (error) {
    console.error('❌ Save brand products failed:', error);
    throw error;
  }
}
