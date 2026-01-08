export interface BrandIntel {
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

export interface CompetitorSuggestion {
  name: string;
  logo: string;
  industry: string;
  relevance: string;
  domain: string;
  url?: string;
  description?: string;
  source?: string;
}

export interface BrandIntelPayload {
  brand: BrandIntel;
  competitors: CompetitorSuggestion[];
}

export interface ClearbitSuggestion {
  name: string;
  domain: string;
  logo?: string | null;
}

export interface WikipediaSummary {
  extract: string;
  description: string;
  url: string;
}

export interface CompetitorGenerationParams {
  companyName: string;
  industry?: string;
  domain?: string;
  locale?: string;
  country?: string;
}

export interface LLMBrandIntelResult {
  brandName?: string;
  summary?: string;
  industry?: string;
  headquarters?: string;
  foundedYear?: number | null;
  ceo?: string;
  competitors?: string[];
  topics?: string[];
  homepageUrl?: string;
}

