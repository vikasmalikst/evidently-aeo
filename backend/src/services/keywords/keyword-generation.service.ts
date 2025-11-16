/**
 * Keyword Generation Service
 * 
 * Generates AEO-optimized keywords from query answers using LLM.
 * This service extracts keywords directly from answers to help with:
 * 1. SEO optimization - Understanding what users search for
 * 2. Content strategy - Identifying gaps in content coverage
 * 3. Answer Engine Optimization - Optimizing content for answer engines
 * 
 * Uses LLM (Cerebras primary, Gemini fallback) to intelligently extract keywords from answers.
 */

import { supabaseAdmin } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface GeneratedKeyword {
  keyword: string;
  relevance_score: number; // 0-1, relevance score from LLM
  metadata?: {
    word_count?: number;
    reasoning?: string; // Why this keyword is relevant
  };
}

export interface KeywordGenerationRequest {
  answer: string;                    // The raw answer text (required)
  query_id?: string;                  // Reference to generated_queries (for storage)
  query_text?: string;                // The original query text (for context in generated_keywords table)
  collector_result_id?: string;       // Reference to collector_results (for storage)
  brand_id?: string;                  // Brand ID (for storage)
  customer_id?: string;               // Customer ID (for storage)
  max_keywords?: number;             // Max keywords to generate (default: 20)
}

export interface KeywordGenerationResponse {
  keywords: GeneratedKeyword[];
  total_keywords: number;
  processing_time_ms: number;
}

export class KeywordGenerationService {
  /**
   * Main method to generate keywords from an answer using LLM
   */
  async generateKeywords(request: KeywordGenerationRequest): Promise<KeywordGenerationResponse> {
    const startTime = Date.now();
    const maxKeywords = request.max_keywords || 20;

    if (!request.answer || request.answer.trim().length === 0) {
      throw new Error('Answer text is required for keyword generation');
    }

    // Use LLM to extract keywords from the answer
    const keywords = await this.generateKeywordsWithLLM(request.answer, maxKeywords);

    const processingTime = Date.now() - startTime;

    return {
      keywords,
      total_keywords: keywords.length,
      processing_time_ms: processingTime
    };
  }

  /**
   * Generate keywords from answer using LLM (Cerebras primary, Gemini fallback)
   */
  private async generateKeywordsWithLLM(
    answer: string,
    maxKeywords: number
  ): Promise<GeneratedKeyword[]> {
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    const geminiApiKey = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_GEMINI_API_KEY'];
    const geminiModel = process.env['GEMINI_MODEL'] || process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-1.5-flash';

    const prompt = `You are an expert in SEO and Answer Engine Optimization (AEO). 

Extract the most important keywords and key phrases from the following answer text. These keywords should be:
1. Relevant for SEO and AEO optimization
2. What users would actually search for
3. Include both short keywords (1-2 words) and long-tail keywords (3-5 words)
4. Include question-based keywords (how, what, why, when, where)
5. Focus on actionable, searchable terms

Answer text:
${answer.substring(0, 4000)} ${answer.length > 4000 ? '...' : ''}

Generate ${maxKeywords} keywords. For each keyword, provide:
- The keyword phrase
- A relevance score (0.0 to 1.0) indicating how important/relevant this keyword is
- Brief reasoning (1 sentence) explaining why this keyword is relevant

Respond with a JSON array in this exact format:
[
  {
    "keyword": "exact keyword phrase",
    "relevance_score": 0.85,
    "reasoning": "brief explanation of why this keyword is relevant"
  }
]

Return ONLY the JSON array, no additional text.`;

    try {
      // Try Cerebras first
      if (cerebrasApiKey) {
        try {
          return await this.generateWithCerebras(prompt, cerebrasApiKey, cerebrasModel, maxKeywords);
        } catch (error) {
          console.warn('⚠️ Cerebras keyword generation failed, trying Gemini:', error);
          if (geminiApiKey) {
            return await this.generateWithGemini(prompt, geminiApiKey, geminiModel, maxKeywords);
          }
          throw error;
        }
      } else if (geminiApiKey) {
        return await this.generateWithGemini(prompt, geminiApiKey, geminiModel, maxKeywords);
      } else {
        throw new Error('No LLM API key configured (CEREBRAS_API_KEY or GEMINI_API_KEY required)');
      }
    } catch (error) {
      console.error('❌ LLM keyword generation failed:', error);
      throw new Error(`Failed to generate keywords: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate keywords using Cerebras AI
   */
  private async generateWithCerebras(
    prompt: string,
    apiKey: string,
    model: string,
    maxKeywords: number
  ): Promise<GeneratedKeyword[]> {
    const response = await fetch('https://api.cerebras.ai/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        max_tokens: 2000,
        temperature: 0.3,
        stop: ['\n\n', '---']
      })
    });

    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const aiResponse = data.choices?.[0]?.text?.trim();

    if (!aiResponse) {
      throw new Error('Empty response from Cerebras API');
    }

    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in Cerebras response');
    }

    const keywords = JSON.parse(jsonMatch[0]) as Array<{
      keyword: string;
      relevance_score: number;
      reasoning?: string;
    }>;

    return keywords.slice(0, maxKeywords).map(kw => ({
      keyword: kw.keyword.trim(),
      relevance_score: Math.min(Math.max(kw.relevance_score || 0.5, 0), 1), // Clamp between 0 and 1
      metadata: {
        word_count: kw.keyword.split(/\s+/).length,
        reasoning: kw.reasoning
      }
    }));
  }

  /**
   * Generate keywords using Google Gemini
   */
  private async generateWithGemini(
    prompt: string,
    apiKey: string,
    model: string,
    maxKeywords: number
  ): Promise<GeneratedKeyword[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `You are an expert in SEO and AEO keyword extraction. Return only valid JSON arrays.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!aiResponse) {
      throw new Error('Empty response from Gemini API');
    }

    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in Gemini response');
    }

    const keywords = JSON.parse(jsonMatch[0]) as Array<{
      keyword: string;
      relevance_score: number;
      reasoning?: string;
    }>;

    return keywords.slice(0, maxKeywords).map(kw => ({
      keyword: kw.keyword.trim(),
      relevance_score: Math.min(Math.max(kw.relevance_score || 0.5, 0), 1), // Clamp between 0 and 1
      metadata: {
        word_count: kw.keyword.split(/\s+/).length,
        reasoning: kw.reasoning
      }
    }));
  }

