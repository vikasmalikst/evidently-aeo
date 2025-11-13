export interface OnboardingBrand {
  verified: boolean;
  companyName: string;
  website: string;
  domain: string;
  logo: string;
  industry: string;
  headquarters: string;
  founded: number | null;
  description: string;
  metadata?: Record<string, any>;
}

export interface OnboardingCompetitor {
  name: string;
  logo: string;
  industry: string;
  relevance: string;
  domain: string;
  url?: string;
  description?: string;
  source?: string;
}

export interface BrandIntelResponse {
  success: boolean;
  data?: {
    brand: OnboardingBrand;
    competitors: OnboardingCompetitor[];
  };
  error?: string;
}

