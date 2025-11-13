import { apiClient } from '../lib/apiClient';
import type { OnboardingBrand, OnboardingCompetitor } from '../types/onboarding';

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

