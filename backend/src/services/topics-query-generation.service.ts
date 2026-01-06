/**
 * New Topics & Query Generation Service
 * 
 * This service implements the improved prompt approach that generates
 * topics and queries together, organized by intent archetypes.
 * 
 * Key improvements:
 * - Flexible topic count (3-7 per intent, not fixed 5)
 * - Better topic-query alignment
 * - More structured intent system
 * - Filters to top 15-20 most relevant topics
 */

import axios from 'axios';

export interface TopicWithQuery {
  intentArchetype: string;
  topic: string;
  description: string;
  priority: number;
}

export interface TopicsAndQueriesResponse {
  primaryDomain: string;
  topics: TopicWithQuery[];
}

export interface TopicsAndQueriesRequest {
  brandName: string;
  industry?: string;
  competitors?: string[];
  description?: string;
  maxTopics?: number; // Default: 20, max: 50
}

class TopicsQueryGenerationService {
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel = process.env['CEREBRAS_MODEL'] || 'gpt-4o-mini';
  private openRouterApiKey = process.env['OPENROUTER_API_KEY'];
  private openRouterModel = (() => {
    const envModel = process.env['OPENROUTER_TOPICS_MODEL'];
    const defaultModel = 'openai/gpt-4o-mini';
    const model = envModel || defaultModel;
    
    console.log(`📋 [TOPICS] Using OpenRouter model: ${model}`);
    return model;
  })();
  private openRouterSiteUrl = process.env['OPENROUTER_SITE_URL'];
  private openRouterSiteTitle = process.env['OPENROUTER_SITE_TITLE'];

  /**
   * Generate topics and queries using the new improved prompt
   */
  async generateTopicsAndQueries(
    request: TopicsAndQueriesRequest
  ): Promise<TopicsAndQueriesResponse> {
    const maxTopics = request.maxTopics || 20;
    const prompt = this.buildPrompt(request);
    let lastError: unknown;

    // Primary: OpenRouter (gpt-4o-mini)
    if (this.openRouterApiKey) {
      try {
        return await this.generateWithOpenRouter(prompt, maxTopics);
      } catch (error) {
        console.error('❌ OpenRouter topics generation failed, attempting fallback...', error);
        lastError = error;
      }
    } else {
      console.warn('⚠️ OPENROUTER_API_KEY is not configured. Skipping primary provider.');
    }

    // Fallback: OpenRouter with gpt-5-nano-2025-08-07
    if (this.openRouterApiKey) {
      try {
        console.log('🔄 [TOPICS] Retrying with gpt-5-nano-2025-08-07 fallback...');
        return await this.generateWithOpenRouterFallback(prompt, maxTopics);
      } catch (error) {
        console.error('❌ OpenRouter fallback (gpt-5-nano-2025-08-07) also failed, attempting Cerebras...', error);
        lastError = lastError || error;
      }
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
      `Failed to generate topics and queries: ${
        lastError instanceof Error ? lastError.message : 'No provider succeeded'
      }`
    );
  }

