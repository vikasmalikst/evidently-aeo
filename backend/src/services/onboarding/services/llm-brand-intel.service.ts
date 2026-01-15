import axios from 'axios';
import type { LLMBrandIntelResult } from '../types';
import { braveSearchService } from './brave-search.service';

/**
 * Service for generating brand intelligence using LLM (OpenRouter/Cerebras)
 * Enhanced with Brave Search for real-time data
 */
export class LLMBrandIntelService {
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel =
    process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
  private openRouterApiKey = process.env['OPENROUTER_API_KEY'];
  // Updated to use the fast GPT-OSS 20B model
  private openRouterModel = process.env['OPENROUTER_MODEL'] || 'openai/gpt-oss-20b';
    
  private openRouterSiteUrl = process.env['OPENROUTER_SITE_URL'];
  private openRouterSiteTitle = process.env['OPENROUTER_SITE_TITLE'];

  async generateBrandIntel(
    rawInput: string,
    companyName: string,
    domain?: string
  ): Promise<LLMBrandIntelResult> {
    console.log(`🚀 [BRAND-INTEL] Starting intelligence gathering for: "${rawInput}"`);

    // Step 1: Perform Brave Web Search (Optimized: Single query to save API calls)
    // Combined query for brand info + competitors + products
    const combinedQuery = `${companyName} aliases products features competitors alternatives`;
    
    const searchStartTime = performance.now();
    
    // Use single search with higher limit (6) to get enough info
    const searchResults = await braveSearchService.search(combinedQuery, 6);

    const searchEndTime = performance.now();
    console.log(`⏱️ [BRAND-INTEL] Total Search Phase: ${(searchEndTime - searchStartTime).toFixed(2)}ms`);

    // Prepare search context
    const searchContext = searchResults.map(r => `Source: ${r.title}\n${r.description}\nURL: ${r.url}`).join('\n\n');

    const systemPrompt = `You are a brand intelligence researcher.
    
CONTEXT FROM WEB SEARCH:
${searchContext}

TASK:
Analyze the brand "${rawInput}"${domain ? ` (Website: ${domain})` : ''} using the provided search context and your internal knowledge.

1. Identify the brand, canonical homepage URL, short neutral summary (max 4 sentences).
2. Extract CEO, headquarters city+country, founded year (if public).
3. List top 5 competitors (global first, dedupe subsidiaries) with their URLs, aliases, and key products.
4. Assign an industry/vertical (1–3 words).
5. Identify Brand Synonyms/Aliases (e.g., "IBM" for "International Business Machines").
6. Identify Key Commercial Products for the brand.

IMPORTANT: You must respond with a valid JSON object containing these exact fields:
{
  "brandName": "string",
  "homepageUrl": "string (domain name)",
  "brandSynonyms": ["string"],
  "keyProducts": ["string"],
  "summary": "string (max 4 sentences)",
  "ceo": "string or null",
  "headquarters": "string (city, country)",
  "foundedYear": number or null,
  "industry": "string (1-3 words)",
  "competitors": [
    {
      "name": "string",
      "url": "string (homepage)",
      "synonyms": ["string"],
      "products": ["string"]
    }
  ]
}

Return JSON strictly matching the schema. Input was: ${rawInput}${domain ? ` (Website: ${domain})` : ''}.`;

    const userMessage = `Analyze this brand: ${rawInput}${domain ? ` (Website: ${domain})` : ''}`;

    // Log the full prompt being sent to LLM
    console.log('📝 [BRAND-INTEL] Full prompt being sent to LLM:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔹 System Prompt (truncated):');
    console.log(this.previewForLog(systemPrompt, 500));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let lastError: unknown;

    // Primary: OpenRouter
    if (this.openRouterApiKey) {
      try {
        const llmStartTime = performance.now();
        const content = await this.generateWithOpenRouter(systemPrompt, userMessage);
        const llmEndTime = performance.now();
        console.log(`⏱️ [BRAND-INTEL] OpenRouter Processing Time: ${(llmEndTime - llmStartTime).toFixed(2)}ms`);

        const parsed = this.parseBrandIntel(content);
        if (parsed) return parsed;
        console.warn('⚠️ OpenRouter returned no usable JSON, trying Cerebras fallback if available.');
      } catch (error) {
        this.logProviderError('OpenRouter', error);
        console.error('❌ OpenRouter brand intel generation failed, trying Cerebras fallback if available:', error);
        lastError = error;
      }
    } else {
      console.warn('⚠️ OPENROUTER_API_KEY not configured. Skipping primary provider.');
    }

    // Fallback: Cerebras
    if (this.cerebrasApiKey) {
      try {
        const llmStartTime = performance.now();
        const content = await this.generateWithCerebras(systemPrompt, userMessage);
        const llmEndTime = performance.now();
        console.log(`⏱️ [BRAND-INTEL] Cerebras Processing Time: ${(llmEndTime - llmStartTime).toFixed(2)}ms`);

        const parsed = this.parseBrandIntel(content);
        if (parsed) return parsed;
        console.warn('⚠️ Cerebras returned no usable JSON.');
      } catch (error) {
        this.logProviderError('Cerebras', error);
        console.error('❌ Cerebras brand intel generation failed:', error);
        lastError = lastError || error;
      }
    } else {
      console.warn('⚠️ CEREBRAS_API_KEY not configured. No fallback available.');
    }

    if (lastError) {
      console.error('❌ LLM brand intel generation exhausted all providers:', lastError);
    }
    return {};
  }

