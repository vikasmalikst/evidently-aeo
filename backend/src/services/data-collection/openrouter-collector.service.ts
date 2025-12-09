/**
 * OpenRouter Collector Service
 * Provides a lightweight wrapper around openrouter.ai chat completions.
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

loadEnvironment();

export type OpenRouterRole = 'system' | 'user' | 'assistant';

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
}

export interface OpenRouterQueryRequest {
  prompt?: string;
  messages?: OpenRouterMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
  enableWebSearch?: boolean;
  collectorType?: string;
}

export interface OpenRouterQueryResponse {
  query_id: string;
  run_start: string;
  run_end: string;
  prompt: string;
  response: string;
  model_used: string;
  collector_type: string;
  citations?: string[];
  urls?: string[];
  metadata?: Record<string, unknown>;
}

export class OpenRouterCollectorService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultSystemPrompt: string;
  private readonly referer: string;
  private readonly appName: string;
  private readonly collectorConfigs: Record<string, {
    model: string;
    systemPrompt?: string;
    enableWebSearch?: boolean;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }>;

  constructor() {
    this.apiKey = getEnvVar('OPENROUTER_API_KEY');
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.defaultModel = 'anthropic/claude-3.5-haiku';
    this.defaultSystemPrompt = 'You are a helpful and precise research assistant.';
    this.referer = getEnvVar('OPENROUTER_SITE_URL', 'https://answerintel.local');
    this.appName = getEnvVar('OPENROUTER_APP_NAME', 'AnswerIntel Collector');
    this.collectorConfigs = {
      claude: {
        model: 'anthropic/claude-haiku-4.5:online',
        systemPrompt: 'You are Claude, a precise research assistant. Provide factual, well-structured answers with bullet points where useful. When you receive a question, first gather fresh evidence using web search, cite the sources you rely on, and then deliver a concise, well-structured answer.',
        enableWebSearch: true,
        maxTokens: 1024,
        temperature: 0.7,
        topP: 0.9
      },
      deepseek: {
        model: 'deepseek/deepseek-r1',
        systemPrompt: 'You are DeepSeek, a precise and thoughtful AI research assistant. When you receive a question, first gather fresh evidence using web search, cite the sources you rely on, and then deliver a concise, well-structured answer.',
        enableWebSearch: true,
        maxTokens: 1024,
        temperature: 0.7,
        topP: 0.9
      }
    };

    const hasApiKey = Boolean(this.apiKey);
  }

  async executeQuery(request: OpenRouterQueryRequest): Promise<OpenRouterQueryResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in your environment.');
    }

    if (!request.prompt && (!request.messages || request.messages.length === 0)) {
      throw new Error('OpenRouter request requires either a prompt or a messages array.');
    }

    const resolvedConfig = this.resolveConfig(request);

    const queryId = `openrouter_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startTime = new Date().toISOString();

    let messages: OpenRouterMessage[];

    if (request.messages && request.messages.length > 0) {
      messages = [...request.messages];
      if (request.systemPrompt) {
        messages = [{ role: 'system', content: request.systemPrompt }, ...messages];
      } else if (!messages.some(msg => msg.role === 'system') && resolvedConfig.systemPrompt) {
        messages = [{ role: 'system', content: resolvedConfig.systemPrompt }, ...messages];
      }
    } else {
      messages = [];
      messages.push({
        role: 'system',
        content: request.systemPrompt || resolvedConfig.systemPrompt || this.defaultSystemPrompt
      });
      messages.push({
        role: 'user',
        content: request.prompt || ''
      });
    }

    const body: Record<string, unknown> = {
      model: resolvedConfig.model,
      messages,
    };

    if (resolvedConfig.temperature !== undefined) {
      body.temperature = resolvedConfig.temperature;
    }

    if (resolvedConfig.maxTokens !== undefined) {
      body.max_tokens = resolvedConfig.maxTokens;
    }

    if (resolvedConfig.topP !== undefined) {
      body.top_p = resolvedConfig.topP;
    }

    // Always include tools for Claude (with web search)
    const collectorType = request.collectorType || 'openrouter';
    if (collectorType === 'claude') {
      body.tools = [
        {
          type: 'web_search_20250305',
          name: 'web_search'
        }
      ];
    } else if (resolvedConfig.enableWebSearch) {
      // For other collectors, conditionally add tools if enableWebSearch is true
      body.tools = [
        {
          type: 'web_search_20250305',
          name: 'web_search'
        }
      ];
    }
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.referer,
        'X-Title': this.appName
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as any;
    const messageContent = result?.choices?.[0]?.message?.content;
    const answer = typeof messageContent === 'string'
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent.map((part: any) => part?.text || '').join('\n')
        : 'No response from OpenRouter model';

    const endTime = new Date().toISOString();
    const usage = result?.usage || {};
    return {
      query_id: queryId,
      run_start: startTime,
      run_end: endTime,
      prompt: request.prompt || '',
      response: answer,
      model_used: result?.model || (body.model as string),
      collector_type: collectorType,
      citations: [],
      urls: [],
      metadata: {
        provider: 'openrouter',
        model: result?.model || body.model,
        usage,
        messages_count: messages.length,
        enable_web_search: resolvedConfig.enableWebSearch ?? false
      }
    };
  }

  private resolveConfig(request: OpenRouterQueryRequest): {
    model: string;
    systemPrompt?: string;
    enableWebSearch?: boolean;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } {
    const collectorType = request.collectorType;
    if (!collectorType) {
      throw new Error('OpenRouter collectorType is required when using hardcoded configurations.');
    }

    const baseConfig = this.collectorConfigs[collectorType];
    if (!baseConfig) {
      throw new Error(`OpenRouter configuration not found for collector type: ${collectorType}`);
    }

    return {
      model: request.model || baseConfig.model,
      systemPrompt: request.systemPrompt || baseConfig.systemPrompt,
      enableWebSearch: request.enableWebSearch ?? baseConfig.enableWebSearch ?? false,
      maxTokens: request.maxTokens ?? baseConfig.maxTokens ?? 1024,
      temperature: request.temperature ?? baseConfig.temperature ?? 0.7,
      topP: request.topP ?? baseConfig.topP
    };
  }
}

export const openRouterCollectorService = new OpenRouterCollectorService();
