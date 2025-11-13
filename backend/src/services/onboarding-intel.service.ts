import axios from 'axios';

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

interface ClearbitSuggestion {
  name: string;
  domain: string;
  logo?: string | null;
}

interface WikipediaSummary {
  extract: string;
  description: string;
  url: string;
}

interface CompetitorGenerationParams {
  companyName: string;
  industry?: string;
  domain?: string;
  locale?: string;
  country?: string;
}

class OnboardingIntelService {
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel =
    process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';

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

    // Step 1: Try Clearbit autocomplete to resolve name + domain
    const clearbitSuggestions = await this.fetchClearbitSuggestions(
      trimmedInput
    );

    const isLikelyDomain = trimmedInput.includes('.');
    const matchedSuggestion = this.pickBestSuggestion(
      clearbitSuggestions,
      trimmedInput,
      isLikelyDomain
    );

    const companyName = this.buildCompanyName(matchedSuggestion, trimmedInput);
    const domain = this.buildDomain(matchedSuggestion, trimmedInput);
    const website = domain ? this.ensureHttps(domain) : '';
    const logo =
      matchedSuggestion?.logo ??
      (domain ? `https://logo.clearbit.com/${domain}` : '');

    // Step 2: Fetch Wikipedia summary for richer description/metadata
    const wikipediaSummary = await this.fetchWikipediaSummary(companyName);
    const description =
      wikipediaSummary?.extract?.trim() ||
      'No public description available for this brand yet.';

    const derivedIndustry =
      this.extractIndustry(description) ||
      this.extractIndustry(wikipediaSummary?.description ?? '') ||
      'General';

    const headquarters =
      this.extractHeadquarters(description) ||
      this.extractHeadquarters(wikipediaSummary?.description ?? '') ||
      '';

    const foundedYear =
      this.extractFoundedYear(description) ||
      this.extractFoundedYear(wikipediaSummary?.description ?? '') ||
      null;

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

    // Step 3: Generate competitor suggestions
    const competitors = await this.generateCompetitors({
      companyName,
      industry: derivedIndustry,
      domain,
      locale,
      country,
    });

