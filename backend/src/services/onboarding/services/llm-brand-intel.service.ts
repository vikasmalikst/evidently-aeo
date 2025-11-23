import axios from 'axios';
import type { LLMBrandIntelResult } from '../types';

/**
 * Service for generating brand intelligence using LLM (Cerebras)
 */
export class LLMBrandIntelService {
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel =
    process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';

  async generateBrandIntel(
    rawInput: string,
    companyName: string,
    domain?: string,
    skipTopics: boolean = false
  ): Promise<LLMBrandIntelResult> {
    if (!this.cerebrasApiKey) {
      console.warn('⚠️ Cerebras API key not configured, skipping LLM generation');
      return {};
    }

    const topicsSection = skipTopics ? '' : `
You are an Answer Engine Optimization (AEO) researcher.  
Your task is to generate 5–8 high-level **Topics** that represent the main categories of user queries for a specific brand or entity.  

Requirements:
1. Topics are broad "buckets" of user intent, not individual questions.  
2. Topics must be **brand-specific** and **industry-specific**.  
3. Avoid generic labels like "FAQs" or "General Information." Each Topic should reflect real areas of likely user curiosity.  
4. Cover a balanced spread of user concerns, typically including:
   - Brand identity & trust
   - Products & features
   - Concerns, risks, or complaints
   - Informational / how-to usage
   - Pricing, value, or cost
   - Comparisons vs. competitors
   - Sustainability, ethics, or quality signals
   - Ingredients, nutrition, or safety (if relevant to category)
   - Local/transactional considerations (if relevant)
5. Keep Topics **short (2–5 words)** and **query-shaped** (e.g., "Nutritional Facts," "Durability & Quality," "Pricing & Value").  
6. Do not include the brand name inside the Topics.`;

    const topicsField = skipTopics ? '' : ',\n  "topics": ["string1", "string2", "string3", "string4", "string5", "string6", "string7", "string8"]';

    const systemPrompt = `You are a brand intelligence researcher. Given a brand name OR a URL:

Identify the brand, canonical homepage URL, short neutral summary (max 4 sentences).

Extract CEO, headquarters city+country, founded year (if public).

List top 5 competitors (global first, dedupe subsidiaries).

Assign an industry/vertical (1–3 words).
${skipTopics ? '\n\nNOTE: Topics will be generated separately. Do not include topics in your response.' : ''}

IMPORTANT: You must respond with a valid JSON object containing these exact fields:
{
  "brandName": "string",
  "homepageUrl": "string (full URL with https://)",
  "summary": "string (max 4 sentences)",
  "ceo": "string or null",
  "headquarters": "string (city, country)",
  "foundedYear": number or null,
  "industry": "string (1-3 words)",
  "competitors": ["string1", "string2", "string3", "string4", "string5"]${topicsField}
}
${topicsSection}

Return JSON strictly matching the BrandIntel schema. Include 3–6 public sources with titles+URLs used for the above. Input was: ${rawInput}.`;

    try {
      const response = await axios.post<any>(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: this.cerebrasModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this brand: ${rawInput}` }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.cerebrasApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) {
        console.warn('⚠️ No content in LLM response');
        return {};
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ No JSON found in LLM response');
        return {};
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Parsed brand intel JSON:', parsed);

      return {
        summary: parsed.summary || parsed.description || undefined,
        industry: parsed.industry || parsed.sector || parsed.vertical || undefined,
        headquarters: parsed.headquarters || parsed.location || parsed.hq || undefined,
        foundedYear: parsed.foundedYear || parsed.founded || parsed.year_founded || null,
        ceo: parsed.ceo || parsed.ceo_name || undefined,
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : (Array.isArray(parsed.aeo_topics) ? parsed.aeo_topics : []),
        homepageUrl: parsed.homepageUrl || parsed.homepage || parsed.url || undefined,
      };
    } catch (error) {
      console.error('❌ LLM brand intelligence generation failed:', error);
      return {};
    }
  }
}

export const llmBrandIntelService = new LLMBrandIntelService();

