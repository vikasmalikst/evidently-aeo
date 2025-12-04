/**
 * Priority-Based Collector Service
 * Implements fallback logic with priority ordering from global_settings
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { oxylabsCollectorService } from './oxylabs-collector.service';
import { chatgptOxylabsCollectorService } from './chatgpt-oxylabs-collector.service';
import { dataForSeoCollectorService } from './dataforseo-collector.service';
import { brightDataCollectorService } from './brightdata-collector.service';
import { openRouterCollectorService } from './openrouter-collector.service';
import { serpApiCollectorService } from './serpapi-collector.service';
import { groqCollectorService } from './groq-collector.service';

// Load environment variables
loadEnvironment();

// Initialize Supabase client
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

export interface CollectorProvider {
  name: string;
  priority: number;
  enabled: boolean;
  timeout: number;
  retries: number;
  fallback_on_failure: boolean;
}

export interface CollectorPriorityConfig {
  collector_type: string;
  providers: CollectorProvider[];
}

export interface SystemConfig {
  max_concurrent_collectors: number;
  default_timeout: number;
  default_retries: number;
  fallback_enabled: boolean;
  async_execution: boolean;
  batch_size: number;
  health_check_interval: number;
}

export interface PriorityExecutionResult {
  queryId: string;
  executionId: string;
  collectorType: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  response?: string;
  citations?: string[];
  urls?: string[];
  error?: string;
  executionTimeMs?: number;
  metadata?: any;
  brandId?: string;
  customerId?: string;
  fallbackUsed?: boolean;
  fallbackChain?: string[];
  snapshotId?: string;
}

export class PriorityCollectorService {
  private systemConfig: SystemConfig | null = null;
  private collectorConfigs: Map<string, CollectorPriorityConfig> = new Map();

  constructor() {
    this.initializeHardcodedPriorities();
  }

  /**
   * Initialize hardcoded priority configurations
   */
  private initializeHardcodedPriorities(): void {
    // Set default system configuration
    this.systemConfig = {
      max_concurrent_collectors: 3,
      default_timeout: 60000,
      default_retries: 2,
      fallback_enabled: true,
      async_execution: true,
      batch_size: 3,
      health_check_interval: 300000
    };

    // ChatGPT Collector Priority Configuration
    this.collectorConfigs.set('chatgpt', {
      collector_type: 'chatgpt',
      providers: [
        {
          name: 'brightdata_chatgpt',
          priority: 1,
          enabled: true, // ✅ Enabled with async trigger endpoint
          timeout: 10000, // 10s timeout - async returns snapshot_id quickly
          retries: 1,
          fallback_on_failure: true
        },
        {
          name: 'dataforseo_chatgpt',
          priority: 2,
          enabled: false,
          timeout: 60000, // 60s for DataForSEO ChatGPT
          retries: 1,
          fallback_on_failure: true
        },
        {
          name: 'groq_chatgpt',
          priority: 3,
          enabled: false,
          timeout: 30000,
          retries: 1,
          fallback_on_failure: true
        },
        {
          name: 'oxylabs_chatgpt',
          priority: 4,
          enabled: false,
          timeout: 90000, // 90s for ChatGPT (matches chatgpt-oxylabs-collector.service.ts)
          retries: 1,
          fallback_on_failure: true
        },
        {
          name: 'openai_direct',
          priority: 5,
          enabled: false,
          timeout: 30000,
          retries: 1,
          fallback_on_failure: true // Fallback to OpenAI direct when other providers fail
        },
       
      ]
    });

    // Google AIO Collector Priority Configuration
    this.collectorConfigs.set('google_aio', {
      collector_type: 'google_aio',
      providers: [
        {
          name: 'oxylabs_google_aio',
          priority: 1,
          enabled: true, // Re-enabled as per user's request
          timeout: 45000,
          retries: 2,
          fallback_on_failure: true
        },
        {
          name: 'brightdata_google_aio',
          priority: 2,
          enabled: true,
          timeout: 45000,
          retries: 2,
          fallback_on_failure: true
        },
        {
          name: 'dataforseo_google_aio',
          priority: 3,
          enabled: true,
          timeout: 45000,
          retries: 1,
          fallback_on_failure: true
        }
       
      ]
    });

    // Perplexity Collector Priority Configuration
    this.collectorConfigs.set('perplexity', {
      collector_type: 'perplexity',
      providers: [
        {
          name: 'oxylabs_perplexity',
          priority: 1,
          enabled: true,
          timeout: 60000,
          retries: 2,
          fallback_on_failure: true
        },
        {
          name: 'brightdata_perplexity',
          priority: 2,
          enabled: true,
          timeout: 60000,
          retries: 2,
          fallback_on_failure: true
        },
        {
          name: 'dataforseo_perplexity',
          priority: 3,
          enabled: true,
          timeout: 45000,
          retries: 1,
          fallback_on_failure: true
        }
      ]
    });

    // Claude Collector Priority Configuration (via OpenRouter)
    this.collectorConfigs.set('claude', {
      collector_type: 'claude',
      providers: [
        {
          name: 'openrouter_claude',
          priority: 1,
          enabled: true,
          timeout: 60000,
          retries: 1,
          fallback_on_failure: false
        }
      ]
    });

  

    // Bing Copilot Collector Priority Configuration
    this.collectorConfigs.set('bing_copilot', {
      collector_type: 'bing_copilot',
      providers: [
        {
          name: 'serpapi_bing_copilot',
          priority: 1,
          enabled: true,
          timeout: 60000, // 60 seconds for SerpApi (synchronous)
          retries: 2,
          fallback_on_failure: true
        },
        {
          name: 'brightdata_bing_copilot',
          priority: 2,
          enabled: false,
          timeout: 300000, // Increased to 5 minutes for BrightData async processing
          retries: 2,
          fallback_on_failure: true
        }
      ]
    });

    // Gemini Collector Priority Configuration
    // Using Google Gemini Direct as primary (user requested)
    this.collectorConfigs.set('gemini', {
      collector_type: 'gemini',
      providers: [
        {
          name: 'brightdata_gemini',
          priority: 1,
          enabled: true,
          timeout: 45000,
          retries: 2,
          fallback_on_failure: true
        },
        {
          name: 'google_gemini_direct',
          priority: 2,
          enabled: true,
          timeout: 45000,
          retries: 2,
          fallback_on_failure: true
        },
       
      ]
    });

    // Grok Collector Priority Configuration
    this.collectorConfigs.set('grok', {
      collector_type: 'grok',
      providers: [
        {
          name: 'brightdata_grok',
          priority: 1,
          enabled: true,
          timeout: 300000, // Increased to 5 minutes for BrightData async processing
          retries: 2,
          fallback_on_failure: true
        }
      ]
    });

    console.log('🔧 Priority Collector Service initialized with hardcoded priorities');
  }

  /**
   * Load collector priority configuration for a specific collector type
   */
  private async loadCollectorConfig(collectorType: string): Promise<CollectorPriorityConfig | null> {
    // Return hardcoded configuration
    const config = this.collectorConfigs.get(collectorType);
    if (!config) {
      console.warn(`⚠️ No priority config found for ${collectorType}`);
      return null;
    }
    return config;
  }

  /**
   * Execute query with priority-based fallback logic
   */
  async executeWithPriorityFallback(
    queryId: string,
    executionId: string,
    collectorType: string,
    queryText: string,
    brandId: string,
    customerId: string,
    locale: string = 'en-US',
    country: string = 'US',
    snapshotIdCallback?: (snapshotId: string) => void
  ): Promise<PriorityExecutionResult> {
    const startTime = Date.now();
    const fallbackChain: string[] = [];
    
    try {
      // Load collector configuration
      const config = await this.loadCollectorConfig(collectorType);
      if (!config) {
        throw new Error(`No priority configuration found for collector type: ${collectorType}`);
      }

      // Sort providers by priority (ascending)
      const sortedProviders = config.providers
        .filter(provider => provider.enabled)
        .sort((a, b) => a.priority - b.priority);

      if (sortedProviders.length === 0) {
        throw new Error(`No enabled providers found for collector type: ${collectorType}`);
      }

      console.log(`🔄 Executing ${collectorType} with ${sortedProviders.length} providers in priority order`);

      // Try each provider in priority order
      for (const provider of sortedProviders) {
        try {
          console.log(`🔄 Trying ${provider.name} (priority ${provider.priority}) for ${collectorType}`);
          fallbackChain.push(provider.name);
          
          // For BrightData, start polling but don't wait for completion if it takes too long
          // Store snapshot_id immediately when we get it
          let snapshotIdStored = false;
          if (provider.name.includes('brightdata')) {
            // Call the BrightData provider to get snapshot_id
            try {
              const snapshotResult = await this.callBrightDataProvider(
                provider,
                queryText,
                brandId,
                locale,
                country,
                collectorType
              );
              
              // If we got snapshot_id immediately, store it
              const immediateSnapshotId = snapshotResult.metadata?.snapshot_id || snapshotResult.snapshot_id;
              if (immediateSnapshotId && !snapshotIdStored) {
                // Update execution record with snapshot_id immediately
                await this.updateExecutionSnapshotId(executionId, immediateSnapshotId);
                snapshotIdStored = true;
              }
            } catch (err) {
              // Continue to normal execution flow
              console.warn(`⚠️ Failed to get snapshot_id early: ${err}`);
            }
          }
          
          const result = await this.executeWithProvider(
            provider,
            queryText,
            brandId,
            locale,
            country,
            collectorType
          );

          const executionTime = Date.now() - startTime;
          
          console.log(`✅ ${provider.name} succeeded for ${collectorType} in ${executionTime}ms`);
          
          // Extract snapshot_id from BrightData results
          const snapshotId = result.metadata?.snapshot_id || result.snapshot_id;
          
          return {
            queryId,
            executionId,
            collectorType,
            provider: provider.name,
            status: 'completed',
            response: result.answer || result.response,
            citations: result.citations || [],
            urls: result.urls || [],
            executionTimeMs: executionTime,
            metadata: result.metadata || {},
            brandId,
            customerId,
            fallbackUsed: fallbackChain.length > 1,
            fallbackChain: [...fallbackChain],
            snapshotId
          };

        } catch (providerError: any) {
          console.warn(`⚠️ ${provider.name} failed for ${collectorType}:`, providerError.message);
          
          // If this provider has fallback_on_failure = false, stop trying
          if (!provider.fallback_on_failure) {
            throw new Error(`Provider ${provider.name} failed and fallback is disabled: ${providerError.message}`);
          }
          
          // Continue to next provider
          continue;
        }
      }

      // If we get here, all providers failed
      throw new Error(`All providers failed for ${collectorType}. Tried: ${fallbackChain.join(', ')}`);

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ All providers failed for ${collectorType}:`, error.message);
      
      return {
        queryId,
        executionId,
        collectorType,
        provider: 'none',
        status: 'failed',
        error: error.message,
        executionTimeMs: executionTime,
        brandId,
        customerId,
        fallbackUsed: fallbackChain.length > 1,
        fallbackChain: [...fallbackChain]
      };
    }
  }

  /**
   * Execute query with specific provider
   */
  private async executeWithProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    const timeout = provider.timeout || this.systemConfig?.default_timeout || 60000;
    
    // For BrightData collectors, use longer timeout (10 minutes = 600000ms)
    // because polling can take up to 60 attempts * 10 seconds = 600 seconds
    const isBrightData = provider.name.includes('brightdata');
    const effectiveTimeout = isBrightData ? 600000 : timeout; // 10 minutes for BrightData
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Provider ${provider.name} timed out after ${effectiveTimeout}ms`)), effectiveTimeout);
    });

    // Create the execution promise
    const executionPromise = this.callProviderAPI(provider, queryText, brandId, locale, country, collectorType);

    // Race between execution and timeout
    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Call specific provider API
   */
  private async callProviderAPI(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    console.log(`🔄 Calling ${provider.name} for ${collectorType}`);

    // Route to appropriate service based on provider name
    if (provider.name.includes('groq')) {
      return await this.callGroqProvider(provider, queryText, brandId, locale, country, collectorType);
    } else if (provider.name.includes('serpapi')) {
      return await this.callSerpApiProvider(provider, queryText, brandId, locale, country, collectorType);
    } else if (provider.name.includes('openrouter')) {
      return await this.callOpenRouterProvider(provider, queryText, brandId, locale, country, collectorType);
    } else if (provider.name.includes('oxylabs')) {
      return await this.callOxylabsProvider(provider, queryText, brandId, locale, country, collectorType);
    } else if (provider.name.includes('dataforseo')) {
      return await this.callDataForSeoProvider(provider, queryText, brandId, locale, country, collectorType);
    } else if (provider.name.includes('brightdata')) {
      return await this.callBrightDataProvider(provider, queryText, brandId, locale, country, collectorType);
    } else if (provider.name.includes('direct')) {
      return await this.callDirectProvider(provider, queryText, brandId, locale, country, collectorType);
    } else {
      throw new Error(`Unknown provider type: ${provider.name}`);
    }
  }

  /**
   * Call Groq provider
   */
  private async callGroqProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    console.log(`🔄 Calling Groq ${provider.name} for ${collectorType}`);
    
    return await groqCollectorService.executeQuery({
      prompt: queryText,
      collectorType
    });
  }

  /**
   * Call OpenRouter provider
   */
  private async callOpenRouterProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    console.log(`🔄 Calling OpenRouter ${provider.name} for ${collectorType}`);
    
    return await openRouterCollectorService.executeQuery({
      prompt: queryText,
      collectorType
    });
  }

  /**
   * Call Oxylabs provider
   */
  private async callOxylabsProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    // Use dedicated ChatGPT Oxylabs service for ChatGPT
    if (provider.name === 'oxylabs_chatgpt' || collectorType === 'chatgpt') {
      return await chatgptOxylabsCollectorService.executeQuery({
        prompt: queryText,
        brand: brandId,
        locale,
        country
      });
    }

    // Use general Oxylabs service for other collectors
    const sourceMap: { [key: string]: string } = {
      'oxylabs_google_aio': 'google_ai_mode',
      'oxylabs_perplexity': 'perplexity'
    };

    const source = sourceMap[provider.name] || collectorType;
    
    return await oxylabsCollectorService.executeQuery({
      prompt: queryText,
      source: source as any,
      brand: brandId,
      locale,
      country
    });
  }

  /**
   * Call DataForSEO provider
   */
  private async callDataForSeoProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    return await dataForSeoCollectorService.executeQuery({
      prompt: queryText,
      source: collectorType as any,
      locale,
      country
    });
  }

  /**
   * Call SerpApi provider
   */
  private async callSerpApiProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    console.log(`🔄 Calling SerpApi ${provider.name} for ${collectorType}`);
    
    const request = {
      prompt: queryText,
      brand: brandId,
      locale,
      country
    };

    // Route to appropriate SerpApi method based on collector type
    switch (collectorType) {
      case 'bing_copilot':
        return await serpApiCollectorService.executeBingCopilotQuery(request);
      default:
        throw new Error(`Unsupported collector type for SerpApi: ${collectorType}`);
    }
  }

  /**
   * Call BrightData provider
   */
  private async callBrightDataProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    console.log(`🔄 Calling BrightData ${provider.name} for ${collectorType}`);
    
    const request = {
      prompt: queryText,
      brand: brandId,
      locale,
      country,
      web_search: false,
      additional_prompt: ''
    };

    // Route to appropriate BrightData method based on collector type
    switch (collectorType) {
      case 'chatgpt':
        return await brightDataCollectorService.executeChatGPTQuery(request);
      case 'google_aio':
        return await brightDataCollectorService.executeGoogleAIOQuery(request);
      case 'perplexity':
        return await brightDataCollectorService.executePerplexityQuery(request);
      case 'baidu':
        return await brightDataCollectorService.executeBaiduQuery(request);
      case 'bing':
        return await brightDataCollectorService.executeBingQuery(request);
      case 'bing_copilot':
        return await brightDataCollectorService.executeBingCopilotQuery(request);
      case 'gemini':
        return await brightDataCollectorService.executeGeminiQuery(request);
      case 'grok':
        return await brightDataCollectorService.executeGrokQuery(request);
      default:
        throw new Error(`Unsupported collector type for BrightData: ${collectorType}`);
    }
  }

  /**
   * Call direct API provider
   */
  private async callDirectProvider(
    provider: CollectorProvider,
    queryText: string,
    brandId: string,
    locale: string,
    country: string,
    collectorType: string
  ): Promise<any> {
    console.log(`🔄 Calling direct API ${provider.name} for ${collectorType}`);
    
    // Route to appropriate direct API based on provider
    
  }

  /**
   * Call Google Gemini Direct API
   */
  private async callGoogleGeminiDirect(
    queryText: string,
    brandId: string,
    locale: string,
    country: string
  ): Promise<any> {
    const geminiApiKey = getEnvVar('GOOGLE_GEMINI_API_KEY');
    const geminiModel = getEnvVar('GOOGLE_GEMINI_MODEL') || 'gemini-2.5-flash';
    
    if (!geminiApiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: queryText
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    console.log(`🔄 Calling Google Gemini Direct API with model: ${geminiModel}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json() as any;
    
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        return {
          answer: candidate.content.parts[0].text,
          response: candidate.content.parts[0].text,
          citations: [],
          urls: [],
          metadata: {
            provider: 'google_gemini_direct',
            model: geminiModel,
            usage: result.usageMetadata,
            finishReason: candidate.finishReason
          }
        };
      }
    }
    
    throw new Error('No valid response from Google Gemini API');
  }

  /**
   * Call OpenAI Direct API
   */
  private async callOpenAIDirect(
    queryText: string,
    brandId: string,
    locale: string,
    country: string
  ): Promise<any> {
    const openaiApiKey = getEnvVar('OPENAI_API_KEY');
    
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured');
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Use newer model if available, fallback to gpt-3.5-turbo
    const openaiModel = getEnvVar('OPENAI_MODEL', 'gpt-4o-mini');
    
    const requestBody = {
      model: openaiModel,
      messages: [{
        role: 'user',
        content: queryText
      }],
      max_tokens: 1000,
      temperature: 0.7
    };

    console.log(`🔄 Calling OpenAI Direct API (fallback) with model: ${openaiModel}`);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = `OpenAI API error: ${errorJson.error.message}`;
          }
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json() as any;
      
      if (result.choices && result.choices.length > 0) {
        const choice = result.choices[0];
        const answer = choice.message?.content || '';
        
        if (!answer) {
          throw new Error('OpenAI API returned empty response');
        }
        
        console.log('✅ OpenAI Direct API call successful');
        
        return {
          query_id: `openai_direct_${Date.now()}`,
          run_start: new Date().toISOString(),
          run_end: new Date().toISOString(),
          prompt: queryText,
          answer: answer,
          response: answer,
          citations: [],
          urls: [],
          model_used: result.model || openaiModel,
          collector_type: 'chatgpt',
          metadata: {
            provider: 'openai_direct',
            model: result.model || openaiModel,
            usage: result.usage,
            finishReason: choice.finish_reason,
            brand: brandId,
            locale,
            country,
            success: true
          }
        };
      }
      
      throw new Error('No valid response from OpenAI API - no choices in response');
    } catch (error: any) {
      console.error('❌ OpenAI Direct API call failed:', error.message);
      throw error;
    }
  }

 

  /**
   * Get system configuration
   */
  getSystemConfig(): SystemConfig | null {
    return this.systemConfig;
  }

  /**
   * Get collector configuration for a specific type
   */
  async getCollectorConfig(collectorType: string): Promise<CollectorPriorityConfig | null> {
    return await this.loadCollectorConfig(collectorType);
  }

  /**
   * Update collector configuration
   */
  async updateCollectorConfig(collectorType: string, config: CollectorPriorityConfig): Promise<void> {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        setting_key: `collector_priorities_${collectorType}`,
        setting_value: config,
        description: `Priority configuration for ${collectorType} collector`,
        is_active: true
      });

    if (error) {
      throw new Error(`Failed to update collector config: ${error.message}`);
    }

    // Update local cache
    this.collectorConfigs.set(collectorType, config);
  }

  /**
   * Health check for all providers of a collector type
   */
  async checkCollectorHealth(collectorType: string): Promise<Record<string, boolean>> {
    const config = await this.loadCollectorConfig(collectorType);
    if (!config) {
      return {};
    }

    const healthStatus: Record<string, boolean> = {};
    
    for (const provider of config.providers) {
      try {
        // Simple health check - you can implement more sophisticated checks
        healthStatus[provider.name] = true; // Placeholder
      } catch (error) {
        healthStatus[provider.name] = false;
      }
    }

    return healthStatus;
  }

  /**
   * Update execution record with snapshot_id (helper method for data collection service)
   */
  async updateExecutionSnapshotId(executionId: string, snapshotId: string): Promise<void> {
    // This will be called from data-collection.service
    // Import supabase here to update
    const { error } = await supabase
      .from('query_executions')
      .update({ brightdata_snapshot_id: snapshotId })
      .eq('id', executionId);

    if (error) {
      console.error(`Failed to update execution snapshot_id:`, error);
    } else {
      console.log(`✅ Stored snapshot_id ${snapshotId} for execution ${executionId}`);
    }
  }
}

export const priorityCollectorService = new PriorityCollectorService();