  private async generateWithCerebras(systemPrompt: string, userMessage: string): Promise<string> {
    console.log('🚀 [BRAND-INTEL] Calling Cerebras for brand intel with model:', this.cerebrasModel);
    
    const response = await axios.post<any>(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        model: this.cerebrasModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${this.cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('No content in Cerebras response');
    }
    console.log('🔍 Cerebras response preview:', this.previewForLog(content));
    return content;
  }

  private async generateWithOpenRouter(systemPrompt: string, userMessage: string): Promise<string> {
    console.log('🌐 [BRAND-INTEL] Calling OpenRouter for brand intel with model:', this.openRouterModel);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.openRouterSiteUrl) {
      headers['HTTP-Referer'] = this.openRouterSiteUrl;
    }
    if (this.openRouterSiteTitle) {
      headers['X-Title'] = this.openRouterSiteTitle;
    }

    const requestPayload = {
      model: this.openRouterModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    };

    // console.log('📤 [BRAND-INTEL] OpenRouter Request Payload:');
    // console.log(JSON.stringify(requestPayload, null, 2));

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      requestPayload,
      {
        headers,
        timeout: 60000,
      }
    );

    // Handle different response structures (including reasoning responses)
    const message = response.data?.choices?.[0]?.message;
    let content = '';
    
