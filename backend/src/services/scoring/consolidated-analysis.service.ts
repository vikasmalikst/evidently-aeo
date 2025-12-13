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

dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

export interface ConsolidatedAnalysisOptions {
  brandName: string;
  brandMetadata?: any;
  competitorNames: string[];
  competitorMetadata?: Map<string, any>; // competitor_name -> metadata
  rawAnswer: string;
  citations: string[]; // Array of citation URLs
  collectorResultId?: number; // For caching
  customerId?: string; // For database caching
  brandId?: string; // For database caching
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
   * Main function: Perform consolidated analysis
   */
  async analyze(options: ConsolidatedAnalysisOptions): Promise<ConsolidatedAnalysisResult> {
    // Check cache first
    if (options.collectorResultId && this.cache.has(options.collectorResultId)) {
      console.log(`📦 Using cached consolidated analysis for collector_result ${options.collectorResultId}`);
      return this.cache.get(options.collectorResultId)!;
    }

    try {
      // Check database cache for citation categorizations first
      const customerId = options.customerId || options.brandMetadata?.customer_id;
      const brandId = options.brandId || options.brandMetadata?.brand_id;
      const cachedCitations = await this.getCachedCitationCategories(
        options.citations,
        customerId,
        brandId
      );

      // Separate citations into cached and uncached
      const uncachedCitations = options.citations.filter(
        url => !cachedCitations.has(this.extractDomain(url))
      );

      // Build prompt (only include uncached citations in LLM call)
      const prompt = this.buildPrompt({
        ...options,
        citations: uncachedCitations,
      });

      // Call OpenRouter API (only for uncached citations)
      const result = await this.callOpenRouterAPI(prompt);

      // Merge cached citations with LLM results
      const mergedCitations: ConsolidatedAnalysisResult['citations'] = {};
      
      // Valid category type guard
      const isValidCategory = (cat: string): cat is 'Editorial' | 'Corporate' | 'Reference' | 'UGC' | 'Social' | 'Institutional' => {
        return ['Editorial', 'Corporate', 'Reference', 'UGC', 'Social', 'Institutional'].includes(cat);
      };
      
      // Add cached citations
      for (const [domain, cached] of cachedCitations.entries()) {
        // Find the URL that matches this domain
        const matchingUrl = options.citations.find(url => this.extractDomain(url) === domain);
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

      // Cache result
      if (options.collectorResultId) {
        this.cache.set(options.collectorResultId, result);
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

    const competitorMetadataStr = options.competitorMetadata && options.competitorMetadata.size > 0
      ? Array.from(options.competitorMetadata.entries())
          .map(([name, metadata]) => {
            const metadataStr = metadata ? JSON.stringify(metadata).substring(0, 200) : 'No metadata';
            return `- ${name}: ${metadataStr}`;
          })
          .join('\n')
      : 'No competitor metadata provided';

    const citationsList = options.citations.length > 0
      ? options.citations.map((url, i) => `${i + 1}. ${url}`).join('\n')
      : 'No citations provided';

    // Truncate answer text to 50,000 characters to stay within token limits
    const maxAnswerLength = 50000;
    const truncatedAnswer = options.rawAnswer.length > maxAnswerLength
      ? options.rawAnswer.substring(0, maxAnswerLength) + '\n\n[Text truncated to 50,000 characters]'
      : options.rawAnswer;

    return `You are an AI assistant analyzing a brand intelligence query response. Perform the following tasks:

## TASK 1: Product Extraction

### Brand Products
Extract official products sold by the brand "${options.brandName}".

**Brand Context:**
${brandMetadataStr}

**Rules:**
1. Include only official products (SKUs, models, variants) that consumers can buy
2. Exclude generics, ingredients, categories, descriptive phrases
3. Exclude competitors and their products
4. Exclude side effects, conditions, benefits, use-cases, features
5. Use both the answer text and your knowledge, but never invent products
6. Maximum 12 products

### Competitor Products
Extract official products for each competitor mentioned in the answer.

**Competitors:** ${options.competitorNames.join(', ')}

**Competitor Context:**
${competitorMetadataStr}

**Rules:**
1. Same rules as brand products (official products only)
2. Extract products for each competitor separately
3. Maximum 8 products per competitor
4. Only include products mentioned in the answer text or your knowledge

## TASK 2: Citation Categorization

Categorize each citation URL into one of these categories:
- **Editorial**: News sites, blogs, media outlets (e.g., techcrunch.com, forbes.com)
- **Corporate**: Company websites, business sites (e.g., uber.com, g2.com)
- **Reference**: Knowledge bases, wikis (e.g., wikipedia.org, stackoverflow.com)
- **UGC**: User-generated content, reviews (e.g., yelp.com, amazon.com)
- **Social**: Social media platforms (e.g., reddit.com, twitter.com, linkedin.com)
- **Institutional**: Educational, government sites (e.g., .edu, .gov domains)

**Citations to categorize:**
${citationsList}

## TASK 3: Sentiment Analysis

### Brand Sentiment
Analyze the overall sentiment toward "${options.brandName}" in the answer.

### Competitor Sentiment
Analyze the sentiment toward each competitor separately.

**Competitors:** ${options.competitorNames.join(', ')}

**Requirements:**
1. Overall sentiment label: POSITIVE, NEGATIVE, or NEUTRAL (determined by score range below)
2. Sentiment score: Integer from 1 to 100, where:
   - 1-54: Negative sentiment (bad)
   - 55-65: Neutral sentiment
   - 66-100: Positive sentiment (good)
3. For competitors, analyze sentiment specifically about each competitor

## Answer Text to Analyze:
${truncatedAnswer}

---

## OUTPUT FORMAT

Respond with ONLY valid JSON in this exact structure:

{
  "products": {
    "brand": ["Product1", "Product2", ...],
    "competitors": {
      "Competitor1": ["Product1", "Product2", ...],
      "Competitor2": ["Product1", "Product2", ...]
    }
  },
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
  }
}`;
  }

  /**
   * Call OpenRouter API with best throughput model selection
   */
  private async callOpenRouterAPI(prompt: string): Promise<ConsolidatedAnalysisResult> {
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

    // Use streaming to get usage information
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini', // Good balance of cost and quality
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
        max_tokens: 4096,
        stream: true,
        stream_options: {
          include_usage: true
        },
        provider: {
          sort: 'throughput' // Use best throughput model
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    // Stream the response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let usage: any = null;

    if (!reader) {
      throw new Error('No response body reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            
            // Extract content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
            }

            // Extract usage information
            if (parsed.usage) {
              usage = parsed.usage;
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    }

    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('Empty response from OpenRouter API');
    }

    // Log usage if available
    if (usage) {
      console.log(`📊 Token usage: ${usage.prompt_tokens || 0} input, ${usage.completion_tokens || 0} output, ${usage.total_tokens || 0} total`);
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = fullResponse.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```\s*/g, '');
    }

    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('⚠️ No JSON found in response. Response preview:', fullResponse.substring(0, 500));
      throw new Error('No JSON found in OpenRouter response');
    }

    const result = JSON.parse(jsonMatch[0]) as ConsolidatedAnalysisResult;
    
    // Validate and normalize result
    return this.validateAndNormalize(result);
  }

  /**
   * Validate and normalize the result
   */
  private validateAndNormalize(result: ConsolidatedAnalysisResult): ConsolidatedAnalysisResult {
    // Ensure all required fields exist
    if (!result.products) {
      result.products = { brand: [], competitors: {} };
    }
    if (!result.products.brand) {
      result.products.brand = [];
    }
    if (!result.products.competitors) {
      result.products.competitors = {};
    }
    if (!result.citations) {
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
    if (!result.sentiment.competitors) {
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
    const brandNormalized = normalizeScore(result.sentiment.brand.score || 60);
    result.sentiment.brand.score = brandNormalized.score;
    result.sentiment.brand.label = brandNormalized.label;

    // Normalize competitor sentiments
    for (const compName in result.sentiment.competitors) {
      const compNormalized = normalizeScore(result.sentiment.competitors[compName].score || 60);
      result.sentiment.competitors[compName].score = compNormalized.score;
      result.sentiment.competitors[compName].label = compNormalized.label;
    }

    // Ensure arrays are arrays and strings are strings
    result.products.brand = Array.isArray(result.products.brand) 
      ? result.products.brand.filter(p => typeof p === 'string')
      : [];

    // Normalize competitor data
    for (const compName in result.products.competitors) {
      if (!Array.isArray(result.products.competitors[compName])) {
        result.products.competitors[compName] = [];
      }
      result.products.competitors[compName] = result.products.competitors[compName].filter(p => typeof p === 'string');
    }

    // Ensure competitor sentiment objects have required fields
    for (const compName in result.sentiment.competitors) {
      const compSentiment = result.sentiment.competitors[compName];
      if (!compSentiment.label) {
        compSentiment.label = 'NEUTRAL';
      }
      if (typeof compSentiment.score !== 'number') {
        compSentiment.score = 60;
      }
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

    if (citations.length === 0) {
      return cached;
    }

    // Extract unique domains from citations
    const domains = [...new Set(citations.map(url => this.extractDomain(url)))];

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

      if (data && data.length > 0) {
        for (const row of data) {
          cached.set(row.domain.toLowerCase(), {
            category: row.category,
            pageName: row.page_name,
          });
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
    if (citations.length === 0) {
      return;
    }

    try {
      const rowsToInsert = citations
        .map(url => {
          const categorization = categorizations[url];
          if (!categorization) {
            return null;
          }

          const domain = this.extractDomain(url);
          return {
            customer_id: customerId || null,
            brand_id: brandId || null,
            cited_url: url,
            domain: domain,
            category: categorization.category,
            page_name: categorization.pageName || null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (rowsToInsert.length === 0) {
        return;
      }

      // Use upsert to avoid duplicates (on conflict with domain, update)
      const { error } = await this.supabase
        .from('citation_categories')
        .upsert(rowsToInsert, {
          onConflict: 'domain',
          ignoreDuplicates: false, // Update if exists
        });

      if (error) {
        console.warn(`⚠️ Error storing citation categories in cache:`, error.message);
      } else {
        console.log(`✅ Stored ${rowsToInsert.length} citation categories in database cache`);
      }
    } catch (error) {
      console.warn(`⚠️ Error storing citation categories:`, error instanceof Error ? error.message : error);
    }
  }
}

// Export singleton instance
export const consolidatedAnalysisService = new ConsolidatedAnalysisService();
