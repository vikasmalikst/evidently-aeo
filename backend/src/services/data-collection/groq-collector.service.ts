/**
 * Groq Collector Service
 * Provides a wrapper around Groq SDK for chat completions.
 */

import { Groq } from 'groq-sdk';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

loadEnvironment();

export interface GroqQueryRequest {
  prompt?: string;
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
  collectorType?: string;
}

export interface GroqQueryResponse {
  query_id: string;
  run_start: string;
  run_end: string;
  prompt: string;
  response: string;
  answer: string;
  model_used: string;
  collector_type: string;
  citations?: string[];
  urls?: string[];
  metadata?: Record<string, unknown>;
}

export class GroqCollectorService {
  private groq: Groq | null = null;
  private readonly defaultModel: string;
  private readonly defaultSystemPrompt: string;
  private readonly collectorConfigs: Record<string, {
    model: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }>;

  constructor() {
    let hasApiKey = false;
    try {
      const apiKey = getEnvVar('GROQ_API_KEY');
      if (apiKey && apiKey.trim()) {
        const trimmedKey = apiKey.trim();
        this.groq = new Groq({ apiKey: trimmedKey });
        hasApiKey = true;
        // Log first few characters for debugging (without exposing full key)
      } else {
      }
    } catch (error: any) {
      // API key not set, but don't throw in constructor
      // Will throw when executeQuery is called
      hasApiKey = false;
    }
    
    this.defaultModel = 'openai/gpt-oss-20b';
    this.defaultSystemPrompt = 'You are a helpful and precise research assistant.';
    
    this.collectorConfigs = {
      chatgpt: {
        model: 'openai/gpt-oss-20b',
        systemPrompt: 'You are a helpful and precise research assistant. Provide factual, well-structured answers with bullet points where useful.',
        maxTokens: 8192,
        temperature: 1,
        topP: 1
      }
    };
  }

  async executeQuery(request: GroqQueryRequest): Promise<GroqQueryResponse> {
    if (!this.groq) {
      try {
        const apiKey = getEnvVar('GROQ_API_KEY');
        // Trim whitespace and validate API key format
        const trimmedKey = apiKey?.trim();
        if (!trimmedKey) {
          throw new Error('GROQ_API_KEY is empty or not set');
        }
        // Log first few characters for debugging (without exposing full key)
        this.groq = new Groq({ apiKey: trimmedKey });
      } catch (error: any) {
        console.error('❌ Failed to initialize Groq client:', error.message);
        throw new Error(`Groq API key not configured: ${error.message}`);
      }
    }

    if (!request.prompt && (!request.messages || request.messages.length === 0)) {
      throw new Error('Groq request requires either a prompt or a messages array.');
    }

    const resolvedConfig = this.resolveConfig(request);
    const queryId = `groq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startTime = new Date().toISOString();

    let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

    if (request.messages && request.messages.length > 0) {
      messages = [...request.messages];
      if (request.systemPrompt) {
        messages = [{ role: 'system', content: request.systemPrompt }, ...messages];
      } else if (!messages.some(msg => msg.role === 'system') && resolvedConfig.systemPrompt) {
        messages = [{ role: 'system', content: resolvedConfig.systemPrompt }, ...messages];
      }
    } else {
      messages = [];
      if (request.systemPrompt || resolvedConfig.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt || resolvedConfig.systemPrompt || this.defaultSystemPrompt
        });
      }
      messages.push({
        role: 'user',
        content: request.prompt || ''
      });
    }

    const chatCompletionParams: any = {
      messages: messages,
      model: resolvedConfig.model,
      temperature: resolvedConfig.temperature ?? 1,
      max_completion_tokens: resolvedConfig.maxTokens ?? 8192,
      top_p: resolvedConfig.topP ?? 1,
      stream: false
    };
    try {
      const chatCompletion = await this.groq.chat.completions.create(chatCompletionParams);
      
      const messageContent = chatCompletion?.choices?.[0]?.message?.content;
      const answer = messageContent || 'No response from Groq model';
      
      const endTime = new Date().toISOString();
      const usage = chatCompletion?.usage as { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number } | undefined;

      const tokensUsed = usage?.total_tokens ?? ((usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0));
      return {
        query_id: queryId,
        run_start: startTime,
        run_end: endTime,
        prompt: request.prompt || '',
        response: answer,
        answer: answer,
        model_used: chatCompletion?.model || chatCompletionParams.model,
        collector_type: request.collectorType || 'chatgpt',
        citations: [],
        urls: [],
        metadata: {
          provider: 'groq',
          model: chatCompletion?.model || chatCompletionParams.model,
          usage,
          messages_count: messages.length,
          finish_reason: chatCompletion?.choices?.[0]?.finish_reason
        }
      };
    } catch (error: any) {
      console.error('❌ Groq API Error:', {
        error: error.message,
        status: error.status,
        query_id: queryId
      });
      throw new Error(`Groq API error: ${error.message || 'Unknown error'}`);
    }
  }

  private resolveConfig(request: GroqQueryRequest): {
    model: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } {
    const collectorType = request.collectorType || 'chatgpt';
    const baseConfig = this.collectorConfigs[collectorType] || this.collectorConfigs['chatgpt'];

    return {
      model: request.model || baseConfig.model,
      systemPrompt: request.systemPrompt || baseConfig.systemPrompt,
      maxTokens: request.maxTokens ?? baseConfig.maxTokens ?? 8192,
      temperature: request.temperature ?? baseConfig.temperature ?? 1,
      topP: request.topP ?? baseConfig.topP ?? 1
    };
  }
}

export const groqCollectorService = new GroqCollectorService();

