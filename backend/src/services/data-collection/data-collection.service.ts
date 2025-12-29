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
import { transitionCollectorResultByExecution } from './collector-results-status';

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
  suppressScoring?: boolean;
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
  suppressScoring?: boolean;
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
  }

  /**
   * Execute queries across multiple collectors
   * Process in batches to avoid overwhelming the API
   */
  async executeQueries(requests: QueryExecutionRequest[]): Promise<CollectorResult[]> {
    const results: CollectorResult[] = [];
    const BATCH_SIZE = 3; // Process 3 queries at a time
    // Process requests in batches
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (request, batchIndex) => {
        const queryNum = i + batchIndex + 1;
        try {
          // Execute across enabled collectors with retry mechanism
          // Each collector will create its own execution record
          const collectorResults = await this.executeQueryAcrossCollectorsWithRetry(request, 2); // 2 retries
          if (!collectorResults || collectorResults.length === 0) {
            return await this.createFailedExecutionsForCollectors(
              request,
              new Error('All collectors failed'),
              0
            );
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

          return await this.createFailedExecutionsForCollectors(
            request,
            error instanceof Error ? error : new Error(errorMessage),
            0
          );
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause
      }
    }

    // Enhanced summary logging
    const successCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const totalExecutions = results.length;
    if (totalExecutions > 0) {
    }
    
    if (failedCount > 0) {
    }
    
    return results;
  }

  private async createFailedExecutionsForCollectors(
    request: QueryExecutionRequest,
    error: Error,
    attemptNumber: number
  ): Promise<CollectorResult[]> {
    const enabledCollectors = request.collectors.filter((collector) => this.collectors.get(collector)?.enabled);
    const results: CollectorResult[] = [];

    for (const collectorType of enabledCollectors) {
      const collectorError = CollectorError.fromError(
        error,
        {
          queryId: request.queryId,
          queryText: request.queryText,
          collectorType,
          brandId: request.brandId,
          customerId: request.customerId,
        },
        attemptNumber
      );

      const executionId = await this.createQueryExecutionForCollector(
        request,
        collectorType,
        'failed',
        collectorError
      );

      results.push({
        queryId: request.queryId,
        executionId,
        collectorType,
        status: 'failed',
        error: collectorError.message,
        brandId: request.brandId,
        customerId: request.customerId,
        executionTimeMs: 0,
        suppressScoring: request.suppressScoring,
      });
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
      return await this.createFailedExecutionsForCollectors(
        request,
        new Error(`Circuit breaker is open for collectors: ${request.collectors.join(', ')}`),
        0
      );
    }
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Calculate exponential backoff with jitter
          const baseDelay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 0.3 * baseDelay; // Up to 30% jitter
          const delayMs = baseDelay + jitter;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const results = await this.executeQueryAcrossCollectors(request);
        
        // Reset circuit breaker on success
        if (attempt > 0) {
          this.resetCircuitBreaker(collectorKeys);
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
        // Don't retry on non-retryable errors
        if (!collectorError.retryable) {
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
      }
    }

    let competitorsList: string[] = [];
    if (request.brandId) {
      try {
        const { data: competitorsData } = await this.supabase
          .from('brand_competitors')
          .select('competitor_name')
          .eq('brand_id', request.brandId);

        if (competitorsData && competitorsData.length > 0) {
          competitorsList = competitorsData.map((c: any) => c.competitor_name).filter(Boolean);
        }
      } catch (error) {
      }
    }

    let topicFromQuery: string | null = null;
    if (request.queryId) {
      try {
        const { data: queryData } = await this.supabase
          .from('generated_queries')
          .select('topic, metadata')
          .eq('id', request.queryId)
          .single();

        if (queryData) {
          topicFromQuery = queryData.topic || queryData.metadata?.topic_name || queryData.metadata?.topic || null;
        }
      } catch (error) {
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
        collectors: request.collectors,
        suppress_scoring: request.suppressScoring === true,
      },
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
    const { data, error } = await supabase
      .from('query_executions')
      .insert(insertData)
      .select('id, status')
      .single();

    if (error) {
      console.error(`❌ Failed to create query execution for ${collectorType}:`, error);
      throw new Error(`Failed to create query execution: ${error.message}`);
    }

    if (data?.id) {
      try {
        const createdTransition = {
          from: null,
          to:
            status === 'failed'
              ? (collectorError?.retryable ? 'failed_retry' : 'failed')
              : 'processing',
          at: new Date().toISOString(),
          source: 'data_collection:init',
          ...(request.brandId ? { brand_id: request.brandId } : {}),
          ...(request.customerId ? { customer_id: request.customerId } : {}),
          execution_id: data.id,
          collector_type: mappedCollectorType,
          ...(snapshotId ? { brightdata_snapshot_id: snapshotId } : {}),
        };

        const pendingCollectorResult: any = {
          query_id: request.queryId,
          collector_type: mappedCollectorType,
          raw_answer: null,
          citations: null,
          urls: null,
          question: request.queryText || null,
          brand: brandName,
          competitors: competitorsList.length > 0 ? competitorsList : null,
          topic: topicFromQuery || null,
          brand_id: request.brandId,
          customer_id: request.customerId,
          execution_id: data.id,
          status:
            status === 'failed'
              ? (collectorError?.retryable ? 'failed_retry' : 'failed')
              : 'processing',
          metadata: {
            intent: request.intent,
            locale: request.locale,
            country: request.country,
            collectors: request.collectors,
            suppress_scoring: request.suppressScoring === true,
            last_status_transition: createdTransition,
            status_transitions: [createdTransition],
          },
        };

        if (snapshotId) {
          pendingCollectorResult.brightdata_snapshot_id = snapshotId;
        }

        if (collectorError && status === 'failed') {
          pendingCollectorResult.error_message = collectorError.message;
        }

        const { error: pendingInsertError } = await this.supabase
          .from('collector_results')
          .insert(pendingCollectorResult)
          .select('id')
          .maybeSingle();

        if (pendingInsertError) {
          if (pendingInsertError.code !== 'PGRST204') {
          }
        }
      } catch (collectorResultInsertError) {
      }
    }

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

    // ENFORCE: If status is 'completed', verify raw_answer exists
    let finalStatus = status;
    if (status === 'completed') {
      try {
        const { data: result } = await this.supabase
          .from('collector_results')
          .select('raw_answer')
          .eq('execution_id', executionId)
          .maybeSingle();

        if (!result || !result.raw_answer || (typeof result.raw_answer === 'string' && result.raw_answer.trim().length === 0)) {
          console.warn(`[query_executions] executionId=${executionId} cannot be 'completed' because raw_answer is null/empty in collector_results. Downgrading to 'running'.`);
          finalStatus = 'running';
        }
      } catch (error) {
        console.error(`[query_executions] Error checking raw_answer for executionId=${executionId}:`, error);
        finalStatus = 'running';
      }
    }

    // Log status update for debugging
    const updateData: any = {
      status: finalStatus,
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
    } else {
    }

    try {
      const mappedCollectorType = this.mapCollectorTypeToDatabase(collectorType);
      const collectorResultStatus =
        finalStatus === 'failed'
          ? (collectorError?.retryable ? 'failed_retry' : 'failed')
          : finalStatus === 'pending' || finalStatus === 'running'
            ? 'processing'
            : 'completed';

      const collectorUpdate: any = {};
      if (snapshotId) collectorUpdate.brightdata_snapshot_id = snapshotId;
      if (collectorError && finalStatus === 'failed') collectorUpdate.error_message = collectorError.message;

      await transitionCollectorResultByExecution(
        this.supabase,
        executionId,
        mappedCollectorType,
        collectorResultStatus,
        {
          source: 'data_collection:updateExecutionStatus',
          reason: finalStatus,
          executionId,
          collectorType: mappedCollectorType,
          snapshotId,
        },
        collectorUpdate
      );
    } catch (collectorStatusUpdateError) {
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
          await this.updateExecutionStatus(result.executionId, result.collectorType, 'completed');
        }
        // If execution is 'running' but result status is 'failed', update to 'failed'
        else if (execution.status === 'running' && result.status === 'failed') {
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
          console.warn(`[query_executions] Found execution ${result.executionId} in 'completed' status but no raw_answer found. Downgrading to 'running'.`);
          await this.updateExecutionStatus(result.executionId, result.collectorType, 'running');
        }

      } catch (error: any) {
        console.error(`❌ Error verifying execution ${result.executionId}:`, error.message);
        // Don't throw - continue with other executions
      }
    }
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

      // Store result if successful
      if (result.status === 'completed') {
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

        // Update execution status with snapshot_id if available
        // This is done AFTER storeCollectorResult so updateExecutionStatus can verify raw_answer
        await this.updateExecutionStatus(
          executionId, 
          collectorType, 
          'completed', 
          undefined,
          result.snapshotId
        );
      } else if (result.status === 'running') {
        await this.updateExecutionStatus(executionId, collectorType, 'running', undefined, result.snapshotId);
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
        rawResponseJson: rawResponseJson,
        suppressScoring: request.suppressScoring
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
        }
      } catch (error) {
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
          if (topicFromQuery) {
          }
        }
      } catch (error) {
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
        }
      } catch (error) {
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
      status: result.status === 'failed' ? 'failed' : result.status,
      metadata: (() => {
        // Remove raw_response_json from metadata to avoid 413 Request Entity Too Large errors
        const { raw_response_json: _, ...metadataWithoutRawJson } = result.metadata || {};
        return {
          ...metadataWithoutRawJson,
          execution_time_ms: result.executionTimeMs, // Also store in metadata for backward compatibility
          status: result.status,
          collected_by: 'main_process',
          collected_at: new Date().toISOString(),
          suppress_scoring: result.suppressScoring === true,
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
    } else {
    }
    
    if (result.customerId) {
      insertData.customer_id = result.customerId;
    } else {
    }

    // Only add execution_id if the column exists
    if (result.executionId) {
      insertData.execution_id = result.executionId;
    }

    // Add snapshot_id for BrightData collectors
    if (result.snapshotId) {
      insertData.brightdata_snapshot_id = result.snapshotId;
    }

    // Add raw_response_json if available
    if (result.rawResponseJson) {
      insertData.raw_response_json = result.rawResponseJson;
    }
    let insertedData: any[] | null = null;
    let error: any = null;

    if (result.executionId) {
      try {
        const { status: toStatus, ...updateFields } = insertData;
        const transition = await transitionCollectorResultByExecution(
          this.supabase,
          result.executionId,
          mappedCollectorType,
          toStatus,
          {
            source: 'data_collection:storeCollectorResult',
            reason: toStatus,
            brandId: result.brandId,
            customerId: result.customerId,
            executionId: result.executionId,
            collectorType: mappedCollectorType,
            snapshotId: result.snapshotId,
          },
          updateFields
        );

        if (transition.collectorResultId) {
          insertedData = [{ id: transition.collectorResultId }];
        }
      } catch (updateException) {
      }
    }

    if (!insertedData) {
      const storedTransition = {
        from: null,
        to: insertData.status,
        at: new Date().toISOString(),
        source: 'data_collection:storeCollectorResult',
        ...(result.brandId ? { brand_id: result.brandId } : {}),
        ...(result.customerId ? { customer_id: result.customerId } : {}),
        ...(result.executionId ? { execution_id: result.executionId } : {}),
        collector_type: mappedCollectorType,
        ...(result.snapshotId ? { brightdata_snapshot_id: result.snapshotId } : {}),
      };
      insertData.metadata = {
        ...(insertData.metadata || {}),
        last_status_transition: storedTransition,
        status_transitions: [storedTransition],
      };

      const insertResult = await this.supabase
        .from('collector_results')
        .insert(insertData)
        .select();
      insertedData = insertResult.data || null;
      error = insertResult.error;
    }

    if (error) {
      console.error('❌ Failed to store collector result:', error);
      console.error('❌ Insert data was:', JSON.stringify(insertData, null, 2));
      
      // If execution_id column doesn't exist, try without it
      if (error.code === 'PGRST204' && result.executionId) {
        const { error: retryError } = await this.supabase
          .from('collector_results')
          .insert({
            query_id: result.queryId,
            collector_type: mappedCollectorType,
            raw_answer: result.response,
            citations: result.citations,
            urls: result.urls,
            brand: brandName,
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
        }
      }
    } else {
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
                await this.updateExecutionStatus(result.executionId, result.collectorType, 'completed');
              } else if (result.status === 'failed') {
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
              await this.updateExecutionStatus(result.executionId, result.collectorType, 'completed');
            }
            // If execution is still 'running' but result is 'failed', fix it
            else if (execution.status === 'running' && result.status === 'failed') {
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
        });
      }

      // 🎯 Trigger automatic scoring for this brand (position extraction, sentiment scoring, citation extraction)
      // Run asynchronously to not block data collection
      // Only trigger scoring if raw_answer is populated (skip for async BrightData requests that will be updated later)
      const hasAnswer = result.response && result.response.trim().length > 0;
      if (!result.suppressScoring && insertedData && insertedData.length > 0 && result.brandId && result.customerId && hasAnswer) {
        try {
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
        } catch (scoringError) {
          // Don't throw - scoring failure shouldn't block data collection
        }
      } else if (insertedData && insertedData.length > 0 && result.brandId && result.customerId && !hasAnswer) {
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
