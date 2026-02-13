/**
 * OpenRouter Collector Service
 * Provides a lightweight wrapper around openrouter.ai chat completions.
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { mcpSearchService } from './mcp-search.service';

loadEnvironment();

export type OpenRouterRole = 'system' | 'user' | 'assistant' | 'tool';

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
  tool_call_id?: string;
  name?: string;
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
  enableToolLoop?: boolean; // NEW: Enable autonomous tool-calling loop
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
  toolCallsExecuted?: number; // NEW: Track autonomous tool calls
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
      },
      content: {
        model: 'openai/gpt-oss-20b',
        systemPrompt: 'You are a senior content strategist. Write clear, brand-safe marketing content that is factual, structured, and ready to ship. Do not use web search unless explicitly requested.',
        enableWebSearch: false,
        maxTokens: 10000,
        temperature: 0.6,
        topP: 0.9
      }
    };

    const hasApiKey = Boolean(this.apiKey);
  }

  /**
   * NEW: Execute query with autonomous tool-calling loop
   * Mirrors the GroqCompoundService logic for Active Grounding
   */
  async executeQueryWithTools(request: OpenRouterQueryRequest): Promise<OpenRouterQueryResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in your environment.');
    }

    if (!request.prompt && (!request.messages || request.messages.length === 0)) {
      throw new Error('OpenRouter request requires either a prompt or a messages array.');
    }

    const resolvedConfig = this.resolveConfig(request);
    const queryId = `openrouter_tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startTime = new Date().toISOString();

    // Build initial messages
    let messages: any[];
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

    // Define web search tool (OpenAI function calling format)
    const tools = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for real-time information, facts, or data gaps. Returns a list of relevant snippets.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              }
            },
            required: ['query']
          }
        }
      }
    ];

    console.log(`🚀 [OpenRouterCollectorService] Starting tool loop with ${resolvedConfig.model}`);

    let iterations = 0;
    const maxIterations = 5; // Reduced for regeneration speed
    let toolCallsExecuted = 0;
    let lastContent = '';

    while (iterations < maxIterations) {
      iterations++;

      const body: Record<string, unknown> = {
        model: resolvedConfig.model,
        messages,
        tools,
        temperature: resolvedConfig.temperature,
        max_tokens: resolvedConfig.maxTokens,
        top_p: resolvedConfig.topP
      };

      console.log(`🌐 [OpenRouterCollectorService] Tool loop iteration ${iterations}/${maxIterations}`);

      try {
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

        if (!result?.choices?.[0]) {
          console.error('❌ OpenRouter response structure:', JSON.stringify(result, null, 2));
          throw new Error(`Invalid OpenRouter response: no choices found.`);
        }

        const message = result.choices[0].message;
        const finishReason = result.choices[0].finish_reason;

        // Debug: Log message structure
        console.log(`🔍 [OpenRouterCollectorService] Iteration ${iterations} - Finish reason: ${finishReason}, Has tool_calls: ${!!message.tool_calls}, Has content: ${!!message.content}`);

        // Check for tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log(`🔎 [OpenRouterCollectorService] LLM requested ${message.tool_calls.length} tool(s)`);

          // Add assistant message with tool calls to history
          messages.push(message);

          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function?.name || toolCall.name;
            let args: any = {};

            try {
              args = JSON.parse(toolCall.function?.arguments || toolCall.arguments || '{}');
            } catch (e) {
              console.warn('⚠️ Failed to parse tool arguments:', toolCall);
            }

            let toolResult = 'Tool not found';

            if (functionName === 'web_search') {
              const query = args.query || args.q || '';
              console.log(`🌐 [OpenRouterCollectorService] Executing MCP Search: "${query}"`);
              try {
                const searchRes = await mcpSearchService.quickSearch(query, 3);
                toolResult = mcpSearchService.formatContext(searchRes);
                toolCallsExecuted++;
              } catch (err: any) {
                console.warn(`⚠️ MCP Search failed: ${err.message}`);
                toolResult = `Search failed: ${err.message}`;
              }
            }

            // Add tool response to messages
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: toolResult
            });
          }

          // Continue loop to get next LLM response
          continue;
        }

        // No tool calls - extract final content
        let content = message.content || '';

        if (typeof content !== 'string') {
          if (Array.isArray(content)) {
            content = content
              .map((part: any) => {
                if (typeof part === 'string') return part;
                if (part?.text) return part.text;
                if (part?.content) return part.content;
                return '';
              })
              .filter(Boolean)
              .join('\n');
          } else {
            content = String(content);
          }
        }

        lastContent = content;

        // Check if we have valid content
        if (content && content.trim().length > 0) {
          console.log(`✅ [OpenRouterCollectorService] Tool loop completed in ${iterations} iterations (${toolCallsExecuted} tool calls)`);
          console.log(`📝 [OpenRouterCollectorService] Final content length: ${content.length} chars`);

          const endTime = new Date().toISOString();
          return {
            query_id: queryId,
            run_start: startTime,
            run_end: endTime,
            prompt: request.prompt || '',
            response: content,
            model_used: result?.model || resolvedConfig.model,
            collector_type: request.collectorType || 'openrouter',
            citations: [],
            urls: [],
            metadata: {
              provider: 'openrouter',
              model: result?.model || resolvedConfig.model,
              usage: result?.usage || {},
              iterations,
              toolCallsExecuted
            },
            toolCallsExecuted
          };
        }

        // Empty content but not first iteration - might be mid-loop
        console.warn(`⚠️ [OpenRouterCollectorService] Iteration ${iterations} returned empty content, continuing loop...`);
        if (iterations === 1) {
          throw new Error('OpenRouter returned empty content on first iteration');
        }

      } catch (err: any) {
        console.error(`❌ [OpenRouterCollectorService] Error in iteration ${iterations}:`, err.message);

        // If we're past iteration 3 and have errors, bail out
        if (iterations >= 3) {
          throw err;
        }

        // Otherwise try to continue
        continue;
      }
    }

    // Max iterations reached - return best effort
    console.warn(`⚠️ [OpenRouterCollectorService] Max iterations (${maxIterations}) reached. Returning best-effort content.`);

    const endTime = new Date().toISOString();
    return {
      query_id: queryId,
      run_start: startTime,
      run_end: endTime,
      prompt: request.prompt || '',
      response: lastContent || 'Max iterations reached without final content',
      model_used: resolvedConfig.model,
      collector_type: request.collectorType || 'openrouter',
      citations: [],
      urls: [],
      metadata: {
        provider: 'openrouter',
        model: resolvedConfig.model,
        iterations: maxIterations,
        toolCallsExecuted,
        maxIterationsReached: true
      },
      toolCallsExecuted
    };
  }

  async executeQuery(request: OpenRouterQueryRequest): Promise<OpenRouterQueryResponse> {
    // If tool loop is requested, delegate to new method
    if (request.enableToolLoop) {
      return this.executeQueryWithTools(request);
    }

    // Original implementation continues below...
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

    // Log request for debugging (without sensitive data)
    console.log(`🌐 OpenRouter request: model=${resolvedConfig.model}, collectorType=${collectorType}, messages=${messages.length}, hasTools=${!!body.tools}`);

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

    // Log the full response structure for debugging
    if (!result?.choices?.[0]) {
      console.error('❌ OpenRouter response structure:', JSON.stringify(result, null, 2));
      throw new Error(`Invalid OpenRouter response: no choices found. Response: ${JSON.stringify(result).substring(0, 500)}`);
    }

    const message = result?.choices?.[0]?.message;
    const messageContent = message?.content;
    const finishReason = result?.choices?.[0]?.finish_reason;

    // Handle different content types
    let answer: string = '';

    // First, try to get content
    if (typeof messageContent === 'string' && messageContent.trim().length > 0) {
      answer = messageContent;
    } else if (Array.isArray(messageContent)) {
      // Handle array content (e.g., from reasoning responses or multimodal)
      answer = messageContent
        .map((part: any) => {
          if (typeof part === 'string') return part;
          if (part?.text) return part.text;
          if (part?.content) return part.content;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else if (messageContent !== null && messageContent !== undefined) {
      // Try to stringify other types
      answer = String(messageContent);
    }

    // If content is empty but there's reasoning (for reasoning models like gpt-oss-20b)
    // The reasoning might contain the answer, or we need to extract from reasoning_details
    if ((!answer || answer.trim().length === 0) && message?.reasoning) {
      // For reasoning models, sometimes the answer is in reasoning field
      // But if finish_reason is "length", the model hit token limit before outputting final answer
      if (finishReason === 'length') {
        console.warn(`⚠️ OpenRouter response hit token limit. Reasoning tokens used: ${result?.usage?.completion_tokens_details?.reasoning_tokens || 'unknown'}`);
        // Try to extract any JSON from the reasoning text
        const reasoningText = typeof message.reasoning === 'string'
          ? message.reasoning
          : message.reasoning_details?.[0]?.text || '';

        // Look for JSON in reasoning text as fallback
        const jsonMatch = reasoningText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          answer = jsonMatch[0];
          console.log('✅ Extracted JSON from reasoning text');
        } else {
          throw new Error(`OpenRouter response hit token limit before generating final answer. Increase max_tokens. Model: ${result?.model || body.model}, Finish reason: ${finishReason}`);
        }
      } else {
        // If not length-limited, try using reasoning as fallback
        answer = typeof message.reasoning === 'string' ? message.reasoning : '';
      }
    }

    if (!answer || answer.trim().length === 0) {
      console.error('❌ OpenRouter empty answer. Full response:', JSON.stringify(result, null, 2));
      throw new Error(`Empty content in OpenRouter response. Model: ${result?.model || body.model}, Finish reason: ${finishReason || 'unknown'}`);
    }

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
