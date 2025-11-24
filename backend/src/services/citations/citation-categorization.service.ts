/**
 * Citation Categorization Service
 * Maps domains to citation categories using LLM-based categorization
 * All categorizations are done via AI (Cerebras or Gemini)
 */

export type CitationCategory = 
  | 'Editorial' 
  | 'Corporate' 
  | 'Reference' 
  | 'UGC' 
  | 'Social' 
  | 'Institutional';

interface CategorizationResult {
  category: CitationCategory;
  confidence?: 'high' | 'medium' | 'low'; // Confidence level (high = hardcoded, medium/low = AI)
  source?: 'hardcoded' | 'ai' | 'simple_domain_matching' | 'fallback_default'; // Where the categorization came from
}

interface DomainCategoryMapping {
  domain: string | RegExp;
  category: CitationCategory;
  pageName?: string; // Optional predefined page name
}

// Domain patterns for categorization
const DOMAIN_CATEGORIES: DomainCategoryMapping[] = [
  // Social Platforms
  { domain: /reddit\.com/i, category: 'Social', pageName: 'Reddit' },
  { domain: /twitter\.com/i, category: 'Social', pageName: 'Twitter' },
  { domain: /x\.com/i, category: 'Social', pageName: 'X (Twitter)' },
  { domain: /facebook\.com/i, category: 'Social', pageName: 'Facebook' },
  { domain: /linkedin\.com/i, category: 'Social', pageName: 'LinkedIn' },
  { domain: /instagram\.com/i, category: 'Social', pageName: 'Instagram' },
  { domain: /tiktok\.com/i, category: 'Social', pageName: 'TikTok' },
  { domain: /youtube\.com/i, category: 'Social', pageName: 'YouTube' },
  { domain: /pinterest\.com/i, category: 'Social', pageName: 'Pinterest' },
  
  // Editorial/News
  { domain: /techcrunch\.com/i, category: 'Editorial', pageName: 'TechCrunch' },
  { domain: /forbes\.com/i, category: 'Editorial', pageName: 'Forbes' },
  { domain: /medium\.com/i, category: 'Editorial', pageName: 'Medium' },
  { domain: /wired\.com/i, category: 'Editorial', pageName: 'Wired' },
  { domain: /theverge\.com/i, category: 'Editorial', pageName: 'The Verge' },
  { domain: /bbc\.com/i, category: 'Editorial', pageName: 'BBC' },
  { domain: /cnn\.com/i, category: 'Editorial', pageName: 'CNN' },
  { domain: /nytimes\.com/i, category: 'Editorial', pageName: 'New York Times' },
  { domain: /wsj\.com/i, category: 'Editorial', pageName: 'Wall Street Journal' },
  { domain: /reuters\.com/i, category: 'Editorial', pageName: 'Reuters' },
  { domain: /bloomberg\.com/i, category: 'Editorial', pageName: 'Bloomberg' },
  { domain: /guardian\.com/i, category: 'Editorial', pageName: 'The Guardian' },
  { domain: /vogue\.co\.uk/i, category: 'Editorial', pageName: 'Vogue' },
  { domain: /teenvogue\.com/i, category: 'Editorial', pageName: 'Teen Vogue' },
  
  // Reference/Knowledge
  { domain: /wikipedia\.org/i, category: 'Reference', pageName: 'Wikipedia' },
  { domain: /wikidata\.org/i, category: 'Reference', pageName: 'Wikidata' },
  { domain: /stackoverflow\.com/i, category: 'Reference', pageName: 'Stack Overflow' },
  { domain: /github\.com/i, category: 'Reference', pageName: 'GitHub' },
  { domain: /quora\.com/i, category: 'Reference', pageName: 'Quora' },
  
  // Corporate/Business
  { domain: /g2\.com/i, category: 'Corporate', pageName: 'G2' },
  { domain: /capterra\.com/i, category: 'Corporate', pageName: 'Capterra' },
  { domain: /trustpilot\.com/i, category: 'Corporate', pageName: 'Trustpilot' },
  
  // Institutional/Educational
  { domain: /\.edu/i, category: 'Institutional', pageName: undefined }, // Generic .edu
  { domain: /\.gov/i, category: 'Institutional', pageName: undefined }, // Generic .gov
  { domain: /archive\./i, category: 'Institutional', pageName: 'Archive' },
  { domain: /scholar\.google\.com/i, category: 'Institutional', pageName: 'Google Scholar' },
  { domain: /pubmed\.ncbi\.nlm\.nih\.gov/i, category: 'Institutional', pageName: 'PubMed' },
  
  // UGC/Review Sites
  { domain: /amazon\.com/i, category: 'UGC', pageName: 'Amazon' },
  { domain: /yelp\.com/i, category: 'UGC', pageName: 'Yelp' },
  { domain: /tripadvisor\.com/i, category: 'UGC', pageName: 'TripAdvisor' },
];

