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
  query: string;
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
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY_4'];
  private cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';

  /**
   * Generate topics and queries using the new improved prompt
   */
  async generateTopicsAndQueries(
    request: TopicsAndQueriesRequest
  ): Promise<TopicsAndQueriesResponse> {
    if (!this.cerebrasApiKey) {
      throw new Error('CEREBRAS_API_KEY is not configured');
    }

    const maxTopics = request.maxTopics || 20;
    const prompt = this.buildPrompt(request);

    try {
      console.log('🤖 Generating topics and queries with new prompt approach...');
      console.log(`📋 Brand: ${request.brandName}, Max topics: ${maxTopics}`);

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
          timeout: 60000, // 60 seconds for larger responses
        }
      );

      const content = response.data?.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) {
        throw new Error('Empty response from Cerebras API');
      }

      // Parse the response
      const parsed = this.parseResponse(content);
      
      // Filter and rank topics
      const filtered = this.filterAndRankTopics(parsed.topics, maxTopics);

      console.log(`✅ Generated ${filtered.length} topics (from ${parsed.topics.length} total)`);

      return {
        primaryDomain: parsed.primaryDomain,
        topics: filtered,
      };
    } catch (error) {
      console.error('❌ Topics and queries generation failed:', error);
      throw new Error(
        `Failed to generate topics and queries: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Build the improved prompt
   */
  private buildPrompt(request: TopicsAndQueriesRequest): string {
    const { brandName, industry, competitors, description } = request;

    return `You are an AEO (Answer Engine Optimization) Topic & Query Architect.  
Your job: generate a structured list of meaningful Topics for the brand the user will input — then, based on those Topics, produce **natural-language user queries/prompts** that real users might type into an LLM/search.

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

5. For each Topic, create **one natural-language user query/prompt** (the question a typical user might type into an LLM/search).  
   - The query must:  
     - Be phrased like a real user question (e.g., "What is…", "How do I…", "Which … is best for …").  
     - **Not include the brand name.**  
     - Reflect the Topic and Intent.  
   - Provide the query right after the description in the output for each topic.

6. For each Topic, assign a **priority score (1-5)** based on:
   - Relevance to the brand's primary domain
   - Likely user search volume
   - Business value potential

7. **Output format (CRITICAL - Return ONLY valid JSON):**
\`\`\`json
{
  "primaryDomain": "1-2 sentence description of the brand's primary domain of value",
  "topics": [
    {
      "intentArchetype": "best_of|comparison|alternatives|pricing_or_value|use_case|how_to|problem_solving|beginner_explain|expert_explain|technical_deep_dive",
      "topic": "short descriptive phrase (2-5 words)",
      "description": "1-2 sentence explanation",
      "query": "natural language question without brand name",
      "priority": 1-5
    }
  ]
}
\`\`\`

CRITICAL REQUIREMENTS:
- Return ONLY the JSON object. No markdown code fences, no explanations, no text before or after.
- Generate topics that are specific to this brand and industry
- Ensure queries are natural, user-focused, and don't mention the brand name
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
          t.query &&
          typeof t.priority === 'number'
        )
        .map((t: any) => ({
          intentArchetype: t.intentArchetype,
          topic: t.topic.trim(),
          description: t.description.trim(),
          query: t.query.trim(),
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
}

export const topicsQueryGenerationService = new TopicsQueryGenerationService();