    if (typeof message?.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message?.content)) {
      // Handle array content (e.g., from reasoning responses)
      content = message.content
        .map((part: any) => part?.text || part?.content || '')
        .join('\n');
    } else if (message?.content) {
      content = String(message.content);
    }
    
    if (!content.trim()) {
      console.error('❌ OpenRouter response structure:', JSON.stringify(response.data, null, 2));
      throw new Error('No content in OpenRouter response');
    }
    console.log('🔍 OpenRouter response preview:', this.previewForLog(content));
    return content;
  }

  private parseBrandIntel(content: string): LLMBrandIntelResult | null {
    // Try to extract JSON more robustly
    let jsonString = '';

    // Method 1: Try to find JSON object with balanced braces
    const firstBrace = content.indexOf('{');
    if (firstBrace === -1) {
      console.warn('⚠️ No JSON object found in LLM response (no opening brace)');
      return null;
    }

    // Find the matching closing brace by counting braces
    let braceCount = 0;
    let jsonEnd = -1;
    for (let i = firstBrace; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    if (jsonEnd === -1) {
      console.warn('⚠️ No valid JSON object found in LLM response (unbalanced braces)');
      // Fallback: try the old regex method
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    } else {
      jsonString = content.substring(firstBrace, jsonEnd);
    }

    if (!jsonString) {
      console.warn('⚠️ Could not extract JSON from LLM response');
      console.log('Full response:', content);
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
      console.log('✅ Parsed brand intel JSON:', parsed);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonString.substring(0, 200) + '...');
      // Try to clean up common issues
      try {
        // Remove trailing commas and other common issues
        const cleaned = jsonString
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
        parsed = JSON.parse(cleaned);
        console.log('✅ Parsed brand intel JSON after cleanup:', parsed);
      } catch (cleanupError) {
        console.error('❌ JSON parse failed even after cleanup:', cleanupError);
        return null;
      }
    }

    // Generate URL permutations for the brand
    const brandUrlPermutations = (parsed.homepageUrl || parsed.homepage || parsed.url) 
      ? this.generateUrlPermutations(parsed.homepageUrl || parsed.homepage || parsed.url) 
      : [];
    
    // Merge URL permutations into brandSynonyms
    const brandSynonyms = Array.isArray(parsed.brandSynonyms) ? parsed.brandSynonyms : [];
    // Combine and dedupe
    const combinedBrandSynonyms = Array.from(new Set([...brandSynonyms, ...brandUrlPermutations]));

    return {
      brandName: parsed.brandName || parsed.name || undefined,
      brandSynonyms: combinedBrandSynonyms,
      keyProducts: Array.isArray(parsed.keyProducts) ? parsed.keyProducts : [],
      brandUrls: brandUrlPermutations,
      summary: parsed.summary || parsed.description || undefined,
      industry: parsed.industry || parsed.sector || parsed.vertical || undefined,
      headquarters: parsed.headquarters || parsed.location || parsed.hq || undefined,
      foundedYear: parsed.foundedYear || parsed.founded || parsed.year_founded || null,
      ceo: parsed.ceo || parsed.ceo_name || undefined,
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map((c: any) => {
        if (typeof c === 'string') return { name: c, urls: [], synonyms: [] };
        
        const compUrlPermutations = c.url ? this.generateUrlPermutations(c.url) : [];
        const compSynonyms = Array.isArray(c.synonyms) ? c.synonyms : [];
        const combinedCompSynonyms = Array.from(new Set([...compSynonyms, ...compUrlPermutations]));
        
        return {
          name: c.name,
          url: c.url,
          urls: compUrlPermutations,
          synonyms: combinedCompSynonyms,
          products: Array.isArray(c.products) ? c.products : []
        };
      }) : [],
      homepageUrl: parsed.homepageUrl || parsed.homepage || parsed.url || undefined,
    };
  }

  private generateUrlPermutations(domain: string): string[] {
    if (!domain) return [];
    // Clean domain first (remove protocol, www, trailing slash)
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    
    return [
      cleanDomain,
      `www.${cleanDomain}`,
      `https://${cleanDomain}`,
      `https://www.${cleanDomain}`,
      `http://${cleanDomain}`,
      `http://www.${cleanDomain}`
    ];
  }

  private previewForLog(text: string, max: number = 800): string {
    return text.length > max ? `${text.substring(0, max)}...` : text;
  }

  private logProviderError(provider: 'OpenRouter' | 'Cerebras', error: unknown) {
    if (typeof error !== 'object' || error === null) {
      console.error(`❌ ${provider} error (non-object):`, error);
      return;
    }

    // Axios-style error shape
    const anyErr = error as any;
    const status = anyErr?.response?.status;
    const statusText = anyErr?.response?.statusText;
    const errBody = anyErr?.response?.data?.error;
    const message = anyErr?.message;

    console.error(`❌ ${provider} API error`, {
      status,
      statusText,
      message,
      error: errBody,
    });
  }
}

export const llmBrandIntelService = new LLMBrandIntelService();
