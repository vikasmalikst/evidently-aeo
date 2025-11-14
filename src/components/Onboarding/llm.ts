/**
 * LLM Service for Brand Intelligence Generation
 * 
 * This file provides a provider-agnostic interface for generating brand intelligence
 * using Cerebras and ChatGPT (with web search) providers.
 */

import { BrandIntel, LLMProvider, LLMConfig } from '../types';
import { LLM_SYSTEM_PROMPT } from '../constants';

// Base LLM provider interface
interface LLMProviderInterface {
  generateBrandIntel(rawInput: string): Promise<BrandIntel>;
}

// OpenAI Provider Implementation
class OpenAIProvider implements LLMProviderInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateBrandIntel(rawInput: string): Promise<BrandIntel> {
    const systemPrompt = LLM_SYSTEM_PROMPT.replace('{rawInput}', rawInput);
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this brand: ${rawInput}` }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      return this.parseBrandIntelResponse(content, rawInput);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate brand intelligence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseBrandIntelResponse(content: string, rawInput: string): BrandIntel {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      console.log('🔍 LLM Response Parsing - Raw parsed data:', parsed);
      
      // Validate and normalize the response with better field mapping
      const brandName = parsed.brandName || parsed.brand || rawInput;
      
      const result = {
        input: { raw: rawInput },
        brandName: brandName,
        homepageUrl: parsed.homepageUrl || parsed.website || parsed.url || `https://www.${brandName.toLowerCase().replace(/\s+/g, '')}.com`,
        summary: parsed.summary || parsed.description || `Information about ${brandName}`,
        ceo: parsed.ceo || parsed.ceo_name || undefined,
        headquarters: parsed.headquarters || parsed.location || parsed.hq || undefined,
        foundedYear: parsed.foundedYear || parsed.founded || parsed.year_founded || null,
        industry: parsed.industry || parsed.sector || parsed.vertical || undefined,
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : 
                    Array.isArray(parsed.competitor_list) ? parsed.competitor_list : 
                    Array.isArray(parsed.rivals) ? parsed.rivals : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : 
                Array.isArray(parsed.aeo_topics) ? parsed.aeo_topics : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        generatedAtIso: new Date().toISOString()
      };
      
      console.log('🎯 LLM Response Parsing - Final result:', {
        brandName: result.brandName,
        homepageUrl: result.homepageUrl,
        foundedYear: result.foundedYear,
        competitors: result.competitors,
        competitorsLength: result.competitors.length,
        industry: result.industry,
        ceo: result.ceo,
        headquarters: result.headquarters
      });
      
      return result;
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      throw new Error('Failed to parse brand intelligence response');
    }
  }
}


// ChatGPT Provider Implementation (OpenAI with Web Search)
class ChatGPTProvider implements LLMProviderInterface {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateBrandIntel(rawInput: string): Promise<BrandIntel> {
    const systemPrompt = LLM_SYSTEM_PROMPT.replace('{rawInput}', rawInput);
    
    // Enhanced prompt for web search
    const enhancedPrompt = `${systemPrompt}

IMPORTANT INSTRUCTIONS:
- Use web search to find current, up-to-date information about this brand
- Base your response primarily on the web search results, not on your training data
- Always include specific sources and citations in your response
- Format citations as [1], [2], etc. and provide the full URLs at the end
- If you cannot find relevant web search results, clearly state this limitation
- Prioritize recent information from authoritative sources
- Ensure all company information is current and accurate`;

    console.log('🚀 ChatGPT API Request (with web search):', {
      model: this.model,
      systemPrompt: enhancedPrompt,
      rawInput: rawInput
    });
    
