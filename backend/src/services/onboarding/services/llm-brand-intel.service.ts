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
    "qwen/qwen3-235b-a22b-instruct-2507";
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

    const userMessage = `Analyze this brand: ${rawInput}`;

    // Log the full prompt being sent to LLM
    console.log('📝 [BRAND-INTEL] Full prompt being sent to LLM:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔹 System Prompt:');
    console.log(systemPrompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔹 User Message:');
    console.log(userMessage);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Input Parameters:');
    console.log(JSON.stringify({ rawInput, companyName, domain }, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let lastError: unknown;

    // Primary: OpenRouter Parasail
    if (this.openRouterApiKey) {
      try {
        const content = await this.generateWithOpenRouter(systemPrompt, userMessage);
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
        const content = await this.generateWithCerebras(systemPrompt, userMessage);
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

  private async generateWithCerebras(systemPrompt: string, userMessage: string): Promise<string> {
    console.log('🚀 [BRAND-INTEL] Calling Cerebras for brand intel with model:', this.cerebrasModel);
    console.log('📤 [BRAND-INTEL] Cerebras Request Payload:');
    console.log(JSON.stringify({
      model: this.cerebrasModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }, null, 2));

    const response = await axios.post<any>(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        model: this.cerebrasModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 2000,
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
      throw new Error('No content in Cerebras response');
    }
    console.log('🔍 Cerebras response preview:', this.previewForLog(content));
    return content;
  }

  private async generateWithOpenRouter(systemPrompt: string, userMessage: string): Promise<string> {
    console.log('🌐 [BRAND-INTEL] Calling OpenRouter for brand intel with model:', this.openRouterModel);

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

    const requestPayload = {
      model: this.openRouterModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    };

    console.log('📤 [BRAND-INTEL] OpenRouter Request Payload:');
    console.log(JSON.stringify(requestPayload, null, 2));
    console.log('📤 [BRAND-INTEL] OpenRouter Request Headers (excluding Authorization):');
    console.log(JSON.stringify({ ...headers, Authorization: '***REDACTED***' }, null, 2));

    const response = await axios.post<any>(
      'https://openrouter.ai/api/v1/chat/completions',
      requestPayload,
      {
        headers,
        timeout: 60000,
      }
    );

    // Handle different response structures (including reasoning responses)
    const message = response.data?.choices?.[0]?.message;
    let content = '';
    
    if (typeof message?.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message?.content)) {
      // Handle array content (e.g., from reasoning responses)
      content = message.content
        .map((part: any) => part?.text || part?.content || '')
        .join('\n');
    } else if (message?.content) {
      content = String(message.content);
    }
    
    if (!content.trim()) {
      console.error('❌ OpenRouter response structure:', JSON.stringify(response.data, null, 2));
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

