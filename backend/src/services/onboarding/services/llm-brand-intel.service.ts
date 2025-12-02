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
    domain?: string
  ): Promise<LLMBrandIntelResult> {
    if (!this.cerebrasApiKey) {
      console.warn('⚠️ Cerebras API key not configured, skipping LLM generation');
      return {};
    }


    const systemPrompt = `You are a brand intelligence researcher. Given a brand name OR a URL:

Identify the brand, canonical homepage URL, short neutral summary (max 4 sentences).

Extract CEO, headquarters city+country, founded year (if public).

List top 5 competitors (global first, dedupe subsidiaries).

Assign an industry/vertical (1–3 words).

IMPORTANT: You must respond with a valid JSON object containing these exact fields:
{
  "brandName": "string",
  "homepageUrl": "string (full URL with https://)",
  "summary": "string (max 4 sentences)",
  "ceo": "string or null",
  "headquarters": "string (city, country)",
  "foundedYear": number or null,
  "industry": "string (1-3 words)",
  "competitors": ["string1", "string2", "string3", "string4", "string5"]
}

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

      // Log the raw content for debugging (truncated if too long)
      const contentPreview = content.length > 500 ? content.substring(0, 500) + '...' : content;
      console.log('🔍 LLM response content preview:', contentPreview);

      // Try to extract JSON more robustly
      let jsonString = '';
      
      // Method 1: Try to find JSON object with balanced braces
      const firstBrace = content.indexOf('{');
      if (firstBrace === -1) {
        console.warn('⚠️ No JSON object found in LLM response (no opening brace)');
        return {};
      }

      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = firstBrace; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
        } else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd === -1) {
        console.warn('⚠️ No valid JSON object found in LLM response (unbalanced braces)');
        // Fallback: try the old regex method
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        }
      } else {
        jsonString = content.substring(firstBrace, jsonEnd);
      }

      if (!jsonString) {
        console.warn('⚠️ Could not extract JSON from LLM response');
        console.log('Full response:', content);
        return {};
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonString);
        console.log('✅ Parsed brand intel JSON:', parsed);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('Attempted to parse:', jsonString.substring(0, 200) + '...');
        // Try to clean up common issues
        try {
          // Remove trailing commas and other common issues
          const cleaned = jsonString
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
          parsed = JSON.parse(cleaned);
          console.log('✅ Parsed brand intel JSON after cleanup:', parsed);
        } catch (cleanupError) {
          console.error('❌ JSON parse failed even after cleanup:', cleanupError);
          return {};
        }
      }

      return {
        summary: parsed.summary || parsed.description || undefined,
        industry: parsed.industry || parsed.sector || parsed.vertical || undefined,
        headquarters: parsed.headquarters || parsed.location || parsed.hq || undefined,
        foundedYear: parsed.foundedYear || parsed.founded || parsed.year_founded || null,
        ceo: parsed.ceo || parsed.ceo_name || undefined,
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        homepageUrl: parsed.homepageUrl || parsed.homepage || parsed.url || undefined,
      };
    } catch (error) {
      console.error('❌ LLM brand intelligence generation failed:', error);
      return {};
    }
  }
}

export const llmBrandIntelService = new LLMBrandIntelService();