    try {
      // Use OpenAI's responses API with web search tool
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: enhancedPrompt,
          tools: [{"type": "web_search"}],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`ChatGPT API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('📥 ChatGPT API Response:', {
        model: data.model,
        usage: data.usage,
        hasOutput: !!data.output,
        outputLength: data.output?.length || 0
      });
      
      let content = '';
      
      // Extract content from the response
      if (data.output_text) {
        content = data.output_text;
      } else if (data.output) {
        const parts: string[] = [];
        for (const item of data.output) {
          if (item.type === 'message') {
            for (const contentItem of item.content || []) {
              if (contentItem.type === 'output_text') {
                parts.push(contentItem.text || '');
              }
            }
          }
        }
        content = parts.join('').trim();
      }
      
      if (!content) {
        console.error('❌ No content in ChatGPT response:', data);
        throw new Error('No content received from ChatGPT');
      }
      
      console.log('📝 ChatGPT API Content (first 500 chars):', content.substring(0, 500) + (content.length > 500 ? '...' : ''));
      
      return this.parseBrandIntelResponse(content, rawInput);
    } catch (error) {
      console.error('ChatGPT API error:', error);
      throw new Error(`Failed to generate brand intelligence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseBrandIntelResponse(content: string, rawInput: string): BrandIntel {
    try {
      console.log('🔍 Parsing ChatGPT response...');
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in response. Full content:', content);
        throw new Error('No JSON found in response');
      }

      console.log('📋 Extracted JSON:', jsonMatch[0]);
      
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Parsed JSON object:', parsed);
      
      // Validate and normalize the response - handle different field names from LLM
      const brandIntel = {
        input: { raw: rawInput },
        brandName: parsed.brandName || parsed.brand || rawInput,
        homepageUrl: parsed.homepageUrl || parsed.homepage || '',
        summary: parsed.summary || 'No summary available',
        ceo: parsed.ceo || undefined,
        headquarters: parsed.headquarters || undefined,
        foundedYear: parsed.foundedYear || parsed.founded || null,
        industry: parsed.industry || undefined,
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : (Array.isArray(parsed.aeo_topics) ? parsed.aeo_topics : []),
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        generatedAtIso: new Date().toISOString()
      };
      
      console.log('🎯 Final BrandIntel object:', brandIntel);
      
      return brandIntel;
    } catch (error) {
      console.error('❌ Error parsing ChatGPT response:', error);
      console.error('📄 Raw content that failed to parse:', content);
      throw new Error('Failed to parse brand intelligence response');
    }
  }
}

// Cerebras Provider Implementation
class CerebrasProvider implements LLMProviderInterface {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.cerebras.ai') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateBrandIntel(rawInput: string): Promise<BrandIntel> {
    const systemPrompt = LLM_SYSTEM_PROMPT.replace('{rawInput}', rawInput);
    
    // Log the request details
    const requestPayload = {
      model: 'qwen-3-235b-a22b-instruct-2507',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this brand: ${rawInput}` }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    };
    
    console.log('🚀 Cerebras API Request:', {
      url: `${this.baseUrl}/v1/chat/completions`,
      model: requestPayload.model,
      temperature: requestPayload.temperature,
      max_tokens: requestPayload.max_tokens,
      systemPrompt: systemPrompt,
      userMessage: `Analyze this brand: ${rawInput}`,
      rawInput: rawInput
    });
    
    try {
      // Cerebras API uses a different endpoint structure
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        console.error('❌ Cerebras API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Log the full response
      console.log('📥 Cerebras API Response:', {
        id: data.id,
        model: data.model,
        usage: data.usage,
        choices: data.choices?.length || 0,
        finishReason: data.choices?.[0]?.finish_reason,
        contentLength: data.choices?.[0]?.message?.content?.length || 0
      });
      
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        console.error('❌ No content in Cerebras response:', data);
        throw new Error('No content received from Cerebras');
      }
      
      // Log the actual content (truncated for readability)
      console.log('📝 Cerebras API Content (first 500 chars):', content.substring(0, 500) + (content.length > 500 ? '...' : ''));

      return this.parseBrandIntelResponse(content, rawInput);
    } catch (error) {
      console.error('Cerebras API error:', error);
      throw new Error(`Failed to generate brand intelligence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseBrandIntelResponse(content: string, rawInput: string): BrandIntel {
    try {
      console.log('🔍 Parsing Cerebras response...');
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in response. Full content:', content);
        throw new Error('No JSON found in response');
      }

      console.log('📋 Extracted JSON:', jsonMatch[0]);
      
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Parsed JSON object:', parsed);
      
      // Validate and normalize the response - handle different field names from LLM
      const brandIntel = {
        input: { raw: rawInput },
        brandName: parsed.brandName || parsed.brand || rawInput,
        homepageUrl: parsed.homepageUrl || parsed.homepage || '',
        summary: parsed.summary || 'No summary available',
        ceo: parsed.ceo || undefined,
        headquarters: parsed.headquarters || undefined,
        foundedYear: parsed.foundedYear || parsed.founded || null,
        industry: parsed.industry || undefined,
        competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : (Array.isArray(parsed.aeo_topics) ? parsed.aeo_topics : []),
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        generatedAtIso: new Date().toISOString()
      };
      
      console.log('🎯 Final BrandIntel object:', brandIntel);
      
      return brandIntel;
    } catch (error) {
      console.error('❌ Error parsing Cerebras response:', error);
      console.error('📄 Raw content that failed to parse:', content);
      throw new Error('Failed to parse brand intelligence response');
    }
  }
}


// Main LLM Service Class
export class LLMService {
  private provider: LLMProviderInterface;

