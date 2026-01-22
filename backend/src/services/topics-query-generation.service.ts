/**
 * Unified Topics & Trending Generation Service
 * 
 * Single LLM call that returns both:
 * - AI-generated topics (grouped by intent category)
 * - Trending keywords for the brand
 * 
 * Optimizations:
 * - Compact prompt (no long context)
 * - No description/priority in output (cleaner JSON)
 * - Post-validation to reject question-like topics
 * - Aspect-based comparison topics
 */

import axios from 'axios';

// Simplified topic (no description/priority)
export interface TopicItem {
  intentArchetype: string;
  topic: string;
}

// Trending keyword item
export interface TrendingItem {
  keyword: string;
  category: string;
}

// Unified response from the single LLM call
export interface UnifiedTopicsResponse {
  primaryDomain: string;
  topics: TopicItem[];
  trending: TrendingItem[];
}

export interface TopicsAndQueriesRequest {
  brandName: string;
  industry?: string;
  competitors?: string[];
  description?: string;
  /**
   * Compact keyword list from website scraping.
   */
  websiteContent?: string;
  /**
   * Brand keywords from website.
   */
  brandKeywords?: string[];
  /**
   * Industry keywords from website.
   */
  industryKeywords?: string[];
  maxTopics?: number; // Default: 20
}

// Comparison aspects for more specific topics
const COMPARISON_ASPECTS = [
  'pricing',
  'integrations',
  'implementation',
  'reporting',
  'AP/AR automation',
  'forecasting',
  'security',
  'user experience',
];

// Question words to reject
const QUESTION_WORDS = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'tell', 'describe'];

class TopicsQueryGenerationService {
  private openRouterApiKey = process.env['OPENROUTER_API_KEY'];
  private openRouterModel = process.env['OPENROUTER_TOPICS_MODEL'] || 'openai/gpt-4o-mini';
  private openRouterSiteUrl = process.env['OPENROUTER_SITE_URL'];
  private openRouterSiteTitle = process.env['OPENROUTER_SITE_TITLE'];
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';

  /**
   * Generate topics AND trending keywords in a single LLM call
   */
  async generateTopicsAndQueries(
    request: TopicsAndQueriesRequest
  ): Promise<UnifiedTopicsResponse> {
    const maxTopics = request.maxTopics || 20;
    const prompt = this.buildPrompt(request);
    let lastError: unknown;

    console.log(`📋 [TOPICS] Using OpenRouter model: ${this.openRouterModel}`);

    // Primary: OpenRouter
    if (this.openRouterApiKey) {
      try {
        return await this.generateWithOpenRouter(prompt, maxTopics);
      } catch (error) {
        console.error('❌ OpenRouter topics generation failed, attempting fallback...', error);
        lastError = error;
      }

      // Fallback: OpenRouter with gpt-5-nano
      try {
        console.log('🔄 [TOPICS] Retrying with gpt-5-nano-2025-08-07 fallback...');
        return await this.generateWithOpenRouterFallback(prompt, maxTopics);
      } catch (error) {
        console.error('❌ OpenRouter fallback also failed, attempting Cerebras...', error);
        lastError = lastError || error;
      }
    } else {
      console.warn('⚠️ OPENROUTER_API_KEY is not configured. Skipping primary provider.');
    }

    // Final Fallback: Cerebras
    if (this.cerebrasApiKey) {
      try {
        return await this.generateWithCerebras(prompt, maxTopics);
      } catch (error) {
        console.error('❌ Cerebras topics generation failed.', error);
        lastError = lastError || error;
      }
    } else {
      console.warn('⚠️ CEREBRAS_API_KEY is not configured. No fallback available.');
    }

    throw new Error(
      `Failed to generate topics: ${lastError instanceof Error ? lastError.message : 'No provider succeeded'}`
    );
  }

