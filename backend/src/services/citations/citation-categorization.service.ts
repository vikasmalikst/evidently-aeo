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
  source?: 'hardcoded' | 'ai'; // Where the categorization came from
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
   * Always uses LLM-based categorization (no hardcoded patterns)
   */
  async categorize(url: string, useAI: boolean = true): Promise<CategorizationResult> {
    const domain = this.extractDomain(url);

    // Always use AI for categorization
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
        throw new Error(`Failed to categorize citation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // If AI is disabled, throw error (we don't support non-AI categorization anymore)
    throw new Error('AI categorization is required. Set useAI=true or configure CEREBRAS_API_KEY or GOOGLE_GEMINI_API_KEY');
  }

  /**
   * Retry wrapper with exponential backoff for rate limiting
   */
  private async withRetryBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 30000
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message.toLowerCase();
        const isRateLimit = errorMsg.includes('429') || 
                           errorMsg.includes('too many requests') ||
                           errorMsg.includes('rate limit');
        const isEmptyResponse = errorMsg.includes('empty response');
        const isServerError = errorMsg.includes('500') || 
                             errorMsg.includes('502') || 
                             errorMsg.includes('503') ||
                             errorMsg.includes('504');

        // Only retry on rate limits, empty responses, or server errors
        if (!isRateLimit && !isEmptyResponse && !isServerError) {
          throw lastError;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxRetries - 1) {
          throw lastError;
        }

        // Calculate exponential backoff with jitter
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
    // HARDCODED CEREBRAS API KEY FOR CITATIONS SERVICE
    const cerebrasApiKey = 'csk-tw3tw2dfrxkk3cj9pp4djtryt49txk6mm4nhcnwtjvwtd54h';
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    const geminiApiKey = process.env['GOOGLE_GEMINI_API_KEY'];
    const geminiModel = process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-2.5-flash';

    // Try Cerebras first (with hardcoded key), then Gemini
    if (cerebrasApiKey) {
      try {
        return await this.withRetryBackoff(
          () => this.categorizeWithCerebras(url, domain, cerebrasApiKey, cerebrasModel),
          5, // max retries
          1000, // base delay 1s
          30000 // max delay 30s
        );
      } catch (error) {
        console.warn(`⚠️ Cerebras categorization failed, trying Gemini:`, error instanceof Error ? error.message : error);
        if (geminiApiKey) {
          return await this.withRetryBackoff(
            () => this.categorizeWithGemini(url, domain, geminiApiKey, geminiModel),
            5, // max retries
            2000, // base delay 2s (Gemini has stricter rate limits)
            60000 // max delay 60s
          );
        }
        throw error;
      }
    } else if (geminiApiKey) {
      return await this.withRetryBackoff(
        () => this.categorizeWithGemini(url, domain, geminiApiKey, geminiModel),
        5,
        2000,
        60000
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
    const prompt = `You are a citation categorization expert. Categorize the following website URL into one of these categories:

Categories:
1. **Editorial** - News websites, blogs, magazines, journalism sites (e.g., TechCrunch, Forbes, BBC, CNN, Medium)
2. **Corporate** - Company websites, business/product pages (e.g., company.com, product pages, official brand sites)
3. **Reference** - Knowledge bases, documentation, wikis (e.g., Wikipedia, Stack Overflow, GitHub, Quora)
4. **UGC** - User-generated content, review sites (e.g., Amazon reviews, Yelp, TripAdvisor)
5. **Social** - Social media platforms (e.g., Reddit, Twitter, Facebook, LinkedIn, Instagram, YouTube)
6. **Institutional** - Educational (.edu), government (.gov), research institutions, archives

URL to categorize: ${url}
Domain: ${domain}

Respond with ONLY the category name (one word: Editorial, Corporate, Reference, UGC, Social, or Institutional).
Do not include any explanation or additional text.`;

    const response = await fetch('https://api.cerebras.ai/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        max_tokens: 50,
        temperature: 0.3, // Low temperature for consistent categorization
        stop: ['\n', '---']
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
    const aiResponse = data.choices?.[0]?.text?.trim().toLowerCase();

    if (!aiResponse || aiResponse.length === 0) {
      throw new Error('Empty response from Cerebras API');
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
          temperature: 0.3,
          maxOutputTokens: 20
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

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();

    if (!aiResponse || aiResponse.length === 0) {
      throw new Error('Empty response from Gemini API');
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
    source?: 'hardcoded' | 'ai';
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

