/**
 * Polling service for BrightData collectors
 * Handles snapshot polling and result extraction
 */

import { BrightDataRequest, BrightDataResponse, BrightDataError } from './types';
import { transitionCollectorResultById } from '../collector-results-status';
import { getEnvVar } from '../../../utils/env-utils';

const CIRCUIT_BREAKER_RESET_TIMEOUT_MS = parseInt(getEnvVar('BRIGHTDATA_CIRCUIT_BREAKER_RESET_TIMEOUT_MS') || '60000', 10); // 1 minute
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = parseInt(getEnvVar('BRIGHTDATA_CIRCUIT_BREAKER_FAILURE_THRESHOLD') || '3', 10);

export class BrightDataPollingService {
  private apiKey: string;
  private supabase: any;
  private failureCount: number = 0;
  private isCircuitOpen: boolean = false;
  private openedTimestamp: number = 0;

  constructor(apiKey: string, supabase: any) {
    this.apiKey = apiKey;
    this.supabase = supabase;
  }

  private checkCircuit(): void {
    if (this.isCircuitOpen) {
      const now = Date.now();
      if (now - this.openedTimestamp > CIRCUIT_BREAKER_RESET_TIMEOUT_MS) {
        // Circuit is half-open, allow one request to try
        this.isCircuitOpen = false;
        console.warn('⚠️ BrightData circuit breaker is now HALF-OPEN. Allowing a test request.');
      } else {
        throw new BrightDataError('BrightData circuit is OPEN. Requests are being short-circuited.', 503);
      }
    }
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    this.isCircuitOpen = false;
    console.log('✅ BrightData circuit breaker is CLOSED. All systems operational.');
  }

  private recordFailure(): void {
    this.failureCount++;
    console.warn(`❌ BrightData circuit breaker failure count: ${this.failureCount}/${CIRCUIT_BREAKER_FAILURE_THRESHOLD}`);
    if (this.failureCount >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      this.isCircuitOpen = true;
      this.openedTimestamp = Date.now();
      console.error('🛑 BrightData circuit breaker is now OPEN. Short-circuiting requests.');
    }
  }

