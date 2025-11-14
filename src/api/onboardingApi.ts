import { apiClient } from '../lib/apiClient';
import type { OnboardingBrand, OnboardingCompetitor } from '../types/onboarding';
import type { Topic } from '../types/topic';

export interface BrandIntelResult {
  brand: OnboardingBrand;
  competitors: OnboardingCompetitor[];
}

export interface BrandIntelApiResponse {
  success: boolean;
  data?: BrandIntelResult;
  error?: string;
}

export interface CompetitorListResponse {
  success: boolean;
  data?: OnboardingCompetitor[];
  error?: string;
}

export async function fetchBrandIntel(
  input: string,
  options: {
    locale?: string;
    country?: string;
  } = {}
): Promise<BrandIntelApiResponse> {
  return apiClient.request<BrandIntelApiResponse>(
    '/onboarding/brand-intel',
    {
      method: 'POST',
      body: JSON.stringify({
        input,
        locale: options.locale,
        country: options.country,
      }),
    },
    { requiresAuth: true }
  );
}

export async function refreshCompetitors(payload: {
  companyName: string;
  industry?: string;
  domain?: string;
  locale?: string;
  country?: string;
}): Promise<CompetitorListResponse> {
  return apiClient.request<CompetitorListResponse>(
    '/onboarding/competitors',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { requiresAuth: true }
  );
}

export interface TopicsResponse {
  success: boolean;
  data?: {
    trending: Topic[];
    aiGenerated: {
      awareness: Topic[];
      comparison: Topic[];
      purchase: Topic[];
      support: Topic[];
    };
    preset: Topic[];
  };
  error?: string;
}

export async function fetchTopicsForBrand(params: {
  brand_name: string;
  industry: string;
  competitors: string[];
  locale?: string;
  country?: string;
  brand_id?: string;
  website_url?: string;
}): Promise<TopicsResponse> {
  return apiClient.request<TopicsResponse>(
    '/onboarding/topics',
    {
      method: 'POST',
      body: JSON.stringify({
        brand_name: params.brand_name,
        industry: params.industry,
        competitors: params.competitors,
        locale: params.locale || 'en-US',
        country: params.country || 'US',
        brand_id: params.brand_id,
        website_url: params.website_url
      }),
    },
    { requiresAuth: true }
  );
}

export interface PromptsResponse {
  success: boolean;
  data?: Array<{
    topic: string;
    prompts: string[];
  }>;
  error?: string;
}

export async function fetchPromptsForTopics(params: {
  brand_name: string;
  industry: string;
  competitors: string[];
  topics: string[];
  locale?: string;
  country?: string;
  brand_id?: string;
  website_url?: string;
}): Promise<PromptsResponse> {
  return apiClient.request<PromptsResponse>(
    '/onboarding/prompts',
    {
      method: 'POST',
      body: JSON.stringify({
        brand_name: params.brand_name,
        industry: params.industry,
        competitors: params.competitors,
        topics: params.topics,
        locale: params.locale || 'en-US',
        country: params.country || 'US',
        brand_id: params.brand_id,
        website_url: params.website_url
      }),
    },
    { requiresAuth: true }
  );
}

