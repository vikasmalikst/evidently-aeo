/**
 * Prompt Generation Service
 * 
 * Generates diverse, industry-specific search queries for given topics.
 * Uses multiple AI providers with fallback chain:
 * 1. OpenRouter (gpt-4o-mini) - Primary
 * 2. OpenRouter (gpt-5-nano) - First fallback
 * 3. Cerebras (qwen-3-235b) - Second fallback
 * 4. Google Gemini - Final fallback
 */

export interface PromptGenerationRequest {
  brandName: string;
  industry: string;
  competitors?: string[];
  topics: string[];
}

export interface GeneratedQuery {
  topic: string;
  query: string;
}

export interface PromptGenerationResult {
  queries: GeneratedQuery[];
  providerUsed: string;
}

// Industry-specific terminology mappings
const INDUSTRY_TERMS: Record<string, string[]> = {
  financial: [
    'cash flow forecasting', 'working capital', 'DSO', 'DPO', 'AP automation',
    'AR automation', 'bank reconciliation', 'multi-entity consolidation',
    'liquidity management', 'cash visibility', 'payment processing',
    'ERP integration', 'financial close', 'variance analysis', 'FP&A',
    'spend management', 'invoice processing', 'collections automation'
  ],
  treasury: [
    'cash flow forecasting', 'working capital', 'DSO', 'DPO', 'AP automation',
    'AR automation', 'bank reconciliation', 'multi-entity consolidation',
    'liquidity management', 'cash visibility', 'payment processing',
    'ERP integration', 'financial close', 'variance analysis', 'FP&A',
    'spend management', 'invoice processing', 'collections automation'
  ],
  cash: [
    'cash flow forecasting', 'working capital', 'DSO', 'DPO', 'AP automation',
    'AR automation', 'bank reconciliation', 'multi-entity consolidation',
    'liquidity management', 'cash visibility', 'payment processing',
    'ERP integration', 'financial close', 'variance analysis', 'FP&A'
  ],
  accounting: [
    'general ledger', 'accounts payable', 'accounts receivable', 'bank reconciliation',
    'financial reporting', 'audit trail', 'tax compliance', 'expense management',
    'invoice automation', 'payment processing', 'month-end close', 'GAAP compliance'
  ],
  marketing: [
    'attribution modeling', 'conversion optimization', 'customer acquisition',
    'marketing automation', 'campaign performance', 'ROI tracking',
    'audience segmentation', 'A/B testing', 'lead scoring', 'funnel analysis',
    'brand awareness', 'engagement metrics', 'content performance'
  ],
  hr: [
    'talent acquisition', 'employee engagement', 'performance management',
    'onboarding automation', 'workforce planning', 'succession planning',
    'compensation benchmarking', 'employee retention', 'HRIS integration',
    'time tracking', 'payroll automation', 'compliance management'
  ],
  sales: [
    'pipeline management', 'sales forecasting', 'deal velocity',
    'quota attainment', 'territory management', 'lead routing',
    'opportunity scoring', 'sales enablement', 'customer success',
    'churn prediction', 'revenue operations', 'account management'
  ],
  crm: [
    'pipeline management', 'sales forecasting', 'deal velocity',
    'customer lifecycle', 'contact management', 'lead scoring',
    'opportunity tracking', 'sales automation', 'customer retention',
    'relationship tracking', 'revenue forecasting', 'account insights'
  ],
  supply: [
    'demand forecasting', 'inventory optimization', 'supply planning',
    'warehouse management', 'order fulfillment', 'supplier management',
    'procurement automation', 'logistics optimization', 'track and trace',
    'last mile delivery', 'returns management', 'SKU rationalization'
  ],
  logistics: [
    'demand forecasting', 'inventory optimization', 'supply planning',
    'warehouse management', 'order fulfillment', 'supplier management',
    'procurement automation', 'logistics optimization', 'track and trace',
    'last mile delivery', 'returns management', 'route optimization'
  ],
  health: [
    'patient engagement', 'clinical workflows', 'EHR integration',
    'revenue cycle management', 'care coordination', 'population health',
    'regulatory compliance', 'claims processing', 'patient scheduling',
    'telehealth', 'medical billing', 'HIPAA compliance'
  ],
  ecommerce: [
    'conversion rate optimization', 'cart abandonment', 'product discovery',
    'personalization engine', 'inventory sync', 'omnichannel',
    'customer lifetime value', 'returns management', 'product recommendations',
    'checkout optimization', 'merchandising', 'price optimization'
  ],
  retail: [
    'conversion rate optimization', 'cart abandonment', 'product discovery',
    'personalization', 'inventory management', 'omnichannel retail',
    'customer loyalty', 'POS integration', 'merchandise planning',
    'store operations', 'price optimization', 'demand forecasting'
  ],
  software: [
    'API integration', 'workflow automation', 'user onboarding',
    'feature adoption', 'product analytics', 'customer health score',
    'churn reduction', 'expansion revenue', 'usage metrics',
    'deployment options', 'SSO integration', 'data migration'
  ],
  saas: [
    'API integration', 'workflow automation', 'user onboarding',
    'feature adoption', 'product analytics', 'customer health score',
    'churn reduction', 'expansion revenue', 'usage metrics',
    'deployment options', 'SSO integration', 'data migration'
  ],
  default: [
    'workflow automation', 'process optimization', 'data integration',
    'reporting and analytics', 'ROI measurement', 'compliance',
    'scalability', 'user adoption', 'implementation', 'best practices',
    'industry benchmarks', 'digital transformation'
  ]
};

