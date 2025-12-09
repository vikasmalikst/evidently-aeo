/**
 * Anthropic Claude Direct API Service
 * Direct integration with Anthropic's Claude API
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

// Load environment variables
loadEnvironment();

export interface AnthropicQueryRequest {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AnthropicQueryResponse {
  query_id: string;
  run_start: string;
  run_end: string;
  prompt: string;
  response: string;
  model_used: string;
  collector_type: string;
  citations?: string[];
  urls?: string[];
  metadata?: any;
}

export class AnthropicCollectorService {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = getEnvVar('ANTHROPIC_API_KEY', '');
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
    this.defaultModel = 'claude-3-5-sonnet-20241022';
    
    const hasApiKey = !!this.apiKey;
  }

  /**
   * Execute query using Anthropic Claude API
   */
  async executeQuery(request: AnthropicQueryRequest): Promise<AnthropicQueryResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const queryId = `anthropic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          max_tokens: request.max_tokens || 4000,
          temperature: request.temperature || 0.7,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Anthropic API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as any;
      const answer = result.content?.[0]?.text || 'No response from Claude';

      const endTime = new Date().toISOString();
      return {
        query_id: queryId,
        run_start: startTime,
        run_end: endTime,
        prompt: request.prompt,
        response: answer,
        model_used: result.model || this.defaultModel,
        collector_type: 'claude',
        metadata: {
          tokens_used: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
          input_tokens: result.usage?.input_tokens || 0,
          output_tokens: result.usage?.output_tokens || 0,
          model: result.model || this.defaultModel,
          stop_reason: result.stop_reason || 'end_turn'
        }
      };

    } catch (error) {
      console.error('❌ Anthropic Claude execution failed:', error);
      throw new Error(`Anthropic Claude execution failed: ${error.message}`);
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-20241022',
      'claude-3-5-haiku-latest',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
}

// Export singleton instance
export const anthropicCollectorService = new AnthropicCollectorService();