  constructor(config: LLMConfig) {
    this.provider = this.createProvider(config);
  }

  private createProvider(config: LLMConfig): LLMProviderInterface {
    // Normalize "openai" to "chatgpt" for backwards compatibility
    const normalizedProvider = config.provider.toLowerCase() === 'openai' ? 'chatgpt' : config.provider;
    
    switch (normalizedProvider) {
      case 'chatgpt':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required for ChatGPT');
        }
        return new ChatGPTProvider(config.apiKey, config.model);
      
      case 'cerebras':
        if (!config.apiKey) {
          throw new Error('Cerebras API key is required');
        }
        return new CerebrasProvider(config.apiKey, config.baseUrl);
      
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}. Supported providers: cerebras, chatgpt`);
    }
  }

  async generateBrandIntel(rawInput: string): Promise<BrandIntel> {
    try {
      return await this.provider.generateBrandIntel(rawInput);
    } catch (error) {
      console.error('LLM Service error:', error);
      throw error;
    }
  }
}

// Factory function to create LLM service with Cerebras configuration
export function createLLMServiceFromEnv(): LLMService {
  // Use Vite's import.meta.env for frontend environment variables
  // Normalize "openai" to "chatgpt" for backwards compatibility
  let provider = ((import.meta as any).env?.VITE_LLM_PROVIDER || 'cerebras') as string;
  if (provider.toLowerCase() === 'openai') {
    provider = 'chatgpt';
  }
  const normalizedProvider = provider as LLMProvider;
  
  console.log('🔧 LLM Service - Creating service with provider:', normalizedProvider);
  console.log('🔧 Environment variables:', {
    VITE_LLM_PROVIDER: (import.meta as any).env?.VITE_LLM_PROVIDER,
    normalizedProvider: normalizedProvider,
    VITE_OPENAI_API_KEY: (import.meta as any).env?.VITE_OPENAI_API_KEY ? 'SET' : 'NOT SET',
    VITE_CEREBRAS_API_KEY: (import.meta as any).env?.VITE_CEREBRAS_API_KEY ? 'SET' : 'NOT SET'
  });
  
  switch (normalizedProvider) {
    case 'chatgpt':
      const openaiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error('OpenAI API key is required for ChatGPT provider. Please set VITE_OPENAI_API_KEY in your environment variables.');
      }
      return new LLMService({
        provider: 'chatgpt',
        apiKey: openaiKey,
        model: (import.meta as any).env?.VITE_OPENAI_MODEL || 'gpt-4o-mini'
      });
      
    case 'cerebras':
      const cerebrasKey = (import.meta as any).env?.VITE_CEREBRAS_API_KEY;
      if (!cerebrasKey) {
        throw new Error('Cerebras API key is required for Cerebras provider. Please set VITE_CEREBRAS_API_KEY in your environment variables.');
      }
      return new LLMService({
        provider: 'cerebras',
        apiKey: cerebrasKey,
        model: (import.meta as any).env?.VITE_CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507',
        baseUrl: (import.meta as any).env?.VITE_CEREBRAS_BASE_URL || 'https://api.cerebras.ai'
      });
      
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Supported providers are: cerebras, chatgpt`);
  }
}

// Default export for easy importing
export default LLMService;
