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
import { CollectorError, ErrorType } from './types/collector-errors';

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

const verboseLogging = process.env.COLLECTOR_VERBOSE_LOGS === 'true';
const logVerbose = (...args: any[]) => {
  if (verboseLogging) {
    console.log(...args);
  }
};

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
  rawResponseJson?: any; // Raw JSON response from collector API
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
  private circuitBreakers: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();
  
  // Retry configuration from environment variables
  private maxRetries: number = parseInt(process.env['DATA_COLLECTION_MAX_RETRIES'] || '3', 10);
  private retryBaseDelayMs: number = parseInt(process.env['DATA_COLLECTION_RETRY_BASE_DELAY_MS'] || '1000', 10);
  private circuitBreakerThreshold: number = parseInt(process.env['DATA_COLLECTION_CIRCUIT_BREAKER_THRESHOLD'] || '5', 10);
  private circuitBreakerTimeoutMs: number = 60000; // 1 minute

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
      enabled: true,
      baseUrl: 'priority',
      timeout: 30000, // Reduced to 30s for faster fallback
      retries: 1, // Reduced retries
      priority: 1
    });

    // Google AIO Collector (via Priority/BrightData)
    this.collectors.set('google_aio', {
      name: 'Google AIO Collector',
      enabled: true,
      baseUrl: 'priority', // ✅ Changed to priority to use BrightData
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 2
    });

    // Perplexity Collector (via Priority/BrightData)
    this.collectors.set('perplexity', {
      name: 'Perplexity Collector',
      enabled: true,
      baseUrl: 'priority', // ✅ Changed to priority to use BrightData
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 3
    });

    // Bing Copilot Collector (via BrightData)
    // Note: 'copilot' and 'microsoft-copilot' are mapped to 'bing_copilot' in brand.service.ts
    this.collectors.set('bing_copilot', {
      name: 'Bing Copilot Collector',
      enabled: true, // ✅ Enabled with BrightData
      baseUrl: 'priority',
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 4
    });

   
    this.collectors.set('claude', {
      name: 'Claude Collector',
      enabled: true, 
      baseUrl: 'priority',
      timeout: 30000,
      retries: 2,
      priority: 5
    });

    // Grok Collector (via BrightData)
    this.collectors.set('grok', {
      name: 'Grok Collector',
      enabled: true, // ✅ Enabled with BrightData
      baseUrl: 'priority',
      timeout: 300000, // Increased to 5 minutes for BrightData async processing
      retries: 2,
      priority: 6
    });

    // Gemini Collector (replacing YouTube)
    this.collectors.set('gemini', {
      name: 'Gemini Collector',
      enabled: true, // ✅ Enabled with priority-based fallback
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

    logVerbose('🔧 Data Collection Service initialized with collectors:', Array.from(this.collectors.keys()));
  }

  /**
   * Execute queries across multiple collectors
   * Process in batches to avoid overwhelming the API
   */
  async executeQueries(requests: QueryExecutionRequest[]): Promise<CollectorResult[]> {
    const results: CollectorResult[] = [];
    const BATCH_SIZE = 3; // Process 3 queries at a time
    
    logVerbose(`📊 Processing ${requests.length} queries in batches of ${BATCH_SIZE}...`);

    // Process requests in batches
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      logVerbose(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(requests.length / BATCH_SIZE)} (queries ${i + 1}-${Math.min(i + BATCH_SIZE, requests.length)})`);
      
      const batchPromises = batch.map(async (request, batchIndex) => {
        const queryNum = i + batchIndex + 1;
        try {
          logVerbose(`\n🚀 [${queryNum}/${requests.length}] Executing: "${request.queryText.substring(0, 60)}..."`);
          
          // Execute across enabled collectors with retry mechanism
          // Each collector will create its own execution record
          const collectorResults = await this.executeQueryAcrossCollectorsWithRetry(request, 2); // 2 retries
          logVerbose(`✅ [${queryNum}/${requests.length}] Completed ${collectorResults.length} collector executions`);
          
          // If all collectors failed, create a failed collector_result entry so the query is tracked
          if (collectorResults.length === 0 || collectorResults.every(r => r.status === 'failed')) {
            console.warn(`⚠️ [${queryNum}/${requests.length}] All collectors failed for query "${request.queryText.substring(0, 60)}...". Creating failed collector_result entry.`);
            try {
              // Create a failed collector_result entry to track this query attempt
              await this.storeCollectorResult({
                queryId: request.queryId,
                executionId: '', // No execution ID since all collectors failed
                collectorType: request.collectors.join(','),
                status: 'failed',
                error: collectorResults.length > 0 
                  ? collectorResults.map(r => r.error).filter(Boolean).join('; ') 
                  : 'All collectors failed',
                brandId: request.brandId,
                customerId: request.customerId,
                executionTimeMs: 0
              });
            } catch (storeError) {
              console.error(`❌ Failed to store failed collector_result for query ${request.queryId}:`, storeError);
            }
          }
          
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
          
          // Create a failed collector_result entry even when exception is thrown
          try {
            await this.storeCollectorResult({
              queryId: request.queryId,
              executionId: '',
              collectorType: request.collectors.join(','),
              status: 'failed',
              error: errorMessage,
              brandId: request.brandId,
              customerId: request.customerId,
              executionTimeMs: 0
            });
          } catch (storeError) {
            console.error(`❌ Failed to store failed collector_result for query ${request.queryId}:`, storeError);
          }
          
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < requests.length) {
        logVerbose('⏸️  Brief pause before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause
      }
    }

    // Enhanced summary logging
    const successCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const totalExecutions = results.length;
    
    logVerbose(`\n✅ All queries processed. Summary:`);
    logVerbose(`   Total executions: ${totalExecutions}`);
    if (totalExecutions > 0) {
      logVerbose(`   Successful: ${successCount} (${Math.round((successCount / totalExecutions) * 100)}%)`);
      logVerbose(`   Failed: ${failedCount} (${Math.round((failedCount / totalExecutions) * 100)}%)`);
    }
    
    if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount} collector executions failed. Check logs above for details.`);
    }
    
    return results;
  }

  /**
   * Execute query across multiple collectors with enhanced retry mechanism
   * Includes smart retry logic, exponential backoff with jitter, and circuit breaker
   */
  private async executeQueryAcrossCollectorsWithRetry(
    request: QueryExecutionRequest,
    maxRetries: number = this.maxRetries
  ): Promise<CollectorResult[]> {
    let lastError: CollectorError | null = null;
    const collectorKeys = request.collectors.join(',');
    
    // Check circuit breaker for this collector combination
    if (this.isCircuitBreakerOpen(collectorKeys)) {
      console.warn(`🚫 Circuit breaker is OPEN for collectors: ${request.collectors.join(', ')}. Skipping execution.`);
      throw new Error(`Circuit breaker is open for collectors: ${request.collectors.join(', ')}`);
    }
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logVerbose(`🔄 Retry attempt ${attempt}/${maxRetries} for query: "${request.queryText.substring(0, 60)}..."`);
          
          // Calculate exponential backoff with jitter
          const baseDelay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 0.3 * baseDelay; // Up to 30% jitter
          const delayMs = baseDelay + jitter;
          
          logVerbose(`⏸️  Waiting ${Math.round(delayMs)}ms before retry (base: ${baseDelay}ms, jitter: ${Math.round(jitter)}ms)`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const results = await this.executeQueryAcrossCollectors(request);
        
        // Reset circuit breaker on success
        if (attempt > 0) {
          this.resetCircuitBreaker(collectorKeys);
          logVerbose(`✅ Query succeeded on retry attempt ${attempt}`);
        }
        
        return results;
      } catch (error: any) {
        // Convert error to CollectorError
        const collectorError = CollectorError.fromError(error, {
          queryId: request.queryId,
          queryText: request.queryText,
          collectorType: request.collectors.join(','),
          brandId: request.brandId,
          customerId: request.customerId
        }, attempt);
        
        lastError = collectorError;
        
        console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed:`, {
          errorType: collectorError.errorType,
          retryable: collectorError.retryable,
          message: collectorError.message
        });
        
        // Don't retry on non-retryable errors
        if (!collectorError.retryable) {
          logVerbose(`🚫 Error is non-retryable (${collectorError.errorType}). Stopping retries.`);
          throw collectorError;
        }
        
        // Check if we should continue retrying
        if (attempt >= maxRetries) {
          // Record failure in circuit breaker
          this.recordCircuitBreakerFailure(collectorKeys);
          break;
        }
      }
    }
    
    // All retries exhausted
    console.error(`❌ All ${maxRetries + 1} attempts failed for query: "${request.queryText.substring(0, 60)}..."`);
    
    // Record failure in circuit breaker
    this.recordCircuitBreakerFailure(collectorKeys);
    
    throw lastError || new CollectorError(
      ErrorType.UNKNOWN_ERROR,
      'Query execution failed after retries',
      {
        queryId: request.queryId,
        queryText: request.queryText,
        collectorType: request.collectors.join(','),
        attemptNumber: maxRetries,
        timestamp: new Date().toISOString(),
        brandId: request.brandId,
        customerId: request.customerId
      },
      false
    );
  }

  /**
   * Check if circuit breaker is open for a collector combination
   */
  private isCircuitBreakerOpen(collectorKey: string): boolean {
    const breaker = this.circuitBreakers.get(collectorKey);
    if (!breaker) {
      return false;
    }
    
    if (breaker.isOpen) {
      // Check if timeout has passed to try half-open state
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure > this.circuitBreakerTimeoutMs) {
        breaker.isOpen = false; // Move to half-open state
        logVerbose(`🟡 Circuit breaker moved to HALF-OPEN for: ${collectorKey}`);
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Record a failure in circuit breaker
   */
  private recordCircuitBreakerFailure(collectorKey: string): void {
    const breaker = this.circuitBreakers.get(collectorKey) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false
    };
    
    breaker.failures += 1;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= this.circuitBreakerThreshold) {
      breaker.isOpen = true;
      console.error(`🔴 Circuit breaker OPENED for: ${collectorKey} (${breaker.failures} consecutive failures)`);
    } else {
      console.warn(`⚠️ Circuit breaker: ${breaker.failures}/${this.circuitBreakerThreshold} failures for: ${collectorKey}`);
    }
    
    this.circuitBreakers.set(collectorKey, breaker);
  }

  /**
   * Reset circuit breaker on success
   */
  private resetCircuitBreaker(collectorKey: string): void {
    const breaker = this.circuitBreakers.get(collectorKey);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      this.circuitBreakers.set(collectorKey, breaker);
      logVerbose(`🟢 Circuit breaker RESET for: ${collectorKey}`);
    }
  }

  /**
   * Create query execution record in database for a specific collector
   */
  private async createQueryExecutionForCollector(
    request: QueryExecutionRequest, 
    collectorType: string, 
    status: string = 'pending',
    collectorError?: CollectorError,
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

    // Add error information if failed (using CollectorError format)
    if (collectorError) {
      const errorFormat = collectorError.toDatabaseFormat();
      insertData.error_message = errorFormat.error_message;
      insertData.error_metadata = errorFormat.error_metadata;
      
      // Also add retry_count and retry_history if available
      if (collectorError.context.attemptNumber > 0) {
        insertData.retry_count = collectorError.context.attemptNumber;
        insertData.retry_history = [{
          attempt: collectorError.context.attemptNumber,
          timestamp: collectorError.context.timestamp,
          error_type: collectorError.errorType,
          retryable: collectorError.retryable
        }];
      }
    }

    logVerbose(`📝 Creating query execution for ${collectorType} with status: ${status}`);
    
    const { data, error } = await supabase
      .from('query_executions')
      .insert(insertData)
      .select('id, status')
      .single();

    if (error) {
      console.error(`❌ Failed to create query execution for ${collectorType}:`, error);
      throw new Error(`Failed to create query execution: ${error.message}`);
    }

    logVerbose(`✅ Successfully created query execution ${data.id} for ${collectorType} with status: ${status}`);
    return data.id;
  }

  /**
   * Update query execution status with enhanced error handling
   */
  private async updateExecutionStatus(
    executionId: string,
    collectorType: string,
    status: string,
    collectorError?: CollectorError,
    snapshotId?: string
  ): Promise<void> {
    // Validate status transition
    const validStatuses = ['pending', 'running', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      console.error(`❌ Invalid status '${status}' for execution ${executionId}`);
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Log status update for debugging
    logVerbose(`🔄 Updating execution ${executionId} (${collectorType}) status to: ${status}`);

    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };

    // Add error information if failed
    if (collectorError && status === 'failed') {
      const errorFormat = collectorError.toDatabaseFormat();
      updateData.error_message = errorFormat.error_message;
      updateData.error_metadata = errorFormat.error_metadata;
      
      // Update retry_count and retry_history
      if (collectorError.context.attemptNumber > 0) {
        updateData.retry_count = collectorError.context.attemptNumber;
        
        // Get existing retry_history and append
        const { data: existing } = await this.supabase
          .from('query_executions')
          .select('retry_history, retry_count')
          .eq('id', executionId)
          .single();
        
        const existingHistory = existing?.retry_history || [];
        updateData.retry_history = [
          ...existingHistory,
          {
            attempt: collectorError.context.attemptNumber,
            timestamp: collectorError.context.timestamp,
            error_type: collectorError.errorType,
            retryable: collectorError.retryable
          }
        ];
      }
    }

    // Add snapshot_id if provided
    if (snapshotId) {
      updateData.brightdata_snapshot_id = snapshotId;
    }

    const { data, error } = await this.supabase
      .from('query_executions')
      .update(updateData)
      .eq('id', executionId)
      .select('id, status');

    if (error) {
      console.error(`❌ Failed to update execution status for ${executionId}:`, error);
      throw new Error(`Failed to update execution status: ${error.message}`);
    }

    // Verify the update was successful
    if (!data || data.length === 0) {
      console.warn(`⚠️ No rows updated for execution ${executionId} - execution may not exist`);
    } else {
      logVerbose(`✅ Successfully updated execution ${executionId} status to: ${status}`);
    }
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
        // Convert error to CollectorError
        const error = result.reason || new Error('Unknown error');
        const collectorError = CollectorError.fromError(error, {
          queryId: request.queryId,
          queryText: request.queryText,
          collectorType: collectorType,
          brandId: request.brandId,
          customerId: request.customerId
        }, 0);
        
        this.createQueryExecutionForCollector(request, collectorType, 'failed', collectorError)
          .catch(err => console.error(`Failed to create execution record for ${collectorType}:`, err));
        
        results.push({
          queryId: request.queryId,
          executionId: '', // Will be populated by createQueryExecutionForCollector if needed
          collectorType,
          status: 'failed',
          error: collectorError.message,
          metadata: {
            error_type: collectorError.errorType,
            retryable: collectorError.retryable
          }
        });
      }
    });

    // After all collectors finish, verify and fix any execution statuses that don't match their results
    await this.verifyAndFixExecutionStatuses(results);

    return results;
  }

  /**
   * Verify and fix execution statuses based on collector results
   * This ensures executions are marked as 'completed' if results exist, or 'failed' if they don't
   */
  private async verifyAndFixExecutionStatuses(collectorResults: CollectorResult[]): Promise<void> {
    if (collectorResults.length === 0) return;

    logVerbose(`🔍 Verifying execution statuses for ${collectorResults.length} collector results...`);

    for (const result of collectorResults) {
      if (!result.executionId) continue; // Skip if no execution ID

      try {
        // Check current execution status
        const { data: execution, error: fetchError } = await this.supabase
          .from('query_executions')
          .select('id, status, collector_type')
          .eq('id', result.executionId)
          .single();

        if (fetchError || !execution) {
          console.warn(`⚠️ Execution ${result.executionId} not found, skipping verification`);
          continue;
        }

        // Check if result exists in collector_results
        const { data: storedResult, error: resultError } = await this.supabase
          .from('collector_results')
          .select('id, execution_id, raw_answer')
          .eq('execution_id', result.executionId)
          .single();

        // If execution is still 'running' but we have a result, update to 'completed'
        if (execution.status === 'running' && storedResult && storedResult.raw_answer) {
          logVerbose(`🔧 Fixing: Execution ${result.executionId} is 'running' but has result, updating to 'completed'`);
          await this.updateExecutionStatus(result.executionId, result.collectorType, 'completed');
        }
        // If execution is 'running' but result status is 'failed', update to 'failed'
        else if (execution.status === 'running' && result.status === 'failed') {
          logVerbose(`🔧 Fixing: Execution ${result.executionId} is 'running' but result is 'failed', updating to 'failed'`);
          const collectorError = result.error 
            ? CollectorError.fromError(new Error(result.error), {
                queryId: result.queryId,
                queryText: '',
                collectorType: result.collectorType,
                brandId: result.brandId,
                customerId: result.customerId
              }, 0)
            : undefined;
          await this.updateExecutionStatus(result.executionId, result.collectorType, 'failed', collectorError);
        }
        // If execution is 'completed' but no result exists, this is a data inconsistency
        else if (execution.status === 'completed' && (!storedResult || !storedResult.raw_answer)) {
          console.warn(`⚠️ Data inconsistency: Execution ${result.executionId} is 'completed' but no result found`);
        }

      } catch (error: any) {
        console.error(`❌ Error verifying execution ${result.executionId}:`, error.message);
        // Don't throw - continue with other executions
      }
    }

    logVerbose(`✅ Finished verifying execution statuses`);
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
        // Extract raw_response_json from metadata if available (but don't store it back in metadata to avoid 413 errors)
        const rawResponseJson = result.metadata?.raw_response_json;
        
        // Remove raw_response_json from metadata to avoid 413 Request Entity Too Large errors
        const { raw_response_json: _, ...metadataWithoutRawJson } = result.metadata || {};
        
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
            ...metadataWithoutRawJson,
            provider: result.provider,
            fallbackUsed: result.fallbackUsed,
            fallbackChain: result.fallbackChain
          },
          brandId: result.brandId,
          customerId: result.customerId,
          snapshotId: result.snapshotId,
          rawResponseJson: rawResponseJson
        });
      } else {
        // Update execution status for failed attempts
        // Create CollectorError from result.error if it's a string
        let collectorError: CollectorError | undefined;
        if (result.error) {
          const error = typeof result.error === 'string' 
            ? new Error(result.error) 
            : result.error;
          collectorError = CollectorError.fromError(error, {
            queryId: request.queryId,
            queryText: request.queryText,
            collectorType: collectorType,
            brandId: request.brandId,
            customerId: request.customerId
          }, 0);
        }
        await this.updateExecutionStatus(executionId, collectorType, 'failed', collectorError, result.snapshotId);
      }

      return result;

    } catch (error: any) {
      // Create CollectorError from exception
      const collectorError = CollectorError.fromError(error, {
        queryId: request.queryId,
        queryText: request.queryText,
        collectorType: collectorType,
        brandId: request.brandId,
        customerId: request.customerId
      }, 0);
      
      console.error(`❌ Priority fallback failed for ${collectorType}:`, {
        errorType: collectorError.errorType,
        retryable: collectorError.retryable,
        message: collectorError.message,
        context: collectorError.context
      });
      
      // Create execution record if it wasn't created yet, or update existing one
      try {
        if (!executionId) {
          executionId = await this.createQueryExecutionForCollector(request, collectorType, 'failed', collectorError);
        } else {
          await this.updateExecutionStatus(executionId, collectorType, 'failed', collectorError);
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
        error: collectorError.message,
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
      // Extract raw_response_json from metadata if available (but don't store it back in metadata to avoid 413 errors)
      const rawResponseJson = response.metadata?.raw_response_json;
      
      // Remove raw_response_json from metadata to avoid 413 Request Entity Too Large errors
      const { raw_response_json: _, ...metadataWithoutRawJson } = response.metadata || {};
      
      await this.storeCollectorResult({
        queryId: request.queryId,
        executionId,
        collectorType,
        status: 'completed',
        response: response.answer || response.response,
        citations: response.citations || [],
        urls: response.urls || [],
        executionTimeMs: executionTime,
        metadata: metadataWithoutRawJson || {},
        // Add missing fields from request
        brandId: request.brandId,
        customerId: request.customerId,
        rawResponseJson: rawResponseJson
      });

      // CRITICAL: Update execution status to 'completed' after successful result storage
      await this.updateExecutionStatus(executionId, collectorType, 'completed');

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
      
      // Create CollectorError from the exception
      const collectorError = CollectorError.fromError(error, {
        queryId: request.queryId,
        queryText: request.queryText,
        collectorType: collectorType,
        brandId: request.brandId,
        customerId: request.customerId
      }, 0);
      
      // Enhanced error logging with structured error
      console.error(`❌ ${config.name} failed for query "${request.queryText.substring(0, 60)}...":`, {
        collectorType,
        queryId: request.queryId,
        brandId: request.brandId,
        errorType: collectorError.errorType,
        retryable: collectorError.retryable,
        error: collectorError.message,
        context: collectorError.context,
        stack: collectorError.stack
      });
      
      // Update execution status with CollectorError
      await this.updateExecutionStatus(executionId, collectorType, 'failed', collectorError);
      
      return {
        queryId: request.queryId,
        executionId,
        collectorType,
        status: 'failed',
        error: collectorError.message,
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
   * Store collector result
   */
  private async storeCollectorResult(result: CollectorResult): Promise<void> {
    // Try to insert with execution_id first, fallback to without it
    const mappedCollectorType = this.mapCollectorTypeToDatabase(result.collectorType);
    
    logVerbose(`📝 Storing result with brandId: ${result.brandId}, customerId: ${result.customerId}`);
    
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
          logVerbose(`✅ Retrieved brand name: ${brandName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not retrieve brand name for ${result.brandId}:`, error);
      }
    }

    // Get query text and topic from generated_queries table
    let queryText = null;
    let topicFromQuery: string | null = null;
    if (result.queryId) {
      try {
        const { data: queryData } = await this.supabase
          .from('generated_queries')
          .select('query_text, topic, metadata')
          .eq('id', result.queryId)
          .single();
        
        if (queryData) {
          queryText = queryData.query_text;
          // Priority: 1) topic column, 2) metadata->>'topic_name', 3) metadata->>'topic'
          topicFromQuery = queryData.topic || 
                          queryData.metadata?.topic_name || 
                          queryData.metadata?.topic || 
                          null;
          logVerbose(`✅ Retrieved query text: ${queryText?.substring(0, 50)}...`);
          if (topicFromQuery) {
            logVerbose(`✅ Retrieved topic: ${topicFromQuery}`);
          }
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
          logVerbose(`✅ Retrieved ${competitorsList.length} competitors`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not retrieve competitors for ${result.brandId}:`, error);
      }
    }
    
    const insertData: any = {
      query_id: result.queryId,
      collector_type: mappedCollectorType,
      raw_answer: result.response || null, // Can be null for failed results
      citations: result.citations || null, // Can be null for failed results
      urls: result.urls || null, // Can be null for failed results
      brand: brandName, // Add brand name
      question: queryText, // Add query text
      competitors: competitorsList.length > 0 ? competitorsList : null, // Add competitors as JSONB array (not stringified)
      topic: topicFromQuery || null, // Store topic in dedicated column
      collection_time_ms: result.executionTimeMs || null, // Store collection time in dedicated column
      metadata: (() => {
        // Remove raw_response_json from metadata to avoid 413 Request Entity Too Large errors
        const { raw_response_json: _, ...metadataWithoutRawJson } = result.metadata || {};
        return {
          ...metadataWithoutRawJson,
          execution_time_ms: result.executionTimeMs, // Also store in metadata for backward compatibility
          status: result.status,
          collected_by: 'main_process',
          collected_at: new Date().toISOString(),
          ...(topicFromQuery ? { topic: topicFromQuery } : {}), // Also store in metadata for backward compatibility
          ...(result.error ? { error: result.error } : {}), // Store error message for failed results
          ...(result.status === 'failed' ? { failed: true, failed_at: new Date().toISOString() } : {})
        };
      })()
    };
    
    // Add error_message if status is failed
    if (result.status === 'failed' && result.error) {
      insertData.error_message = result.error;
    }

    // Add brand and customer IDs for multi-tenant support
    if (result.brandId) {
      insertData.brand_id = result.brandId;
      logVerbose(`✅ Added brand_id to insertData: ${insertData.brand_id}`);
    } else {
      logVerbose(`⚠️ No brandId in result object`);
    }
    
    if (result.customerId) {
      insertData.customer_id = result.customerId;
      logVerbose(`✅ Added customer_id to insertData: ${insertData.customer_id}`);
    } else {
      logVerbose(`⚠️ No customerId in result object`);
    }

    // Only add execution_id if the column exists
    if (result.executionId) {
      insertData.execution_id = result.executionId;
    }

    // Add snapshot_id for BrightData collectors
    if (result.snapshotId) {
      insertData.brightdata_snapshot_id = result.snapshotId;
      logVerbose(`✅ Added brightdata_snapshot_id: ${result.snapshotId}`);
    }

    // Add raw_response_json if available
    if (result.rawResponseJson) {
      insertData.raw_response_json = result.rawResponseJson;
      logVerbose(`✅ Added raw_response_json to insertData`);
    }

    logVerbose('📤 About to insert into collector_results:', JSON.stringify(insertData, null, 2));

    const { data: insertedData, error } = await this.supabase
      .from('collector_results')
      .insert(insertData)
      .select();

    if (error) {
      console.error('❌ Failed to store collector result:', error);
      console.error('❌ Insert data was:', JSON.stringify(insertData, null, 2));
      
      // If execution_id column doesn't exist, try without it
      if (error.code === 'PGRST204' && result.executionId) {
        logVerbose('🔄 Retrying without execution_id...');
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
            topic: topicFromQuery || null, // Store topic in dedicated column
            collection_time_ms: result.executionTimeMs || null, // Store collection time in dedicated column
            metadata: {
              ...result.metadata,
              execution_time_ms: result.executionTimeMs, // Also store in metadata for backward compatibility
              status: result.status,
              execution_id: result.executionId, // Store in metadata instead
              ...(topicFromQuery ? { topic: topicFromQuery } : {}) // Also store in metadata for backward compatibility
            }
          });

        if (retryError) {
          console.error('Failed to store collector result (retry):', retryError);
        } else {
          logVerbose('✅ Successfully stored collector result without execution_id column');
        }
      }
    } else {
      logVerbose('✅ Successfully stored collector result');
      logVerbose('📥 Inserted data returned from DB:', JSON.stringify(insertedData, null, 2));
      
      // CRITICAL: Verify execution status matches the stored result
      // This ensures status is updated even if the earlier update failed
      if (result.executionId) {
        try {
          const { data: execution } = await this.supabase
            .from('query_executions')
            .select('id, status')
            .eq('id', result.executionId)
            .single();

          if (execution) {
            // Check if a result actually exists in collector_results table
            const { data: storedResult } = await this.supabase
              .from('collector_results')
              .select('id, raw_answer')
              .eq('execution_id', result.executionId)
              .single();

            // If execution is still 'running' but we have a stored result, update status
            if (execution.status === 'running' && storedResult) {
              if (storedResult.raw_answer && result.status === 'completed') {
                logVerbose(`🔧 Auto-fixing: Execution ${result.executionId} is 'running' but result exists in DB, updating to 'completed'`);
                await this.updateExecutionStatus(result.executionId, result.collectorType, 'completed');
              } else if (result.status === 'failed') {
                logVerbose(`🔧 Auto-fixing: Execution ${result.executionId} is 'running' but result is 'failed', updating to 'failed'`);
                const collectorError = result.error 
                  ? CollectorError.fromError(new Error(result.error), {
                      queryId: result.queryId,
                      queryText: '',
                      collectorType: result.collectorType,
                      brandId: result.brandId,
                      customerId: result.customerId
                    }, 0)
                  : undefined;
                await this.updateExecutionStatus(result.executionId, result.collectorType, 'failed', collectorError);
              }
            }
            // If we just stored a successful result but status wasn't updated, fix it
            else if (execution.status === 'running' && result.status === 'completed' && storedResult?.raw_answer) {
              logVerbose(`🔧 Auto-fixing: Execution ${result.executionId} is 'running' but result was stored successfully, updating to 'completed'`);
              await this.updateExecutionStatus(result.executionId, result.collectorType, 'completed');
            }
            // If execution is still 'running' but result is 'failed', fix it
            else if (execution.status === 'running' && result.status === 'failed') {
              logVerbose(`🔧 Auto-fixing: Execution ${result.executionId} is 'running' but result is 'failed', updating to 'failed'`);
              const collectorError = result.error 
                ? CollectorError.fromError(new Error(result.error), {
                    queryId: result.queryId,
                    queryText: '',
                    collectorType: result.collectorType,
                    brandId: result.brandId,
                    customerId: result.customerId
                  }, 0)
                : undefined;
              await this.updateExecutionStatus(result.executionId, result.collectorType, 'failed', collectorError);
            }
          }
        } catch (verifyError) {
          console.warn(`⚠️ Failed to verify execution status for ${result.executionId}:`, verifyError);
          // Don't throw - result is already stored
        }
      }
      
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

      // 🎯 Trigger automatic scoring for this brand (position extraction, sentiment scoring, citation extraction)
      // Run asynchronously to not block data collection
      // Only trigger scoring if raw_answer is populated (skip for async BrightData requests that will be updated later)
      const hasAnswer = result.response && result.response.trim().length > 0;
      if (insertedData && insertedData.length > 0 && result.brandId && result.customerId && hasAnswer) {
        try {
          logVerbose(`🔄 Triggering automatic scoring for brand ${result.brandId} (new collector result inserted with answer)...`);
          // Import and trigger scoring asynchronously (non-blocking)
          const { brandScoringService } = await import('../scoring/brand-scoring.orchestrator');
          // Use async method to not block data collection response
          // Process all unprocessed results for this brand (don't use 'since' to process all pending results)
          brandScoringService.scoreBrandAsync({
            brandId: result.brandId,
            customerId: result.customerId,
            // Don't specify 'since' - process all unprocessed results for this brand
            // The scoring services will only process results that haven't been scored yet
            parallel: false // Run sequentially for better reliability
          });
          logVerbose(`✅ Automatic scoring triggered for brand ${result.brandId} (running in background)`);
        } catch (scoringError) {
          console.warn(`⚠️ Failed to trigger scoring for brand ${result.brandId} (non-blocking):`, scoringError);
          // Don't throw - scoring failure shouldn't block data collection
        }
      } else if (insertedData && insertedData.length > 0 && result.brandId && result.customerId && !hasAnswer) {
        logVerbose(`⏭️ Skipping scoring trigger for brand ${result.brandId} - raw_answer is empty (async request, will trigger after data is fetched)`);
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
      logVerbose('🔑 Generating keywords for collector result...');

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

        logVerbose(`✅ Generated and stored ${keywordResponse.keywords.length} keywords`);
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