export class CitationCategorizationService {
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
   */
  extractPageName(url: string, domain: string): string | null {
    // First check if we have a predefined name
    for (const mapping of DOMAIN_CATEGORIES) {
      if (mapping.pageName) {
        if (mapping.domain instanceof RegExp) {
          if (mapping.domain.test(url)) {
            return mapping.pageName;
          }
        } else if (domain.toLowerCase().includes(mapping.domain.toLowerCase())) {
          return mapping.pageName;
        }
      }
    }

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
   * Uses hardcoded patterns first, then falls back to AI if needed
   */
  async categorize(url: string, useAI: boolean = true): Promise<CategorizationResult> {
    const domain = this.extractDomain(url);

    // First, try hardcoded domain patterns (fast and reliable)
    for (const mapping of DOMAIN_CATEGORIES) {
      if (mapping.domain instanceof RegExp) {
        if (mapping.domain.test(url) || mapping.domain.test(domain)) {
          return {
            category: mapping.category,
            confidence: 'high',
            source: 'hardcoded'
          };
        }
      } else if (domain.toLowerCase().includes(mapping.domain.toLowerCase())) {
        return {
          category: mapping.category,
          confidence: 'high',
          source: 'hardcoded'
        };
      }
    }

    // If no hardcoded match, try simple domain-based heuristics
    const simpleCategory = this.categorizeByDomainHeuristics(domain);
    if (simpleCategory) {
      return {
        category: simpleCategory,
        confidence: 'medium',
        source: 'simple_domain_matching'
      };
    }

    // Finally, try AI categorization if enabled
    if (useAI) {
      try {
        const aiCategory = await this.categorizeWithAI(url, domain);
        return {
          category: aiCategory,
          confidence: 'high',
          source: 'ai'
        };
      } catch (error) {
        console.error(`❌ AI categorization failed for ${domain}:`, error instanceof Error ? error.message : error);
        // Fall back to default category instead of throwing
        console.warn(`⚠️ Using default 'Corporate' category for ${domain} due to AI failure`);
        return {
          category: 'Corporate', // Default fallback
          confidence: 'low',
          source: 'fallback_default'
        };
      }
    }

    // If AI is disabled and no pattern matched, use default
    return {
      category: 'Corporate',
      confidence: 'low',
      source: 'fallback_default'
    };
  }

  /**
   * Simple domain-based heuristics for categorization (no AI needed)
   */
  private categorizeByDomainHeuristics(domain: string): CitationCategory | null {
    const lowerDomain = domain.toLowerCase();
    
    // Check for common patterns
    if (lowerDomain.endsWith('.edu')) return 'Institutional';
    if (lowerDomain.endsWith('.gov') || lowerDomain.endsWith('.gov.uk') || lowerDomain.endsWith('.gov.au')) return 'Institutional';
    if (lowerDomain.includes('university') || lowerDomain.includes('edu')) return 'Institutional';
    if (lowerDomain.includes('news') || lowerDomain.includes('blog') || lowerDomain.includes('media')) return 'Editorial';
    if (lowerDomain.includes('wiki')) return 'Reference';
    if (lowerDomain.includes('review') || lowerDomain.includes('rating')) return 'UGC';
    
    return null; // No match found
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
   * Categorize an unknown domain using AI (Cerebras or Gemini)
   */
  private async categorizeWithAI(url: string, domain: string): Promise<CitationCategory> {
    // Citation Categorization uses GOOGLE_GEMINI_API_KEY_3 (fallback: GOOGLE_GEMINI_API_KEY)
    // This is part of scoring services, so uses numbered key
    const { getCitationCategorizationKey, getCerebrasKey, getGeminiModel, getCerebrasModel } = require('../../utils/api-key-resolver');
    const geminiApiKey = getCitationCategorizationKey(); // Primary for citations (KEY_3)
    const cerebrasApiKey = getCerebrasKey(); // Fallback
    const geminiModel = getGeminiModel('gemini-2.5-flash');
    const cerebrasModel = getCerebrasModel();
    

    // Try Gemini first (primary for citations), then Cerebras as fallback
    if (geminiApiKey) {
      try {
        return await this.withRetryBackoff(
          () => this.categorizeWithGemini(url, domain, geminiApiKey, geminiModel),
          2, // max retries
          1000, // base delay 1s
          10000 // max delay 10s
        );
      } catch (error) {
        console.warn(`⚠️ Gemini categorization failed for ${domain}, trying Cerebras fallback...`);
      }
    }
    
    if (cerebrasApiKey) {
      try {
        return await this.withRetryBackoff(
          () => this.categorizeWithCerebras(url, domain, cerebrasApiKey, cerebrasModel),
          2, // max retries (reduced from 5)
          1000, // base delay 1s
          10000 // max delay 10s (reduced from 30s)
        );
      } catch (error) {
        console.warn(`⚠️ Cerebras categorization failed, trying Gemini:`, error instanceof Error ? error.message : error);
        if (geminiApiKey) {
          return await this.withRetryBackoff(
            () => this.categorizeWithGemini(url, domain, geminiApiKey, geminiModel),
            2, // max retries (reduced from 5)
            2000, // base delay 2s (Gemini has stricter rate limits)
            20000 // max delay 20s (reduced from 60s)
          );
        }
        throw error;
      }
    } else if (geminiApiKey) {
      return await this.withRetryBackoff(
        () => this.categorizeWithGemini(url, domain, geminiApiKey, geminiModel),
        2, // max retries (reduced from 5)
        2000,
        20000 // max delay 20s (reduced from 60s)
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
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000) // 30 second timeout
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
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000) // 30 second timeout
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
   * Uses AI for categorization if domain is unknown
   */
  async processCitation(url: string, useAI: boolean = true): Promise<{
    url: string;
    domain: string;
    pageName: string | null;
    category: CitationCategory;
    confidence?: 'high' | 'medium' | 'low';
    source?: 'hardcoded' | 'ai' | 'simple_domain_matching' | 'fallback_default';
  }> {
    const domain = this.extractDomain(url);
    const pageName = this.extractPageName(url, domain);
    const categorizationResult = await this.categorize(url, useAI);

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
}

export const citationCategorizationService = new CitationCategorizationService();

