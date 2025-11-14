/**
 * Data Collection Service
 * Orchestrates query execution across multiple collectors
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { oxylabsCollectorService } from './oxylabs-collector.service';
import { dataForSeoCollectorService } from './dataforseo-collector.service';
import { priorityCollectorService, PriorityExecutionResult } from './priority-collector.service';
import { keywordGenerationService } from '../keywords/keyword-generation.service';
import { openRouterCollectorService } from './openrouter-collector.service';

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

export interface QueryExecutionRequest {
  queryId: string;
  brandId: string;
  customerId: string;
  queryText: string;
  intent: string;
  locale: string;
  country: string;
  collectors: string[];
}

export interface CollectorResult {
  queryId: string;
  executionId: string;
  collectorType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  response?: string;
  citations?: string[];
  urls?: string[];
  error?: string;
  executionTimeMs?: number;
  metadata?: any;
  brandId?: string;
  customerId?: string;
  snapshotId?: string;
}

export interface CollectorConfig {
  name: string;
  enabled: boolean;
  baseUrl: string;
  timeout: number;
  retries: number;
  priority: number;
}

export class DataCollectionService {
  private collectors: Map<string, CollectorConfig> = new Map();
  private supabase: any;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = getEnvVar('SUPABASE_URL');
    const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
    
    this.initializeCollectors();
  }

  /**
   * Map collector type to database format
   */
  private mapCollectorTypeToDatabase(collectorType: string): string {
    const mapping: { [key: string]: string } = {
      'chatgpt': 'ChatGPT',
      'google_aio': 'Google AIO',
      'perplexity': 'Perplexity',
      'claude': 'Claude',
      'deepseek': 'DeepSeek',
      'copilot': 'Bing Copilot', // Map copilot to Bing Copilot
      'bing_copilot': 'Bing Copilot',
      'grok': 'Grok',
      'gemini': 'Gemini',
      'mistral': 'Mistral' // Add Mistral mapping (for future implementation)
    };
    return mapping[collectorType] || collectorType;
  }

  private initializeCollectors() {
    // ChatGPT Collector (via Priority-based fallback: Oxylabs → BrightData → OpenAI)
    this.collectors.set('chatgpt', {
      name: 'ChatGPT Collector',
      enabled: false,
      baseUrl: 'priority',
      timeout: 30000, // Reduced to 30s for faster fallback
      retries: 1, // Reduced retries
      priority: 1
    });

    // Google AIO Collector (via Oxylabs)
    this.collectors.set('google_aio', {
      name: 'Google AIO Collector',
      enabled: false,
      baseUrl: 'oxylabs',
      timeout: 45000, // Increased to 45s
      retries: 2,
      priority: 2
    });

    // Perplexity Collector (via Oxylabs)
    this.collectors.set('perplexity', {
      name: 'Perplexity Collector',
      enabled: false,
      baseUrl: 'oxylabs',
      timeout: 60000, // 60s for Perplexity
      retries: 2,
      priority: 3
    });

    // Bing Copilot Collector (via BrightData)
    this.collectors.set('bing_copilot', {
      name: 'Bing Copilot Collector',
      enabled: false, // ✅ Enabled with BrightData
      baseUrl: 'priority',
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 4
    });

    // Copilot (alias for Bing Copilot - for frontend compatibility)
    this.collectors.set('copilot', {
      name: 'Bing Copilot Collector',
      enabled: false, // ✅ Enabled with BrightData
      baseUrl: 'priority',
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 4
    });

    // Claude Collector (via DataForSEO priority chain)
    this.collectors.set('claude', {
      name: 'Claude Collector',
      enabled: false, // enable once DataForSEO credentials are configured
      baseUrl: 'priority',
      timeout: 30000,
      retries: 2,
      priority: 5
    });

    // Grok Collector (via BrightData)
    this.collectors.set('grok', {
      name: 'Grok Collector',
      enabled: false, // ✅ Enabled with BrightData
      baseUrl: 'priority',
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 6
    });

    // Gemini Collector (replacing YouTube)
    this.collectors.set('gemini', {
      name: 'Gemini Collector',
      enabled: false, // ✅ Enabled with priority-based fallback
      baseUrl: 'priority',
      timeout: 45000,
      retries: 2,
      priority: 7
    });

    // DeepSeek Collector (direct via OpenRouter)
    this.collectors.set('deepseek', {
      name: 'DeepSeek Collector',
      enabled: false, // enable once OPENROUTER_API_KEY is configured
      baseUrl: 'openrouter',
      timeout: 45000,
      retries: 1,
      priority: 8
    });

    console.log('🔧 Data Collection Service initialized with collectors:', Array.from(this.collectors.keys()));
  }

  /**
   * Execute queries across multiple collectors
   * Process in batches to avoid overwhelming the API
   */
  async executeQueries(requests: QueryExecutionRequest[]): Promise<CollectorResult[]> {
    const results: CollectorResult[] = [];
    const BATCH_SIZE = 3; // Process 3 queries at a time
    
    console.log(`📊 Processing ${requests.length} queries in batches of ${BATCH_SIZE}...`);

    // Process requests in batches
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(requests.length / BATCH_SIZE)} (queries ${i + 1}-${Math.min(i + BATCH_SIZE, requests.length)})`);
      
      const batchPromises = batch.map(async (request, batchIndex) => {
        const queryNum = i + batchIndex + 1;
        try {
          console.log(`\n🚀 [${queryNum}/${requests.length}] Executing: "${request.queryText.substring(0, 60)}..."`);
          
          // Execute across enabled collectors with retry mechanism
          // Each collector will create its own execution record
          const collectorResults = await this.executeQueryAcrossCollectorsWithRetry(request, 2); // 2 retries
          console.log(`✅ [${queryNum}/${requests.length}] Completed ${collectorResults.length} collector executions`);
          return collectorResults;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(`❌ [${queryNum}/${requests.length}] Error executing query:`, {
            query: request.queryText.substring(0, 100),
            error: errorMessage,
            stack: errorStack,
            brandId: request.brandId,
            queryId: request.queryId
          });
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < requests.length) {
        console.log('⏸️  Brief pause before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause
      }
    }

    // Enhanced summary logging
    const successCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const totalExecutions = results.length;
    
    console.log(`\n✅ All queries processed. Summary:`);
    console.log(`   Total executions: ${totalExecutions}`);
    if (totalExecutions > 0) {
      console.log(`   Successful: ${successCount} (${Math.round((successCount / totalExecutions) * 100)}%)`);
      console.log(`   Failed: ${failedCount} (${Math.round((failedCount / totalExecutions) * 100)}%)`);
    }
    
    if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount} collector executions failed. Check logs above for details.`);
    }
    
    return results;
  }

  /**
   * Execute query across multiple collectors with retry mechanism
   */
  private async executeQueryAcrossCollectorsWithRetry(
    request: QueryExecutionRequest,
    maxRetries: number = 2
  ): Promise<CollectorResult[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for query: "${request.queryText.substring(0, 60)}..."`);
          // Exponential backoff: wait 2^attempt seconds
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
        
        return await this.executeQueryAcrossCollectors(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);
        
        // Don't retry on certain errors (e.g., validation errors)
        if (lastError.message.includes('not found') || lastError.message.includes('invalid')) {
          throw lastError;
        }
      }
    }
    
    // All retries exhausted
    console.error(`❌ All ${maxRetries + 1} attempts failed for query: "${request.queryText.substring(0, 60)}..."`);
    throw lastError || new Error('Query execution failed after retries');
  }

  /**
   * Create query execution record in database for a specific collector
   */
  private async createQueryExecutionForCollector(
    request: QueryExecutionRequest, 
    collectorType: string, 
    status: string = 'pending',
    errorMessage?: string,
    snapshotId?: string
  ): Promise<string> {
    const mappedCollectorType = this.mapCollectorTypeToDatabase(collectorType);
    
    // Get brand name from database
    let brandName = null;
    if (request.brandId) {
      try {
        const { data: brandData } = await this.supabase
          .from('brands')
          .select('name')
          .eq('id', request.brandId)
          .single();
        
        if (brandData) {
          brandName = brandData.name;
        }
      } catch (error) {
        console.warn(`⚠️ Could not retrieve brand name for ${request.brandId}:`, error);
      }
    }
    
    const insertData: any = {
      query_id: request.queryId,
      brand_id: request.brandId,
      customer_id: request.customerId,
      collector_type: mappedCollectorType,
      status: status,
      brand_name: brandName, // Add brand name
      metadata: {
        intent: request.intent,
        locale: request.locale,
        country: request.country,
        collectors: request.collectors
      }
    };

    // Add snapshot_id if provided (for BrightData collectors)
    if (snapshotId) {
      insertData.brightdata_snapshot_id = snapshotId;
    }

    // Add error message if failed
    if (errorMessage) {
      insertData.error_message = errorMessage;
    }

    const { data, error } = await supabase
      .from('query_executions')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create query execution: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Execute query across multiple collectors with priority-based fallback
   */
  private async executeQueryAcrossCollectors(
    request: QueryExecutionRequest
  ): Promise<CollectorResult[]> {
    const results: CollectorResult[] = [];
    const enabledCollectors = request.collectors.filter(collector => 
      this.collectors.get(collector)?.enabled
    );

    // Execute collectors with priority-based fallback
    // IMPORTANT: Each collector gets its own execution record
    const promises = enabledCollectors.map(async collectorType => {
      const config = this.collectors.get(collectorType);
      if (!config) {
        throw new Error(`Collector ${collectorType} configuration missing`);
      }

      if (config.baseUrl === 'priority') {
        return await this.executeWithPriorityFallback(request, collectorType);
      }

      const executionId = await this.createQueryExecutionForCollector(request, collectorType, 'pending');
      return await this.executeWithCollector(request, executionId, collectorType);
    });

    const collectorResults = await Promise.allSettled(promises); // benefits : even if
                 // one collectors fails,others continue 
    
    collectorResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const priorityResult = result.value as PriorityExecutionResult;
        results.push({
          queryId: priorityResult.queryId,
          executionId: priorityResult.executionId,
          collectorType: priorityResult.collectorType,
          status: priorityResult.status,
          response: priorityResult.response,
          citations: priorityResult.citations,
          urls: priorityResult.urls,
          error: priorityResult.error,
          executionTimeMs: priorityResult.executionTimeMs,
          metadata: {
            ...priorityResult.metadata,
            provider: priorityResult.provider,
            fallbackUsed: priorityResult.fallbackUsed,
            fallbackChain: priorityResult.fallbackChain
          },
          brandId: priorityResult.brandId,
          customerId: priorityResult.customerId,
          snapshotId: priorityResult.snapshotId
        });
      } else {
        const collectorType = enabledCollectors[index];
        // Create execution record even for failed attempts
        this.createQueryExecutionForCollector(request, collectorType, 'failed', result.reason?.message || 'Unknown error')
          .catch(err => console.error(`Failed to create execution record for ${collectorType}:`, err));
        
        results.push({
          queryId: request.queryId,
          executionId: '', // Will be populated by createQueryExecutionForCollector if needed
          collectorType,
          status: 'failed',
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    return results;
  }

  /**
   * Execute query with priority-based fallback for a specific collector
   */
  private async executeWithPriorityFallback(
    request: QueryExecutionRequest,
    collectorType: string
  ): Promise<PriorityExecutionResult> {
    // Create execution record for this specific collector
    let executionId: string;
    
    try {
      // Create execution record with 'pending' status
      executionId = await this.createQueryExecutionForCollector(request, collectorType, 'pending');
      
      // Update to 'running'
      await this.updateExecutionStatus(executionId, collectorType, 'running');
      
      // Use priority collector service for fallback logic
      const result = await priorityCollectorService.executeWithPriorityFallback(
        request.queryId,
        executionId,
        collectorType,
        request.queryText,
        request.brandId,
        request.customerId,
        request.locale,
        request.country
      );

      // Update execution status with snapshot_id if available
      if (result.status === 'completed') {
        await this.updateExecutionStatus(
          executionId, 
          collectorType, 
          'completed', 
          undefined,
          result.snapshotId
        );
        
        // Store result if successful
        await this.storeCollectorResult({
          queryId: result.queryId,
          executionId: result.executionId,
          collectorType: result.collectorType,
          status: result.status,
          response: result.response,
          citations: result.citations,
          urls: result.urls,
          executionTimeMs: result.executionTimeMs,
          metadata: {
            ...result.metadata,
            provider: result.provider,
            fallbackUsed: result.fallbackUsed,
            fallbackChain: result.fallbackChain
          },
          brandId: result.brandId,
          customerId: result.customerId,
          snapshotId: result.snapshotId
        });
      } else {
        // Update execution status for failed attempts
        await this.updateExecutionStatus(executionId, collectorType, 'failed', result.error, result.snapshotId);
      }

      return result;

    } catch (error: any) {
      console.error(`❌ Priority fallback failed for ${collectorType}:`, error.message);
      
      // Create execution record if it wasn't created yet, or update existing one
      try {
        if (!executionId) {
          executionId = await this.createQueryExecutionForCollector(request, collectorType, 'failed', error.message);
        } else {
          await this.updateExecutionStatus(executionId, collectorType, 'failed', error.message);
        }
      } catch (dbError) {
        console.error(`Failed to create/update execution record:`, dbError);
      }
      
      return {
        queryId: request.queryId,
        executionId: executionId || '',
        collectorType,
        provider: 'none',
        status: 'failed',
        error: error.message,
        brandId: request.brandId,
        customerId: request.customerId
      };
    }
  }

  /**
   * Execute query with specific collector (legacy method - kept for compatibility)
   */
  private async executeWithCollector(
    request: QueryExecutionRequest,
    executionId: string,
    collectorType: string
  ): Promise<CollectorResult> {
    const config = this.collectors.get(collectorType);
    if (!config) {
      throw new Error(`Collector ${collectorType} not found`);
    }

    const startTime = Date.now();
    
    try {
      // console.log(`🔄 Executing with ${config.name}...`);
      
      // Update execution status
      await this.updateExecutionStatus(executionId, collectorType, 'running');
      
      // Call collector API
      const response = await this.callCollectorAPI(config, request, collectorType);
      
      const executionTime = Date.now() - startTime;
      
      // Store result with ALL required fields
      await this.storeCollectorResult({
        queryId: request.queryId,
        executionId,
        collectorType,
        status: 'completed',
        response: response.answer || response.response,
        citations: response.citations || [],
        urls: response.urls || [],
        executionTimeMs: executionTime,
        metadata: response.metadata || {},
        // Add missing fields from request
        brandId: request.brandId,
        customerId: request.customerId
      });

      return {
        queryId: request.queryId,
        executionId,
        collectorType,
        status: 'completed',
        response: response.answer || response.response,
        citations: response.citations || [],
        urls: response.urls || [],
        executionTimeMs: executionTime,
        brandId: request.brandId,
        customerId: request.customerId
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack || undefined;
      
      // Enhanced error logging
      console.error(`❌ ${config.name} failed for query "${request.queryText.substring(0, 60)}...":`, {
        collectorType,
        queryId: request.queryId,
        brandId: request.brandId,
        error: errorMessage,
        stack: errorStack,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString()
      });
      
      // Update execution status with detailed error information
      const detailedError = {
        message: errorMessage,
        stack: errorStack,
        collectorType,
        timestamp: new Date().toISOString()
      };
      
      await this.updateExecutionStatus(executionId, collectorType, 'failed', JSON.stringify(detailedError));
      
      return {
        queryId: request.queryId,
        executionId,
        collectorType,
        status: 'failed',
        error: errorMessage,
        executionTimeMs: executionTime
      };
    }
  }

  /**
   * Call collector API using TypeScript services
   */
  private async callCollectorAPI(config: CollectorConfig, request: QueryExecutionRequest, collectorType: string): Promise<any> {
    // Route to OpenRouter-backed collectors
    if (config.baseUrl === 'openrouter') {
      try {
        return await openRouterCollectorService.executeQuery({
          prompt: request.queryText,
          collectorType
        });
      } catch (error: any) {
        throw new Error(`OpenRouter collector ${collectorType} failed: ${error.message}`);
      }
    }

    // Route to DataForSEO for Baidu, Bing, YouTube
    if (config.baseUrl === 'dataforseo') {
      try {
        return await dataForSeoCollectorService.executeQuery({
          prompt: request.queryText,
          source: collectorType as any,
          locale: request.locale,
          country: request.country
        });
      } catch (error: any) {
        throw new Error(`DataForSEO collector ${collectorType} failed: ${error.message}`);
      }
    }

    // Route to Oxylabs for Google AIO, Perplexity, Oxylabs Perplexity
    const sourceMap: { [key: string]: string } = {
      google_aio: 'google_ai_mode',
      perplexity: 'perplexity'
    };

    const oxylabsSource = sourceMap[collectorType] || collectorType;
    
    try {
      return await oxylabsCollectorService.executeQuery({
        prompt: request.queryText,
        source: oxylabsSource as any,
        brand: request.brandId,
        locale: request.locale,
        country: request.country
      });
    } catch (error: any) {
      throw new Error(`Oxylabs collector ${collectorType} failed: ${error.message}`);
    }
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(
    executionId: string, 
    collectorType: string, 
    status: string, 
    errorMessage?: string,
    snapshotId?: string
  ): Promise<void> {
    const mappedCollectorType = this.mapCollectorTypeToDatabase(collectorType);
    
    const updateData: any = {
      collector_type: mappedCollectorType,
      status,
      error_message: errorMessage,
      executed_at: new Date().toISOString()
    };

    // Add snapshot_id if provided (for BrightData collectors)
    if (snapshotId) {
      updateData.brightdata_snapshot_id = snapshotId;
    }

    const { error } = await supabase
      .from('query_executions')
      .update(updateData)
      .eq('id', executionId);

    if (error) {
      console.error('Failed to update execution status:', error);
    }
  }

  /**
   * Store collector result
   */
  private async storeCollectorResult(result: CollectorResult): Promise<void> {
    // Try to insert with execution_id first, fallback to without it
    const mappedCollectorType = this.mapCollectorTypeToDatabase(result.collectorType);
    
    console.log(`📝 Storing result with brandId: ${result.brandId}, customerId: ${result.customerId}`);
    
    // Get brand name from database
    let brandName = null;
    if (result.brandId) {
      try {
        const { data: brandData } = await this.supabase
          .from('brands')
          .select('name')
          .eq('id', result.brandId)
          .single();
        
        if (brandData) {
          brandName = brandData.name;
          console.log(`✅ Retrieved brand name: ${brandName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not retrieve brand name for ${result.brandId}:`, error);
      }
    }

    // Get query text from generated_queries table
    let queryText = null;
    if (result.queryId) {
      try {
        const { data: queryData } = await this.supabase
          .from('generated_queries')
          .select('query_text')
          .eq('id', result.queryId)
          .single();
        
        if (queryData) {
          queryText = queryData.query_text;
          console.log(`✅ Retrieved query text: ${queryText?.substring(0, 50)}...`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not retrieve query text for ${result.queryId}:`, error);
      }
    }

    // Get competitors from brand_competitors table
    let competitorsList: string[] = [];
    if (result.brandId) {
      try {
        const { data: competitorsData } = await this.supabase
          .from('brand_competitors')
          .select('competitor_name')
          .eq('brand_id', result.brandId);
        
        if (competitorsData && competitorsData.length > 0) {
          competitorsList = competitorsData.map(c => c.competitor_name).filter(Boolean);
          console.log(`✅ Retrieved ${competitorsList.length} competitors`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not retrieve competitors for ${result.brandId}:`, error);
      }
    }
    
    const insertData: any = {
      query_id: result.queryId,
      collector_type: mappedCollectorType,
      raw_answer: result.response,
      citations: result.citations,
      urls: result.urls,
      brand: brandName, // Add brand name
      question: queryText, // Add query text
      competitors: competitorsList.length > 0 ? competitorsList : null, // Add competitors as JSONB array (not stringified)
      metadata: {
        ...result.metadata,
        execution_time_ms: result.executionTimeMs,
        status: result.status,
        collected_by: 'main_process',
        collected_at: new Date().toISOString()
      }
    };

    // Add brand and customer IDs for multi-tenant support
    if (result.brandId) {
      insertData.brand_id = result.brandId;
      console.log(`✅ Added brand_id to insertData: ${insertData.brand_id}`);
    } else {
      console.log(`⚠️ No brandId in result object`);
    }
    
    if (result.customerId) {
      insertData.customer_id = result.customerId;
      console.log(`✅ Added customer_id to insertData: ${insertData.customer_id}`);
    } else {
      console.log(`⚠️ No customerId in result object`);
    }

    // Only add execution_id if the column exists
    if (result.executionId) {
      insertData.execution_id = result.executionId;
    }

    // Add snapshot_id for BrightData collectors
    if (result.snapshotId) {
      insertData.brightdata_snapshot_id = result.snapshotId;
      console.log(`✅ Added brightdata_snapshot_id: ${result.snapshotId}`);
    }

    console.log('📤 About to insert into collector_results:', JSON.stringify(insertData, null, 2));

    const { data: insertedData, error } = await this.supabase
      .from('collector_results')
      .insert(insertData)
      .select();

    if (error) {
      console.error('❌ Failed to store collector result:', error);
      console.error('❌ Insert data was:', JSON.stringify(insertData, null, 2));
      
      // If execution_id column doesn't exist, try without it
      if (error.code === 'PGRST204' && result.executionId) {
        console.log('🔄 Retrying without execution_id...');
        const { error: retryError } = await this.supabase
          .from('collector_results')
          .insert({
            query_id: result.queryId,
            collector_type: mappedCollectorType,
            raw_answer: result.response,
            citations: result.citations,
            urls: result.urls,
            question: queryText,
            competitors: competitorsList.length > 0 ? competitorsList : null,
            brightdata_snapshot_id: result.snapshotId,
            metadata: {
              ...result.metadata,
              execution_time_ms: result.executionTimeMs,
              status: result.status,
              execution_id: result.executionId // Store in metadata instead
            }
          });

        if (retryError) {
          console.error('Failed to store collector result (retry):', retryError);
        } else {
          console.log('✅ Successfully stored collector result without execution_id column');
        }
      }
    } else {
      console.log('✅ Successfully stored collector result');
      console.log('📥 Inserted data returned from DB:', JSON.stringify(insertedData, null, 2));
      
      // Generate keywords from the answer (async, non-blocking)
      if (insertedData && insertedData.length > 0 && result.response) {
        const collectorResultId = insertedData[0].id;
        this.generateKeywordsForResult(
          result.response,
          result.queryId,
          collectorResultId,
          result.brandId,
          result.customerId,
          queryText,
          result.citations || []
        ).catch(error => {
          console.warn('⚠️ Keyword generation failed (non-blocking):', error);
        });
      }
    }
  }

  /**
   * Generate keywords for a collector result
   */
  private async generateKeywordsForResult(
    answer: string,
    queryId?: string,
    collectorResultId?: string,
    brandId?: string,
    customerId?: string,
    queryText?: string,
    citations?: string[]
  ): Promise<void> {
    try {
      console.log('🔑 Generating keywords for collector result...');

      // No need to fetch topics or categories - LLM will extract keywords directly from answer

      // Generate keywords using LLM
      const keywordResponse = await keywordGenerationService.generateKeywords({
        answer,
        query_id: queryId,
        query_text: queryText, // Pass query text for context
        collector_result_id: collectorResultId,
        brand_id: brandId,
        customer_id: customerId,
        max_keywords: 20
      });

      // Store keywords in database (both collector_results and generated_keywords tables)
      if (keywordResponse.keywords.length > 0) {
        await keywordGenerationService.storeKeywords(keywordResponse.keywords, {
          answer,
          query_id: queryId,
          query_text: queryText, // Pass query text for context
          collector_result_id: collectorResultId,
          brand_id: brandId,
          customer_id: customerId
        });

        console.log(`✅ Generated and stored ${keywordResponse.keywords.length} keywords`);
      }
    } catch (error) {
      console.error('❌ Error generating keywords:', error);
      // Don't throw - keyword generation is non-blocking
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<any> {
    const { data, error } = await supabase
      .from('query_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) {
      throw new Error(`Failed to get execution status: ${error.message}`);
    }

    return data;
  }

  /**
   * Get collector results for a query
   */
  async getQueryResults(queryId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('collector_results')
      .select('*')
      .eq('query_id', queryId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get query results: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Check collector health using priority-based service
   */
  async checkCollectorHealth(collectorType: string): Promise<boolean> {
    try {
      // Use priority collector service for health checks
      const healthStatus = await priorityCollectorService.checkCollectorHealth(collectorType);
      return Object.values(healthStatus).some(status => status === true);
    } catch (error) {
      console.error(`Priority health check failed for ${collectorType}:`, error);
      return false;
    }
  }

  /**
   * Get all collector health status
   */
  async getAllCollectorHealth(): Promise<Record<string, boolean>> {
    const healthStatus: Record<string, boolean> = {};
    
    for (const [collectorType] of this.collectors) {
      healthStatus[collectorType] = await this.checkCollectorHealth(collectorType);
    }

    return healthStatus;
  }
}

export const dataCollectionService = new DataCollectionService();
