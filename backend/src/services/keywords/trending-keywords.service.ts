/**
 * Trending Keywords Service (Gemini-only)
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
loadEnvironment();

// Initialize Supabase client
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TrendingKeyword {
  keyword: string;
  category: string;
  source: 'gemini';
  trend_score: number;
  search_volume?: number;
  competition_level?: 'low' | 'medium' | 'high';
  related_queries?: string[];
  last_updated: string;
}

interface TrendingPrompt {
  prompt: string;
  category: string;
  source: 'gemini';
  last_updated: string;
}

interface TrendingKeywordsResponse {
  success: boolean;
  data: {
    keywords: TrendingKeyword[];
    prompts?: TrendingPrompt[];
    total_count: number;
    sources_used: string[];
    generated_at: string;
  };
  error?: string;
}

interface TrendingKeywordsRequest {
  brand: string;
  industry?: string;
  competitors?: string[];
  locale?: string;
  country?: string;
  max_keywords?: number;
}

export class TrendingKeywordsService {
  private geminiApiKey: string;
  private geminiModel: string;

  constructor() {
    this.geminiApiKey = getEnvVar('GOOGLE_GEMINI_API_KEY', '');
    // Allow overriding the model via env; default to a supported v1beta model
    this.geminiModel = getEnvVar('GOOGLE_GEMINI_MODEL', 'gemini-1.5-flash-002');
    console.log('🔧 Trending Keywords Service initialized with:');
    console.log(`  - Gemini: ${this.geminiApiKey ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  - Gemini Model: ${this.geminiModel}`);
  }

  async getTrendingKeywords(request: TrendingKeywordsRequest, brandId?: string, customerId?: string): Promise<TrendingKeywordsResponse> {
    const { brand, industry = '', competitors = [], locale = 'en-US', country = 'US', max_keywords = 50 } = request;

    if (!this.geminiApiKey) {
      return this.failure('Gemini API key not configured');
    }

    const { keywords, prompts } = await this.fetchFromGemini(brand, industry, competitors, locale, country);
    if (!keywords || !keywords.length) {
      return this.failure('Gemini API failed to return keywords');
    }

    const sorted = this.deduplicateKeywords(keywords)
      .sort((a, b) => b.trend_score - a.trend_score)
      .slice(0, max_keywords);

    // Store in database if brandId and customerId are provided
    if (brandId && customerId) {
      await this.storeTrendingData(sorted, prompts || [], brandId, customerId);
    }

    return {
      success: true,
      data: {
        keywords: sorted,
        prompts: prompts || [],
        total_count: sorted.length,
        sources_used: ['gemini'],
        generated_at: new Date().toISOString()
      }
    };
  }

  /** Oxylabs integration removed */
  private async fetchFromOxylabs(
    brand: string,
    industry: string,
    competitors: string[],
    locale: string,
    country: string
  ): Promise<TrendingKeyword[]> {
    return this.getEnhancedFallbackKeywords(brand, industry, competitors);
  }

  // Oxylabs request helper removed

  /**
   * Generate trending search queries for Oxylabs Google AI Mode (optimized for speed)
   */
  private generateTrendingSearchQueries(
    brand: string, 
    industry: string, 
    competitors: string[]
  ): Array<{query: string, category: string}> {
    return [
      {
        query: `${brand} ${industry} trending keywords 2024`,
        category: 'Trending'
      },
      {
        query: `${brand} vs ${competitors.slice(0, 1).join('')} comparison`,
        category: 'Comparison'
      }
    ];
  }

  /**
   * Extract keywords from Oxylabs ChatGPT response
   */
  private extractKeywordsFromOxylabsResponse(
    data: any, 
    category: string, 
    brand: string
  ): TrendingKeyword[] {
    const keywords: TrendingKeyword[] = [];
    
    try {
      // Parse the ChatGPT response data
      let content = data.content || data.text || data.response || '';
      
      // Ensure content is a string
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }
      
      console.log('📝 Extracting keywords from content:', content.substring(0, 200) + '...');
      
      // Extract keywords using multiple strategies
      const extractedKeywords = this.extractKeywordsFromText(content, brand, category);
      keywords.push(...extractedKeywords);
      
    } catch (error) {
      console.warn('⚠️ Failed to extract keywords from Oxylabs response:', error);
    }
    
    return keywords;
  }

  /**
   * Extract keywords from text content
   */
  private extractKeywordsFromText(content: string, brand: string, category: string): TrendingKeyword[] {
    const keywords: TrendingKeyword[] = [];
    
    // Clean the content - remove URLs, JSON artifacts, and technical metadata
    let cleanContent = content
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/[{}[\]\\"]/g, ' ') // Remove JSON artifacts
      .replace(/\\n|\\t|\\r/g, ' ') // Remove escape characters
      .replace(/\b(update_time|is_desktop_app|desktop_web|llm_model|raw_response)\b[^a-zA-Z]*/g, '') // Remove technical fields
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Strategy 1: Look for actual trending search terms (not questions or URLs)
    const searchTerms = this.extractSearchTerms(cleanContent, brand);
    searchTerms.forEach(term => {
      if (this.isValidKeyword(term, brand)) {
        keywords.push({
          keyword: term,
          category: category,
          source: 'gemini',
          trend_score: 0.9,
          search_volume: 50000,
          competition_level: 'high',
          related_queries: [],
          last_updated: new Date().toISOString()
        });
      }
    });
    
    // Strategy 2: Extract brand-specific trending topics
    const brandTopics = this.extractBrandTopics(cleanContent, brand);
    brandTopics.forEach(topic => {
      keywords.push({
        keyword: `${brand} ${topic}`,
        category: category,
        source: 'gemini',
        trend_score: 0.8,
        search_volume: 30000,
        competition_level: 'medium',
        related_queries: [],
        last_updated: new Date().toISOString()
      });
    });
    
    return keywords.slice(0, 5); // Limit to top 5 keywords per category
  }

  /**
   * Extract keywords from Oxylabs Google AI Mode response
   */
  private extractKeywordsFromGoogleResponse(
    data: any, 
    category: string, 
    brand: string
  ): TrendingKeyword[] {
    const keywords: TrendingKeyword[] = [];
    
    try {
      // Parse the Google AI Mode response data
      const content = data.content || data.text || data.response || '';
      console.log('📝 Extracting keywords from Google AI Mode content:', content.substring(0, 200) + '...');
      
      // Extract keywords from Google search results
      const extractedKeywords = this.extractKeywordsFromGoogleContent(content, brand, category);
      keywords.push(...extractedKeywords);
      
    } catch (error) {
      console.warn('⚠️ Failed to extract keywords from Google AI Mode response:', error);
    }
    
    return keywords;
  }

  /**
   * Extract keywords from Google search content
   */
  private extractKeywordsFromGoogleContent(content: string, brand: string, category: string): TrendingKeyword[] {
    const keywords: TrendingKeyword[] = [];
    
    // Clean the content - remove HTML tags and normalize
    let cleanContent = content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Strategy 1: Extract from search result titles and snippets
    const titleMatches = cleanContent.match(/(?:title|headline):\s*([^.!?]+)/gi);
    if (titleMatches) {
      titleMatches.forEach(match => {
        const title = match.replace(/^(?:title|headline):\s*/i, '').trim();
        if (this.isValidKeyword(title, brand)) {
          keywords.push({
            keyword: title,
            category: category,
            source: 'gemini',
            trend_score: 0.9,
            search_volume: 50000,
            competition_level: 'high',
            related_queries: [],
            last_updated: new Date().toISOString()
          });
        }
      });
    }
    
    // Strategy 2: Extract from "People also ask" sections
    const paaMatches = cleanContent.match(/(?:people also ask|related questions):\s*([^.!?]+)/gi);
    if (paaMatches) {
      paaMatches.forEach(match => {
        const question = match.replace(/^(?:people also ask|related questions):\s*/i, '').trim();
        if (this.isValidKeyword(question, brand)) {
          keywords.push({
            keyword: question,
            category: category,
            source: 'gemini',
            trend_score: 0.8,
            search_volume: 40000,
            competition_level: 'medium',
            related_queries: [],
            last_updated: new Date().toISOString()
          });
        }
      });
    }
    
    // Strategy 3: Extract from search suggestions
    const suggestionMatches = cleanContent.match(/(?:suggestions|related searches):\s*([^.!?]+)/gi);
    if (suggestionMatches) {
      suggestionMatches.forEach(match => {
        const suggestion = match.replace(/^(?:suggestions|related searches):\s*/i, '').trim();
        if (this.isValidKeyword(suggestion, brand)) {
          keywords.push({
            keyword: suggestion,
            category: category,
            source: 'gemini',
            trend_score: 0.7,
            search_volume: 30000,
            competition_level: 'medium',
            related_queries: [],
            last_updated: new Date().toISOString()
          });
        }
      });
    }
    
    // Strategy 4: Extract brand-specific terms from content
    const brandTerms = this.extractBrandTermsFromContent(cleanContent, brand);
    brandTerms.forEach(term => {
      keywords.push({
        keyword: term,
        category: category,
        source: 'gemini',
        trend_score: 0.6,
        search_volume: 20000,
        competition_level: 'low',
        related_queries: [],
        last_updated: new Date().toISOString()
      });
    });
    
    return keywords.slice(0, 5); // Limit to 5 keywords per category
  }

  /**
   * Extract brand-specific terms from Google content
   */
  private extractBrandTermsFromContent(content: string, brand: string): string[] {
    const terms: string[] = [];
    
    // Look for brand-related phrases
    const brandPattern = new RegExp(`\\b${brand}\\s+([a-zA-Z]+(?:\\s+[a-zA-Z]+)*)`, 'gi');
    const matches = content.match(brandPattern);
    
    if (matches) {
      matches.forEach(match => {
        const term = match.replace(new RegExp(`^${brand}\\s+`, 'i'), '').trim();
        if (term.length > 3 && term.length < 30 && this.isValidKeyword(term, brand)) {
          terms.push(`${brand} ${term}`);
        }
      });
    }
    
    return terms;
  }

  /**
   * Extract actual search terms from content
   */
  private extractSearchTerms(content: string, brand: string): string[] {
    const terms: string[] = [];
    
    // Look for common search patterns
    const patterns = [
      /(?:searching for|searches for|people search for|trending searches?)\s+([^.!?]+)/gi,
      /(?:popular|trending|hot)\s+([^.!?]+)/gi,
      /(?:keywords?|terms?)\s*:?\s*([^.!?\n]+)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const term = match.replace(/^(?:searching for|searches for|people search for|trending searches?|popular|trending|hot|keywords?|terms?)\s*:?\s*/i, '').trim();
          if (term.length > 3 && term.length < 50) {
            terms.push(term);
          }
        });
      }
    });
    
    return terms;
  }

  /**
   * Extract brand-specific topics
   */
  private extractBrandTopics(content: string, brand: string): string[] {
    const topics: string[] = [];
    
    // Look for industry-specific terms
    const industryTerms = [
      'launches', 'missions', 'rockets', 'satellites', 'spacecraft', 'technology',
      'innovation', 'exploration', 'mars', 'moon', 'starlink', 'starship',
      'falcon', 'reusable', 'landing', 'orbital', 'deep space'
    ];
    
    industryTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        topics.push(term);
      }
    });
    
    return topics;
  }

  private failure(message: string): TrendingKeywordsResponse {
    return {
      success: false,
      data: {
        keywords: [],
        total_count: 0,
        sources_used: [],
        generated_at: new Date().toISOString()
      },
      error: message
    };
  }

  /**
   * Check if a keyword is valid (not a URL, question, or technical term)
   * Keywords must be 1-4 words, no question words, no question marks, no full sentences
   */
  private isValidKeyword(keyword: string, brand: string): boolean {
    if (!keyword || typeof keyword !== 'string') return false;
    
    const keywordTrimmed = keyword.trim();
    if (keywordTrimmed.length === 0) return false;
    
    // Reject URLs
    if (keywordTrimmed.includes('http') || keywordTrimmed.includes('www.')) return false;
    
    // Reject question marks
    if (keywordTrimmed.includes('?')) return false;
    
    // Check word count (must be 1-4 words)
    const wordCount = keywordTrimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 4) {
      console.log(`🚫 Rejected keyword (too many words: ${wordCount}): "${keywordTrimmed}"`);
      return false;
    }
    
    // Reject question words at the start
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'tell', 'describe', 'compare'];
    const keywordLower = keywordTrimmed.toLowerCase();
    if (questionWords.some(qw => keywordLower.startsWith(qw + ' ') || keywordLower === qw)) {
      console.log(`🚫 Rejected keyword (starts with question word): "${keywordTrimmed}"`);
      return false;
    }
    
    // Reject full sentences (check for verbs that indicate sentences)
    // Common sentence patterns: "are", "is", "do", "does", "can", "should", "will" followed by other words
    const sentencePatterns = [
      /\b(are|is|was|were|do|does|did|can|could|should|will|would|may|might)\s+\w+\s+\w+/i,
      /\b(explain|tell|describe|compare|show|help|find|get|buy|purchase)\s+\w+\s+\w+/i
    ];
    if (sentencePatterns.some(pattern => pattern.test(keywordTrimmed))) {
      console.log(`🚫 Rejected keyword (sentence pattern): "${keywordTrimmed}"`);
      return false;
    }
    
    // Reject technical terms
    if (keywordTrimmed.includes('\\') || keywordTrimmed.includes('{') || keywordTrimmed.includes('}')) return false;
    
    // Must be relevant to brand or industry (relaxed check - allow general terms too)
    return true; // Allow all keywords that pass the above checks
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'can', 'must', 'shall', 'a', 'an', 'some', 'any', 'all', 'both', 'each',
      'every', 'other', 'another', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'now', 'here', 'there',
      'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Check if a keyword is relevant to the brand
   */
  private isRelevantKeyword(keyword: string, brand: string): boolean {
    const relevantTerms = [
      'review', 'price', 'cost', 'feature', 'benefit', 'advantage', 'disadvantage',
      'comparison', 'vs', 'alternative', 'competitor', 'best', 'top', 'quality',
      'service', 'support', 'help', 'guide', 'tutorial', 'how', 'what', 'why',
      'when', 'where', 'news', 'update', 'latest', 'new', 'trending', 'popular'
    ];
    
    return relevantTerms.some(term => keyword.includes(term));
  }

  /**
   * Get fallback keywords when Oxylabs is unavailable
   */
  private getFallbackOxylabsKeywords(
    brand: string,
    industry: string,
    competitors: string[]
  ): TrendingKeyword[] {
    return [
      {
        keyword: `${brand} reviews`,
        category: 'Reviews',
        source: 'gemini',
        trend_score: 0.9,
        search_volume: 50000,
        competition_level: 'high',
        related_queries: [`${brand} customer reviews`, `${brand} user feedback`],
        last_updated: new Date().toISOString()
      },
      {
        keyword: `${brand} vs ${competitors[0] || 'competitor'}`,
        category: 'Comparison',
        source: 'gemini',
        trend_score: 0.8,
        search_volume: 30000,
        competition_level: 'medium',
        related_queries: [`${brand} comparison`, `${brand} alternatives`],
        last_updated: new Date().toISOString()
      },
      {
        keyword: `${brand} pricing`,
        category: 'Pricing',
        source: 'gemini',
        trend_score: 0.7,
        search_volume: 25000,
        competition_level: 'high',
        related_queries: [`${brand} cost`, `${brand} price`],
        last_updated: new Date().toISOString()
      }
    ];
  }

  /**
   * Get enhanced fallback keywords when Oxylabs fails
   */
  private getEnhancedFallbackKeywords(
    brand: string, 
    industry: string, 
    competitors: string[]
  ): TrendingKeyword[] {
    const keywords: TrendingKeyword[] = [];
    
    // Industry-specific trending terms
    const industryTrends = this.getIndustryTrendingTerms(industry);
    industryTrends.forEach(term => {
      keywords.push({
        keyword: `${brand} ${term}`,
        category: 'Trending',
        source: 'gemini',
        trend_score: 0.9,
        search_volume: 45000,
        competition_level: 'high',
        related_queries: [`${brand} ${term} 2024`, `${brand} ${term} latest`],
        last_updated: new Date().toISOString()
      });
    });
    
    // Competitor comparison terms
    if (competitors.length > 0) {
      const topCompetitor = competitors[0];
      keywords.push({
        keyword: `${brand} vs ${topCompetitor}`,
        category: 'Comparison',
        source: 'gemini',
        trend_score: 0.8,
        search_volume: 35000,
        competition_level: 'high',
        related_queries: [`${brand} vs ${topCompetitor} comparison`, `${brand} vs ${topCompetitor} 2024`],
        last_updated: new Date().toISOString()
      });
    }
    
    // Brand-specific features
    const brandFeatures = this.getBrandFeatures(brand, industry);
    brandFeatures.forEach(feature => {
      keywords.push({
        keyword: `${brand} ${feature}`,
        category: 'Features',
        source: 'gemini',
        trend_score: 0.7,
        search_volume: 25000,
        competition_level: 'medium',
        related_queries: [`${brand} ${feature} benefits`, `${brand} ${feature} pricing`],
        last_updated: new Date().toISOString()
      });
    });
    
    return keywords.slice(0, 8); // Limit to 8 keywords
  }

  /**
   * Get industry-specific trending terms
   */
  private getIndustryTrendingTerms(industry: string): string[] {
    const industryMap: Record<string, string[]> = {
      'Aerospace': ['launches', 'missions', 'technology', 'innovation', 'space exploration', 'satellites'],
      'Technology': ['AI', 'cloud', 'security', 'automation', 'digital transformation', 'innovation'],
      'Healthcare': ['telemedicine', 'AI diagnostics', 'patient care', 'medical devices', 'digital health'],
      'Finance': ['fintech', 'cryptocurrency', 'digital banking', 'blockchain', 'payments', 'investing'],
      'E-commerce': ['online shopping', 'mobile commerce', 'personalization', 'logistics', 'customer experience'],
      'Automotive': ['electric vehicles', 'autonomous driving', 'sustainability', 'connected cars', 'mobility']
    };
    
    return industryMap[industry] || ['innovation', 'technology', 'solutions', 'services', 'products'];
  }

  /**
   * Fetch trending keywords from Google Gemini
   */
  private async fetchFromGemini(
    brand: string,
    industry: string,
    competitors: string[],
    locale: string,
    country: string
  ): Promise<{ keywords: TrendingKeyword[]; prompts: TrendingPrompt[] }> {
    try {
      if (!this.geminiApiKey) {
        return { keywords: [], prompts: [] };
      }

      console.log('🔍 Fetching from Google Gemini...');

      const prompt = [
        `You are an SEO trends expert. For brand "${brand}" in industry "${industry}" (country ${country}), return JSON with two arrays:`,
        `{"keywords": [{"keyword": string, "category": string}], "prompts": [{"prompt": string, "category": string}]}.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 KEYWORDS REQUIREMENTS (CRITICAL - READ CAREFULLY)`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Keywords are SHORT SEARCH TERMS that users type into search engines, NOT questions or full sentences.`,
        ``,
        `✅ CORRECT KEYWORD FORMAT:`,
        `- 1-4 words maximum`,
        `- No question words (what, how, why, when, where, who, which, explain, tell)`,
        `- No question marks`,
        `- No full sentences or verb phrases`,
        `- Examples: "running shoes", "product reviews", "pricing plans", "customer support", "brand comparison"`,
        ``,
        `❌ FORBIDDEN KEYWORD FORMATS:`,
        `- Questions: "What are running shoes?", "How to buy products?"`,
        `- Full sentences: "Explain the benefits of Nike React foam"`,
        `- Long phrases: "What are the latest Nike sneaker releases everyone is talking about?"`,
        `- Task prompts: "Tell me about Nike's recent environmental initiatives"`,
        ``,
        `Generate 8-12 keywords with categories from: Trending, Comparison, Features, Pricing, Support, Alternatives, News.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📋 PROMPTS REQUIREMENTS`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Prompts are trending user QUESTIONS or task prompts about the brand (8-12 items) with the same categories.`,
        `These are full questions like "What are the latest Nike sneaker releases?" or "How do Nike running shoes compare to Adidas?"`,
        ``,
        competitors.length ? `Consider competitors: ${competitors.slice(0, 3).join(', ')}.` : '',
        ``,
        `Respond ONLY with strict JSON. No prose.`
      ].filter(Boolean).join('\n');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Gemini error:', errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let parsed: { keywords?: Array<{ keyword: string; category?: string }>; prompts?: Array<{ prompt: string; category?: string }> } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      const now = new Date().toISOString();
      const keywords: TrendingKeyword[] = (parsed.keywords || [])
        .filter((k: any) => {
          // Basic type and length check
          if (typeof k?.keyword !== 'string' || k.keyword.length < 3) {
            return false;
          }
          // Apply strict keyword validation
          return this.isValidKeyword(k.keyword.trim(), brand);
        })
        .slice(0, 12)
        .map((k: any) => ({
          keyword: k.keyword.trim(),
          category: (k.category || 'Trending').toString(),
          source: 'gemini',
          trend_score: 0.9,
          search_volume: 40000,
          competition_level: 'high',
          related_queries: [],
          last_updated: now
        }));

      const prompts: TrendingPrompt[] = (parsed.prompts || [])
        .filter((p: any) => typeof p?.prompt === 'string' && p.prompt.length >= 5)
        .slice(0, 12)
        .map((p: any) => ({
          prompt: p.prompt.trim(),
          category: (p.category || 'Trending').toString(),
          source: 'gemini',
          last_updated: now
        }));

      return { keywords, prompts };
    } catch (error) {
      console.error('❌ Gemini fetch error:', error);
      throw error; // Re-throw the error instead of returning empty arrays
    }
  }

  /**
   * Check if a topic is prompt-like (full question or sentence)
   */
  private isPromptLike(topic: string): boolean {
    if (!topic || typeof topic !== 'string') return false;
    
    const topicTrimmed = topic.trim();
    
    // Check for question mark
    if (topicTrimmed.includes('?')) return true;
    
    // Check word count (prompts are usually >4 words)
    const wordCount = topicTrimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 4) return true;
    
    // Check for question words at start
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'tell', 'describe', 'compare'];
    const topicLower = topicTrimmed.toLowerCase();
    if (questionWords.some(qw => topicLower.startsWith(qw + ' ') || topicLower === qw)) {
      return true;
    }
    
    // Check for sentence patterns
    const sentencePatterns = [
      /\b(are|is|was|were|do|does|did|can|could|should|will|would|may|might)\s+\w+\s+\w+/i,
      /\b(explain|tell|describe|compare|show|help|find|get|buy|purchase)\s+\w+\s+\w+/i
    ];
    if (sentencePatterns.some(pattern => pattern.test(topicTrimmed))) {
      return true;
    }
    
    return false;
  }

  /**
   * Convert a prompt-like topic to a keyword using Gemini
   */
  private async convertPromptToKeyword(prompt: string, brand: string, industry: string): Promise<string | null> {
    try {
      if (!this.geminiApiKey) {
        console.warn('⚠️ Gemini API key not configured, cannot convert prompt to keyword');
        return null;
      }

      const conversionPrompt = `You are an SEO expert. Extract the core keyword or key phrase from this search query or question.

Original: "${prompt}"

Extract the main keyword or key phrase (1-4 words) that users would search for. 
- Remove question words (what, how, why, etc.)
- Remove question marks
- Keep only the essential search terms
- Examples:
  - "What are Nike running shoes?" → "Nike running shoes"
  - "How do I buy products?" → "buy products"
  - "Explain the benefits of React foam" → "React foam benefits"

Return ONLY the keyword phrase, nothing else. No explanation, no quotes, just the keyword.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: conversionPrompt }] }]
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ Gemini conversion error for "${prompt}": ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const keyword = text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

      // Validate the extracted keyword
      if (this.isValidKeyword(keyword, brand)) {
        return keyword;
      }

      // If validation fails, try to extract manually
      return this.extractKeywordManually(prompt);
    } catch (error) {
      console.warn(`⚠️ Error converting prompt to keyword: "${prompt}"`, error);
      return this.extractKeywordManually(prompt);
    }
  }

  /**
   * Manually extract keyword from prompt (fallback method)
   */
  private extractKeywordManually(prompt: string): string | null {
    let keyword = prompt.trim();
    
    // Remove question mark
    keyword = keyword.replace(/\?/g, '');
    
    // Remove question words at start
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'tell', 'describe', 'compare'];
    for (const qw of questionWords) {
      if (keyword.toLowerCase().startsWith(qw + ' ')) {
        keyword = keyword.substring(qw.length + 1).trim();
        break;
      }
    }
    
    // Remove common sentence starters
    keyword = keyword.replace(/^(are|is|was|were|do|does|did|can|could|should|will|would|may|might)\s+/i, '');
    
    // Take first 4 words max
    const words = keyword.split(/\s+/).filter(w => w.length > 0).slice(0, 4);
    keyword = words.join(' ');
    
    // Validate
    if (keyword.length >= 3 && keyword.length <= 50) {
      return keyword;
    }
    
    return null;
  }

  /**
   * Normalize topics to keywords - converts any prompt-like topics to keyword-like topics
   * Returns both the normalized topics array and a map of original -> normalized
   */
  async normalizeTopicsToKeywords(topics: string[], brand: string, industry: string): Promise<string[]> {
    const normalizedTopics: string[] = [];
    
    for (const topic of topics) {
      if (!topic || typeof topic !== 'string') continue;
      
      const topicTrimmed = topic.trim();
      if (topicTrimmed.length === 0) continue;
      
      // If already keyword-like, use as-is
      if (!this.isPromptLike(topicTrimmed)) {
        normalizedTopics.push(topicTrimmed);
        continue;
      }
      
      // Convert prompt-like topic to keyword
      console.log(`🔄 Converting prompt-like topic to keyword: "${topicTrimmed}"`);
      const keyword = await this.convertPromptToKeyword(topicTrimmed, brand, industry);
      
      if (keyword && this.isValidKeyword(keyword, brand)) {
        normalizedTopics.push(keyword);
        console.log(`✅ Converted "${topicTrimmed}" → "${keyword}"`);
      } else {
        // If conversion fails, try manual extraction
        const manualKeyword = this.extractKeywordManually(topicTrimmed);
        if (manualKeyword && this.isValidKeyword(manualKeyword, brand)) {
          normalizedTopics.push(manualKeyword);
          console.log(`✅ Manually extracted "${topicTrimmed}" → "${manualKeyword}"`);
        } else {
          console.warn(`⚠️ Could not convert prompt-like topic to keyword: "${topicTrimmed}"`);
          // Skip this topic if we can't convert it
        }
      }
    }
    
    return normalizedTopics;
  }

  /**
   * Get brand-specific features based on industry
   */
  private getBrandFeatures(brand: string, industry: string): string[] {
    const featureMap: Record<string, string[]> = {
      'Aerospace': ['rockets', 'spacecraft', 'satellites', 'launch services', 'space technology'],
      'Technology': ['software', 'platform', 'API', 'integration', 'analytics'],
      'Healthcare': ['platform', 'solutions', 'services', 'tools', 'analytics'],
      'Finance': ['platform', 'services', 'solutions', 'tools', 'analytics'],
      'E-commerce': ['platform', 'marketplace', 'solutions', 'tools', 'analytics'],
      'Automotive': ['vehicles', 'technology', 'solutions', 'services', 'innovation']
    };
    
    return featureMap[industry] || ['solutions', 'services', 'platform', 'technology', 'innovation'];
  }

  /**
   * Fetch trending keywords from Google AIO
   */
  private async fetchFromGoogleAio(
    brand: string,
    industry: string,
    competitors: string[],
    locale: string,
    country: string
  ): Promise<TrendingKeyword[]> {
    try {
      console.log('🔍 Fetching from Google AIO...');
      
      // This would integrate with Google AIO API
      // For now, return mock data
      const mockKeywords: TrendingKeyword[] = [
        {
          keyword: `what is ${brand}`,
          category: 'Informational',
          source: 'gemini',
          trend_score: 0.85,
          search_volume: 40000,
          competition_level: 'medium',
          related_queries: [`${brand} definition`, `${brand} meaning`],
          last_updated: new Date().toISOString()
        },
        {
          keyword: `how to use ${brand}`,
          category: 'Tutorial',
          source: 'gemini',
          trend_score: 0.75,
          search_volume: 20000,
          competition_level: 'low',
          related_queries: [`${brand} tutorial`, `${brand} guide`],
          last_updated: new Date().toISOString()
        }
      ];

      return mockKeywords;
    } catch (error) {
      console.error('❌ Google AIO fetch error:', error);
      return [];
    }
  }

  /**
   * Fetch trending keywords from News APIs
   */
  private async fetchFromNews(
    brand: string,
    industry: string,
    locale: string,
    country: string
  ): Promise<TrendingKeyword[]> {
    try {
      console.log('🔍 Fetching from News APIs...');
      
      // This would integrate with News API
      // For now, return mock data
      const mockKeywords: TrendingKeyword[] = [
        {
          keyword: `${brand} news`,
          category: 'News',
          source: 'gemini',
          trend_score: 0.6,
          search_volume: 15000,
          competition_level: 'medium',
          related_queries: [`${brand} updates`, `${brand} latest`],
          last_updated: new Date().toISOString()
        },
        {
          keyword: `${brand} announcement`,
          category: 'Announcements',
          source: 'gemini',
          trend_score: 0.5,
          search_volume: 10000,
          competition_level: 'low',
          related_queries: [`${brand} press release`, `${brand} news`],
          last_updated: new Date().toISOString()
        }
      ];

      return mockKeywords;
    } catch (error) {
      console.error('❌ News API fetch error:', error);
      return [];
    }
  }

  /**
   * Get manual/fallback keywords based on brand and industry
   */
  private getManualKeywords(
    brand: string,
    industry: string,
    competitors: string[]
  ): TrendingKeyword[] {
    const keywords: TrendingKeyword[] = [
      {
        keyword: `${brand} features`,
        category: 'Features',
        source: 'gemini',
        trend_score: 0.8,
        search_volume: 30000,
        competition_level: 'medium',
        related_queries: [`${brand} capabilities`, `${brand} benefits`],
        last_updated: new Date().toISOString()
      },
      {
        keyword: `${brand} support`,
        category: 'Support',
        source: 'gemini',
        trend_score: 0.7,
        search_volume: 20000,
        competition_level: 'low',
        related_queries: [`${brand} help`, `${brand} customer service`],
        last_updated: new Date().toISOString()
      },
      {
        keyword: `${brand} alternatives`,
        category: 'Alternatives',
        source: 'gemini',
        trend_score: 0.6,
        search_volume: 15000,
        competition_level: 'medium',
        related_queries: [`${brand} competitors`, `${brand} similar`],
        last_updated: new Date().toISOString()
      }
    ];

    // Add industry-specific keywords
    if (industry) {
      keywords.push({
        keyword: `${brand} ${industry.toLowerCase()}`,
        category: 'Industry',
        source: 'gemini',
        trend_score: 0.9,
        search_volume: 40000,
        competition_level: 'high',
        related_queries: [`${brand} ${industry.toLowerCase()} solutions`],
        last_updated: new Date().toISOString()
      });
    }

    return keywords;
  }

  /**
   * Deduplicate keywords by keyword text
   */
  private deduplicateKeywords(keywords: TrendingKeyword[]): TrendingKeyword[] {
    const seen = new Set<string>();
    return keywords.filter(keyword => {
      const key = keyword.keyword.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get trending keywords by category
   */
  async getTrendingKeywordsByCategory(
    request: TrendingKeywordsRequest,
    category: string
  ): Promise<TrendingKeywordsResponse> {
    const response = await this.getTrendingKeywords(request);
    
    if (response.success) {
      const filteredKeywords = response.data.keywords.filter(
        keyword => keyword.category.toLowerCase() === category.toLowerCase()
      );
      
      return {
        ...response,
        data: {
          ...response.data,
          keywords: filteredKeywords,
          total_count: filteredKeywords.length
        }
      };
    }
    
    return response;
  }

  /**
   * Store trending keywords and prompts in database
   */
  private async storeTrendingData(
    keywords: TrendingKeyword[], 
    prompts: TrendingPrompt[], 
    brandId: string, 
    customerId: string
  ): Promise<void> {
    try {
      console.log('💾 Storing trending data in database...');

      // Store keywords
      if (keywords.length > 0) {
        const keywordInserts = keywords.map(k => ({
          brand_id: brandId,
          customer_id: customerId,
          keyword: k.keyword,
          category: k.category,
          source: k.source,
          trend_score: k.trend_score,
          search_volume: k.search_volume,
          competition_level: k.competition_level,
          related_queries: k.related_queries || [],
          metadata: { last_updated: k.last_updated }
        }));

        const { error: keywordError } = await supabase
          .from('trending_keywords')
          .insert(keywordInserts);

        if (keywordError) {
          console.error('❌ Failed to store trending keywords:', keywordError);
        } else {
          console.log(`✅ Stored ${keywords.length} trending keywords`);
        }
      }

      // Store prompts
      if (prompts.length > 0) {
        const promptInserts = prompts.map(p => ({
          brand_id: brandId,
          customer_id: customerId,
          prompt: p.prompt,
          category: p.category,
          source: p.source,
          metadata: { last_updated: p.last_updated }
        }));

        const { error: promptError } = await supabase
          .from('trending_prompts')
          .insert(promptInserts);

        if (promptError) {
          console.error('❌ Failed to store trending prompts:', promptError);
        } else {
          console.log(`✅ Stored ${prompts.length} trending prompts`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to store trending data:', error);
    }
  }
}

export const trendingKeywordsService = new TrendingKeywordsService();
