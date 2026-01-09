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
    url?: string;
  }): Promise<BrandIntelPayload> {
    const { input, locale = 'en-US', country = 'US', url } = params;
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

    // Override with user provided URL if available
    if (url) {
      const providedDomain = stripProtocol(url);
      if (providedDomain) {
        domain = providedDomain;
        console.log(`✅ Using user provided domain: ${domain}`);
      }
    }

    let website = domain ? ensureHttps(domain) : '';
    // Store original Clearbit logo if available
    const clearbitLogo = matchedSuggestion?.logo;
    let logo = clearbitLogo ?? (domain ? `https://logo.clearbit.com/${domain}` : '');

    // Step 2: Generate brand intelligence using LLM
    let llmBrandIntel = null;
    try {
      llmBrandIntel = await llmBrandIntelService.generateBrandIntel(
        trimmedInput,
        companyName,
        domain
      );
      console.log('✅ LLM brand intelligence generated:', {
        hasBrandName: !!llmBrandIntel?.brandName,
        hasSummary: !!llmBrandIntel?.summary,
        hasIndustry: !!llmBrandIntel?.industry,
        competitorsCount: llmBrandIntel?.competitors?.length || 0,
      });
    } catch (llmError) {
      console.error('❌ LLM generation failed:', llmError);
    }

    // Use LLM's brandName if available, otherwise fall back to Clearbit's companyName
    const finalCompanyName = llmBrandIntel?.brandName || companyName;

    // Step 3: Fetch Wikipedia summary as fallback/enhancement
    const wikipediaSummary = await wikipediaService.fetchSummary(finalCompanyName);
    let description =
      llmBrandIntel?.summary || wikipediaSummary?.extract?.trim() || '';

    if (!description) {
      description = `Information about ${finalCompanyName}${domain ? ` (${domain})` : ''}`;
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

    // Use LLM-generated homepage URL if available (prefer LLM's domain as it's more accurate)
    const originalDomain = domain;
    if (llmBrandIntel?.homepageUrl) {
      const llmDomain = stripProtocol(llmBrandIntel.homepageUrl);
      if (llmDomain) {
        // Always prefer LLM's domain when available (it's more accurate than Clearbit's guess)
        domain = llmDomain;
        website = ensureHttps(llmDomain);
        console.log(`✅ Using LLM domain: ${domain} (from homepageUrl: ${llmBrandIntel.homepageUrl})`);
      }
    }

    // Step 5: Build brand object
    // Ensure we have a domain and logo even if Clearbit/LLM miss
    if (!domain) {
      const fallbackDomain = `${finalCompanyName.toLowerCase().replace(/\s+/g, '')}.com`;
      domain = fallbackDomain;
      website = ensureHttps(fallbackDomain);
    }
    
    // Always rebuild logo with the final domain to ensure consistency
    // LLM's homepageUrl is more accurate, so use it for logo even if we had a Clearbit logo
    // This ensures the logo matches the actual domain we're using
    logo = `https://logo.clearbit.com/${domain}`;
    console.log(`🖼️ Logo URL built with final domain: ${logo}`);

    const brand: BrandIntel = {
      verified: Boolean(domain),
      companyName: finalCompanyName,
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
          companyName: finalCompanyName,
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