  /**
   * Quick poll to check if snapshot result is ready (non-blocking, max 5 seconds)
   */
  async quickPollSnapshot(
    snapshotId: string,
    datasetId: string,
    request: BrightDataRequest,
    collectorType: string = 'chatgpt'
  ): Promise<BrightDataResponse | null> {
    this.checkCircuit(); // Check circuit status before making a request

    try {
      const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
      
      const response = await fetch(snapshotUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        return null;
      }

      if (response.status !== 200) {
        const errorBody = await response.text();
        console.error(`❌ BrightData API returned non-200 status: ${response.status}, body: ${errorBody}`);
        this.recordFailure(); // Record failure for non-200 responses
        throw new BrightDataError(`BrightData API returned non-200 status: ${response.status}`, response.status, { responseBody: errorBody });
      }
      
      const responseText = await response.text();
      let downloadResult: any;
      
      try {
        downloadResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ BrightData API response is not valid JSON: ${responseText.substring(0, 200)}...`, parseError);
        this.recordFailure(); // Record failure for JSON parsing errors
        throw new BrightDataError('BrightData API response is not valid JSON', 500, { responseBody: responseText });
      }
      
      // Handle different response structures
      let actualResult = downloadResult;
      
      if (Array.isArray(downloadResult) && downloadResult.length > 0) {
        actualResult = downloadResult[0];
      }
      
      if (actualResult && actualResult.data && Array.isArray(actualResult.data) && actualResult.data.length > 0) {
        actualResult = actualResult.data[0];
      }
      
      // Check if data is ready
      const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
      const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
      const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
      
      if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
        const { answer, urls } = this.extractAnswerAndUrls(actualResult);
        
        if (!answer || answer.trim().length === 0) {
          console.warn(`⚠️ BrightData snapshot ${snapshotId} returned empty answer after extraction.`);
          return null;
        }
        this.recordSuccess(); // Record success if data is valid
        return {
          query_id: `brightdata_${collectorType}_${Date.now()}`,
          run_start: new Date().toISOString(),
          run_end: new Date().toISOString(),
          prompt: request.prompt,
          answer: answer,
          response: answer,
          citations: urls,
          urls: urls,
          model_used: collectorType,
          collector_type: collectorType,
          metadata: {
            provider: `brightdata_${collectorType}`,
            dataset_id: datasetId,
            snapshot_id: snapshotId,
            success: true,
            brand: request.brand,
            locale: request.locale,
            country: request.country,
            raw_response_json: downloadResult
          }
        };
      }
      
      console.warn(`⚠️ BrightData snapshot ${snapshotId} data not ready yet.`);
      return null;
    } catch (error: any) {
      if (error instanceof BrightDataError) {
        throw error; // Re-throw custom errors directly
      } else {
        console.error(`❌ Unexpected error during quickPollSnapshot for ${snapshotId}:`, error);
        this.recordFailure(); // Record failure for unexpected errors
        throw new BrightDataError(`Unexpected error during quickPollSnapshot: ${error.message}`, 500, { originalError: error });
      }
    }
  }

  /**
   * Poll for snapshot results asynchronously (background process)
   */
  async pollForSnapshotAsync(
    snapshotId: string,
    collectorType: string,
    datasetId: string,
    request: BrightDataRequest
  ): Promise<void> {
    this.checkCircuit(); // Check circuit status before making a request

    const maxAttempts = 60; // 10 minutes max
    const pollInterval = 10000; // 10 seconds
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        
        const response = await fetch(snapshotUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.status === 202) {
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          }

          console.error(`❌ BrightData snapshot ${snapshotId} timed out - still processing after max attempts`);
          await this.markSnapshotFailed(
            snapshotId,
            collectorType,
            datasetId,
            request,
            'BrightData snapshot timed out - still processing after max attempts'
          );
          this.recordFailure();
          throw new BrightDataError(`BrightData snapshot ${snapshotId} timed out - still processing after max attempts`, 408);
        }
        
        if (response.status !== 200) {
          const errorBody = await response.text();
          console.error(`❌ BrightData API returned non-200 status: ${response.status}, body: ${errorBody}`);
          this.recordFailure();
          throw new BrightDataError(`BrightData API returned non-200 status: ${response.status}`, response.status, { responseBody: errorBody });
        }

        const responseText = await response.text();
        let downloadResult: any;
        
        try {
          downloadResult = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`❌ BrightData API response is not valid JSON: ${responseText.substring(0, 200)}...`, parseError);
          this.recordFailure();
          throw new BrightDataError('BrightData API response is not valid JSON', 500, { responseBody: responseText });
        }
        
        let actualResult = downloadResult;
        
        if (Array.isArray(downloadResult) && downloadResult.length > 0) {
          actualResult = downloadResult[0];
        }
        
        const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
        const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
        const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
        
        if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
          const { answer, urls } = this.extractAnswerAndUrls(actualResult);
          await this.updateDatabaseWithResults(snapshotId, collectorType, datasetId, request, answer, urls, downloadResult);
          this.recordSuccess(); // Record success if data is valid and processed
          return; // Success - exit polling
        }
        
        // Data not ready yet, wait and retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } else {
          console.error(`❌ Snapshot ${snapshotId} timed out after ${maxAttempts} attempts`);
          await this.markSnapshotFailed(
            snapshotId,
            collectorType,
            datasetId,
            request,
            'BrightData snapshot timed out - data not ready'
          );
          this.recordFailure();
          throw new BrightDataError(`BrightData snapshot ${snapshotId} timed out - data not ready`, 408, { snapshotId, actualResult });
        }
        
      } catch (error: any) {
        if (error instanceof BrightDataError) {
          throw error; // Re-throw custom errors directly
        } else {
          console.error(`❌ Unexpected error during pollForSnapshotAsync for ${snapshotId} (attempt ${attempt}):`, error);
          this.recordFailure(); // Record failure for unexpected errors
          throw new BrightDataError(`Unexpected error during pollForSnapshotAsync: ${error.message}`, 500, { originalError: error });
        }
      }
    }
  }

  /**
   * Poll for snapshot results (synchronous, blocking)
   */
  async pollForSnapshot(
    snapshotId: string,
    collectorType: string,
    datasetId: string,
    request: BrightDataRequest
  ): Promise<BrightDataResponse> {
    this.checkCircuit(); // Check circuit status before making a request

    const maxAttempts = 60; // 10 minutes max
    const pollInterval = 10000; // 10 seconds
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        
        const response = await fetch(snapshotUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.status === 202) {
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            await this.markSnapshotFailed(
              snapshotId,
              collectorType,
              datasetId,
              request,
              'BrightData snapshot timed out - still processing after max attempts'
            );
            this.recordFailure();
            throw new BrightDataError('BrightData snapshot timed out - still processing after max attempts', 408);
          }
        }
        
        if (response.status !== 200) {
          const errorBody = await response.text();
          console.error(`❌ BrightData API returned non-200 status: ${response.status}, body: ${errorBody}`);
          this.recordFailure();
          throw new BrightDataError(`BrightData API returned non-200 status: ${response.status}`, response.status, { responseBody: errorBody });
        }

        const responseText = await response.text();
        let downloadResult: any;
        
        try {
          downloadResult = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`❌ BrightData API response is not valid JSON: ${responseText.substring(0, 200)}...`, parseError);
          this.recordFailure();
          throw new BrightDataError('BrightData API response is not valid JSON', 500, { responseBody: responseText });
        }
        
        let actualResult = downloadResult;
        
        if (Array.isArray(downloadResult) && downloadResult.length > 0) {
          actualResult = downloadResult[0];
        }
        
        if (actualResult && actualResult.data && Array.isArray(actualResult.data) && actualResult.data.length > 0) {
          actualResult = actualResult.data[0];
        }
        
        const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
        const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
        const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
        
        if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
          const { answer, urls } = this.extractAnswerAndUrls(actualResult);
          
          if (!answer || answer.trim().length === 0) {
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));
              continue;
            } else {
              this.recordFailure();
              throw new BrightDataError('BrightData snapshot timed out - answer is empty after max attempts', 408, { snapshotId });
            }
          }
          this.recordSuccess(); // Record success if data is valid
          return {
            query_id: `brightdata_${collectorType}_${Date.now()}`,
            run_start: new Date().toISOString(),
            run_end: new Date().toISOString(),
            prompt: request.prompt,
            answer: answer,
            response: answer,
            citations: urls,
            urls: urls,
            model_used: collectorType,
            collector_type: collectorType,
            metadata: {
              provider: `brightdata_${collectorType}`,
              dataset_id: datasetId,
              snapshot_id: snapshotId,
              success: true,
              brand: request.brand,
              locale: request.locale,
              country: request.country,
              answer_section_html: actualResult.answer_section_html || undefined
            }
          };
        }
        
        // If we get here, data is not ready yet
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        } else {
          await this.markSnapshotFailed(
            snapshotId,
            collectorType,
            datasetId,
            request,
            'BrightData snapshot timed out - data not ready'
          );
          this.recordFailure();
          throw new BrightDataError('BrightData snapshot timed out - data not ready', 408, { snapshotId, actualResult });
        }
        
      } catch (error: any) {
        if (error instanceof BrightDataError) {
          throw error; // Re-throw custom errors directly
        } else {
          console.error(`❌ Unexpected error during pollForSnapshot for ${snapshotId} (attempt ${attempt}):`, error);
          this.recordFailure(); // Record failure for unexpected errors
          throw new BrightDataError(`Unexpected error during pollForSnapshot: ${error.message}`, 500, { originalError: error });
        }
      }
    }
    
    await this.markSnapshotFailed(
      snapshotId,
      collectorType,
      datasetId,
      request,
      'BrightData snapshot polling exceeded maximum attempts'
    );
    this.recordFailure();
    throw new BrightDataError('BrightData snapshot polling exceeded maximum attempts', 408);
  }

  /**
   * Extract answer and URLs from BrightData response
   */
  private extractAnswerAndUrls(actualResult: any): { answer: string; urls: string[] } {
    // Extract answer
    let answer = actualResult.answer_text || actualResult.answer || actualResult.response || actualResult.content || 'No response';
    
    if ((!answer || answer === 'No response') && actualResult.answer_section_html) {
      answer = actualResult.answer_section_html.replace(/<[^>]*>/g, '').trim() || actualResult.answer_section_html;
    }

    // Extract citations
    let citationsArray: any[] = [];
    
    if (actualResult.citations && Array.isArray(actualResult.citations)) {
      citationsArray = actualResult.citations;
    } else if (actualResult.links_attached && Array.isArray(actualResult.links_attached)) {
      citationsArray = actualResult.links_attached;
    } else if (actualResult.sources && Array.isArray(actualResult.sources)) {
      citationsArray = actualResult.sources;
    } else if (actualResult.urls && Array.isArray(actualResult.urls)) {
      citationsArray = actualResult.urls;
    }
    
    // Extract URLs from citations array
    let urls: string[] = [];
    if (Array.isArray(citationsArray) && citationsArray.length > 0) {
      urls = citationsArray
        .map((citation: any) => {
          if (typeof citation === 'string') {
            return citation.startsWith('http://') || citation.startsWith('https://') ? citation : null;
          }
          if (typeof citation === 'object' && citation !== null) {
            return citation.url || citation.source || citation.link || citation.href || null;
          }
          return null;
        })
        .filter((url: string | null): url is string => url !== null && (url.startsWith('http://') || url.startsWith('https://')));
      
      urls = [...new Set(urls)]; // Remove duplicates
    }
    
    // Fallback: extract URLs from text content
    if (urls.length === 0) {
      const textToSearch = answer || actualResult.answer_section_html || '';
      if (textToSearch) {
        const urlRegex = /https?:\/\/[^\s\)<>"]+/g;
        const extractedUrls = textToSearch.match(urlRegex) || [];
        urls = [...new Set(extractedUrls as string[])];
      }
    }

    return { answer, urls };
  }

  /**
   * Update database with polling results
   */
  private async markSnapshotFailed(
    snapshotId: string,
    collectorType: string,
    datasetId: string,
    request: BrightDataRequest,
    errorMessage: string
  ): Promise<void> {
    try {
      const { data: existingResult } = await this.supabase
        .from('collector_results')
        .select('id, execution_id, brand_id, customer_id, metadata')
        .eq('brightdata_snapshot_id', snapshotId)
        .maybeSingle();

      if (!existingResult?.id) return;

      await transitionCollectorResultById(
        this.supabase,
        existingResult.id,
        'failed',
        {
          source: 'brightdata:polling',
          reason: 'timeout',
          brandId: existingResult.brand_id,
          customerId: existingResult.customer_id,
          executionId: existingResult.execution_id,
          collectorType: collectorType === 'chatgpt' ? 'ChatGPT' : collectorType,
          snapshotId,
        },
        {
          error_message: errorMessage,
          metadata: {
            provider: `brightdata_${collectorType}`,
            dataset_id: datasetId,
            snapshot_id: snapshotId,
            success: false,
            brand: request.brand,
            locale: request.locale,
            country: request.country,
            collected_by: 'async_polling',
            collected_at: new Date().toISOString(),
          },
        }
      );
    } catch (error: any) {
      console.error(`❌ Failed to mark snapshot ${snapshotId} as failed:`, error?.message || String(error));
    }
  }

  private async updateDatabaseWithResults(
    snapshotId: string,
    collectorType: string,
    datasetId: string,
    request: BrightDataRequest,
    answer: string,
    urls: string[],
    downloadResult: any
  ): Promise<void> {
    console.log(`📥 [Polling] Updating database with results for snapshot ${snapshotId} (Collector: ${collectorType}, Country: ${request.country || 'US'})`);
    try {
      // Find the collector_result record by snapshot_id
      const { data: existingResult, error: findError } = await this.supabase
        .from('collector_results')
        .select('id, execution_id, query_id, brand_id, customer_id, metadata')
        .eq('brightdata_snapshot_id', snapshotId)
        .single();
      
      const nowIso = new Date().toISOString();

      const computeCollectionTimeMs = (metadata: any): number | null => {
        const firstAt = metadata?.status_transitions?.[0]?.at;
        if (typeof firstAt === 'string') {
          const startMs = new Date(firstAt).getTime();
          if (!Number.isNaN(startMs)) {
            return Math.max(0, Date.now() - startMs);
          }
        }
        return null;
      };

      const getTopicForQueryId = async (queryId: string | null | undefined): Promise<string | null> => {
        if (!queryId) return null;
        try {
          const { data: queryData } = await this.supabase
            .from('generated_queries')
            .select('topic, metadata')
            .eq('id', queryId)
            .single();
          return queryData?.topic || queryData?.metadata?.topic_name || queryData?.metadata?.topic || null;
        } catch (error) {
          return null;
        }
      };

      if (findError || !existingResult) {
        // Try to find by execution_id from query_executions
        const { data: execution } = await this.supabase
          .from('query_executions')
          .select('id, query_id, brand_id, customer_id, metadata')
          .eq('brightdata_snapshot_id', snapshotId)
          .single();
        
        if (execution) {
          const suppressScoring =
            execution?.metadata?.suppress_scoring === true ||
            execution?.metadata?.suppressScoring === true;

          const topic = await getTopicForQueryId(execution.query_id);
          const collectionTimeMs = computeCollectionTimeMs(execution.metadata);

          const { error: upsertError, data: upsertedData } = await this.supabase
            .from('collector_results')
            .upsert({
              execution_id: execution.id,
              query_id: execution.query_id,
              brand_id: execution.brand_id,
              customer_id: execution.customer_id,
              collector_type: collectorType === 'chatgpt' ? 'ChatGPT' : collectorType,
              brightdata_snapshot_id: snapshotId,
              raw_answer: answer,
              citations: urls,
              urls: urls,
              topic: topic,
              collection_time_ms: collectionTimeMs,
            }, {
              onConflict: 'execution_id'
            })
            .select();
          
          if (!upsertError && upsertedData && upsertedData.length > 0) {
            const resultId = upsertedData[0].id;

            await transitionCollectorResultById(
              this.supabase,
              resultId,
              'completed',
              {
                source: 'brightdata:polling',
                reason: 'raw_answer_stored',
                brandId: execution.brand_id,
                customerId: execution.customer_id,
                executionId: execution.id,
                collectorType: collectorType === 'chatgpt' ? 'ChatGPT' : collectorType,
                snapshotId,
              },
              {
                raw_answer: answer,
                citations: urls,
                urls: urls,
                topic: topic,
                collection_time_ms: collectionTimeMs,
                metadata: {
                  provider: `brightdata_${collectorType}`,
                  dataset_id: datasetId,
                  snapshot_id: snapshotId,
                  success: true,
                  brand: request.brand,
                  locale: request.locale,
                  country: request.country,
                  collected_by: 'async_polling',
                  collected_at: nowIso,
                  suppress_scoring: suppressScoring,
                },
              }
            );

            // Update raw_response_json separately
            await this.supabase
              .from('collector_results')
              .update({ raw_response_json: downloadResult })
              .eq('id', resultId);
            
            // Trigger scoring
            if (
              !suppressScoring &&
              answer &&
              answer.trim().length > 0 &&
              execution.brand_id &&
              execution.customer_id
            ) {
              try {
                const { brandScoringService } = await import('../../scoring/brand-scoring.orchestrator');
                brandScoringService.scoreBrandAsync({
                  brandId: execution.brand_id,
                  customerId: execution.customer_id,
                  parallel: false
                });
              } catch (scoringError) {
              }
            }
          }
        }
      } else {
        const suppressScoring =
          existingResult?.metadata?.suppress_scoring === true ||
          existingResult?.metadata?.suppressScoring === true;

        const topic = await getTopicForQueryId(existingResult.query_id);
        const collectionTimeMs = computeCollectionTimeMs(existingResult.metadata);

        await transitionCollectorResultById(
          this.supabase,
          existingResult.id,
          'completed',
          {
            source: 'brightdata:polling',
            reason: 'raw_answer_stored',
            brandId: existingResult.brand_id,
            customerId: existingResult.customer_id,
            executionId: existingResult.execution_id,
            collectorType: collectorType === 'chatgpt' ? 'ChatGPT' : collectorType,
            snapshotId,
          },
          {
            raw_answer: answer,
            citations: urls,
            urls: urls,
            topic: topic,
            collection_time_ms: collectionTimeMs,
            metadata: {
              provider: `brightdata_${collectorType}`,
              dataset_id: datasetId,
              snapshot_id: snapshotId,
              success: true,
              collected_by: 'async_polling',
              collected_at: nowIso,
              suppress_scoring: suppressScoring,
            },
          }
        );
        
        // Update raw_response_json separately
        await this.supabase
          .from('collector_results')
          .update({ raw_response_json: downloadResult })
          .eq('id', existingResult.id);
        
        // Trigger scoring
        if (
          !suppressScoring &&
          answer &&
          answer.trim().length > 0 &&
          existingResult.brand_id &&
          existingResult.customer_id
        ) {
          try {
            const { brandScoringService } = await import('../../scoring/brand-scoring.orchestrator');
            brandScoringService.scoreBrandAsync({
              brandId: existingResult.brand_id,
              customerId: existingResult.customer_id,
              parallel: false
            });
          } catch (scoringError) {
          }
        }
      }
    } catch (dbError: any) {
      console.error(`❌ Database update error:`, dbError.message);
    }
  }
}
