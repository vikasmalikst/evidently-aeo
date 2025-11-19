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
    let domain = this.buildDomain(matchedSuggestion, trimmedInput);
    let website = domain ? this.ensureHttps(domain) : '';
    const logo =
      matchedSuggestion?.logo ??
      (domain ? `https://logo.clearbit.com/${domain}` : '');

    // Step 2: Generate complete brand intelligence using LLM (matches portal implementation)
    // This generates brand info, competitors, and topics all at once
    // NOTE: Topics can be skipped if using new topics+queries generation service
    const skipTopics = process.env.USE_NEW_TOPICS_QUERY_GENERATION === 'true';
    console.log('🤖 Generating brand intelligence with LLM (portal-style)...', skipTopics ? '(topics skipped - using new service)' : '');
    let llmBrandIntel: any = null;
    try {
      llmBrandIntel = await this.generateBrandIntelWithLLM(trimmedInput, companyName, domain, skipTopics);
      console.log('✅ LLM brand intelligence generated:', {
        hasSummary: !!llmBrandIntel?.summary,
        hasIndustry: !!llmBrandIntel?.industry,
        competitorsCount: llmBrandIntel?.competitors?.length || 0,
        topicsCount: llmBrandIntel?.topics?.length || 0,
      });
    } catch (llmError) {
      console.error('❌ LLM generation failed:', llmError);
    }

    // Step 2a: Fetch Wikipedia summary as fallback/enhancement
    const wikipediaSummary = await this.fetchWikipediaSummary(companyName);
    let description = llmBrandIntel?.summary || wikipediaSummary?.extract?.trim() || '';
    
    // Final fallback if still no description
    if (!description || description === '') {
      description = `Information about ${companyName}${domain ? ` (${domain})` : ''}`;
    }

    // Use LLM data first, then fallback to Wikipedia/extraction
    let derivedIndustry =
      llmBrandIntel?.industry ||
      this.extractIndustry(description) ||
      this.extractIndustry(wikipediaSummary?.description ?? '') ||
      'General';

    let headquarters =
      llmBrandIntel?.headquarters ||
      this.extractHeadquarters(description) ||
      this.extractHeadquarters(wikipediaSummary?.description ?? '') ||
      '';

    let foundedYear =
      llmBrandIntel?.foundedYear ||
      this.extractFoundedYear(description) ||
      this.extractFoundedYear(wikipediaSummary?.description ?? '') ||
      null;

    // Use LLM-generated homepage URL if available
    if (llmBrandIntel?.homepageUrl) {
      const llmDomain = this.stripProtocol(llmBrandIntel.homepageUrl);
      if (llmDomain && !domain) {
        domain = llmDomain;
        website = llmBrandIntel.homepageUrl;
      }
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

    // Step 3: Use LLM-generated competitors (simple string array) or generate with separate API
    let competitors: CompetitorSuggestion[] = [];
    
    if (llmBrandIntel?.competitors && Array.isArray(llmBrandIntel.competitors) && llmBrandIntel.competitors.length > 0) {
      // Convert simple string array to CompetitorSuggestion format
      console.log(`✅ Using ${llmBrandIntel.competitors.length} competitors from LLM`);
      competitors = llmBrandIntel.competitors
        .filter((name: string) => name && typeof name === 'string' && name.trim().length > 0)
        .slice(0, 10)
        .map((name: string) => {
          const normalizedName = name.trim();
          // Create proper domain format - add .com if no TLD present
          let competitorDomain = normalizedName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9.-]/g, '');
          // If domain doesn't have a TLD, add .com
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
      // Fallback to separate competitor generation API
      console.log('⚠️ No competitors from LLM, using separate competitor generation...');
      try {
        competitors = await this.generateCompetitors({
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

    // Store topics in metadata for later use (they'll be used in topic generation step)
    if (llmBrandIntel?.topics && Array.isArray(llmBrandIntel.topics) && llmBrandIntel.topics.length > 0) {
      brand.metadata = {
        ...brand.metadata,
        llmGeneratedTopics: llmBrandIntel.topics,
      };
      console.log(`✅ Stored ${llmBrandIntel.topics.length} topics from LLM in metadata`);
    }

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

  /**
   * Generate complete brand intelligence using LLM (Cerebras) - matches portal implementation
   * Uses the same prompt and parsing logic as the portal
   * 
   * @param skipTopics - If true, topics will not be generated (for use with new topics+queries service)
   */
  private async generateBrandIntelWithLLM(
    rawInput: string,
    companyName: string,
    domain?: string,
    skipTopics: boolean = false
  ): Promise<{
    summary?: string;
    industry?: string;
    headquarters?: string;
    foundedYear?: number | null;
    ceo?: string;
    competitors?: string[];
    topics?: string[];
    homepageUrl?: string;
  }> {
    if (!this.cerebrasApiKey) {
      console.warn('⚠️ Cerebras API key not configured, skipping LLM generation');
      return {};
    }

    // Use the exact same prompt as the portal implementation
    // If skipTopics is true, remove topics from the prompt and response
    const topicsSection = skipTopics ? '' : `
You are an Answer Engine Optimization (AEO) researcher.  
Your task is to generate 5–8 high-level **Topics** that represent the main categories of user queries for a specific brand or entity.  

Requirements:
1. Topics are broad "buckets" of user intent, not individual questions.  
2. Topics must be **brand-specific** and **industry-specific**.  
3. Avoid generic labels like "FAQs" or "General Information." Each Topic should reflect real areas of likely user curiosity.  
4. Cover a balanced spread of user concerns, typically including:
   - Brand identity & trust
   - Products & features
   - Concerns, risks, or complaints
   - Informational / how-to usage
   - Pricing, value, or cost
   - Comparisons vs. competitors
   - Sustainability, ethics, or quality signals
   - Ingredients, nutrition, or safety (if relevant to category)
   - Local/transactional considerations (if relevant)
5. Keep Topics **short (2–5 words)** and **query-shaped** (e.g., "Nutritional Facts," "Durability & Quality," "Pricing & Value").  
6. Do not include the brand name inside the Topics.`;

    const topicsField = skipTopics ? '' : ',\n  "topics": ["string1", "string2", "string3", "string4", "string5", "string6", "string7", "string8"]';

    const LLM_SYSTEM_PROMPT = `You are a brand intelligence researcher. Given a brand name OR a URL:

Identify the brand, canonical homepage URL, short neutral summary (max 4 sentences).

Extract CEO, headquarters city+country, founded year (if public).

List top 5 competitors (global first, dedupe subsidiaries).

Assign an industry/vertical (1–3 words).
${skipTopics ? '\n\nNOTE: Topics will be generated separately. Do not include topics in your response.' : ''}

IMPORTANT: You must respond with a valid JSON object containing these exact fields:
{
  "brandName": "string",
  "homepageUrl": "string (full URL with https://)",
  "summary": "string (max 4 sentences)",
  "ceo": "string or null",
  "headquarters": "string (city, country)",
  "foundedYear": number or null,
  "industry": "string (1-3 words)",
  "competitors": ["string1", "string2", "string3", "string4", "string5"]${topicsField}
}
${topicsSection}

Return JSON strictly matching the BrandIntel schema. Include 3–6 public sources with titles+URLs used for the above. Input was: {rawInput}.`;

    const systemPrompt = LLM_SYSTEM_PROMPT.replace('{rawInput}', rawInput);

    try {
      // Use chat/completions API format (same as portal)
      const response = await axios.post<any>(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: this.cerebrasModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this brand: ${rawInput}` }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.cerebrasApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) {
        console.warn('⚠️ No content in LLM response');
        return {};
      }

      // Use the same parsing logic as portal (simple regex, then handle field variations)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ No JSON found in LLM response');
        return {};
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Parsed brand intel JSON:', parsed);

      // Handle field name variations (same as portal)
      return {
        summary: parsed.summary || parsed.description || undefined,
        industry: parsed.industry || parsed.sector || parsed.vertical || undefined,
        headquarters: parsed.headquarters || parsed.location || parsed.hq || undefined,
        foundedYear: parsed.foundedYear || parsed.founded || parsed.year_founded || null,
        ceo: parsed.ceo || parsed.ceo_name || undefined,
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : (Array.isArray(parsed.aeo_topics) ? parsed.aeo_topics : []),
        homepageUrl: parsed.homepageUrl || parsed.homepage || parsed.url || undefined,
      };
    } catch (error) {
      console.error('❌ LLM brand intelligence generation failed:', error);
      return {};
    }
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

    console.log('🔍 Starting competitor generation for:', {
      companyName,
      industry,
      domain,
      locale,
      country,
    });

    // Ensure Cerebras API key is configured
    if (!this.cerebrasApiKey) {
      const errorMsg = '❌ CEREBRAS_API_KEY is not configured. Cannot generate competitors.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log('✅ Cerebras API key found, calling Cerebras API...');

    try {
      const aiCompetitors = await this.generateCompetitorsWithCerebras({
        companyName,
        industry,
        domain,
        locale,
        country,
      });

      console.log(`✅ Cerebras returned ${aiCompetitors.length} competitors`);

      const uniqueCompetitors = new Map<string, CompetitorSuggestion>();

      aiCompetitors.forEach((competitor) => {
        if (!competitor.name) {
          return;
        }
        uniqueCompetitors.set(
          competitor.name.toLowerCase(),
          competitor
        );
      });

      // Remove brand itself if accidentally included
      if (uniqueCompetitors.has(companyName.toLowerCase())) {
        console.log(`⚠️ Removing ${companyName} from competitors (self-reference)`);
        uniqueCompetitors.delete(companyName.toLowerCase());
      }

      let finalCompetitors = Array.from(uniqueCompetitors.values()).slice(0, 12);
      
      // 🎯 NEW: Basic competitor verification - filter out invalid competitors
      finalCompetitors = this.verifyCompetitors(finalCompetitors, companyName);
      
      // If no competitors found, try to get some basic suggestions from Clearbit
      if (finalCompetitors.length === 0) {
        console.warn('⚠️ No competitors found from AI, trying Clearbit fallback...');
        try {
          const clearbitSuggestions = await this.fetchClearbitSuggestions(`${industry} companies`);
          const fallbackCompetitors = clearbitSuggestions
            .slice(0, 5)
            .filter(s => s.name.toLowerCase() !== companyName.toLowerCase())
            .map(s => ({
              name: s.name,
              domain: s.domain,
              logo: s.logo || `https://logo.clearbit.com/${s.domain}`,
              industry: industry,
              relevance: 'Indirect Competitor' as const,
              url: `https://${s.domain}`,
              description: '',
              source: 'clearbit-fallback',
            }));
          
          if (fallbackCompetitors.length > 0) {
            console.log(`✅ Using ${fallbackCompetitors.length} Clearbit fallback competitors`);
            finalCompetitors = fallbackCompetitors;
          }
        } catch (fallbackError) {
          console.warn('⚠️ Clearbit fallback also failed:', fallbackError);
        }
      }
      
      console.log(`✅ Returning ${finalCompetitors.length} verified unique competitors`);

      return finalCompetitors;
    } catch (error) {
      const errorMsg = `❌ Cerebras competitor generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(errorMsg);
      console.error('Full error:', error);
      throw new Error(errorMsg);
    }
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
      throw new Error('Cerebras API key is not configured');
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
      max_tokens: 3000, // Increased to ensure complete responses for 10 competitors with full details
      temperature: 0.6,
      stop: ['---END---'],
    };

    console.log('📤 Sending request to Cerebras API:', {
      model: payload.model,
      max_tokens: payload.max_tokens,
      temperature: payload.temperature,
      promptLength: payload.prompt.length,
    });

    let response;
    try {
      response = await axios.post<any>(
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

      console.log('📥 Cerebras API response received:', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        hasChoices: !!response.data?.choices,
        choicesLength: response.data?.choices?.length,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Cerebras API request failed:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        throw new Error(
          `Cerebras API request failed: ${error.response?.status} ${
            error.response?.statusText || error.message
          }`
        );
      }
      throw error;
    }

    const text: string = response.data?.choices?.[0]?.text ?? '';
    console.log('📄 Raw response text length:', text.length);
    console.log('📄 Raw response text preview:', text.substring(0, 500));

    if (!text.trim()) {
      throw new Error('Cerebras returned an empty response');
    }

    try {
      const json = this.extractJsonFromText(text);
      console.log('✅ Successfully parsed JSON from response');
      
      const competitors: CompetitorSuggestion[] = Array.isArray(
        json?.competitors
      )
        ? json.competitors
        : Array.isArray(json)
        ? json
        : [];

      console.log('📊 Parsed competitors count:', competitors.length);

      const processedCompetitors = competitors
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

      console.log('✅ Processed competitors:', processedCompetitors.map(c => c.name));

      return processedCompetitors;
    } catch (error) {
      console.error('❌ Failed to parse Cerebras response:', {
        error: error instanceof Error ? error.message : String(error),
        rawTextPreview: text.substring(0, 1000),
      });
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
- If ${companyName} operates in ${country}, find competitors in that market.
- If ${companyName} does NOT operate in ${country}, find companies that DO operate in ${country} and serve similar customer needs in the ${industry} industry.
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
- Target Market: ${country} (${locale})
${domain ? `- Website: ${domain}\n` : ''}

RULES:
- DO NOT include ${companyName} itself in the list.
- If the brand doesn't operate in ${country}, find companies that DO operate there and serve similar needs.
- Prefer competitors that customers would compare directly when researching options.
- If unsure, choose the most globally recognized companies in the same category.
- CRITICAL: Output ONLY valid JSON. Do NOT include any text, comments, explanations, or markdown after the JSON.
- The response must end immediately after the closing brace } of the JSON object.
- Always return at least 3-5 competitors if possible. Only return empty array if truly no relevant companies exist.

---END---`;
  }

  private extractJsonFromText(text: string): any {
    console.log('🔍 Attempting to extract JSON from text...');
    
    // Remove markdown code fences if present (common with instruction-tuned models)
    let cleanedText = text.trim();
    
    // Handle <|endoftext|> token and other end tokens that might cause issues
    // Cerebras and other models may append these tokens after the response
    const endTokens = ['<|endoftext|>', '<|im_end|>', '---END---', '<|end|>'];
    for (const token of endTokens) {
      const tokenIndex = cleanedText.indexOf(token);
      if (tokenIndex !== -1) {
        console.log(`🔍 Detected end token "${token}" at position ${tokenIndex}, truncating...`);
        cleanedText = cleanedText.substring(0, tokenIndex).trim();
      }
    }
    
    // Check for markdown code blocks: ```json ... ``` or ``` ... ```
    if (cleanedText.startsWith('```')) {
      console.log('🔍 Detected markdown code fence, removing...');
      
      // Remove opening fence (```json or ```)
      cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
      
      // Remove closing fence (```)  
      cleanedText = cleanedText.replace(/\n?```\s*$/i, '');
      
      console.log('✅ Removed markdown code fences');
      console.log('📝 Cleaned text preview:', cleanedText.substring(0, 300));
    }
    
    const firstBrace = cleanedText.indexOf('{');

    if (firstBrace === -1) {
      console.error('❌ No JSON braces found in response');
      console.error('Text preview:', cleanedText.substring(0, 500));
      // Try regex fallback extraction
      return this.extractCompetitorsWithRegex(cleanedText);
    }

    // Find the matching closing brace by counting braces (handles nested objects)
    let braceCount = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < cleanedText.length; i++) {
      if (cleanedText[i] === '{') {
        braceCount++;
      } else if (cleanedText[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          lastBrace = i;
          break; // Found the matching closing brace
        }
      }
    }

    if (lastBrace === -1) {
      console.error('❌ No matching closing brace found for JSON object');
      console.error('Text preview:', cleanedText.substring(0, 500));
      // Try regex fallback extraction
      return this.extractCompetitorsWithRegex(cleanedText);
    }

    let jsonString = cleanedText.slice(firstBrace, lastBrace + 1);
    console.log('📝 Extracted JSON string length:', jsonString.length);
    console.log('📝 Extracted JSON preview:', jsonString.substring(0, 300));

    // Strategy 1: Try parsing as-is
    try {
      const parsed = JSON.parse(jsonString);
      console.log('✅ JSON parsed successfully (Strategy 1: as-is)');
      console.log('📊 Parsed object keys:', Object.keys(parsed));
      
      // VALIDATE COMPLETENESS - Reject partial/truncated responses
      if (!this.validateJsonCompleteness(jsonString, parsed)) {
        throw new Error('JSON validation failed: Response is incomplete or truncated');
      }
      
      return parsed;
    } catch (firstError) {
      console.log('⚠️ Strategy 1 failed, trying Strategy 2: Enhanced JSON cleaning...');
      console.log('Error:', firstError instanceof Error ? firstError.message : String(firstError));
      
      // Strategy 2: Enhanced JSON cleaning
      try {
        const cleanedJson = this.cleanJsonString(jsonString);
        const parsed = JSON.parse(cleanedJson);
        console.log('✅ JSON parsed successfully (Strategy 2: enhanced cleaning)');
        console.log('📊 Parsed object keys:', Object.keys(parsed));
        
        // VALIDATE COMPLETENESS - Reject partial/truncated responses
        if (!this.validateJsonCompleteness(cleanedJson, parsed)) {
          throw new Error('JSON validation failed: Response is incomplete or truncated');
        }
        
        return parsed;
      } catch (secondError) {
        console.log('⚠️ Strategy 2 failed, trying Strategy 3: Partial recovery...');
        
        // Strategy 3: Try partial JSON recovery (DISABLED IN STRICT MODE)
        try {
          const recovered = this.recoverPartialJson(jsonString, secondError);
          if (recovered) {
            console.log('✅ Recovered partial JSON (Strategy 3: partial recovery)');
            return recovered;
          }
        } catch (thirdError) {
          console.log('⚠️ Strategy 3 failed (disabled in strict mode)');
        }
        
        // Strategy 4: Regex-based fallback extraction (DISABLED - incomplete data)
        console.error('❌ All complete parsing strategies failed');
        console.error('   Regex fallback is disabled in strict mode (would return incomplete data)');
        console.error('   This likely means the API response was truncated due to token limits');
        console.error('   Suggested fix: Increase max_tokens or reduce requested data');
        
        throw new Error(
          'Failed to parse complete JSON from response. Response appears to be truncated. Partial results are rejected in strict mode.'
        );
      }
    }
  }

  private cleanJsonString(jsonString: string): string {
    console.log('🧹 Applying enhanced JSON cleaning...');
    
    let cleaned = jsonString;
    
    // 1. Replace single quotes with double quotes (but not in content)
    // This is tricky, so we'll be conservative
    cleaned = cleaned.replace(/'/g, '"');
    
    // 2. Remove trailing commas before closing brackets/braces
    cleaned = cleaned.replace(/,\s*}/g, '}');
    cleaned = cleaned.replace(/,\s*]/g, ']');
    
    // 3. Fix missing commas between array elements (detect } { pattern)
    cleaned = cleaned.replace(/}\s*{/g, '},{');
    
    // 4. Fix missing commas between array elements (detect ] [ pattern)
    cleaned = cleaned.replace(/]\s*\[/g, '],[');
    
    // 5. Fix missing commas after closing braces in arrays
    cleaned = cleaned.replace(/}(\s*)"/g, '},"');
    
    // 6. Remove control characters
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
    
    // 7. Normalize whitespace
    cleaned = cleaned.replace(/\r\n/g, ' ');
    cleaned = cleaned.replace(/\n/g, ' ');
    cleaned = cleaned.replace(/\t/g, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // 8. Fix double double-quotes that might have been created
    cleaned = cleaned.replace(/""+/g, '"');
    
    console.log('🧹 Cleaned JSON preview:', cleaned.substring(0, 300));
    
    return cleaned;
  }

  /**
   * Validates if the JSON response is complete and not truncated
   * Returns true if complete, false if truncated/incomplete
   */
  private validateJsonCompleteness(jsonString: string, parsedJson: any): boolean {
    // Check 1: Ensure the JSON ends properly with closing braces
    const trimmed = jsonString.trim();
    if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
      console.log('❌ JSON validation failed: Does not end with closing brace/bracket');
      return false;
    }
    
    // Check 2: Verify balanced braces
    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/]/g) || []).length;
    
    if (openBraces !== closeBraces) {
      console.log(`❌ JSON validation failed: Unbalanced braces (open: ${openBraces}, close: ${closeBraces})`);
      return false;
    }
    
    if (openBrackets !== closeBrackets) {
      console.log(`❌ JSON validation failed: Unbalanced brackets (open: ${openBrackets}, close: ${closeBrackets})`);
      return false;
    }
    
    // Check 3: Verify competitors array exists and has complete entries
    if (!parsedJson?.competitors || !Array.isArray(parsedJson.competitors)) {
      console.log('❌ JSON validation failed: Missing or invalid competitors array');
      return false;
    }
    
    // Check 4: Verify each competitor has all required fields
    const requiredFields = ['name', 'domain', 'industry', 'relevance'];
    for (let i = 0; i < parsedJson.competitors.length; i++) {
      const competitor = parsedJson.competitors[i];
      const missingFields = requiredFields.filter(field => !competitor[field]);
      
      if (missingFields.length > 0) {
        console.log(`❌ JSON validation failed: Competitor ${i + 1} missing required fields: ${missingFields.join(', ')}`);
        return false;
      }
      
      // Check for truncated fields (very short or suspicious values)
      if (competitor.name && competitor.name.length < 2) {
        console.log(`❌ JSON validation failed: Competitor ${i + 1} has suspiciously short name`);
        return false;
      }
    }
    
    console.log(`✅ JSON validation passed: Complete JSON with ${parsedJson.competitors.length} valid competitors`);
    return true;
  }

  private recoverPartialJson(jsonString: string, error: any): any | null {
    console.log('🔧 Attempting partial JSON recovery...');
    
    // STRICT MODE: Reject partial JSON recovery - we want 100% complete responses
    console.log('❌ STRICT MODE ENABLED: Partial JSON recovery is disabled');
    console.log('   Reason: User requires 100% complete responses, no partial data accepted');
    
    // Return null to force the error to propagate
    // This will cause the API call to fail rather than return incomplete data
    return null;
  }

  private extractCompetitorsWithRegex(text: string): any {
    console.log('🔍 Attempting regex-based competitor extraction...');
    
    const competitors: CompetitorSuggestion[] = [];
    
    // Pattern 1: Look for "name": "..." or name: "..." (with or without quotes around key)
    const namePattern = /"?name"?\s*:\s*"([^"]+)"/gi;
    const domainPattern = /"?domain"?\s*:\s*"([^"]+)"/gi;
    const industryPattern = /"?industry"?\s*:\s*"([^"]+)"/gi;
    const relevancePattern = /"?relevance"?\s*:\s*"([^"]+)"/gi;
    const descriptionPattern = /"?description"?\s*:\s*"([^"]+)"/gi;
    
    const names = Array.from(text.matchAll(namePattern)).map(m => m[1]);
    const domains = Array.from(text.matchAll(domainPattern)).map(m => m[1]);
    const industries = Array.from(text.matchAll(industryPattern)).map(m => m[1]);
    const relevances = Array.from(text.matchAll(relevancePattern)).map(m => m[1]);
    const descriptions = Array.from(text.matchAll(descriptionPattern)).map(m => m[1]);
    
    console.log('📊 Regex extraction found:', {
      names: names.length,
      domains: domains.length,
      industries: industries.length,
      relevances: relevances.length,
      descriptions: descriptions.length,
    });
    
    // Match them up (assume they're in order)
    const maxLength = Math.max(names.length, domains.length);
    
    for (let i = 0; i < maxLength; i++) {
      const name = names[i];
      if (!name) continue;
      
      const domain = domains[i] || '';
      const industry = industries[i] || 'General';
      const relevance = relevances[i] || 'Direct Competitor';
      const description = descriptions[i] || '';
      
      competitors.push({
        name: name.trim(),
        domain: this.stripProtocol(domain),
        industry,
        relevance,
        logo: domain ? `https://logo.clearbit.com/${this.stripProtocol(domain)}` : '',
        url: domain ? this.ensureHttps(domain) : '',
        description,
        source: 'cerebras-ai-regex',
      });
    }
    
    console.log('✅ Regex extraction completed:', competitors.map(c => c.name));
    
    if (competitors.length === 0) {
      throw new Error('No competitors could be extracted using regex fallback');
    }
    
    return { competitors };
  }

  /**
   * Verify and filter competitors to ensure data quality
   * Removes competitors that are invalid, empty, or the same as the brand
   */
  private verifyCompetitors(
    competitors: CompetitorSuggestion[],
    brandName: string
  ): CompetitorSuggestion[] {
    const normalizedBrandName = brandName.toLowerCase().trim();
    
    return competitors.filter(competitor => {
      // Remove if name is empty or too short
      if (!competitor.name || competitor.name.trim().length < 2) {
        console.log(`🚫 Filtered competitor: Empty or too short name`);
        return false;
      }

      // Remove if competitor is the same as the brand (case-insensitive)
      if (competitor.name.toLowerCase().trim() === normalizedBrandName) {
        console.log(`🚫 Filtered competitor: "${competitor.name}" is the same as brand "${brandName}"`);
        return false;
      }

      // Remove if name is just generic terms
      const genericTerms = ['company', 'inc', 'ltd', 'corp', 'corporation', 'llc', 'brand', 'business'];
      const competitorLower = competitor.name.toLowerCase().trim();
      if (genericTerms.some(term => competitorLower === term || competitorLower === `${term}.`)) {
        console.log(`🚫 Filtered competitor: "${competitor.name}" is too generic`);
        return false;
      }

      // Basic validation passed
      return true;
    });
  }
}

export const onboardingIntelService = new OnboardingIntelService();