class PromptGenerationService {
  private openRouterApiKey = process.env['OPENROUTER_API_KEY'];
  private openRouterModel = process.env['OPENROUTER_MODEL'] || 'openai/gpt-4o-mini';
  private openRouterFallbackModel = 'openai/gpt-5-nano-2025-08-07';
  private openRouterSiteUrl = process.env['OPENROUTER_SITE_URL'];
  private openRouterSiteTitle = process.env['OPENROUTER_SITE_TITLE'];
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
  private geminiApiKey = process.env['GOOGLE_GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'];
  private geminiModel = process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-1.5-flash-002';

  /**
   * Generate diverse search queries for given topics
   */
  async generatePrompts(request: PromptGenerationRequest): Promise<PromptGenerationResult> {
    const { brandName, industry, competitors = [], topics } = request;
    
    const industryTerms = this.getIndustrySpecificTerms(industry);
    const prompt = this.buildPrompt(brandName, industry, competitors, topics, industryTerms);
    
    console.log('📝 [PROMPT-SERVICE] Generating prompts for topics:', topics.slice(0, 5), topics.length > 5 ? '...' : '');
    console.log('📝 [PROMPT-SERVICE] Prompt preview:', prompt.substring(0, 500) + '...');

    // Try providers in order
    let result: PromptGenerationResult | null = null;

    // 1. Try OpenRouter (primary)
    result = await this.tryOpenRouter(prompt, this.openRouterModel, 'OpenRouter Primary');
    if (result) return result;

    // 2. Try OpenRouter fallback
    result = await this.tryOpenRouter(prompt, this.openRouterFallbackModel, 'OpenRouter Fallback');
    if (result) return result;

    // 3. Try Cerebras
    result = await this.tryCerebras(prompt);
    if (result) return result;

    // 4. Try Gemini
    result = await this.tryGemini(prompt);
    if (result) return result;

    throw new Error('Prompt generation failed: All providers (OpenRouter, Cerebras, Gemini) failed');
  }

  /**
   * Get industry-specific terminology
   */
  private getIndustrySpecificTerms(industry: string): string[] {
    const industryLower = (industry || '').toLowerCase();
    
    // Find matching industry terms
    for (const [key, terms] of Object.entries(INDUSTRY_TERMS)) {
      if (key !== 'default' && industryLower.includes(key)) {
        return terms;
      }
    }
    
    return INDUSTRY_TERMS.default;
  }

