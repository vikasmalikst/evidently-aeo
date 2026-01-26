/**
 * Consolidated Analysis Service
 * 
 * Combines multiple LLM operations into a single API call:
 * - Brand product extraction
 * - Competitor product extraction
 * - Citation categorization
 * - Brand sentiment analysis
 * - Competitor sentiment analysis
 * 
 * Uses OpenRouter with best throughput model selection.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { shouldUseOllama, callOllamaAPI as callOllamaClientAPI } from './ollama-client.service';
import { GeneratedKeyword } from '../keywords/keyword-generation.service';

dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

export interface ConsolidatedAnalysisOptions {
  brandName: string;
  brandMetadata?: any;
  brandProducts?: {
    brand_synonyms: string[];
    brand_products: string[];
    competitor_data: Record<string, { synonyms: string[]; products: string[] }>;
  };
  competitorNames: string[];
  competitorMetadata?: Map<string, any>; // competitor_name -> metadata
  rawAnswer: string;
  citations: string[]; // Array of citation URLs
  collectorResultId?: number; // For caching
  customerId?: string; // For database caching
  brandId?: string; // For database caching
}

export interface ConsolidatedAnalysisMetrics {
  totalCitations: number;
  cachedCitations: number;
  totalOccurrences: number; // Brand + Competitor products
  cachedOccurrences: number; // From DB cache
}

export interface ConsolidatedAnalysisResult {
  products: {
    brand: string[];
    competitors: Record<string, string[]>; // competitor_name -> product names
  };
  citations: Record<string, {
    category: 'Editorial' | 'Corporate' | 'Reference' | 'UGC' | 'Social' | 'Institutional';
    pageName: string | null;
  }>;
  sentiment: {
    brand: {
      label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      score: number; // 1-100 scale: <55 = negative, 55-65 = neutral, >65 = positive
    };
    competitors: Record<string, {
      label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      score: number; // 1-100 scale: <55 = negative, 55-65 = neutral, >65 = positive
    }>;
  };
  keywords?: GeneratedKeyword[];
  metrics?: ConsolidatedAnalysisMetrics;
  rawResponse?: string;
  // Qualitative fields
  quotes?: Array<{ text: string; sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; entity: string }>;
  narrative?: {
    brand_summary: string;
    competitor_highlight: string;
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export class ConsolidatedAnalysisService {
  private supabase: SupabaseClient;
  private openRouterApiKey: string;
  private openRouterSiteUrl: string | undefined;
  private openRouterSiteTitle: string | undefined;
  private cache: Map<number, ConsolidatedAnalysisResult> = new Map();

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
    this.openRouterSiteUrl = process.env.OPENROUTER_SITE_URL;
    this.openRouterSiteTitle = process.env.OPENROUTER_SITE_TITLE;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    if (!this.openRouterApiKey) {
      throw new Error('Missing OPENROUTER_API_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  /**
   * Get cached analysis from database (provider-agnostic)
   * Also fetches citations from citation_categories table
   */
  private async getCachedAnalysisFromDB(
    collectorResultId: number,
    citations: string[],
    customerId?: string,
    brandId?: string
  ): Promise<ConsolidatedAnalysisResult | null> {
    try {
      const { data, error } = await this.supabase
        .from('consolidated_analysis_cache')
        .select('products, sentiment, llm_provider, raw_response')
        .eq('collector_result_id', collectorResultId)
        .maybeSingle();

      if (error) {
        console.warn(`⚠️ Error fetching cached analysis for collector_result ${collectorResultId}:`, error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      // Fetch citations from citation_categories table
      const citationsMap: ConsolidatedAnalysisResult['citations'] = {};
      if (citations && citations.length > 0) {
        const cachedCitations = await this.getCachedCitationCategories(
          citations,
          customerId,
          brandId
        );

        // Valid category type guard
        const isValidCategory = (cat: string): cat is 'Editorial' | 'Corporate' | 'Reference' | 'UGC' | 'Social' | 'Institutional' => {
          return ['Editorial', 'Corporate', 'Reference', 'UGC', 'Social', 'Institutional'].includes(cat);
        };

        // Map cached citations back to original URLs
        for (const url of citations) {
          const domain = this.extractDomain(url);
          const cached = cachedCitations.get(domain.toLowerCase());
          if (cached && isValidCategory(cached.category)) {
            citationsMap[url] = {
              category: cached.category,
              pageName: cached.pageName,
            };
          }
        }
      }

      // Reconstruct ConsolidatedAnalysisResult from cached data
      const cachedResult: ConsolidatedAnalysisResult = {
        products: data.products || { brand: [], competitors: {} },
        sentiment: data.sentiment || { brand: { label: 'NEUTRAL', score: 60 }, competitors: {} },
        citations: citationsMap, // Citations fetched from citation_categories table
        rawResponse: data.raw_response || null,
        metrics: {
          totalCitations: citations.length,
          cachedCitations: Object.keys(citationsMap).length,
          totalOccurrences: 1, // The cached analysis itself is one occurrence of brand/competitor data
          cachedOccurrences: 1
        }
      };

      console.log(`📦 Using cached analysis from DB for collector_result ${collectorResultId} (provider: ${data.llm_provider}, ${Object.keys(citationsMap).length} citations)`);
      return cachedResult;
    } catch (error) {
      console.warn(`⚠️ Error fetching cached analysis:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Store analysis result in database cache
   */
  private async storeAnalysisInDB(
    collectorResultId: number,
    result: ConsolidatedAnalysisResult,
    llmProvider: 'ollama' | 'openrouter',
    rawResponse?: string
  ): Promise<void> {
    try {
      // Extract only products and sentiment (citations are stored separately)
      const cacheData = {
        collector_result_id: collectorResultId,
        products: {
          brand: result.products?.brand || [],
          competitors: result.products?.competitors || {},
        },
        sentiment: {
          brand: result.sentiment?.brand || { label: 'NEUTRAL', score: 60 },
          competitors: result.sentiment?.competitors || {},
        },
        llm_provider: llmProvider,
        raw_response: rawResponse || null,
        // Persist qualitative data
        keywords: result.keywords || [],
        quotes: result.quotes || [],
        narrative: result.narrative || null
      };

      const { error } = await this.supabase
        .from('consolidated_analysis_cache')
        .upsert(cacheData, {
          onConflict: 'collector_result_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.warn(`⚠️ Error storing analysis cache for collector_result ${collectorResultId}:`, error.message);
      } else {
        console.log(`💾 Stored analysis cache in DB for collector_result ${collectorResultId} (provider: ${llmProvider})`);
      }
    } catch (error) {
      console.warn(`⚠️ Error storing analysis cache:`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Main function: Perform consolidated analysis
   */
  async analyze(options: ConsolidatedAnalysisOptions): Promise<ConsolidatedAnalysisResult> {
    // Check in-memory cache first (for same request)
    if (options.collectorResultId && this.cache.has(options.collectorResultId)) {
      console.log(`📦 Using in-memory cached analysis for collector_result ${options.collectorResultId}`);
      return this.cache.get(options.collectorResultId)!;
    }

    // Check database cache (provider-agnostic - reuse regardless of current provider)
    if (options.collectorResultId) {
      // Normalize inputs for citation fetching
      const citations = Array.isArray(options.citations) ? options.citations : [];
      const customerId = options.customerId || options.brandMetadata?.customer_id;
      const brandId = options.brandId || options.brandMetadata?.brand_id;

      const cachedResult = await this.getCachedAnalysisFromDB(
        options.collectorResultId,
        citations,
        customerId,
        brandId
      );
      if (cachedResult) {
        // Also cache in memory for this request
        this.cache.set(options.collectorResultId, cachedResult);
        return cachedResult;
      }
    }

    try {
      // Normalize inputs to ensure they're never null
      const citations = Array.isArray(options.citations) ? options.citations : [];
      const competitorNames = Array.isArray(options.competitorNames) ? options.competitorNames : [];
      const rawAnswer = options.rawAnswer || '';
      const brandName = options.brandName || 'Brand';

      // Check database cache for citation categorizations first
      const customerId = options.customerId || options.brandMetadata?.customer_id;
      const brandId = options.brandId || options.brandMetadata?.brand_id;
      const cachedCitations = await this.getCachedCitationCategories(
        citations,
        customerId,
        brandId
      );

      // Separate citations into cached and uncached
      const uncachedCitations = citations.filter(
        url => !cachedCitations.has(this.extractDomain(url))
      );

      // Build prompt (only include uncached citations in LLM call)
      const prompt = this.buildPrompt({
        ...options,
        citations: uncachedCitations,
        competitorNames: competitorNames,
        rawAnswer: rawAnswer,
        brandName: brandName,
      });

      // Check if Ollama should be used (brand-specific)
      const useOllama = await shouldUseOllama(brandId);
      const llmProvider: 'ollama' | 'openrouter' = useOllama ? 'ollama' : 'openrouter';

      // Call LLM API - either Ollama or OpenRouter (existing functionality)
      const result = useOllama
        ? await this.callOllamaAPI(prompt, brandId)
        : await this.callOpenRouterAPI(prompt);

      // Merge cached citations with LLM results
      const mergedCitations: ConsolidatedAnalysisResult['citations'] = {};

      // Valid category type guard
      const isValidCategory = (cat: string): cat is 'Editorial' | 'Corporate' | 'Reference' | 'UGC' | 'Social' | 'Institutional' => {
        return ['Editorial', 'Corporate', 'Reference', 'UGC', 'Social', 'Institutional'].includes(cat);
      };

      // Add cached citations
      for (const [domain, cached] of cachedCitations.entries()) {
        // Find the URL that matches this domain
        const matchingUrl = citations.find(url => this.extractDomain(url) === domain);
        if (matchingUrl && isValidCategory(cached.category)) {
          mergedCitations[matchingUrl] = {
            category: cached.category,
            pageName: cached.pageName,
          };
        }
      }

      // Add LLM results for uncached citations
      for (const [url, categorization] of Object.entries(result.citations)) {
        mergedCitations[url] = categorization;
      }

      // Store new categorizations in database
      if (uncachedCitations.length > 0) {
        await this.storeCitationCategories(
          uncachedCitations,
          result.citations,
          customerId,
          brandId
        );
      }

      // Update result with merged citations
      result.citations = mergedCitations;

      // Add metrics
      result.metrics = {
        totalCitations: citations.length,
        cachedCitations: cachedCitations.size,
        totalOccurrences: 1,
        cachedOccurrences: 0 // This was an LLM call
      };

      // Cache result in memory (for same request)
      if (options.collectorResultId) {
        this.cache.set(options.collectorResultId, result);
      }

      // Store analysis result in database cache (for fault tolerance and resume capability)
      if (options.collectorResultId) {
        await this.storeAnalysisInDB(options.collectorResultId, result, llmProvider, result.rawResponse);
      }

      return result;
    } catch (error) {
      console.error('❌ Consolidated analysis failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Build the consolidated prompt
   */
  private buildPrompt(options: ConsolidatedAnalysisOptions): string {
    const brandMetadataStr = options.brandMetadata
      ? JSON.stringify(options.brandMetadata, null, 2).substring(0, 600)
      : 'No metadata provided';

    // DISABLED: Add brand synonyms and products from KB if available
    // Commented out for now but kept for future use
    let brandKBStr = '';
    // if (options.brandProducts) {
    //   const { brand_synonyms, brand_products } = options.brandProducts;
    //   brandKBStr = `
    // **Brand Knowledge Base (Use these for detection):**
    // - Synonyms/Aliases: ${brand_synonyms?.join(', ') || 'None'}
    // - Known Products: ${brand_products?.join(', ') || 'None'}
    // `;
    // }

    const competitorMetadataStr = options.competitorMetadata && options.competitorMetadata.size > 0
      ? Array.from(options.competitorMetadata.entries())
        .map(([name, metadata]) => {
          const metadataStr = metadata ? JSON.stringify(metadata).substring(0, 200) : 'No metadata';

          // DISABLED: Add competitor products/synonyms if available
          // Commented out for now but kept for future use
          let compKB = '';
          // if (options.brandProducts?.competitor_data) {
          //   const compData = options.brandProducts.competitor_data[name] || 
          //                    Object.entries(options.brandProducts.competitor_data).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
          //   if (compData) {
          //     compKB = ` (Products: ${compData.products?.join(', ') || 'None'}, Synonyms: ${compData.synonyms?.join(', ') || 'None'})`;
          //   }
          // }

          return `- ${name}: ${metadataStr}${compKB}`;
        })
        .join('\n')
      : 'No competitor metadata provided';

    const citations = Array.isArray(options.citations) ? options.citations : [];
    const competitorNames = Array.isArray(options.competitorNames) ? options.competitorNames : [];
    const rawAnswer = options.rawAnswer || '';
    const brandName = options.brandName || 'Brand';

    const citationsList = citations.length > 0
      ? citations.map((url, i) => `${i + 1}. ${url}`).join('\n')
      : 'No citations provided';

    // Truncate answer text to 50,000 characters to stay within token limits
    const maxAnswerLength = 50000;
    const truncatedAnswer = rawAnswer.length > maxAnswerLength
      ? rawAnswer.substring(0, maxAnswerLength) + '\n\n[Text truncated to 50,000 characters]'
      : rawAnswer;

    return `You are an AI assistant analyzing a brand intelligence query response. Perform the following tasks:

## TASK 1: Citation Categorization

Categorize each citation URL into one of these categories:
- **Editorial**: News sites, blogs, media outlets (e.g., techcrunch.com, forbes.com)
- **Corporate**: Company websites, business sites (e.g., uber.com, g2.com)
- **Reference**: Knowledge bases, wikis (e.g., wikipedia.org, stackoverflow.com)
- **UGC**: User-generated content, reviews (e.g., yelp.com, amazon.com)
- **Social**: Social media platforms (e.g., reddit.com, twitter.com, linkedin.com)
- **Institutional**: Educational, government sites (e.g., .edu, .gov domains)

**Citations to categorize:**
${citationsList}

## TASK 2: Sentiment Analysis

### Brand Sentiment
Analyze the overall sentiment toward "${brandName}" in the answer.

### Competitor Sentiment
Analyze the sentiment toward each competitor separately.

**Competitors:** ${competitorNames.length > 0 ? competitorNames.join(', ') : 'No competitors'}

**Requirements:**
1. Overall sentiment label: POSITIVE, NEGATIVE, or NEUTRAL (determined by score range below)
2. Sentiment score: Integer from 1 to 100, where:
   - 1-54: Negative sentiment (bad)
   - 55-65: Neutral sentiment
   - 66-100: Positive sentiment (good)
3. For competitors, analyze sentiment specifically about each competitor

## TASK 3: Keyword Detection

Extract the most important keywords and key phrases from the answer text.
These keywords should be:
1. Relevant for SEO and AEO optimization
2. What users would actually search for
3. Include both short keywords (1-2 words) and long-tail keywords (3-5 words)
4. Include question-based keywords (how, what, why, when, where)
5. Focus on actionable, searchable terms
6. Generate up to 20 keywords

For each keyword, provide:
- The keyword phrase
- A relevance score (0.0 to 1.0)
- Brief reasoning (1 sentence)

## TASK 4: Qualitative Insights

1. **Key Quotes:** Extract 1-3 direct quotes or excerpts from the text that best capture the sentiment (positive or negative). Only pick the most impactful ones.
2. **Narrative Summary:** Write 1-2 sentences explaining WHY the brand or competitors are winning/losing. (e.g., "Competitor X is preferred for simple pricing, while Brand Y is trusted for enterprise features but criticized for complexity.")

## Answer Text to Analyze:
${truncatedAnswer}

---

## OUTPUT FORMAT

Respond with ONLY valid JSON in this exact structure:

{
  "citations": {
    "https://example.com/page1": {
      "category": "Editorial|Corporate|Reference|UGC|Social|Institutional",
      "pageName": "Example Site"
    },
    "https://example.com/page2": {
      "category": "Corporate",
      "pageName": "Company Name"
    }
  },
  "sentiment": {
    "brand": {
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": 1 to 100
    },
    "competitors": {
      "Competitor1": {
        "label": "POSITIVE|NEGATIVE|NEUTRAL",
        "score": 1 to 100
      },
      "Competitor2": {
        "label": "POSITIVE|NEGATIVE|NEUTRAL",
        "score": 1 to 100
      }
    }
  },
  "keywords": [
    {
      "keyword": "exact keyword phrase",
      "relevance_score": 0.85,
      "metadata": {
        "reasoning": "Reasoning here"
      }
    }
  ],
  "quotes": [
    {
      "text": "The snippet text...",
      "sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
      "entity": "BrandName or CompetitorName"
    }
  ],
  "narrative": {
    "brand_summary": "Why the brand is winning/losing...",
    "competitor_highlight": "Key strategy/strength of competitors..."
  }
}`;
  }

  /**
   * Call Ollama API (separate, modular function - brand-specific)
   */
  private async callOllamaAPI(prompt: string, brandId?: string): Promise<ConsolidatedAnalysisResult> {
    console.log('🦙 Calling Ollama for consolidated analysis...');

    const systemMessage = 'You are a precise analysis assistant. Always respond with valid JSON only, no explanations.';

    try {
      // Use the separate Ollama client service (brand-specific)
      const fullResponse = await callOllamaClientAPI(systemMessage, prompt, brandId);

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = typeof fullResponse === 'string' ? fullResponse.trim() : String(fullResponse).trim();

      if (!jsonStr || jsonStr.length === 0) {
        throw new Error('Empty response from Ollama API');
      }

      // Remove markdown code blocks if present
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\s*/g, '');
      }

      // Find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch || !jsonMatch[0]) {
        console.error('⚠️ No JSON found in Ollama response. Response preview:', jsonStr.substring(0, 500));
        throw new Error('No JSON found in Ollama response');
      }

      let result: ConsolidatedAnalysisResult;
      try {
        result = JSON.parse(jsonMatch[0]) as ConsolidatedAnalysisResult;
        // Store the raw full response for post-processing if needed
        result.rawResponse = fullResponse;
      } catch (parseError) {
        console.error('⚠️ Failed to parse JSON from Ollama. Response preview:', jsonStr.substring(0, 500));
        throw new Error(`Failed to parse JSON from Ollama response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Validate and normalize result (same as OpenRouter)
      return this.validateAndNormalize(result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Ollama API call failed:`, errorMsg);
      // Don't fallback to OpenRouter automatically - let the error propagate
      // This ensures Ollama failures are visible and don't silently fallback
      throw new Error(`Ollama API error: ${errorMsg}`);
    }
  }

  /**
   * Helper to process a single line from OpenRouter stream
   */
  private processLine(line: string, onContent: (content: string) => void, onUsage: (usage: any) => void): void {
    const trimmedLine = line.trim();
    if (!trimmedLine || !trimmedLine.startsWith('data: ')) return;

    const data = trimmedLine.slice(6);
    if (data === '[DONE]') return;

    try {
      const parsed = JSON.parse(data);

      // Extract content
      const content = parsed.choices?.[0]?.delta?.content;
      if (content && typeof content === 'string') {
        onContent(content);
      }

      // Extract usage information
      if (parsed.usage) {
        onUsage(parsed.usage);
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  /**
   * Call OpenRouter API with best throughput model selection
   */
  private async callOpenRouterAPI(prompt: string): Promise<ConsolidatedAnalysisResult> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`🔄 Retrying OpenRouter API (attempt ${attempt}/${maxRetries})...`);
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      try {
        const result = await this.executeOpenRouterCall(prompt);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ OpenRouter attempt ${attempt + 1} failed: ${lastError.message}`);

        // If it's a parse error or empty response, it's worth retrying
        if (lastError.message.includes('Empty response') ||
          lastError.message.includes('Failed to parse JSON') ||
          lastError.message.includes('No JSON found')) {
          continue;
        }

        // For other errors (like auth or model not found), don't retry
        throw lastError;
      }
    }

    throw lastError || new Error('OpenRouter API call failed after retries');
  }

  /**
   * Internal execution logic for OpenRouter call
   */
  private async executeOpenRouterCall(prompt: string): Promise<ConsolidatedAnalysisResult> {
    console.log('🌐 Calling OpenRouter for consolidated analysis (best throughput)...');

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.openRouterSiteUrl) {
      headers['HTTP-Referer'] = this.openRouterSiteUrl;
    }
    if (this.openRouterSiteTitle) {
      headers['X-Title'] = this.openRouterSiteTitle;
    }

    // Add 3-minute timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180s (3 mins)

    try {
      // Use streaming to get usage information
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b', // Good balance of cost and quality
          messages: [
            {
              role: 'system',
              content: 'You are a precise analysis assistant. Always respond with valid JSON only, no explanations.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low for consistency
          max_tokens: 8192,
          stream: true,
          stream_options: {
            include_usage: true
          },
          provider: {
            sort: 'throughput' // Use best throughput model
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let usage: any = null;
      let lineBuffer = '';

      if (!reader) {
        throw new Error('No response body reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining data in lineBuffer
          if (lineBuffer.trim()) {
            this.processLine(lineBuffer, (content) => { fullResponse += content; }, (u) => { usage = u; });
          }
          break;
        }

        if (!value) continue;

        const chunk = decoder.decode(value, { stream: true });
        lineBuffer += chunk;

        const lines = lineBuffer.split('\n');
        // Keep the last partial line in the buffer
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          this.processLine(line, (content) => { fullResponse += content; }, (u) => { usage = u; });
        }
      }

      if (!fullResponse || (typeof fullResponse === 'string' && fullResponse.trim().length === 0)) {
        throw new Error('Empty response from OpenRouter API');
      }

      // Log usage if available
      if (usage) {
        console.log(`📊 Token usage: ${usage.prompt_tokens || 0} input, ${usage.completion_tokens || 0} output, ${usage.total_tokens || 0} total`);
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = typeof fullResponse === 'string' ? fullResponse.trim() : String(fullResponse).trim();

      if (!jsonStr || jsonStr.length === 0) {
        throw new Error('Empty response from OpenRouter API');
      }

      // Remove markdown code blocks if present
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\s*/g, '');
      }

      // Find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch || !jsonMatch[0]) {
        console.error('⚠️ No JSON found in response. Response preview:', jsonStr.substring(0, 500));
        throw new Error('No JSON found in OpenRouter response');
      }

      let result: ConsolidatedAnalysisResult;
      try {
        result = JSON.parse(jsonMatch[0]) as ConsolidatedAnalysisResult;
        // Store the raw full response for post-processing if needed
        result.rawResponse = fullResponse;
      } catch (parseError) {
        console.error('⚠️ Failed to parse JSON. Response preview:', jsonStr.substring(0, 500));
        throw new Error(`Failed to parse JSON from OpenRouter response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Validate and normalize result
      return this.validateAndNormalize(result);

    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ OpenRouter API request timed out after 3 minutes');
        throw new Error('OpenRouter API timeout: Request took longer than 3 minutes');
      }

      throw error;
    }
  }

  /**
   * Validate and normalize the result
   */
  private validateAndNormalize(result: ConsolidatedAnalysisResult): ConsolidatedAnalysisResult {
    // Ensure all required fields exist and are not null
    if (!result) {
      result = {
        products: { brand: [], competitors: {} },
        citations: {},
        sentiment: { brand: { label: 'NEUTRAL', score: 60 }, competitors: {} }
      };
    }

    if (!result.products) {
      result.products = { brand: [], competitors: {} };
    }
    if (!result.products.brand || !Array.isArray(result.products.brand)) {
      result.products.brand = [];
    }
    if (!result.products.competitors || typeof result.products.competitors !== 'object') {
      result.products.competitors = {};
    }
    if (!result.citations || typeof result.citations !== 'object') {
      result.citations = {};
    }
    if (!result.sentiment) {
      result.sentiment = {
        brand: { label: 'NEUTRAL', score: 60 }, // 60 is neutral (middle of 55-65 range)
        competitors: {}
      };
    }
    if (!result.sentiment.brand) {
      result.sentiment.brand = { label: 'NEUTRAL', score: 60 };
    }
    if (!result.sentiment.competitors || typeof result.sentiment.competitors !== 'object') {
      result.sentiment.competitors = {};
    }

    // Normalize sentiment scores to 1-100 scale and determine label based on score
    const normalizeScore = (score: number): { score: number; label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' } => {
      // If score is in -1 to 1 range, convert to 1-100
      let normalizedScore: number;
      if (score >= -1 && score <= 1 && score !== 0) {
        // Convert -1 to 1 scale to 1-100 scale
        // -1 -> 1, 0 -> 60, 1 -> 100
        normalizedScore = Math.round(((score + 1) / 2) * 99) + 1;
      } else {
        // Already in 1-100 range or outside both ranges, clamp to 1-100
        normalizedScore = Math.max(1, Math.min(100, Math.round(score)));
      }

      // Determine label based on score range
      let label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      if (normalizedScore < 55) {
        label = 'NEGATIVE';
      } else if (normalizedScore > 65) {
        label = 'POSITIVE';
      } else {
        label = 'NEUTRAL';
      }

      return { score: normalizedScore, label };
    };

    // Normalize brand sentiment
    if (result.sentiment.brand) {
      const brandNormalized = normalizeScore(result.sentiment.brand.score || 60);
      result.sentiment.brand.score = brandNormalized.score;
      result.sentiment.brand.label = brandNormalized.label;
    }

    // Normalize competitor sentiments
    if (result.sentiment.competitors) {
      for (const compName in result.sentiment.competitors) {
        const compSentiment = result.sentiment.competitors[compName];
        if (compSentiment) {
          const compNormalized = normalizeScore(compSentiment.score || 60);
          compSentiment.score = compNormalized.score;
          compSentiment.label = compNormalized.label;
        }
      }
    }

    // Ensure arrays are arrays and strings are strings
    result.products.brand = Array.isArray(result.products.brand)
      ? result.products.brand.filter(p => typeof p === 'string')
      : [];

    // Normalize competitor data
    if (result.products.competitors) {
      for (const compName in result.products.competitors) {
        if (!Array.isArray(result.products.competitors[compName])) {
          result.products.competitors[compName] = [];
        }
        result.products.competitors[compName] = result.products.competitors[compName].filter(p => typeof p === 'string');
      }
    }

    // Ensure competitor sentiment objects have required fields
    if (result.sentiment.competitors) {
      for (const compName in result.sentiment.competitors) {
        const compSentiment = result.sentiment.competitors[compName];
        if (compSentiment) {
          if (!compSentiment.label) {
            compSentiment.label = 'NEUTRAL';
          }
          if (typeof compSentiment.score !== 'number') {
            compSentiment.score = 60;
          }
        }
      }
    }

    // Normalize keywords
    if (result.keywords) {
      if (!Array.isArray(result.keywords)) {
        result.keywords = [];
      } else {
        result.keywords = result.keywords
          .filter(kw => kw && kw.keyword && typeof kw.keyword === 'string')
          .map(kw => ({
            keyword: kw.keyword.trim(),
            relevance_score: typeof kw.relevance_score === 'number'
              ? Math.max(0, Math.min(1, kw.relevance_score))
              : 0.5,
            metadata: kw.metadata || {}
          }));
      }
    } else {
      result.keywords = [];
    }

    return result;
  }

  /**
   * Clear cache for a specific collector result
   */
  clearCache(collectorResultId: number): void {
    this.cache.delete(collectorResultId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch (error) {
      // If URL parsing fails, try to extract domain manually
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      return match ? match[1].toLowerCase() : url.toLowerCase();
    }
  }

  /**
   * Get cached citation categories from database
   * Returns a Map of domain -> { category, pageName }
   */
  private async getCachedCitationCategories(
    citations: string[],
    customerId?: string,
    brandId?: string
  ): Promise<Map<string, { category: string; pageName: string | null }>> {
    const cached = new Map<string, { category: string; pageName: string | null }>();

    // Ensure citations is an array
    const citationsArray = Array.isArray(citations) ? citations : [];

    if (citationsArray.length === 0) {
      return cached;
    }

    // Extract unique domains from citations
    const domains = [...new Set(citationsArray.map(url => this.extractDomain(url)))];

    if (domains.length === 0) {
      return cached;
    }

    try {
      // Query database for cached categories by domain
      let query = this.supabase
        .from('citation_categories')
        .select('domain, category, page_name')
        .in('domain', domains);

      // Optionally filter by customer_id and brand_id if provided
      // Note: We check by domain first (most common case), then by customer/brand if needed
      const { data, error } = await query;

      if (error) {
        console.warn(`⚠️ Error fetching cached citation categories:`, error.message);
        return cached;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        for (const row of data) {
          if (row && row.domain && row.category) {
            cached.set(row.domain.toLowerCase(), {
              category: row.category,
              pageName: row.page_name || null,
            });
          }
        }
        console.log(`📦 Found ${cached.size} cached citation categories in database`);
      }
    } catch (error) {
      console.warn(`⚠️ Error checking citation category cache:`, error instanceof Error ? error.message : error);
    }

    return cached;
  }

  /**
   * Store citation categories in database cache
   */
  private async storeCitationCategories(
    citations: string[],
    categorizations: Record<string, { category: string; pageName: string | null }>,
    customerId?: string,
    brandId?: string
  ): Promise<void> {
    // Ensure citations is an array
    const citationsArray = Array.isArray(citations) ? citations : [];

    if (citationsArray.length === 0) {
      return;
    }

    // Ensure categorizations is an object
    if (!categorizations || typeof categorizations !== 'object') {
      return;
    }

    try {
      const rowsToInsert = citationsArray
        .map(url => {
          if (!url || typeof url !== 'string') {
            return null;
          }

          const categorization = categorizations[url];
          if (!categorization || !categorization.category) {
            return null;
          }

          const domain = this.extractDomain(url);
          if (!domain) {
            return null;
          }

          return {
            customer_id: customerId || null,
            brand_id: brandId || null,
            cited_url: url,
            domain: domain.toLowerCase(), // Normalize domain to lowercase
            category: categorization.category,
            page_name: categorization.pageName || null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (rowsToInsert.length === 0) {
        return;
      }

      // Deduplicate by domain to avoid "ON CONFLICT DO UPDATE cannot affect row a second time" error
      // When multiple URLs from the same domain are processed, we keep only one row per domain
      const domainMap = new Map<string, typeof rowsToInsert[0]>();
      for (const row of rowsToInsert) {
        const existing = domainMap.get(row.domain);
        // Keep the first occurrence, or prefer one with a page_name if available
        if (!existing || (!existing.page_name && row.page_name)) {
          domainMap.set(row.domain, row);
        }
      }

      const uniqueRows = Array.from(domainMap.values());

      if (uniqueRows.length === 0) {
        return;
      }

      // Use upsert to avoid duplicates (on conflict with domain, update)
      // Now we only have one row per domain, so no duplicate conflicts
      const { error } = await this.supabase
        .from('citation_categories')
        .upsert(uniqueRows, {
          onConflict: 'domain',
          ignoreDuplicates: false, // Update if exists
        });

      if (error) {
        console.warn(`⚠️ Error storing citation categories in cache:`, error.message);
      } else {
        console.log(`✅ Stored ${uniqueRows.length} citation categories in database cache (${rowsToInsert.length} URLs, ${uniqueRows.length} unique domains)`);
      }
    } catch (error) {
      console.warn(`⚠️ Error storing citation categories:`, error instanceof Error ? error.message : error);
    }
  }
}

// Export singleton instance
export const consolidatedAnalysisService = new ConsolidatedAnalysisService();