  /**
   * Store generated keywords in database
   * Stores keywords in generated_keywords table (one row per keyword)
   * Also updates collector_results table with keywords as comma-separated text
   */
  async storeKeywords(
    keywords: GeneratedKeyword[],
    request: KeywordGenerationRequest
  ): Promise<void> {
    try {
      // 1. Store keywords in generated_keywords table (one row per keyword)
      const keywordsToStore = keywords.map(kw => ({
        id: uuidv4(),
        query_id: request.query_id,
        collector_result_id: request.collector_result_id,
        brand_id: request.brand_id,
        customer_id: request.customer_id,
        query_text: request.query_text || null, // Store query text for context
        raw_answer: request.answer || null, // Store raw answer for context
        keyword: kw.keyword,
        relevance_score: kw.relevance_score,
        metadata: kw.metadata || {},
        created_at: new Date().toISOString()
      }));

      const { error } = await supabaseAdmin
        .from('generated_keywords')
        .insert(keywordsToStore);

      if (error) {
        console.error('❌ Error storing keywords in generated_keywords table:', error);
        throw error;
      }

      console.log(`✅ Stored ${keywordsToStore.length} keywords in generated_keywords table`);

      // 2. Update collector_results table with keywords as comma-separated text
      if (request.collector_result_id) {
        const keywordsText = keywords.map(kw => kw.keyword).join(', ');

        const { error: updateError } = await supabaseAdmin
          .from('collector_results')
          .update({ keywords: keywordsText })
          .eq('id', request.collector_result_id);

        if (updateError) {
          console.error('❌ Error updating collector_results with keywords:', updateError);
        } else {
          console.log(`✅ Updated collector_results with keywords as text`);
        }
      }
    } catch (error) {
      console.error('❌ Error in storeKeywords:', error);
      throw error;
    }
  }

  /**
   * Get keywords for a specific query or result
   */
  async getKeywords(
    queryId?: string,
    collectorResultId?: string,
    brandId?: string
  ): Promise<GeneratedKeyword[]> {
    try {
      let query = supabaseAdmin
        .from('generated_keywords')
        .select('*')
        .order('relevance_score', { ascending: false });

      if (queryId) {
        query = query.eq('query_id', queryId);
      }
      if (collectorResultId) {
        query = query.eq('collector_result_id', collectorResultId);
      }
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data || []).map((row: any) => ({
        keyword: row.keyword,
        relevance_score: row.relevance_score,
        metadata: row.metadata
      }));
    } catch (error) {
      console.error('❌ Error getting keywords:', error);
      throw error;
    }
  }
}

export const keywordGenerationService = new KeywordGenerationService();
