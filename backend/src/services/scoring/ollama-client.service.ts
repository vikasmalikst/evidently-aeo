/**
 * Ollama Client Service
 * 
 * Separate, modular service for handling Ollama API calls.
 * This service is completely isolated from existing LLM providers
 * to ensure no impact on current functionality.
 */

import { globalSettingsService } from '../global-settings.service';
import { supabaseAdmin } from '../../config/database';

// Global queue to ensure only one Ollama API call happens at a time
// This prevents overloading the local Ollama instance when multiple scoring operations run concurrently
class OllamaQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  getQueueLength(): number {
    return this.queue.length;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuePosition = this.queue.length;
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      // Log queue position if there are items waiting
      if (queuePosition > 0) {
        console.log(`🦙 [Queue: ${queuePosition} waiting] Queuing Ollama API call...`);
      }

      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          // Error is already handled in the task's promise
          console.error('Ollama queue task error:', error);
        }
      }
    }

    this.processing = false;
  }
}

const ollamaQueue = new OllamaQueue();

export interface OllamaConfig {
  ollamaUrl: string;
  ollamaModel: string;
  useOllama: boolean;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  format?: 'json';
  temperature?: number;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * Get Ollama configuration from brands.local_llm (brand-specific)
 */
async function getOllamaConfigForBrand(brandId: string): Promise<OllamaConfig | null> {
  try {
    if (!brandId) {
      console.warn('getOllamaConfigForBrand: brandId is required');
      return null;
    }

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('local_llm')
      .eq('id', brandId)
      .single();

    if (error) {
      console.error('Error fetching brand for Ollama config:', error);
      // If brand doesn't exist, that's okay - just return null
      if (error.code === 'PGRST116') {
        console.warn(`Brand ${brandId} not found`);
        return null;
      }
      // For other errors, log and return null
      return null;
    }

    if (!brand) {
      console.warn(`Brand ${brandId} not found`);
      return null;
    }

    if (!brand.local_llm || typeof brand.local_llm !== 'object') {
      // Brand exists but no local_llm config - this is normal
      return null;
    }

    const config = brand.local_llm as any;
    
    // Check if Ollama is enabled
    if (!config.useOllama) {
      return null;
    }

    return {
      ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
      ollamaModel: config.ollamaModel || 'qwen2.5:latest',
      useOllama: true,
    };
  } catch (error) {
    console.error('Error getting brand Ollama config:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * Get Ollama configuration from global_settings (DEPRECATED - kept for backward compatibility)
 */
async function getOllamaConfig(): Promise<OllamaConfig | null> {
  try {
    const setting = await globalSettingsService.getGlobalSetting('consolidated_analysis');
    
    if (!setting || !setting.metadata) {
      return null;
    }

    const metadata = setting.metadata as any;
    
    // Check if Ollama is enabled
    if (!metadata.useOllama) {
      return null;
    }

    return {
      ollamaUrl: metadata.ollamaUrl || 'http://localhost:11434',
      ollamaModel: metadata.ollamaModel || 'qwen2.5:latest',
      useOllama: true,
    };
  } catch (error) {
    console.error('Error getting Ollama config:', error);
    return null;
  }
}

/**
 * Check if Ollama should be used for scoring (brand-specific)
 */
export async function shouldUseOllama(brandId?: string): Promise<boolean> {
  if (brandId) {
    const config = await getOllamaConfigForBrand(brandId);
    return config?.useOllama === true;
  }
  // Fallback to global config for backward compatibility (deprecated)
  const config = await getOllamaConfig();
  return config?.useOllama === true;
}

/**
 * Call Ollama API for chat completion (brand-specific)
 * This is a separate, isolated function that doesn't interfere with existing LLM calls
 * IMPORTANT: All Ollama calls are queued to ensure only one happens at a time globally
 */
export async function callOllamaAPI(
  systemMessage: string,
  userMessage: string,
  brandId?: string
): Promise<string> {
  const config = brandId 
    ? await getOllamaConfigForBrand(brandId)
    : await getOllamaConfig();
  
  if (!config || !config.useOllama) {
    throw new Error('Ollama is not enabled or configured for this brand');
  }

  const { ollamaUrl, ollamaModel } = config;

  // Queue the API call to ensure only one happens at a time globally
  // This prevents overloading Ollama when multiple scoring operations run concurrently
  return ollamaQueue.enqueue(async () => {
    console.log(`🦙 Calling Ollama API at ${ollamaUrl} with model ${ollamaModel}...`);

    // Add timeout for Ollama calls (300 seconds for complex tasks like recommendations or enrichment, 30 seconds for scoring)
    // Complex tasks need more time due to longer prompts and larger responses
    const isComplexPrompt = userMessage.includes('Generate 8-12 recommendations') || 
                            userMessage.includes('actionable recommendations') ||
                            userMessage.includes('comprehensive synonyms') ||
                            userMessage.includes('commercial products');
    const timeoutMs = isComplexPrompt ? 300000 : 30000; // 300s (5 mins) for complex prompts, 30s for scoring
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            {
              role: 'system',
              content: systemMessage,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          stream: false,
          format: 'json', // Force JSON response
          temperature: 0.1, // Low temperature for consistency
        } as OllamaChatRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as OllamaChatResponse;

      if (!data.message || !data.message.content) {
        throw new Error('Empty response from Ollama API');
      }

      const content = data.message.content.trim();

      if (!content || content.length === 0) {
        throw new Error('Empty content in Ollama API response');
      }

      console.log(`✅ Ollama API call successful (${content.length} characters)`);

      return content;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a timeout error
      if (errorMsg.includes('aborted') || errorMsg.includes('timeout') || 
          (error instanceof Error && error.name === 'AbortError')) {
        console.error(`❌ Ollama API call timed out after ${timeoutMs / 1000} seconds`);
        throw new Error(`Ollama API timeout: Request took longer than ${timeoutMs / 1000} seconds. The model may be too slow for this task.`);
      }
      
      console.error(`❌ Ollama API call failed:`, errorMsg);
      throw new Error(`Ollama API error: ${errorMsg}`);
    }
  });
}

/**
 * Get Ollama configuration for UI display (brand-specific)
 */
export async function getOllamaConfigForUI(brandId?: string): Promise<OllamaConfig | null> {
  if (brandId) {
    return await getOllamaConfigForBrand(brandId);
  }
  // Fallback to global config for backward compatibility (deprecated)
  return await getOllamaConfig();
}

/**
 * Check Ollama API health/availability
 * Returns health status and error message if unavailable
 */
export async function checkOllamaHealth(): Promise<{
  healthy: boolean;
  error?: string;
  responseTime?: number;
}> {
  const config = await getOllamaConfig();
  
  if (!config || !config.useOllama) {
    return {
      healthy: false,
      error: 'Ollama is not enabled',
    };
  }

  const { ollamaUrl, ollamaModel } = config;
  const startTime = Date.now();

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    // Try to list models first (lightweight check)
    const modelsResponse = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!modelsResponse.ok) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        error: `Ollama API returned status ${modelsResponse.status}`,
        responseTime,
      };
    }

