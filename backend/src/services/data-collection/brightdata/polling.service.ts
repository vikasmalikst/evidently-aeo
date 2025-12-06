/**
 * Polling service for BrightData collectors
 * Handles snapshot polling and result extraction
 */

import { BrightDataRequest, BrightDataResponse } from './types';

const verboseLogging = process.env.COLLECTOR_VERBOSE_LOGS === 'true';
const logVerbose = (...args: any[]) => {
  if (verboseLogging) {
    console.log(...args);
  }
};

export class BrightDataPollingService {
  private apiKey: string;
  private supabase: any;

  constructor(apiKey: string, supabase: any) {
    this.apiKey = apiKey;
    this.supabase = supabase;
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
    try {
      const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
      
      const response = await fetch(snapshotUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status !== 200) {
        return null; // Not ready yet
      }
      
      const responseText = await response.text();
      let downloadResult: any;
      
      try {
        downloadResult = JSON.parse(responseText);
      } catch {
        return null; // Not JSON yet, not ready
      }
      
      // Handle different response structures
      let actualResult = downloadResult;
      
      if (Array.isArray(downloadResult) && downloadResult.length > 0) {
        actualResult = downloadResult[0];
        logVerbose(`📦 Quick poll: Response is array, using first element`);
      }
      
      if (actualResult && actualResult.data && Array.isArray(actualResult.data) && actualResult.data.length > 0) {
        actualResult = actualResult.data[0];
        logVerbose(`📦 Quick poll: Response has data array, using first element`);
      }
      
      // Check if data is ready
      const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
      const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
      const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
      
      if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
        logVerbose(`📋 Full JSON Response for quick poll snapshot ${snapshotId}:`, JSON.stringify(downloadResult, null, 2));
        
        const { answer, urls } = this.extractAnswerAndUrls(actualResult);
        
        if (!answer || answer.trim().length === 0) {
          console.warn(`⚠️ Quick poll: Answer is empty after extraction. Available keys:`, Object.keys(actualResult || {}));
          return null;
        }

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
      
      return null; // Not ready yet
    } catch (error) {
      return null; // Error, not ready
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
    const maxAttempts = 60; // 10 minutes max
    const pollInterval = 10000; // 10 seconds
    
    logVerbose(`🔄 Starting async polling for snapshot ${snapshotId} (max ${maxAttempts} attempts, ${pollInterval/1000}s intervals)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logVerbose(`⏳ Async polling attempt ${attempt}/${maxAttempts} for snapshot ${snapshotId}`);
      
      try {
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        
        const response = await fetch(snapshotUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        logVerbose(`📡 Snapshot response status: ${response.status}`);
        
        if (response.status === 202) {
          logVerbose(`⏳ Async poll: Snapshot ${snapshotId} still processing (202), waiting...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            console.error(`❌ BrightData snapshot ${snapshotId} timed out - still processing after max attempts`);
            return;
          }
        }
        
        const responseText = await response.text();
        let downloadResult: any;
        
        try {
          downloadResult = JSON.parse(responseText);
          logVerbose(`✅ Async poll: Successfully parsed JSON response`);
        } catch (parseError) {
          logVerbose(`⚠️ Async poll: Response is not JSON, data still processing...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            console.error(`❌ BrightData snapshot ${snapshotId} timed out - response is not JSON`);
            return;
          }
        }
        
        let actualResult = downloadResult;
        
        if (Array.isArray(downloadResult) && downloadResult.length > 0) {
          actualResult = downloadResult[0];
          logVerbose(`📦 Async poll: Response is array, using first element`);
        }
        
        const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
        const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
        const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
        
        if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
          logVerbose(`✅ Async poll: Snapshot ${snapshotId} data is ready!`);
          logVerbose(`📋 Full JSON Response for async poll snapshot ${snapshotId}:`, JSON.stringify(downloadResult, null, 2));
          
          const { answer, urls } = this.extractAnswerAndUrls(actualResult);
          
          logVerbose(`✅ Async poll: Snapshot ${snapshotId} completed - Answer length: ${answer ? answer.length : 0}, URLs: ${urls.length}`);
          
          await this.updateDatabaseWithResults(snapshotId, collectorType, datasetId, request, answer, urls, downloadResult);
          
          return; // Success - exit polling
        }
        
        // Data not ready yet, wait and retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } else {
          console.error(`❌ Snapshot ${snapshotId} timed out after ${maxAttempts} attempts`);
        }
        
      } catch (error: any) {
        console.error(`❌ Error polling snapshot ${snapshotId} (attempt ${attempt}):`, error.message);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        } else {
          throw error;
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
    const maxAttempts = 60; // 10 minutes max
    const pollInterval = 10000; // 10 seconds
    
    logVerbose(`🔄 Starting polling for snapshot ${snapshotId} (max ${maxAttempts} attempts, ${pollInterval/1000}s intervals)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logVerbose(`⏳ Polling attempt ${attempt}/${maxAttempts} for snapshot ${snapshotId}`);
      
      try {
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        
        const response = await fetch(snapshotUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        logVerbose(`📡 Snapshot response status: ${response.status}`);
        
        if (response.status === 202) {
          logVerbose(`⏳ Snapshot ${snapshotId} still processing (202), waiting...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            throw new Error('BrightData snapshot timed out - still processing after max attempts');
          }
        }
        
        const responseText = await response.text();
        let downloadResult: any;
        
        try {
          downloadResult = JSON.parse(responseText);
          logVerbose(`✅ Successfully parsed JSON response`);
        } catch (parseError) {
          logVerbose(`⚠️ Response is not JSON, data still processing...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            throw new Error('BrightData snapshot timed out - response is not JSON');
          }
        }
        
        let actualResult = downloadResult;
        
        if (Array.isArray(downloadResult) && downloadResult.length > 0) {
          actualResult = downloadResult[0];
          logVerbose(`📦 Response is array with ${downloadResult.length} element(s), using first element`);
        }
        
        if (actualResult && actualResult.data && Array.isArray(actualResult.data) && actualResult.data.length > 0) {
          actualResult = actualResult.data[0];
          logVerbose(`📦 Response has data array, using first element`);
        }
        
        const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
        const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
        const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
        
        if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
          logVerbose(`✅ Data is ready! Found answer fields: answer_text=${!!hasAnswerText}, answer_section_html=${!!hasAnswerSectionHtml}, answer=${!!hasAnswer}`);
          logVerbose(`📋 Full JSON Response for snapshot ${snapshotId}:`, JSON.stringify(downloadResult, null, 2));
          
          const { answer, urls } = this.extractAnswerAndUrls(actualResult);
          
          if (!answer || answer.trim().length === 0) {
            console.warn(`⚠️ Answer is empty after extraction. Available keys:`, Object.keys(actualResult || {}));
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));
              continue;
            } else {
              throw new Error('BrightData snapshot timed out - answer is empty after max attempts');
            }
          }
          
          logVerbose(`✅ Successfully extracted answer and citations for snapshot ${snapshotId}`);

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
        logVerbose('⏳ Data not ready yet, continuing to poll...');
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        } else {
          throw new Error('BrightData snapshot timed out - data not ready');
        }
        
      } catch (error: any) {
        console.error(`❌ Error on attempt ${attempt}:`, error.message);
        
        if (attempt === maxAttempts) {
          console.error(`❌ Failed to get snapshot results after ${maxAttempts} attempts`);
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('BrightData snapshot polling exceeded maximum attempts');
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
  private async updateDatabaseWithResults(
    snapshotId: string,
    collectorType: string,
    datasetId: string,
    request: BrightDataRequest,
    answer: string,
    urls: string[],
    downloadResult: any
  ): Promise<void> {
    try {
      // Find the collector_result record by snapshot_id
      const { data: existingResult, error: findError } = await this.supabase
        .from('collector_results')
        .select('id, execution_id, query_id, brand_id, customer_id')
        .eq('brightdata_snapshot_id', snapshotId)
        .single();
      
      if (findError || !existingResult) {
        // Try to find by execution_id from query_executions
        const { data: execution } = await this.supabase
          .from('query_executions')
          .select('id, query_id, brand_id, customer_id')
          .eq('brightdata_snapshot_id', snapshotId)
          .single();
        
        if (execution) {
          // Upsert essential fields
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
              metadata: {
                provider: `brightdata_${collectorType}`,
                dataset_id: datasetId,
                snapshot_id: snapshotId,
                success: true,
                brand: request.brand,
                locale: request.locale,
                country: request.country,
                collected_by: 'async_polling',
                collected_at: new Date().toISOString()
              }
            }, {
              onConflict: 'execution_id'
            })
            .select();
          
          if (!upsertError && upsertedData && upsertedData.length > 0) {
            const resultId = upsertedData[0].id;
            // Update raw_response_json separately
            await this.supabase
              .from('collector_results')
              .update({ raw_response_json: downloadResult })
              .eq('id', resultId);
            
            // Trigger scoring
            if (answer && answer.trim().length > 0 && execution.brand_id && execution.customer_id) {
              try {
                const { brandScoringService } = await import('../../scoring/brand-scoring.orchestrator');
                brandScoringService.scoreBrandAsync({
                  brandId: execution.brand_id,
                  customerId: execution.customer_id,
                  parallel: false
                });
              } catch (scoringError) {
                console.warn(`⚠️ Failed to trigger scoring (non-blocking):`, scoringError);
              }
            }
          }
        }
      } else {
        // Update existing record
        await this.supabase
          .from('collector_results')
          .update({
            raw_answer: answer,
            citations: urls,
            urls: urls,
            metadata: {
              ...existingResult.metadata,
              provider: `brightdata_${collectorType}`,
              dataset_id: datasetId,
              snapshot_id: snapshotId,
              success: true,
              collected_by: 'async_polling',
              collected_at: new Date().toISOString()
            }
          })
          .eq('id', existingResult.id);
        
        // Update raw_response_json separately
        await this.supabase
          .from('collector_results')
          .update({ raw_response_json: downloadResult })
          .eq('id', existingResult.id);
        
        // Trigger scoring
        if (answer && answer.trim().length > 0 && existingResult.brand_id && existingResult.customer_id) {
          try {
            const { brandScoringService } = await import('../../scoring/brand-scoring.orchestrator');
            brandScoringService.scoreBrandAsync({
              brandId: existingResult.brand_id,
              customerId: existingResult.customer_id,
              parallel: false
            });
          } catch (scoringError) {
            console.warn(`⚠️ Failed to trigger scoring (non-blocking):`, scoringError);
          }
        }
      }
    } catch (dbError: any) {
      console.error(`❌ Database update error:`, dbError.message);
    }
  }
}

