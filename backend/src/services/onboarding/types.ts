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
  aliases?: string[];
  products?: string[];
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
  aliases?: string[];
  products?: string[];
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

export interface CompetitorDetail {
  name: string;
  url?: string; // Canonical
  urls?: string[]; // Permutations
  synonyms?: string[]; // Aliases
  products?: string[]; // Commercial Products
}

export interface LLMBrandIntelResult {
  brandName?: string;
  brandSynonyms?: string[];
  keyProducts?: string[];
  brandUrls?: string[];
  summary?: string;
  industry?: string;
  headquarters?: string;
  foundedYear?: number | null;
  ceo?: string;
  competitors?: CompetitorDetail[];
  homepageUrl?: string;
}