  /**
   * Build a compact, precise prompt
   */
  private buildPrompt(request: TopicsAndQueriesRequest): string {
    const {
      brandName,
      industry,
      competitors,
      description,
      websiteContent,
      brandKeywords,
      industryKeywords,
    } = request;

    // Enforce an even count so we can request a strict 50/50 split
    const requested = request.maxTopics || 20;
    const totalTopics = requested % 2 === 0 ? requested : Math.max(2, requested - 1);
    const brandTopicCount = Math.floor(totalTopics / 2);
    const industryTopicCount = totalTopics - brandTopicCount;

    const competitorList = competitors?.slice(0, 5).join(', ') || '';
    const brandKw = brandKeywords?.slice(0, 5).join(', ') || '';
    const industryKw = industryKeywords?.slice(0, 12).join(', ') || '';
    const aspectList = COMPARISON_ASPECTS.join(', ');

    return `Generate topics and trending keywords for "${brandName}".

INPUT:
- Brand: ${brandName}
${industry ? `- Industry: ${industry}` : ''}
${description ? `- Description: ${description}` : ''}
${competitorList ? `- Competitors: ${competitorList}` : ''}
${websiteContent ? `- ${websiteContent}` : ''}
${brandKw ? `- Brand keywords: ${brandKw}` : ''}
${industryKw ? `- Industry keywords: ${industryKw}` : ''}

OUTPUT TWO ARRAYS IN JSON:

1. "topics" (${totalTopics} items TOTAL): AI-generated topic phrases grouped by intent.
   Intent categories: awareness, comparison, purchase, support
   
   RULES:
   - 2-5 words each (max 6 for "X vs Y" comparisons)
   - NO question marks
   - Do NOT start with: what/how/why/when/where/who/which
   - Neutral tone (not promotional)
   - For comparison: MUST include an aspect (${aspectList})
     Example: "${brandName} vs ${competitors?.[0] || 'Competitor'} pricing" NOT just "${brandName} vs ${competitors?.[0] || 'Competitor'}"
   - STRICT QUOTA (must comply exactly):
     - Exactly ${brandTopicCount} BRAND topics: MUST include the exact brand string "${brandName}" (case-insensitive match).
     - Exactly ${industryTopicCount} INDUSTRY topics: MUST NOT include "${brandName}" anywhere.
   - INDUSTRY topics should describe the market/problem/category (NOT the company), using industry terms (e.g. workflows, roles, use cases, features).
   - BRAND topics should still be useful for search intent (not just "${brandName} features" repeated).

2. "trending" (6-8 items): Short trending keyword phrases users search now.
   RULES:
   - 1-4 words each
   - Keyword-like (nouns), not questions
   - Categories: Trending, Comparison, Features, Pricing, Support, Alternatives

RETURN ONLY THIS JSON (no markdown, no explanation):
{
  "primaryDomain": "1 sentence about brand's main value",
  "topics": [
    {"intentArchetype": "awareness|comparison|purchase|support", "topic": "short phrase"}
  ],
  "trending": [
    {"keyword": "short phrase", "category": "Trending|Comparison|Features|Pricing|Support|Alternatives"}
  ]
}`;
  }

  /**
   * Validate and fix a single topic
   * Returns null if topic should be rejected
   */
  private validateTopic(topic: string): string | null {
    if (!topic || typeof topic !== 'string') return null;

    let cleaned = topic.trim();

    // Reject if has question mark
    if (cleaned.includes('?')) {
      console.log(`🚫 Rejected topic (question mark): "${cleaned}"`);
      return null;
    }

    // Check if starts with question word
    const lowerTopic = cleaned.toLowerCase();
    for (const qw of QUESTION_WORDS) {
      if (lowerTopic === qw || lowerTopic.startsWith(`${qw} `)) {
        // Try to fix simple cases
        const fixed = this.fixQuestionTopic(cleaned, qw);
        if (fixed) {
          console.log(`🔧 Fixed topic: "${cleaned}" → "${fixed}"`);
          return fixed;
        }
        console.log(`🚫 Rejected topic (question word): "${cleaned}"`);
        return null;
      }
    }

    // Check word count (max 7 words)
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 7) {
      console.log(`🚫 Rejected topic (too long): "${cleaned}"`);
      return null;
    }