  /**
   * Build the improved prompt
   */
  private buildPrompt(request: TopicsAndQueriesRequest): string {
    const { brandName, industry, competitors, description } = request;

    return `You are an AEO (Answer Engine Optimization) Topic Architect.  
Your job: generate a structured list of meaningful Topics for the brand the user will input.

The user provides: **Brand Name: ${brandName}**
${industry ? `Industry: ${industry}` : ''}
${description ? `Brand Description: ${description}` : ''}
${competitors && competitors.length > 0 ? `Competitors: ${competitors.join(', ')}` : ''}

Your tasks:

1. Determine the brand's **primary domain of value**.  
   - This may be a product category, a service category, a content/education domain, a mission area, or a marketplace.  
   - Choose the single domain that best reflects how most users interact with the brand.  
   - If the brand spans many domains, pick the one with highest user impact and note any major secondary domains in your description.

2. Using that domain, generate Topics grouped by the following **10 user Intent Archetypes**:  
   - best_of  
   - comparison  
   - alternatives  
   - pricing_or_value  
   - use_case  
   - how_to  
   - problem_solving  
   - beginner_explain  
   - expert_explain  
   - technical_deep_dive

3. For **each Intent Archetype**, generate **3-7 distinct Topics** (not fixed 5).  
   - Generate more topics for intents that are highly relevant to this brand
   - Generate fewer (or skip) intents that are less relevant
   - Topics must be short descriptive phrases (not full questions).  
   - Avoid overlap or duplication across intent groups.  
   - Topics must reflect real-world user thinking for that brand + domain.  
   - Avoid heavy internal jargon or feature names; focus on user-level concepts.

4. For each Topic include a **1–2 sentence description** explaining what the topic is about.

5. For each Topic, assign a **priority score (1-5)** based on:
   - Relevance to the brand's primary domain
   - Likely user search volume
   - Business value potential

6. **Output format (CRITICAL - Return ONLY valid JSON):**
\`\`\`json
{
  "primaryDomain": "1-2 sentence description of the brand's primary domain of value",
  "topics": [
    {
      "intentArchetype": "best_of|comparison|alternatives|pricing_or_value|use_case|how_to|problem_solving|beginner_explain|expert_explain|technical_deep_dive",
      "topic": "short descriptive phrase (2-5 words)",
      "description": "1-2 sentence explanation",
      "priority": 1-5
    }
  ]
}
\`\`\`

CRITICAL REQUIREMENTS:
- Return ONLY the JSON object. No markdown code fences, no explanations, no text before or after.
- Generate topics that are specific to this brand and industry
- Prioritize topics that are most relevant to the brand's primary domain
- Total topics should be between 20-50 (aim for quality over quantity)

Focus on generating the most relevant and valuable topics for "${brandName}".`;
  }