    // Check if the specified model is available
    const modelsData = await modelsResponse.json() as { models?: Array<{ name: string }> };
    const availableModels = modelsData.models || [];
    const modelExists = availableModels.some(m => m.name === ollamaModel || m.name.startsWith(ollamaModel.split(':')[0]));

    if (!modelExists) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        error: `Model "${ollamaModel}" not found. Available models: ${availableModels.map(m => m.name).join(', ') || 'none'}`,
        responseTime,
      };
    }

    // Try a simple test request to verify the model works
    const testController = new AbortController();
    const testTimeoutId = setTimeout(() => testController.abort(), 10000); // 10 second timeout

    const testResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          {
            role: 'user',
            content: 'Say "OK"',
          },
        ],
        stream: false,
      } as OllamaChatRequest),
      signal: testController.signal,
    });

    clearTimeout(testTimeoutId);

    const responseTime = Date.now() - startTime;

    if (!testResponse.ok) {
      const errorText = await testResponse.text().catch(() => 'Unknown error');
      return {
        healthy: false,
        error: `Test request failed: ${testResponse.status} ${errorText.substring(0, 200)}`,
        responseTime,
      };
    }

    return {
      healthy: true,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('timeout') || errorMsg.includes('AbortError')) {
      return {
        healthy: false,
        error: 'Connection timeout - Ollama may be unreachable or slow',
        responseTime,
      };
    }

    if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
      return {
        healthy: false,
        error: `Cannot connect to Ollama at ${ollamaUrl}. Is Ollama running?`,
        responseTime,
      };
    }

    return {
      healthy: false,
      error: errorMsg,
      responseTime,
    };
  }
}