  /**
   * Build the prompt for query generation
   */
  private buildPrompt(
    brandName: string,
    industry: string,
    competitors: string[],
    topics: string[],
    industryTerms: string[]
  ): string {
    const competitorsStr = competitors.length > 0 
      ? `Competitors: ${competitors.join(', ')}. ` 
      : '';

    return `You are an SEO expert specializing in ${industry}. Generate 3-5 DIVERSE, realistic search queries for each topic.

INDUSTRY: ${industry}
${competitorsStr}
INDUSTRY TERMINOLOGY TO USE: ${industryTerms.join(', ')}

CRITICAL DIVERSITY RULES - Each topic must have queries covering DIFFERENT angles:
1. INFORMATIONAL: "what is...", "how does... work", "...explained", "...guide"
2. COMMERCIAL INVESTIGATION: "best...", "top...", "...comparison", "...vs...", "...reviews"
3. PROBLEM-SOLVING: "...challenges", "...solutions", "fix...", "improve...", "optimize..."
4. USE CASE SPECIFIC: "[role] + [topic]", "[industry segment] + [topic]", "[company size] + [topic]"
5. TECHNICAL/ADVANCED: "...implementation", "...integration", "...automation", "...API"

MANDATORY RULES:
- DO NOT include "${brandName}" in ANY query
- DO NOT include competitor names in queries
- Each query must be DIFFERENT in structure and intent (not just word substitutions)
- Use industry-specific jargon and terminology
- Think like different user personas: CFO, Finance Manager, Accountant, SMB Owner, Enterprise buyer
- Include specific use cases: "for [industry]", "for [company size]", "for [specific problem]"

BAD EXAMPLES (too similar):
❌ "best cash flow software" / "top cash flow software" / "cash flow software options" (same intent, different words)
❌ "treasury management guide" / "treasury management overview" / "treasury management basics" (too similar)

GOOD EXAMPLES (diverse):
✅ "how CFOs track multi-entity cash positions" (role-specific, advanced)
✅ "automate AP/AR reconciliation for mid-market companies" (use case + company size)
✅ "real-time cash visibility across multiple banks" (technical feature)
✅ "reduce DSO with automated collections" (problem-solving + metric)
✅ "ERP integration for treasury management" (technical/integration)

Topics:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

CRITICAL: Return ONLY a valid JSON array. No explanations, no markdown.
Format: [{"topic": "Topic Name", "query": "diverse search query"}]

Generate queries that real ${industry} professionals would actually search for.`;
  }

