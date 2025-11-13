import { apiClient } from '../lib/apiClient';

export interface BrandOnboardingData {
  brand_name: string;
  website_url: string;
  description?: string;
  industry?: string;
  competitors?: string[];
  keywords?: string[];
  aeo_topics?: Array<{
    label: string;
    weight: number;
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
  created_at: string;
  updated_at: string;
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
    return response;
  } catch (error) {
    console.error('❌ Brand onboarding failed:', error);
    throw error;
  }
}

