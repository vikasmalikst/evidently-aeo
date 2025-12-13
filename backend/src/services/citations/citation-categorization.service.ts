/**
 * Citation Categorization Service
 * Maps domains to citation categories using LLM-based categorization
 * All categorizations are done via AI (Cerebras as primary, Gemini as secondary)
 * Now includes database caching to avoid redundant API calls
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export type CitationCategory = 
  | 'Editorial' 
  | 'Corporate' 
  | 'Reference' 
  | 'UGC' 
  | 'Social' 
  | 'Institutional';

interface CategorizationResult {
  category: CitationCategory;
  confidence?: 'high' | 'medium' | 'low'; // Confidence level
  source?: 'database_cache' | 'ai'; // Where the categorization came from
}

// Note: Hardcoded domain patterns have been removed
// Categorization now uses only:
// 1. Database cache (citation_categories table)
// 2. AI categorization (Cerebras/Gemini)

export class CitationCategorizationService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    // Initialize Supabase client for database cache
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' },
      });
    } else {
      console.warn('⚠️ Supabase credentials not found - citation category caching will be disabled');
    }
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix
    } catch (error) {
      // If URL parsing fails, try to extract domain manually
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
      return match ? match[1].toLowerCase() : url;
    }
  }

  /**
   * Extract page/company name from URL
   * Attempts to extract a readable name from the domain
   * Can also check database cache for predefined page names
   */
  extractPageName(url: string, domain: string): string | null {
    // Try to get page name from database cache first
    // (This will be called after categorization, so cache should be populated)
    
    // Otherwise, generate from domain
    // Remove common TLDs and extract main part
    const domainWithoutTld = domain.replace(/\.(com|org|net|edu|gov|co|io|uk|us)$/i, '');
    
    // Split by dots and capitalize first letter of each word
    const parts = domainWithoutTld.split('.');
    const readableName = parts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

    return readableName || null;
  }

  /**
   * Categorize a citation based on its domain
   * Uses database cache first, then AI if needed (no hardcoded fallbacks)
   */
  async categorize(
    url: string, 
    useAI: boolean = true,
    customerId?: string,
    brandId?: string
  ): Promise<CategorizationResult> {
    const domain = this.extractDomain(url);

    // First, check database cache
    const cached = await this.getCachedCategory(domain, customerId, brandId);
    if (cached) {
      return {
        category: cached.category,
        confidence: 'high',
        source: 'database_cache'
      };
    }

    // If not in cache, use AI categorization
    if (useAI) {
      try {
        const aiCategory = await this.categorizeWithAI(url, domain);
        const pageName = this.extractPageName(url, domain);
        const result = {
          category: aiCategory,
          confidence: 'high' as const,
          source: 'ai' as const
        };
        // Store in database cache for future use
        await this.storeCategoryInCache(url, domain, aiCategory, pageName, customerId, brandId);
        return result;
      } catch (error) {
        console.error(`❌ AI categorization failed for ${domain}:`, error instanceof Error ? error.message : error);
        // Throw error instead of using fallback - let caller handle it
        throw new Error(`Failed to categorize citation: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // If AI is disabled and not in cache, throw error
    throw new Error(`Citation not in database cache and AI categorization is disabled for ${domain}`);
  }


  /**
   * Retry wrapper with exponential backoff for rate limiting
   * Early exit on persistent empty responses to avoid wasting time
   */
  private async withRetryBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 10000
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;
    let emptyResponseCount = 0;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message.toLowerCase();
        const isRateLimit = errorMsg.includes('429') || 
                           errorMsg.includes('too many requests') ||
                           errorMsg.includes('rate limit');
        const isEmptyResponse = errorMsg.includes('empty response') || 
                               errorMsg.includes('whitespace');
        const isServerError = errorMsg.includes('500') || 
                             errorMsg.includes('502') || 
                             errorMsg.includes('503') ||
                             errorMsg.includes('504');

        // Track empty responses - if we get 2 in a row, likely the API is broken
        if (isEmptyResponse) {
          emptyResponseCount++;
          if (emptyResponseCount >= 2) {
            console.warn(`⚠️ Multiple empty responses detected, skipping remaining retries`);
            throw lastError; // Early exit - API is clearly not working
          }
        } else {
          emptyResponseCount = 0; // Reset counter on non-empty errors
        }

        // Only retry on rate limits, empty responses, or server errors
        if (!isRateLimit && !isEmptyResponse && !isServerError) {
          throw lastError;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxRetries - 1) {
          throw lastError;
        }

        // Calculate exponential backoff with jitter (reduced delays)
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4),
          maxDelayMs
        );

        console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Categorize an unknown domain using AI (Cerebras as primary, Gemini as secondary)
   */
  private async categorizeWithAI(url: string, domain: string): Promise<CitationCategory> {
    // Citation Categorization uses Cerebras as primary, Gemini as secondary
    const { getCitationCategorizationKey, getCerebrasKey, getGeminiModel, getCerebrasModel } = require('../../utils/api-key-resolver');
    const cerebrasApiKey = getCerebrasKey(); // Primary for citations
    const geminiApiKey = getCitationCategorizationKey(); // Secondary fallback (KEY_3 or generic)
    const cerebrasModel = getCerebrasModel();
    const geminiModel = getGeminiModel('gemini-2.5-flash');
    

    // Try Cerebras first (primary for citations), then Gemini as fallback
    if (cerebrasApiKey) {
      try {
        return await this.withRetryBackoff(
          () => this.categorizeWithCerebras(url, domain, cerebrasApiKey, cerebrasModel),
          2, // max retries
          1000, // base delay 1s
          10000 // max delay 10s
        );
      } catch (error) {
        console.warn(`⚠️ Cerebras categorization failed for ${domain}, trying Gemini fallback...`);
      }
    }
    
    if (geminiApiKey) {
      try {
        return await this.withRetryBackoff(
          () => this.categorizeWithGemini(url, domain, geminiApiKey, geminiModel),
          2, // max retries
          2000, // base delay 2s (Gemini has stricter rate limits)
          20000 // max delay 20s
        );
      } catch (error) {
        console.warn(`⚠️ Gemini categorization failed:`, error instanceof Error ? error.message : error);
        if (cerebrasApiKey) {
          // Try Cerebras one more time if Gemini fails
          return await this.withRetryBackoff(
            () => this.categorizeWithCerebras(url, domain, cerebrasApiKey, cerebrasModel),
            2, // max retries
            1000, // base delay 1s
            10000 // max delay 10s
          );
        }
        throw error;
      }
    } else if (cerebrasApiKey) {
      // If no Gemini key but Cerebras is available, try Cerebras again
      return await this.withRetryBackoff(
        () => this.categorizeWithCerebras(url, domain, cerebrasApiKey, cerebrasModel),
        2, // max retries
        1000,
        10000 // max delay 10s
      );
    } else {
      throw new Error('No AI API key configured (CEREBRAS_API_KEY or GOOGLE_GEMINI_API_KEY)');
    }
  }

  /**
   * Categorize using Cerebras AI
   */
  private async categorizeWithCerebras(
    url: string,
    domain: string,
    apiKey: string,
    model: string
  ): Promise<CitationCategory> {
    // Simplified prompt - direct instruction format that works better with Qwen models
    const prompt = `Categorize the website "${domain}" into one of these categories: Editorial, Corporate, Reference, UGC, Social, or Institutional.

Examples:
- uber.com → Corporate
- reddit.com → Social
- wikipedia.org → Reference
- techcrunch.com → Editorial
- yelp.com → UGC
- harvard.edu → Institutional

Respond with only the category name:`;

    const response = await fetch('https://api.cerebras.ai/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        max_tokens: 15, // Small - we only need one word
        temperature: 0.0, // Zero temperature for most deterministic output
        stop: ['\n', '.'] // Minimal stop tokens - just newline and period
      }),
      // Add timeout to prevent hanging (using AbortController for compatibility)
      signal: (() => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 30000); // 30 second timeout
        return controller.signal;
      })()
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 429) {
        throw new Error(`Cerebras API error: 429 Too Many Requests`);
      }
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    
    // Try multiple response formats
    let aiResponse: string | undefined;
    
    // Format 1: choices[0].text
    if (data.choices?.[0]?.text) {
      aiResponse = data.choices[0].text.trim();
    }
    // Format 2: choices[0].message.content
    else if (data.choices?.[0]?.message?.content) {
      aiResponse = data.choices[0].message.content.trim();
    }
    // Format 3: text field directly
    else if (data.text) {
      aiResponse = data.text.trim();
    }
    // Format 4: Check for error in response
    else if (data.error) {
      throw new Error(`Cerebras API error: ${data.error.message || 'Unknown error'}`);
    }

    // Check if response is just whitespace or empty
    if (!aiResponse || aiResponse.length === 0 || /^\s+$/.test(aiResponse)) {
      // Log the full response for debugging
      console.error('Cerebras API returned empty/whitespace response. Full response:', JSON.stringify(data, null, 2));
      console.error('Prompt used:', prompt.substring(0, 200) + '...');
      throw new Error('Empty response from Cerebras API - only whitespace or no text found');
    }

    // Clean up response - remove any leading/trailing whitespace and convert to lowercase
    aiResponse = aiResponse.trim().toLowerCase();
    
    // If response is still empty after trimming, throw error
    if (!aiResponse || aiResponse.length === 0) {
      throw new Error('Empty response from Cerebras API - text was only whitespace');
    }

    // Map AI response to category
    const categoryMap: Record<string, CitationCategory> = {
      'editorial': 'Editorial',
      'corporate': 'Corporate',
      'reference': 'Reference',
      'ugc': 'UGC',
      'social': 'Social',
      'institutional': 'Institutional'
    };

    // Check for exact match or partial match
    for (const [key, category] of Object.entries(categoryMap)) {
      if (aiResponse.includes(key)) {
        return category;
      }
    }

    // If no match found, throw error (we don't support "Other" anymore)
    throw new Error(`Could not categorize citation. AI response: "${aiResponse}" does not match any known category.`);
  }

  /**
   * Categorize using Google Gemini AI
   */
  private async categorizeWithGemini(
    url: string,
    domain: string,
    apiKey: string,
    model: string
  ): Promise<CitationCategory> {
    const prompt = `Categorize this website URL into one category: Editorial, Corporate, Reference, UGC, Social, or Institutional.

URL: ${url}
Domain: ${domain}

Respond with ONLY the category name.`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.0, // Zero temperature for most deterministic output
          maxOutputTokens: 150 // Significantly increased to account for "thoughts" tokens (Gemini uses ~49 tokens for reasoning)
        }
      }),
      // Add timeout to prevent hanging (using AbortController for compatibility)
      signal: (() => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 30000); // 30 second timeout
        return controller.signal;
      })()
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 429) {
        throw new Error(`Gemini API error: 429 Too Many Requests`);
      }
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    
    // Check for API errors in response
    if (data.error) {
      if (data.error.code === 429) {
        throw new Error(`Gemini API error: 429 Too Many Requests`);
      }
      throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`);
    }

    // Try multiple response formats
    let aiResponse: string | undefined;
    
    // Format 1: candidates[0].content.parts[0].text (standard)
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      aiResponse = data.candidates[0].content.parts[0].text.trim().toLowerCase();
    }
    // Format 2: candidates[0].text (alternative)
    else if (data.candidates?.[0]?.text) {
      aiResponse = data.candidates[0].text.trim().toLowerCase();
    }
    // Format 3: text field directly
    else if (data.text) {
      aiResponse = data.text.trim().toLowerCase();
    }
    // Format 4: Check if candidates array is empty or blocked
    else if (data.candidates && data.candidates.length === 0) {
      throw new Error('Gemini API returned empty candidates array - content may be blocked');
    }
    else if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error('Gemini API blocked content due to safety filters');
    }

    if (!aiResponse || aiResponse.length === 0) {
      console.error('Gemini API response structure:', JSON.stringify(data, null, 2));
      throw new Error('Empty response from Gemini API - no text found in response');
    }

    // Map AI response to category
    const categoryMap: Record<string, CitationCategory> = {
      'editorial': 'Editorial',
      'corporate': 'Corporate',
      'reference': 'Reference',
      'ugc': 'UGC',
      'social': 'Social',
      'institutional': 'Institutional'
    };

    for (const [key, category] of Object.entries(categoryMap)) {
      if (aiResponse.includes(key)) {
        return category;
      }
    }

    // If no match found, throw error (we don't support "Other" anymore)
    throw new Error(`Could not categorize citation. AI response: "${aiResponse}" does not match any known category.`);
  }

  /**
   * Process a citation URL and return all extracted information
   * Uses database cache first, then AI for categorization if domain is unknown
   */
  async processCitation(
    url: string, 
    useAI: boolean = true,
    customerId?: string,
    brandId?: string
  ): Promise<{
    url: string;
    domain: string;
    pageName: string | null;
    category: CitationCategory;
    confidence?: 'high' | 'medium' | 'low';
    source?: 'database_cache' | 'ai';
  }> {
    const domain = this.extractDomain(url);
    const categorizationResult = await this.categorize(url, useAI, customerId, brandId);
    
    // Get page name (from cache if available, otherwise extract)
    let pageName = this.extractPageName(url, domain);
    if (categorizationResult.source === 'database_cache') {
      // Try to get page name from cache
      const cached = await this.getCachedCategory(domain, customerId, brandId);
      if (cached?.pageName) {
        pageName = cached.pageName;
      }
    }

    return {
      url,
      domain,
      pageName,
      category: categorizationResult.category,
      confidence: categorizationResult.confidence,
      source: categorizationResult.source,
    };
  }

  /**
   * Synchronous version (deprecated - use async version with AI)
   * This method is kept for backward compatibility but will throw an error
   */
  processCitationSync(url: string): {
    url: string;
    domain: string;
    pageName: string | null;
    category: CitationCategory;
  } {
    throw new Error('Synchronous citation categorization is no longer supported. Use processCitation() with AI instead.');
  }

  /**
   * Get cached category from database
   */
  private async getCachedCategory(
    domain: string,
    customerId?: string,
    brandId?: string
  ): Promise<{ category: CitationCategory; pageName: string | null } | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      let query = this.supabase
        .from('citation_categories')
        .select('category, page_name')
        .eq('domain', domain.toLowerCase())
        .limit(1);

      // Optionally filter by customer_id and brand_id if provided
      // Note: We prioritize domain match first (most common case)
      const { data, error } = await query.maybeSingle();

      if (error) {
        // Table might not exist yet, ignore error
        if (error.code !== 'PGRST116') {
          console.warn(`⚠️ Error fetching cached category for ${domain}:`, error.message);
        }
        return null;
      }

      if (data) {
        return {
          category: data.category as CitationCategory,
          pageName: data.page_name,
        };
      }
    } catch (error) {
      // Table might not exist yet, ignore error
      console.warn(`⚠️ Error checking citation category cache:`, error instanceof Error ? error.message : error);
    }

    return null;
  }

  /**
   * Store category in database cache
   */
  private async storeCategoryInCache(
    url: string,
    domain: string,
    category: CitationCategory,
    pageName: string | null,
    customerId?: string,
    brandId?: string
  ): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('citation_categories')
        .upsert(
          {
            customer_id: customerId || null,
            brand_id: brandId || null,
            cited_url: url,
            domain: domain.toLowerCase(),
            category: category,
            page_name: pageName || null,
          },
          {
            onConflict: 'domain',
            ignoreDuplicates: false, // Update if exists
          }
        );

      if (error) {
        // Table might not exist yet, ignore error
        if (error.code !== 'PGRST116') {
          console.warn(`⚠️ Error storing citation category in cache:`, error.message);
        }
      }
    } catch (error) {
      // Table might not exist yet, ignore error
      console.warn(`⚠️ Error storing citation category:`, error instanceof Error ? error.message : error);
    }
  }
}

export const citationCategorizationService = new CitationCategorizationService();

