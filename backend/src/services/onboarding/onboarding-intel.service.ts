import type {
  BrandIntel,
  BrandIntelPayload,
  CompetitorSuggestion,
  CompetitorGenerationParams,
} from './types';
import { clearbitService } from './services/clearbit.service';
import { wikipediaService } from './services/wikipedia.service';
import { llmBrandIntelService } from './services/llm-brand-intel.service';
import { competitorService } from './services/competitor.service';
import { stripProtocol, ensureHttps } from './utils/string-utils';
import {
  extractIndustry,
  extractHeadquarters,
  extractFoundedYear,
} from './utils/text-extraction';

/**
 * Main service for onboarding brand intelligence
 * Orchestrates multiple data sources to build comprehensive brand information
 */
export class OnboardingIntelService {
  async lookupBrandIntel(params: {
    input: string;
    locale?: string;
    country?: string;
  }): Promise<BrandIntelPayload> {
    const { input, locale = 'en-US', country = 'US' } = params;
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      throw new Error('Brand input is required');
    }

    // Step 1: Resolve company name and domain using Clearbit
    const isLikelyDomain = trimmedInput.includes('.');
    const clearbitSuggestions = await clearbitService.fetchSuggestions(trimmedInput);
    const matchedSuggestion = clearbitService.pickBestSuggestion(
      clearbitSuggestions,
      trimmedInput,
      isLikelyDomain
    );

    const companyName = clearbitService.buildCompanyName(matchedSuggestion, trimmedInput);
    let domain = clearbitService.buildDomain(matchedSuggestion, trimmedInput);
    let website = domain ? ensureHttps(domain) : '';
    let logo =
      matchedSuggestion?.logo ?? (domain ? `https://logo.clearbit.com/${domain}` : '');

    // Step 2: Generate brand intelligence using LLM
    let llmBrandIntel = null;
    try {
      llmBrandIntel = await llmBrandIntelService.generateBrandIntel(
        trimmedInput,
        companyName,
        domain
      );
      console.log('✅ LLM brand intelligence generated:', {
        hasSummary: !!llmBrandIntel?.summary,
        hasIndustry: !!llmBrandIntel?.industry,
        competitorsCount: llmBrandIntel?.competitors?.length || 0,
      });
    } catch (llmError) {
      console.error('❌ LLM generation failed:', llmError);
    }

    // Step 3: Fetch Wikipedia summary as fallback/enhancement
    const wikipediaSummary = await wikipediaService.fetchSummary(companyName);
    let description =
      llmBrandIntel?.summary || wikipediaSummary?.extract?.trim() || '';

    if (!description) {
      description = `Information about ${companyName}${domain ? ` (${domain})` : ''}`;
    }

    // Step 4: Extract and merge company information
    let derivedIndustry =
      llmBrandIntel?.industry ||
      extractIndustry(description) ||
      extractIndustry(wikipediaSummary?.description ?? '') ||
      (matchedSuggestion?.name ? extractIndustry(matchedSuggestion.name) : null) ||
      'General';

    let headquarters =
      llmBrandIntel?.headquarters ||
      extractHeadquarters(description) ||
      extractHeadquarters(wikipediaSummary?.description ?? '') ||
      '';

    let foundedYear =
      llmBrandIntel?.foundedYear ||
      extractFoundedYear(description) ||
      extractFoundedYear(wikipediaSummary?.description ?? '') ||
      null;

    // Use LLM-generated homepage URL if available
    if (llmBrandIntel?.homepageUrl) {
      const llmDomain = stripProtocol(llmBrandIntel.homepageUrl);
      if (llmDomain && !domain) {
        domain = llmDomain;
        website = llmBrandIntel.homepageUrl;
      }
    }

    // Step 5: Build brand object
    // Ensure we have a domain and logo even if Clearbit/LLM miss
    if (!domain) {
      const fallbackDomain = `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;
      domain = fallbackDomain;
      website = ensureHttps(fallbackDomain);
    }
    if (!logo && domain) {
      logo = `https://logo.clearbit.com/${domain}`;
    }

    const brand: BrandIntel = {
      verified: Boolean(domain),
      companyName,
      website,
      domain,
      logo,
      industry: derivedIndustry,
      headquarters,
      founded: foundedYear,
      description,
      metadata: {
        source: {
          wikipedia: wikipediaSummary?.url ?? null,
          clearbit: matchedSuggestion?.domain ?? null,
        },
        lookupInput: trimmedInput,
        fallbackUsed: !matchedSuggestion,
      },
    };

    // Step 6: Generate competitors
    let competitors: CompetitorSuggestion[] = [];

    if (
      llmBrandIntel?.competitors &&
      Array.isArray(llmBrandIntel.competitors) &&
      llmBrandIntel.competitors.length > 0
    ) {
      // Convert LLM competitors (string array) to CompetitorSuggestion format
      console.log(`✅ Using ${llmBrandIntel.competitors.length} competitors from LLM`);
      competitors = llmBrandIntel.competitors
        .filter((name: string) => name && typeof name === 'string' && name.trim().length > 0)
        .slice(0, 10)
        .map((name: string) => {
          const normalizedName = name.trim();
          let competitorDomain = normalizedName
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9.-]/g, '');
          if (!competitorDomain.includes('.')) {
            competitorDomain = `${competitorDomain}.com`;
          }
          return {
            name: normalizedName,
            domain: competitorDomain,
            logo: `https://logo.clearbit.com/${competitorDomain}`,
            industry: derivedIndustry,
            relevance: 'Direct Competitor',
            url: `https://${competitorDomain}`,
            description: '',
            source: 'cerebras-ai',
          };
        });
    } else {
      // Fallback to separate competitor generation
      console.log('⚠️ No competitors from LLM, using separate competitor generation...');
      try {
        competitors = await competitorService.generateCompetitors({
          companyName,
          industry: derivedIndustry,
          domain,
          locale,
          country,
        });
      } catch (compError) {
        console.error('❌ Competitor generation failed:', compError);
        competitors = [];
      }
    }


    return {
      brand,
      competitors,
    };
  }

  async generateCompetitorsForRequest(
    params: CompetitorGenerationParams
  ): Promise<CompetitorSuggestion[]> {
    return competitorService.generateCompetitors(params);
  }
}

export const onboardingIntelService = new OnboardingIntelService();