  /**
   * Parse the LLM response
   */
  private parseResponse(content: string): TopicsAndQueriesResponse {
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
      if (!parsed.primaryDomain || !Array.isArray(parsed.topics)) {
        throw new Error('Invalid response structure');
      }

      // Validate and normalize topics
      const topics: TopicWithQuery[] = parsed.topics
        .filter((t: any) => 
          t.intentArchetype && 
          t.topic && 
          t.description && 
          typeof t.priority === 'number'
        )
        .map((t: any) => ({
          intentArchetype: t.intentArchetype,
          topic: t.topic.trim(),
          description: t.description.trim(),
          priority: Math.max(1, Math.min(5, Math.round(t.priority))), // Clamp to 1-5
        }));

      if (topics.length === 0) {
        throw new Error('No valid topics found in response');
      }

      return {
        primaryDomain: parsed.primaryDomain.trim(),
        topics,
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      console.error('Response preview:', cleaned.substring(0, 500));
      throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call Cerebras as fallback provider
   */
  private async generateWithCerebras(prompt: string, maxTopics: number): Promise<TopicsAndQueriesResponse> {
    console.log('🤖 Generating topics and queries with Cerebras (fallback)...');
    console.log('📝 Topics prompt preview:', this.previewForLog(prompt));

    const response = await axios.post<any>(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        model: this.cerebrasModel,
        messages: [
          { role: 'system', content: 'You are an AEO (Answer Engine Optimization) Topic & Query Architect. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000, // Increased for larger output
      },
      {
        headers: {
          Authorization: `Bearer ${this.cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 90000, // 90 seconds for larger responses
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('Empty response from Cerebras API');
    }

    console.log('🔍 Cerebras topics response preview:', this.previewForLog(content));
    return this.processResponse(content, maxTopics);
  }

  /**
   * Call OpenRouter as primary provider (gpt-4o-mini)
   */
  private async generateWithOpenRouter(prompt: string, maxTopics: number): Promise<TopicsAndQueriesResponse> {
    console.log('🌐 [TOPICS] Generating topics and queries with OpenRouter (primary: gpt-4o-mini)...');
    console.log(`🤖 [TOPICS] Using model: ${this.openRouterModel}`);
    console.log('📝 [TOPICS] Topics prompt preview:', this.previewForLog(prompt));

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: this.openRouterModel,
        messages: [
          { role: 'system', content: 'You are an AEO (Answer Engine Optimization) Topic & Query Architect. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          ...(this.openRouterSiteUrl ? { 'HTTP-Referer': this.openRouterSiteUrl } : {}),
          ...(this.openRouterSiteTitle ? { 'X-Title': this.openRouterSiteTitle } : {}),
        },
        timeout: 90000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('Empty response from OpenRouter API');
    }

    console.log('🔍 OpenRouter topics response preview:', this.previewForLog(content));
    return this.processResponse(content, maxTopics);
  }

  /**
   * Call OpenRouter with fallback model (gpt-5-nano-2025-08-07)
   */
  private async generateWithOpenRouterFallback(prompt: string, maxTopics: number): Promise<TopicsAndQueriesResponse> {
    const fallbackModel = 'openai/gpt-5-nano-2025-08-07';
    console.log(`🔄 [TOPICS] Generating topics with OpenRouter fallback model: ${fallbackModel}`);

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: fallbackModel,
        messages: [
          { role: 'system', content: 'You are an AEO (Answer Engine Optimization) Topic & Query Architect. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          ...(this.openRouterSiteUrl ? { 'HTTP-Referer': this.openRouterSiteUrl } : {}),
          ...(this.openRouterSiteTitle ? { 'X-Title': this.openRouterSiteTitle } : {}),
        },
        timeout: 90000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('Empty response from OpenRouter fallback API');
    }

    console.log('🔍 OpenRouter fallback topics response preview:', this.previewForLog(content));
    return this.processResponse(content, maxTopics);
  }

  /**
   * Parse, filter, and rank LLM output
   */
  private processResponse(content: string, maxTopics: number): TopicsAndQueriesResponse {
    const parsed = this.parseResponse(content);
    const filtered = this.filterAndRankTopics(parsed.topics, maxTopics);

    console.log(`✅ Generated ${filtered.length} topics (from ${parsed.topics.length} total)`);

    return {
      primaryDomain: parsed.primaryDomain,
      topics: filtered,
    };
  }

  /**
   * Filter and rank topics by priority, limiting to maxTopics
   */
  private filterAndRankTopics(
    topics: TopicWithQuery[],
    maxTopics: number
  ): TopicWithQuery[] {
    // Sort by priority (descending), then by intent archetype for consistency
    const sorted = [...topics].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.intentArchetype.localeCompare(b.intentArchetype);
    });

    // Take top N topics
    return sorted.slice(0, maxTopics);
  }

  /**
   * Map intent archetypes to existing category system
   * Maps new 10 archetypes to 4 existing categories for backward compatibility
   */
  mapIntentToCategory(intentArchetype: string): 'awareness' | 'comparison' | 'purchase' | 'post-purchase support' {
    const mapping: Record<string, 'awareness' | 'comparison' | 'purchase' | 'post-purchase support'> = {
      'best_of': 'awareness',
      'comparison': 'comparison',
      'alternatives': 'comparison',
      'pricing_or_value': 'purchase',
      'use_case': 'awareness',
      'how_to': 'awareness',
      'problem_solving': 'post-purchase support',
      'beginner_explain': 'awareness',
      'expert_explain': 'awareness',
      'technical_deep_dive': 'awareness',
    };

    return mapping[intentArchetype] || 'awareness';
  }

  private previewForLog(text: string, max: number = 800): string {
    return text.length > max ? `${text.substring(0, max)}...` : text;
  }
}

export const topicsQueryGenerationService = new TopicsQueryGenerationService();