  /**
   * Extract JSON array from LLM response
   */
  private extractJsonArray(text: string): string | null {
    let cleanText = text.trim();
    
    // Remove markdown code blocks if present
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/i, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/i, '');
    }
    
    // Find complete JSON array by counting brackets
    let bracketCount = 0;
    let startIndex = -1;
    
    for (let i = 0; i < cleanText.length; i++) {
      if (cleanText[i] === '[') {
        if (startIndex === -1) {
          startIndex = i;
        }
        bracketCount++;
      } else if (cleanText[i] === ']') {
        bracketCount--;
        if (bracketCount === 0 && startIndex !== -1) {
          return cleanText.substring(startIndex, i + 1);
        }
      }
    }
    
    // Fallback to regex if bracket counting didn't work
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
    return jsonMatch ? jsonMatch[0] : null;
  }

  /**
   * Parse and validate JSON response
   */
  private parseResponse(responseText: string, providerName: string): GeneratedQuery[] | null {
    const jsonStr = this.extractJsonArray(responseText);
    if (!jsonStr) {
      console.warn(`⚠️ [PROMPT-SERVICE] No valid JSON array found in ${providerName} response`);
      return null;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate structure
        const validQueries = parsed.filter(
          (item: any) => item && typeof item.topic === 'string' && typeof item.query === 'string'
        );
        if (validQueries.length > 0) {
          return validQueries;
        }
      }
      console.warn(`⚠️ [PROMPT-SERVICE] ${providerName} returned empty or invalid array`);
      return null;
    } catch (parseError) {
      console.error(`❌ [PROMPT-SERVICE] Failed to parse ${providerName} JSON response:`, parseError);
      return null;
    }
  }

  /**
   * Try OpenRouter API
   */
  private async tryOpenRouter(prompt: string, model: string, providerLabel: string): Promise<PromptGenerationResult | null> {
    if (!this.openRouterApiKey || this.openRouterApiKey === 'your_openrouter_api_key_here') {
      console.warn(`⚠️ [PROMPT-SERVICE] ${providerLabel} skipped: API key not configured`);
      return null;
    }

    try {
      console.log(`🌐 [PROMPT-SERVICE] Attempting ${providerLabel} with model: ${model}`);
      
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

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an SEO expert. Always respond with valid JSON arrays only. No explanations, no markdown, no code blocks.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [PROMPT-SERVICE] ${providerLabel} API error: ${response.status} ${errorText}`);
        return null;
      }

      const data = await response.json() as any;
      const generatedText = data.choices?.[0]?.message?.content || '';
      
      if (!generatedText) {
        console.warn(`⚠️ [PROMPT-SERVICE] ${providerLabel} returned empty content`);
        return null;
      }

      const queries = this.parseResponse(generatedText, providerLabel);
      if (queries) {
        console.log(`✅ [PROMPT-SERVICE] ${providerLabel} SUCCESS: Generated ${queries.length} queries`);
        return { queries, providerUsed: `${providerLabel} (${model})` };
      }

      return null;
    } catch (error) {
      console.error(`❌ [PROMPT-SERVICE] ${providerLabel} request failed:`, error);
      return null;
    }
  }

  /**
   * Try Cerebras API
   */
  private async tryCerebras(prompt: string): Promise<PromptGenerationResult | null> {
    if (!this.cerebrasApiKey || this.cerebrasApiKey === 'your_cerebras_api_key_here') {
      console.warn('⚠️ [PROMPT-SERVICE] Cerebras skipped: API key not configured');
      return null;
    }

    try {
      console.log(`🧠 [PROMPT-SERVICE] Attempting Cerebras with model: ${this.cerebrasModel}`);
      
      const response = await fetch('https://api.cerebras.ai/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cerebrasApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.cerebrasModel,
          prompt: prompt,
          max_tokens: 2000,
          temperature: 0.7,
          stop: ['---END---']
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [PROMPT-SERVICE] Cerebras API error: ${response.status} ${errorText}`);
        return null;
      }

      const data = await response.json() as any;
      const generatedText = data.choices?.[0]?.text || '';
      
      if (!generatedText) {
        console.warn('⚠️ [PROMPT-SERVICE] Cerebras returned empty content');
        return null;
      }

      const queries = this.parseResponse(generatedText, 'Cerebras');
      if (queries) {
        console.log(`✅ [PROMPT-SERVICE] Cerebras SUCCESS: Generated ${queries.length} queries`);
        return { queries, providerUsed: `Cerebras (${this.cerebrasModel})` };
      }

      return null;
    } catch (error) {
      console.error('❌ [PROMPT-SERVICE] Cerebras request failed:', error);
      return null;
    }
  }

  /**
   * Try Google Gemini API
   */
  private async tryGemini(prompt: string): Promise<PromptGenerationResult | null> {
    if (!this.geminiApiKey || this.geminiApiKey === 'your_gemini_api_key_here') {
      console.warn('⚠️ [PROMPT-SERVICE] Gemini skipped: API key not configured');
      return null;
    }

    try {
      console.log(`🤖 [PROMPT-SERVICE] Attempting Gemini with model: ${this.geminiModel}`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: `You are an SEO expert. Return only valid JSON arrays. No explanations, no markdown, no code blocks.\n\n${prompt}`,
              }],
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [PROMPT-SERVICE] Gemini API error: ${response.status} ${errorText}`);
        return null;
      }

      const data = await response.json() as any;
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!generatedText) {
        console.warn('⚠️ [PROMPT-SERVICE] Gemini returned empty content');
        return null;
      }

      const queries = this.parseResponse(generatedText, 'Gemini');
      if (queries) {
        console.log(`✅ [PROMPT-SERVICE] Gemini SUCCESS: Generated ${queries.length} queries`);
        return { queries, providerUsed: `Gemini (${this.geminiModel})` };
      }

      return null;
    } catch (error) {
      console.error('❌ [PROMPT-SERVICE] Gemini request failed:', error);
      return null;
    }
  }
}

export const promptGenerationService = new PromptGenerationService();
