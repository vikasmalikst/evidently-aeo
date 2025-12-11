import axios from 'axios';
import type { LLMBrandIntelResult } from '../types';

/**
 * Service for generating brand intelligence using LLM (Cerebras)
 */
export class LLMBrandIntelService {
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel =
    process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
  private openRouterApiKey = process.env['OPENROUTER_API_KEY'];
  private openRouterModel =
    "openai/gpt-oss-20b";
  private openRouterSiteUrl = process.env['OPENROUTER_SITE_URL'];
  private openRouterSiteTitle = process.env['OPENROUTER_SITE_TITLE'];

  async generateBrandIntel(
    rawInput: string,
    companyName: string,
    domain?: string
  ): Promise<LLMBrandIntelResult> {
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

Return JSON strictly matching the BrandIntel schema.  Input was: ${rawInput}.`;

    console.log('📝 Brand intel prompt (system+user) preview:', this.previewForLog(systemPrompt), '|| user:', `Analyze this brand: ${rawInput}`);

    let lastError: unknown;

    // Primary: OpenRouter Parasail
    if (this.openRouterApiKey) {
      try {
        const content = await this.generateWithOpenRouter(systemPrompt, rawInput);
        const parsed = this.parseBrandIntel(content);
        if (parsed) return parsed;
        console.warn('⚠️ OpenRouter returned no usable JSON, trying Cerebras fallback if available.');
      } catch (error) {
        this.logProviderError('OpenRouter', error);
        console.error('❌ OpenRouter brand intel generation failed, trying Cerebras fallback if available:', error);
        lastError = error;
      }
    } else {
      console.warn('⚠️ OPENROUTER_API_KEY not configured. Skipping primary provider.');
    }

    // Fallback: Cerebras
    if (this.cerebrasApiKey) {
      try {
        const content = await this.generateWithCerebras(systemPrompt, rawInput);
        const parsed = this.parseBrandIntel(content);
        if (parsed) return parsed;
        console.warn('⚠️ Cerebras returned no usable JSON.');
      } catch (error) {
        this.logProviderError('Cerebras', error);
        console.error('❌ Cerebras brand intel generation failed:', error);
        lastError = lastError || error;
      }
    } else {
      console.warn('⚠️ CEREBRAS_API_KEY not configured. No fallback available.');
    }

    if (lastError) {
      console.error('❌ LLM brand intel generation exhausted all providers:', lastError);
    }
    return {};
  }

  private async generateWithCerebras(systemPrompt: string, rawInput: string): Promise<string> {
    console.log('🚀 Calling Cerebras for brand intel with model:', this.cerebrasModel);

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
      throw new Error('No content in Cerebras response');
    }
    console.log('🔍 Cerebras response preview:', this.previewForLog(content));
    return content;
  }

  private async generateWithOpenRouter(systemPrompt: string, rawInput: string): Promise<string> {
    console.log('🌐 Calling OpenRouter (parasail) for brand intel with model:', this.openRouterModel);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.openRouterApiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.openRouterSiteUrl) {
      headers['HTTP-Referer'] = this.openRouterSiteUrl;
    }
    if (this.openRouterSiteTitle) {
      headers['X-Title'] = this.openRouterSiteTitle;
    }

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: this.openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this brand: ${rawInput}` }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        reasoning: { enabled: true },
        provider: { sort: 'throughput' }
      },
      {
        headers,
        timeout: 30000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new Error('No content in OpenRouter response');
    }
    console.log('🔍 OpenRouter response preview:', this.previewForLog(content));
    return content;
  }

  private parseBrandIntel(content: string): LLMBrandIntelResult | null {
    // Try to extract JSON more robustly
    let jsonString = '';

    // Method 1: Try to find JSON object with balanced braces
    const firstBrace = content.indexOf('{');
    if (firstBrace === -1) {
      console.warn('⚠️ No JSON object found in LLM response (no opening brace)');
      return null;
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
      return null;
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
        return null;
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
  }

  private previewForLog(text: string, max: number = 800): string {
    return text.length > max ? `${text.substring(0, max)}...` : text;
  }

  private logProviderError(provider: 'OpenRouter' | 'Cerebras', error: unknown) {
    if (typeof error !== 'object' || error === null) {
      console.error(`❌ ${provider} error (non-object):`, error);
      return;
    }

    // Axios-style error shape
    const anyErr = error as any;
    const status = anyErr?.response?.status;
    const statusText = anyErr?.response?.statusText;
    const errBody = anyErr?.response?.data?.error;
    const message = anyErr?.message;

    console.error(`❌ ${provider} API error`, {
      status,
      statusText,
      message,
      error: errBody,
    });
  }
}

export const llmBrandIntelService = new LLMBrandIntelService();