    return {
      brand,
      competitors,
    };
  }

  private async fetchClearbitSuggestions(
    query: string
  ): Promise<ClearbitSuggestion[]> {
    try {
      const response = await axios.get<ClearbitSuggestion[]>(
        'https://autocomplete.clearbit.com/v1/companies/suggest',
        {
          params: { query },
          timeout: 5000,
        }
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn('⚠️ Clearbit autocomplete failed:', error);
      return [];
    }
  }

  private pickBestSuggestion(
    suggestions: ClearbitSuggestion[],
    input: string,
    isLikelyDomain: boolean
  ): ClearbitSuggestion | null {
    if (!suggestions.length) {
      return null;
    }

    const normalizedInput = input.trim().toLowerCase();

    // Exact domain match first
    if (isLikelyDomain) {
      const matchedByDomain = suggestions.find((suggestion) =>
        suggestion.domain
          ? suggestion.domain.toLowerCase() === this.stripProtocol(normalizedInput)
          : false
      );

      if (matchedByDomain) {
        return matchedByDomain;
      }
    }

    // Exact name match
    const matchedByName = suggestions.find(
      (suggestion) =>
        suggestion.name.trim().toLowerCase() === normalizedInput ||
        suggestion.name
          .trim()
          .toLowerCase()
          .includes(normalizedInput)
    );

    if (matchedByName) {
      return matchedByName;
    }

    // Fallback: first suggestion
    return suggestions[0];
  }

  private buildCompanyName(
    suggestion: ClearbitSuggestion | null,
    fallback: string
  ): string {
    if (suggestion?.name) {
      return suggestion.name;
    }
    const sanitized = fallback.replace(/https?:\/\//i, '').replace(/www\./i, '');
    return this.toTitleCase(sanitized.split('.')[0] || fallback);
  }

  private buildDomain(
    suggestion: ClearbitSuggestion | null,
    input: string
  ): string {
    if (suggestion?.domain) {
      return suggestion.domain;
    }

    const stripped = this.stripProtocol(input);
    if (stripped.includes('.')) {
      return stripped;
    }

    if (!stripped) {
      return '';
    }

    return `${stripped.replace(/\s+/g, '')}.com`;
  }

  private async fetchWikipediaSummary(
    companyName: string
  ): Promise<WikipediaSummary | null> {
    const candidates = [
      companyName,
      `${companyName} (company)`,
      `${companyName} Inc.`,
      `${companyName} company`,
    ];

    for (const candidate of candidates) {
      try {
        const encoded = encodeURIComponent(candidate);
        const response = await axios.get<any>(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
          { timeout: 5000 }
        );

        if (!response.data) {
          continue;
        }

        if (response.data.type === 'disambiguation') {
          continue;
        }

        return {
          extract: response.data.extract ?? '',
          description: response.data.description ?? '',
          url:
            response.data?.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encoded}`,
        };
      } catch (error) {
        // 404 or other issues, try next candidate
      }
    }

    return null;
  }

  private extractIndustry(text: string): string | null {
    if (!text) return null;

    const sentence = text.split('.').shift() ?? '';
    const match = sentence.match(
      /is an? ([^.]+?)(?: company| corporation| manufacturer| brand| provider| organisation| organization)/i
    );

    if (!match || !match[1]) {
      return null;
    }

    const industry = match[1]
      .replace(/\b(international|american|british|global|multinational|publicly traded)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return this.toTitleCase(industry);
  }

  private extractHeadquarters(text: string): string | null {
    if (!text) return null;

    const match = text.match(/headquartered(?: in| near)? ([^.]+?)(?:\.|,)/i);
    if (match && match[1]) {
      return match[1].trim();
    }

    return null;
  }

  private extractFoundedYear(text: string): number | null {
    if (!text) return null;

    const match = text.match(
      /(founded|established|formed|launched)(?: in)? (\d{4})/i
    );
    if (match && match[2]) {
      return Number(match[2]);
    }

    return null;
  }

  private toTitleCase(value: string): string {
    return value
      .split(/[\s-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private stripProtocol(value: string): string {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .trim()
      .replace(/\/+$/, '');
  }

  private ensureHttps(value: string): string {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return `https://${value}`;
  }

  private async generateCompetitors(
    params: CompetitorGenerationParams
  ): Promise<CompetitorSuggestion[]> {
    const { companyName, industry = 'General', domain, locale, country } =
      params;

    const uniqueCompetitors = new Map<string, CompetitorSuggestion>();

    // Attempt Cerebras generation first
    if (this.cerebrasApiKey) {
      try {
        const aiCompetitors = await this.generateCompetitorsWithCerebras({
          companyName,
          industry,
          domain,
          locale,
          country,
        });

        aiCompetitors.forEach((competitor) => {
          if (!competitor.name) {
            return;
          }
          uniqueCompetitors.set(
            competitor.name.toLowerCase(),
            competitor
          );
        });
      } catch (error) {
        console.error('❌ Cerebras competitor generation failed:', error);
      }
    }

    // Fallback dataset if AI failed or returned insufficient data
    if (uniqueCompetitors.size < 5) {
      const fallback = this.getFallbackCompetitors(companyName, industry);
      fallback.forEach((competitor) => {
        uniqueCompetitors.set(competitor.name.toLowerCase(), competitor);
      });
    }

    // Remove brand itself if accidentally included
    if (uniqueCompetitors.has(companyName.toLowerCase())) {
      uniqueCompetitors.delete(companyName.toLowerCase());
    }

    return Array.from(uniqueCompetitors.values()).slice(0, 12);
  }

  async generateCompetitorsForRequest(
    params: CompetitorGenerationParams
  ): Promise<CompetitorSuggestion[]> {
    return this.generateCompetitors(params);
  }

  private async generateCompetitorsWithCerebras(
    params: CompetitorGenerationParams
  ): Promise<CompetitorSuggestion[]> {
    if (!this.cerebrasApiKey) {
      return [];
    }

    const { companyName, industry, domain, locale = 'en-US', country = 'US' } =
      params;

    const payload = {
      model: this.cerebrasModel,
      prompt: this.buildCerebrasPrompt({
        companyName,
        industry,
        domain,
        locale,
        country,
      }),
      max_tokens: 900,
      temperature: 0.6,
      stop: ['---END---'],
    };

    const response = await axios.post<any>(
      'https://api.cerebras.ai/v1/completions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${this.cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );

    const text: string = response.data?.choices?.[0]?.text ?? '';
    if (!text.trim()) {
      throw new Error('Cerebras returned an empty response');
    }

    try {
      const json = this.extractJsonFromText(text);
      const competitors: CompetitorSuggestion[] = Array.isArray(
        json?.competitors
      )
        ? json.competitors
        : Array.isArray(json)
        ? json
        : [];

      return competitors
        .filter(
          (item): item is CompetitorSuggestion =>
            item && typeof item.name === 'string' && item.name.trim().length > 0
        )
        .map((item) => ({
          name: item.name.trim(),
          logo:
            item.logo && item.logo.startsWith('http')
              ? item.logo
              : item.domain
              ? `https://logo.clearbit.com/${this.stripProtocol(item.domain)}`
              : '',
          industry: item.industry || industry || 'General',
          relevance: item.relevance || 'Direct Competitor',
          domain: this.stripProtocol(item.domain || ''),
          url: item.url || this.ensureHttps(item.domain || ''),
          description: item.description || '',
          source: 'cerebras-ai',
        }))
        .slice(0, 12);
    } catch (error) {
      throw new Error(
        `Failed to parse Cerebras competitor response: ${
          error instanceof Error ? error.message : 'Unknown parsing error'
        }`
      );
    }
  }

  private buildCerebrasPrompt(params: {
    companyName: string;
    industry?: string;
    domain?: string;
    locale: string;
    country: string;
  }): string {
    const { companyName, industry = 'General', domain, locale, country } =
      params;

    return `You are a competitive intelligence analyst.

TASK:
- Identify up to 10 relevant competitors for "${companyName}" in the ${industry} industry.
- Prefer companies operating in the same region (${country}) and market segment.
- Prioritize realistic, well-known organizations. Avoid defunct companies.
- Include a mix of direct and indirect competitors, clearly labelled.

OUTPUT:
Return ONLY valid JSON using the following schema:
{
  "competitors": [
    {
      "name": "string",
      "domain": "string (domain or homepage URL)",
      "industry": "string",
      "relevance": "Direct Competitor | Indirect Competitor | Aspirational Alternative",
      "logo": "https://...",
      "description": "Short neutral summary"
    }
  ]
}

CONTEXT:
- Brand: ${companyName}
- Industry: ${industry}
- Market: ${country} (${locale})
${domain ? `- Website: ${domain}\n` : ''}

RULES:
- DO NOT include ${companyName} itself in the list.
- Prefer competitors that customers would compare directly when researching options.
- If unsure, choose the most globally recognized companies in the same category.
- Output must be valid JSON. Do not include comments, explanations, or markdown.

---END---`;
  }

  private extractJsonFromText(text: string): any {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object detected in response');
    }

    const jsonString = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  }

  private getFallbackCompetitors(
    companyName: string,
    industry: string
  ): CompetitorSuggestion[] {
    const normalizedIndustry = industry.toLowerCase();
    const fallbackMap = this.getFallbackCompetitorMap();
    const list =
      fallbackMap.get(normalizedIndustry) ??
      fallbackMap.get(this.normalizeIndustryKey(normalizedIndustry)) ??
      fallbackMap.get('general')!;

    return list
      .filter(
        (competitor) =>
          competitor.name.toLowerCase() !== companyName.toLowerCase()
      )
      .map((competitor) => ({
        ...competitor,
        domain: this.stripProtocol(competitor.domain),
        url: this.ensureHttps(competitor.domain),
      }));
  }

  private normalizeIndustryKey(industry: string): string {
    if (industry.includes('apparel')) return 'athletic apparel';
    if (industry.includes('footwear')) return 'athletic apparel';
    if (industry.includes('automotive')) return 'automotive';
    if (industry.includes('music')) return 'music streaming';
    if (industry.includes('streaming')) return 'music streaming';
    if (industry.includes('travel')) return 'travel & hospitality';
    if (industry.includes('hospitality')) return 'travel & hospitality';
    if (industry.includes('software')) return 'software';
    if (industry.includes('cloud')) return 'cloud computing';
    if (industry.includes('finance')) return 'financial services';
    if (industry.includes('bank')) return 'financial services';
    if (industry.includes('health')) return 'healthcare';
    if (industry.includes('beauty')) return 'beauty';
    if (industry.includes('telecom')) return 'telecommunications';
    if (industry.includes('e-commerce') || industry.includes('retail'))
      return 'e-commerce';
    if (industry.includes('ride')) return 'ride hailing';
    if (industry.includes('logistic')) return 'logistics';
    if (industry.includes('fast food') || industry.includes('restaurant'))
      return 'fast food';
    if (industry.includes('airline')) return 'airlines';
    if (industry.includes('gaming')) return 'gaming';
    if (industry.includes('education')) return 'education technology';
    return 'general';
  }

  private getFallbackCompetitorMap(): Map<string, CompetitorSuggestion[]> {
    const createCompetitor = (
      name: string,
      domain: string,
      industry: string,
      relevance: string = 'Direct Competitor'
    ): CompetitorSuggestion => ({
      name,
      domain,
      logo: `https://logo.clearbit.com/${domain}`,
      industry,
      relevance,
      source: 'fallback-dataset',
    });

    return new Map<string, CompetitorSuggestion[]>([
      [
        'athletic apparel',
        [
          createCompetitor('Adidas', 'adidas.com', 'Athletic Apparel'),
          createCompetitor('Puma', 'puma.com', 'Athletic Apparel'),
          createCompetitor('Under Armour', 'underarmour.com', 'Athletic Apparel'),
          createCompetitor('New Balance', 'newbalance.com', 'Athletic Apparel'),
          createCompetitor('Reebok', 'reebok.com', 'Athletic Apparel'),
          createCompetitor('ASICS', 'asics.com', 'Athletic Apparel', 'Indirect Competitor'),
          createCompetitor('Lululemon', 'lululemon.com', 'Athletic Apparel', 'Indirect Competitor'),
        ],
      ],
      [
        'technology',
        [
          createCompetitor('Microsoft', 'microsoft.com', 'Technology'),
          createCompetitor('Google', 'google.com', 'Technology'),
          createCompetitor('Amazon', 'amazon.com', 'Technology'),
          createCompetitor('Meta', 'meta.com', 'Technology'),
          createCompetitor('Samsung', 'samsung.com', 'Technology', 'Indirect Competitor'),
        ],
      ],
      [
        'automotive',
        [
          createCompetitor('Ford', 'ford.com', 'Automotive'),
          createCompetitor('General Motors', 'gm.com', 'Automotive'),
          createCompetitor('Volkswagen', 'vw.com', 'Automotive'),
          createCompetitor('Toyota', 'toyota.com', 'Automotive'),
          createCompetitor('BMW', 'bmw.com', 'Automotive'),
        ],
      ],
      [
        'music streaming',
        [
          createCompetitor('Apple Music', 'music.apple.com', 'Music Streaming'),
          createCompetitor('YouTube Music', 'music.youtube.com', 'Music Streaming'),
          createCompetitor('Amazon Music', 'music.amazon.com', 'Music Streaming'),
          createCompetitor('Tidal', 'tidal.com', 'Music Streaming'),
          createCompetitor('SoundCloud', 'soundcloud.com', 'Music Streaming', 'Indirect Competitor'),
        ],
      ],
      [
        'travel & hospitality',
        [
          createCompetitor('Booking.com', 'booking.com', 'Travel & Hospitality'),
          createCompetitor('Expedia', 'expedia.com', 'Travel & Hospitality'),
          createCompetitor('VRBO', 'vrbo.com', 'Travel & Hospitality'),
          createCompetitor('Marriott', 'marriott.com', 'Travel & Hospitality'),
          createCompetitor('Hilton', 'hilton.com', 'Travel & Hospitality'),
        ],
      ],
      [
        'financial services',
        [
          createCompetitor('JPMorgan Chase', 'jpmorganchase.com', 'Financial Services'),
          createCompetitor('Bank of America', 'bankofamerica.com', 'Financial Services'),
          createCompetitor('Wells Fargo', 'wellsfargo.com', 'Financial Services'),
          createCompetitor('Citigroup', 'citigroup.com', 'Financial Services'),
          createCompetitor('Capital One', 'capitalone.com', 'Financial Services'),
        ],
      ],
      [
        'software',
        [
          createCompetitor('Salesforce', 'salesforce.com', 'Software'),
          createCompetitor('Adobe', 'adobe.com', 'Software'),
          createCompetitor('Oracle', 'oracle.com', 'Software'),
          createCompetitor('SAP', 'sap.com', 'Software'),
          createCompetitor('Workday', 'workday.com', 'Software'),
        ],
      ],
      [
        'cloud computing',
        [
          createCompetitor('Amazon Web Services', 'aws.amazon.com', 'Cloud Computing'),
          createCompetitor('Microsoft Azure', 'azure.microsoft.com', 'Cloud Computing'),
          createCompetitor('Google Cloud', 'cloud.google.com', 'Cloud Computing'),
          createCompetitor('IBM Cloud', 'ibm.com/cloud', 'Cloud Computing'),
          createCompetitor('Oracle Cloud', 'cloud.oracle.com', 'Cloud Computing'),
        ],
      ],
      [
        'healthcare',
        [
          createCompetitor('UnitedHealth Group', 'unitedhealthgroup.com', 'Healthcare'),
          createCompetitor('CVS Health', 'cvshealth.com', 'Healthcare'),
          createCompetitor('Johnson & Johnson', 'jnj.com', 'Healthcare'),
          createCompetitor('Pfizer', 'pfizer.com', 'Healthcare'),
          createCompetitor('Abbott Laboratories', 'abbott.com', 'Healthcare'),
        ],
      ],
      [
        'beauty',
        [
          createCompetitor('L\'Oréal', 'loreal.com', 'Beauty'),
          createCompetitor('Estée Lauder', 'esteelauder.com', 'Beauty'),
          createCompetitor('Unilever', 'unilever.com', 'Beauty'),
          createCompetitor('Procter & Gamble', 'pg.com', 'Beauty'),
          createCompetitor('Shiseido', 'shiseido.com', 'Beauty'),
        ],
      ],
      [
        'telecommunications',
        [
          createCompetitor('Verizon', 'verizon.com', 'Telecommunications'),
          createCompetitor('AT&T', 'att.com', 'Telecommunications'),
          createCompetitor('T-Mobile', 't-mobile.com', 'Telecommunications'),
          createCompetitor('Vodafone', 'vodafone.com', 'Telecommunications'),
          createCompetitor('Orange', 'orange.com', 'Telecommunications'),
        ],
      ],
      [
        'e-commerce',
        [
          createCompetitor('Amazon', 'amazon.com', 'E-commerce'),
          createCompetitor('Walmart', 'walmart.com', 'E-commerce'),
          createCompetitor('Target', 'target.com', 'E-commerce'),
          createCompetitor('Alibaba', 'alibaba.com', 'E-commerce'),
          createCompetitor('Etsy', 'etsy.com', 'E-commerce', 'Indirect Competitor'),
        ],
      ],
      [
        'ride hailing',
        [
          createCompetitor('Lyft', 'lyft.com', 'Ride Hailing'),
          createCompetitor('Grab', 'grab.com', 'Ride Hailing'),
          createCompetitor('Didi', 'didiglobal.com', 'Ride Hailing'),
          createCompetitor('Bolt', 'bolt.eu', 'Ride Hailing'),
          createCompetitor('Ola', 'olacabs.com', 'Ride Hailing'),
        ],
      ],
      [
        'logistics',
        [
          createCompetitor('FedEx', 'fedex.com', 'Logistics'),
          createCompetitor('UPS', 'ups.com', 'Logistics'),
          createCompetitor('DHL', 'dhl.com', 'Logistics'),
          createCompetitor('XPO Logistics', 'xpo.com', 'Logistics'),
          createCompetitor('C.H. Robinson', 'chrobinson.com', 'Logistics'),
        ],
      ],
      [
        'fast food',
        [
          createCompetitor('McDonald\'s', 'mcdonalds.com', 'Fast Food'),
          createCompetitor('Burger King', 'burgerking.com', 'Fast Food'),
          createCompetitor('KFC', 'kfc.com', 'Fast Food'),
          createCompetitor('Subway', 'subway.com', 'Fast Food'),
          createCompetitor('Domino\'s', 'dominos.com', 'Fast Food'),
        ],
      ],
      [
        'airlines',
        [
          createCompetitor('Delta Air Lines', 'delta.com', 'Airlines'),
          createCompetitor('American Airlines', 'aa.com', 'Airlines'),
          createCompetitor('United Airlines', 'united.com', 'Airlines'),
          createCompetitor('Southwest Airlines', 'southwest.com', 'Airlines'),
          createCompetitor('British Airways', 'britishairways.com', 'Airlines'),
        ],
      ],
      [
        'gaming',
        [
          createCompetitor('PlayStation', 'playstation.com', 'Gaming'),
          createCompetitor('Xbox', 'xbox.com', 'Gaming'),
          createCompetitor('Nintendo', 'nintendo.com', 'Gaming'),
          createCompetitor('Steam', 'store.steampowered.com', 'Gaming'),
          createCompetitor('Epic Games', 'epicgames.com', 'Gaming'),
        ],
      ],
      [
        'education technology',
        [
          createCompetitor('Coursera', 'coursera.org', 'Education Technology'),
          createCompetitor('Udemy', 'udemy.com', 'Education Technology'),
          createCompetitor('Khan Academy', 'khanacademy.org', 'Education Technology'),
          createCompetitor('edX', 'edx.org', 'Education Technology'),
          createCompetitor('Duolingo', 'duolingo.com', 'Education Technology'),
        ],
      ],
      [
        'general',
        [
          createCompetitor('IBM', 'ibm.com', 'Technology', 'Indirect Competitor'),
          createCompetitor('Accenture', 'accenture.com', 'Technology', 'Indirect Competitor'),
          createCompetitor('Deloitte', 'deloitte.com', 'Consulting', 'Indirect Competitor'),
          createCompetitor('PwC', 'pwc.com', 'Consulting', 'Indirect Competitor'),
          createCompetitor('Capgemini', 'capgemini.com', 'Technology', 'Indirect Competitor'),
        ],
      ],
    ]);
  }
}

export const onboardingIntelService = new OnboardingIntelService();