/**
 * Check Ollama API health/availability for a specific brand
 */
export async function checkOllamaHealthForBrand(brandId: string): Promise<{
  healthy: boolean;
  error?: string;
  responseTime?: number;
}> {
  const config = await getOllamaConfigForBrand(brandId);
  
  if (!config || !config.useOllama) {
    return {
      healthy: false,
      error: 'Ollama is not enabled for this brand',
    };
  }

  const { ollamaUrl, ollamaModel } = config;
  const startTime = Date.now();

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    // Try to list models first (lightweight check)
    const modelsResponse = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!modelsResponse.ok) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        error: `Ollama API returned status ${modelsResponse.status}`,
        responseTime,
      };
    }

    // Check if the specified model is available
    const modelsData = await modelsResponse.json() as { models?: Array<{ name: string }> };
    const availableModels = modelsData.models || [];
    const modelExists = availableModels.some(m => m.name === ollamaModel || m.name.startsWith(ollamaModel.split(':')[0]));

    if (!modelExists) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        error: `Model "${ollamaModel}" not found. Available models: ${availableModels.map(m => m.name).join(', ') || 'none'}`,
        responseTime,
      };
    }

    // Try a simple test request to verify the model works
    const testController = new AbortController();
    const testTimeoutId = setTimeout(() => testController.abort(), 10000); // 10 second timeout

    const testResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          {
            role: 'user',
            content: 'Say "OK"',
          },
        ],
        stream: false,
      } as OllamaChatRequest),
      signal: testController.signal,
    });

    clearTimeout(testTimeoutId);

    const responseTime = Date.now() - startTime;

    if (!testResponse.ok) {
      const errorText = await testResponse.text().catch(() => 'Unknown error');
      return {
        healthy: false,
        error: `Test request failed: ${testResponse.status} ${errorText.substring(0, 200)}`,
        responseTime,
      };
    }

    return {
      healthy: true,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes('timeout') || errorMsg.includes('AbortError')) {
      return {
        healthy: false,
        error: 'Connection timeout - Ollama may be unreachable or slow',
        responseTime,
      };
    }

    if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
      return {
        healthy: false,
        error: `Cannot connect to Ollama at ${ollamaUrl}. Is Ollama running?`,
        responseTime,
      };
    }

    return {
      healthy: false,
      error: errorMsg,
      responseTime,
    };
  }
}

/**
 * Test Ollama with a custom prompt for a specific brand
 */
export async function testOllamaPromptForBrand(brandId: string, prompt: string): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  const config = await getOllamaConfigForBrand(brandId);
  
  if (!config || !config.useOllama) {
    return {
      success: false,
      error: 'Ollama is not enabled for this brand',
    };
  }

  const { ollamaUrl, ollamaModel } = config;

  try {
    // Use the same queue to ensure test calls don't interfere with production
    const response = await ollamaQueue.enqueue(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for test

      const fetchResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        } as OllamaChatRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return fetchResponse;
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Ollama API error: ${response.status} ${errorText.substring(0, 200)}`,
      };
    }

    const data = await response.json() as OllamaChatResponse;

    if (!data.message || !data.message.content) {
      return {
        success: false,
        error: 'Empty response from Ollama API',
      };
    }

    return {
      success: true,
      response: data.message.content.trim(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Test Ollama with a custom prompt (DEPRECATED - use testOllamaPromptForBrand)
 * Uses the same queue to ensure consistency with production calls
 */
export async function testOllamaPrompt(prompt: string): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  const config = await getOllamaConfig();
  
  if (!config || !config.useOllama) {
    return {
      success: false,
      error: 'Ollama is not enabled',
    };
  }

  const { ollamaUrl, ollamaModel } = config;

  try {
    // Use the same queue to ensure test calls don't interfere with production
    const response = await ollamaQueue.enqueue(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for test

      const fetchResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        } as OllamaChatRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return fetchResponse;
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Ollama API error: ${response.status} ${errorText.substring(0, 200)}`,
      };
    }

    const data = await response.json() as OllamaChatResponse;

    if (!data.message || !data.message.content) {
      return {
        success: false,
        error: 'Empty response from Ollama API',
      };
    }

    return {
      success: true,
      response: data.message.content.trim(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