    // Check minimum length
    if (cleaned.length < 3) {
      return null;
    }

    return cleaned;
  }

  /**
   * Try to fix a question-like topic into a keyword phrase
   */
  private fixQuestionTopic(topic: string, questionWord: string): string | null {
    const lower = topic.toLowerCase();
    
    // "What is X" -> "X basics" or "X overview"
    if (lower.startsWith('what is ')) {
      const rest = topic.substring(8).trim();
      if (rest.length > 2) return `${rest} basics`;
    }

    // "How to X" -> "X guide" or just remove "how to"
    if (lower.startsWith('how to ')) {
      const rest = topic.substring(7).trim();
      if (rest.length > 2) return rest;
    }

    // "How does X work" -> "X functionality"
    if (lower.startsWith('how does ') && lower.includes(' work')) {
      const rest = topic.substring(9).replace(/\s+work.*$/i, '').trim();
      if (rest.length > 2) return `${rest} functionality`;
    }

    // Generic: just remove the question word
    const withoutQw = topic.replace(new RegExp(`^${questionWord}\\s+`, 'i'), '').trim();
    if (withoutQw.length > 5 && withoutQw.split(/\s+/).length <= 6) {
      return withoutQw;
    }

    return null;
  }

  /**
   * Validate trending keyword
   */
  private validateTrending(keyword: string): string | null {
    if (!keyword || typeof keyword !== 'string') return null;

    const cleaned = keyword.trim();

    // Reject questions
    if (cleaned.includes('?')) return null;

    // Check word count (max 5)
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 5) return null;

    // Check for question words
    const lower = cleaned.toLowerCase();
    for (const qw of QUESTION_WORDS) {
      if (lower === qw || lower.startsWith(`${qw} `)) {
        return null;
      }
    }

    if (cleaned.length < 3) return null;

    return cleaned;
  }

  /**
   * Parse and validate LLM response
   */
  private parseResponse(content: string, maxTopics: number): UnifiedTopicsResponse {
    // Remove markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.primaryDomain) {
        parsed.primaryDomain = 'General';
      }

      // Process and validate topics
      const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
      const validTopics: TopicItem[] = [];
      let rejectedCount = 0;

      for (const t of rawTopics) {
        if (!t?.topic || !t?.intentArchetype) continue;

        const validatedTopic = this.validateTopic(t.topic);
        if (validatedTopic) {
          validTopics.push({
            intentArchetype: this.normalizeIntentArchetype(t.intentArchetype),
            topic: validatedTopic,
          });
        } else {
          rejectedCount++;
        }
      }

      console.log(`✅ [TOPICS] Validated ${validTopics.length} topics (rejected ${rejectedCount})`);

      // Process and validate trending
      const rawTrending = Array.isArray(parsed.trending) ? parsed.trending : [];
      const validTrending: TrendingItem[] = [];

      for (const tr of rawTrending) {
        if (!tr?.keyword) continue;

        const validatedKeyword = this.validateTrending(tr.keyword);
        if (validatedKeyword) {
          validTrending.push({
            keyword: validatedKeyword,
            category: tr.category || 'Trending',
          });
        }
      }

      console.log(`✅ [TRENDING] Validated ${validTrending.length} keywords`);

      // Limit topics
      const limitedTopics = validTopics.slice(0, maxTopics);

      return {
        primaryDomain: parsed.primaryDomain.trim(),
        topics: limitedTopics,
        trending: validTrending.slice(0, 8),
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      console.error('Response preview:', cleaned.substring(0, 500));
      throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize intent archetype to our 4 categories
   */
  private normalizeIntentArchetype(archetype: string): string {
    const lower = (archetype || '').toLowerCase().trim();
    
    // Map to our 4 main categories
    if (lower.includes('comparison') || lower.includes('alternative') || lower.includes('vs')) {
      return 'comparison';
    }
    if (lower.includes('pricing') || lower.includes('purchase') || lower.includes('value') || lower.includes('cost')) {
      return 'purchase';
    }
    if (lower.includes('support') || lower.includes('problem') || lower.includes('troubleshoot')) {
      return 'support';
    }
    // Default to awareness
    return 'awareness';
  }

  /**
   * Call OpenRouter (primary)
   */
  private async generateWithOpenRouter(prompt: string, maxTopics: number): Promise<UnifiedTopicsResponse> {
    console.log('🌐 [TOPICS] Generating with OpenRouter (primary)...');
    console.log('📝 [TOPICS] Prompt preview:', this.previewForLog(prompt));

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: this.openRouterModel,
        messages: [
          { role: 'system', content: 'Generate topics and trending keywords. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 2500,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          ...(this.openRouterSiteUrl ? { 'HTTP-Referer': this.openRouterSiteUrl } : {}),
          ...(this.openRouterSiteTitle ? { 'X-Title': this.openRouterSiteTitle } : {}),
        },
        timeout: 60000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('Empty response from OpenRouter API');
    }

    console.log('🔍 OpenRouter response preview:', this.previewForLog(content));
    return this.parseResponse(content, maxTopics);
  }

  /**
   * Call OpenRouter fallback model
   */
  private async generateWithOpenRouterFallback(prompt: string, maxTopics: number): Promise<UnifiedTopicsResponse> {
    const fallbackModel = 'openai/gpt-5-nano-2025-08-07';
    console.log(`🔄 [TOPICS] Generating with OpenRouter fallback: ${fallbackModel}`);

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: fallbackModel,
        messages: [
          { role: 'system', content: 'Generate topics and trending keywords. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 2500,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          ...(this.openRouterSiteUrl ? { 'HTTP-Referer': this.openRouterSiteUrl } : {}),
          ...(this.openRouterSiteTitle ? { 'X-Title': this.openRouterSiteTitle } : {}),
        },
        timeout: 60000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('Empty response from OpenRouter fallback API');
    }

    console.log('🔍 OpenRouter fallback response preview:', this.previewForLog(content));
    return this.parseResponse(content, maxTopics);
  }

  /**
   * Call Cerebras (final fallback)
   */
  private async generateWithCerebras(prompt: string, maxTopics: number): Promise<UnifiedTopicsResponse> {
    console.log('🤖 Generating with Cerebras (fallback)...');
    console.log('📝 Prompt preview:', this.previewForLog(prompt));

    const response = await axios.post<any>(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        model: this.cerebrasModel,
        messages: [
          { role: 'system', content: 'Generate topics and trending keywords. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 2500,
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
      throw new Error('Empty response from Cerebras API');
    }

    console.log('🔍 Cerebras response preview:', this.previewForLog(content));
    return this.parseResponse(content, maxTopics);
  }

  /**
   * Map intent archetype to category (for backward compatibility)
   */
  mapIntentToCategory(intentArchetype: string): 'awareness' | 'comparison' | 'purchase' | 'post-purchase support' {
    const normalized = this.normalizeIntentArchetype(intentArchetype);
    if (normalized === 'support') return 'post-purchase support';
    return normalized as 'awareness' | 'comparison' | 'purchase';
  }

  private previewForLog(text: string, max: number = 600): string {
    return text.length > max ? `${text.substring(0, max)}...` : text;
  }
}

export const topicsQueryGenerationService = new TopicsQueryGenerationService();

// Backward compatibility aliases
export type TopicsAndQueriesResponse = UnifiedTopicsResponse;
export type TopicWithQuery = TopicItem & { description?: string; priority?: number };
