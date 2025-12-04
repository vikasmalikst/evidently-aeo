import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

// Load environment variables
loadEnvironment();

// Define interfaces locally
interface BrightDataRequest {
  prompt: string;
  brand?: string;
  locale?: string;
  country?: string;
}

interface BrightDataResponse {
  query_id: string;
  run_start: string;
  run_end: string;
  prompt: string;
  answer: string;
  response: string;
  citations: string[];
  urls: string[];
  model_used: string;
  collector_type: string;
  metadata: {
    provider: string;
    dataset_id: string;
    snapshot_id?: string;
    success: boolean;
    brand?: string;
    locale?: string;
    country?: string;
    // NEW: answer_section_html field added by BrightData for Grok Search scraper
    answer_section_html?: string;
    [key: string]: any; // Allow additional metadata fields for future BrightData schema changes
  };
}

export class BrightDataCollectorService {
  private apiKey: string;
  private baseUrl: string;
  private datasetIds: Map<string, string>;
  private supabase: any;

  constructor() {
    this.apiKey = process.env.BRIGHTDATA_API_KEY || '';
    this.baseUrl = 'https://api.brightdata.com';
    this.datasetIds = new Map();
    
    // Initialize Supabase client for database updates
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
    
    // Initialize dataset IDs for different collectors
    this.datasetIds.set('chatgpt', 'gd_m7aof0k82r803d5bjm'); // ChatGPT dataset ID
    this.datasetIds.set('bing_copilot', 'gd_m7di5jy6s9geokz8w'); // Bing Copilot dataset ID
    this.datasetIds.set('grok', 'gd_m8ve0u141icu75ae74'); // Grok dataset ID
    this.datasetIds.set('gemini', 'gd_mbz66arm2mf9cu856y'); // Gemini dataset ID
    
    if (!this.apiKey) {
      console.warn('⚠️ BrightData API key not configured');
    }
  }

  /**
   * Execute ChatGPT query via BrightData (Asynchronous)
   * Returns immediately with snapshot_id, polling happens in background
   */
  async executeChatGPTQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.executeChatGPTAsync(request);
  }

  /**
   * Execute ChatGPT query asynchronously using trigger endpoint
   * Returns snapshot_id immediately without waiting for results
   */
  private async executeChatGPTAsync(request: BrightDataRequest): Promise<BrightDataResponse> {
    const datasetId = this.datasetIds.get('chatgpt') || '';
    
    if (!this.apiKey || !datasetId) {
      throw new Error('BrightData API key or ChatGPT dataset ID not configured');
    }

    try {
      console.log(`🚀 Executing ChatGPT query via BrightData Async (dataset: ${datasetId})`);
      
      // Use async trigger endpoint format
      const payload = {
        input: [{
          url: 'https://chatgpt.com/',
          prompt: request.prompt,
          country: request.country || '',
          web_search: true,
          additional_prompt: ''
        }]
      };

      // Use trigger endpoint for async execution
      const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&notify=false&include_errors=true`;
      
      console.log(`📡 Triggering async ChatGPT request: ${triggerUrl}`);

      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`📡 ChatGPT trigger response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ BrightData ChatGPT trigger error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`BrightData ChatGPT API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as any;
      console.log(`✅ ChatGPT trigger response:`, JSON.stringify(result, null, 2));

      // Extract snapshot_id from response
      // The trigger endpoint may return snapshot_ids in different formats
      let snapshotId: string | undefined;
      
      if (result.snapshot_id) {
        snapshotId = result.snapshot_id;
      } else if (result.snapshot_ids && Array.isArray(result.snapshot_ids) && result.snapshot_ids.length > 0) {
        // If multiple snapshot_ids returned, use the first one
        snapshotId = result.snapshot_ids[0];
      } else if (result.data && result.data.snapshot_id) {
        snapshotId = result.data.snapshot_id;
      } else if (Array.isArray(result) && result.length > 0 && result[0].snapshot_id) {
        snapshotId = result[0].snapshot_id;
      }

      if (!snapshotId) {
        console.error('❌ No snapshot_id found in trigger response:', JSON.stringify(result, null, 2));
        throw new Error('BrightData ChatGPT trigger did not return snapshot_id');
      }

      console.log(`✅ Got snapshot_id: ${snapshotId} - Attempting quick poll...`);

      // Try one quick poll to see if result is ready (non-blocking, max 5 seconds)
      const quickPollPromise = this.quickPollSnapshot(snapshotId, datasetId, request);
      const quickPollTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000)); // 5 second timeout
      
      const quickResult = await Promise.race([quickPollPromise, quickPollTimeout]) as BrightDataResponse | null;

      if (quickResult && quickResult.answer) {
        // Result is ready! Return immediately
        console.log(`✅ Snapshot ${snapshotId} result ready immediately!`);
        return quickResult;
      }

      // Result not ready yet - start background polling and return with snapshot_id
      console.log(`⏳ Snapshot ${snapshotId} not ready yet, starting background polling...`);
      
      // Start polling in background (non-blocking)
      this.pollForSnapshotAsync(snapshotId, 'chatgpt', datasetId, request).catch(error => {
        console.error(`❌ Background polling failed for snapshot ${snapshotId}:`, error);
      });

      // Return immediately with snapshot_id (async response)
      return {
        query_id: `brightdata_chatgpt_${Date.now()}`,
        run_start: new Date().toISOString(),
        run_end: new Date().toISOString(), // Will be updated when polling completes
        prompt: request.prompt,
        answer: '', // Will be populated when background polling completes
        response: '', // Will be populated when background polling completes
        citations: [],
        urls: [],
        model_used: 'chatgpt',
        collector_type: 'chatgpt',
        metadata: {
          provider: 'brightdata_chatgpt',
          dataset_id: datasetId,
          snapshot_id: snapshotId,
          success: true,
          async: true, // Flag to indicate this is async
          brand: request.brand,
          locale: request.locale,
          country: request.country
        }
      };

    } catch (error: any) {
      console.error('❌ BrightData ChatGPT async error:', error.message);
      throw error;
    }
  }

  /**
   * Quick poll to check if snapshot result is ready (non-blocking, max 5 seconds)
   */
  private async quickPollSnapshot(snapshotId: string, datasetId: string, request: BrightDataRequest): Promise<BrightDataResponse> {
    try {
      const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
      
      const response = await fetch(snapshotUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status !== 200) {
        return null as any; // Not ready yet
      }
      
      const responseText = await response.text();
      let downloadResult: any;
      
      try {
        downloadResult = JSON.parse(responseText);
      } catch {
        return null as any; // Not JSON yet, not ready
      }
      
      // Handle different response structures - BrightData returns array format: [{answer_text, citations, ...}]
      let actualResult = downloadResult;
      
      // If response is an array, take the first element (this is the standard BrightData format)
      if (Array.isArray(downloadResult) && downloadResult.length > 0) {
        actualResult = downloadResult[0];
        console.log(`📦 Quick poll: Response is array, using first element`);
      }
      
      // If response has a data property that's an array, use that
      if (actualResult && actualResult.data && Array.isArray(actualResult.data) && actualResult.data.length > 0) {
        actualResult = actualResult.data[0];
        console.log(`📦 Quick poll: Response has data array, using first element`);
      }
      
      // Check if data is ready - look for answer_text field (primary field in BrightData response)
      const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
      const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
      const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
      
      if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
        // Log the full JSON response in terminal
        console.log(`📋 Full JSON Response for quick poll snapshot ${snapshotId}:`, JSON.stringify(downloadResult, null, 2));
        
        // Extract answer - try multiple field names
        let answer = actualResult.answer_text || actualResult.answer || actualResult.response || actualResult.content || 'No response';
        
        if ((!answer || answer === 'No response') && actualResult.answer_section_html) {
          answer = actualResult.answer_section_html.replace(/<[^>]*>/g, '').trim() || actualResult.answer_section_html;
        }
        
        // Validate we actually have content
        if (!answer || answer === 'No response' || answer.trim().length === 0) {
          console.warn(`⚠️ Quick poll: Answer is empty after extraction. Available keys:`, Object.keys(actualResult || {}));
          return null as any; // Not ready yet
        }
        
        // Extract citations from the response - BrightData format: citations array with objects {url, title, description, icon}
        let citationsArray: any[] = [];
        
        // Primary: Check citations array in actualResult (standard BrightData format)
        if (actualResult.citations && Array.isArray(actualResult.citations)) {
          citationsArray = actualResult.citations;
        } else if (actualResult.links_attached && Array.isArray(actualResult.links_attached)) {
          citationsArray = actualResult.links_attached;
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
        
        return {
          query_id: `brightdata_chatgpt_${Date.now()}`,
          run_start: new Date().toISOString(),
          run_end: new Date().toISOString(),
          prompt: request.prompt,
          answer: answer,
          response: answer,
          citations: urls,
          urls: urls,
          model_used: 'chatgpt',
          collector_type: 'chatgpt',
          metadata: {
            provider: 'brightdata_chatgpt',
            dataset_id: datasetId,
            snapshot_id: snapshotId,
            success: true,
            brand: request.brand,
            locale: request.locale,
            country: request.country,
            // NEW: Store raw JSON response for debugging and analysis
            raw_response_json: downloadResult
          }
        };
      }
      
      return null as any; // Not ready yet
    } catch (error) {
      return null as any; // Error, not ready
    }
  }

  /**
   * Poll for snapshot results asynchronously (background process)
   * This updates the database when results are ready
   */
  private async pollForSnapshotAsync(snapshotId: string, collectorType: string, datasetId: string, request: BrightDataRequest): Promise<void> {
    const maxAttempts = 60; // 10 minutes max
    const pollInterval = 10000; // 10 seconds
    
    console.log(`🔄 Starting async polling for snapshot ${snapshotId} (max ${maxAttempts} attempts, ${pollInterval/1000}s intervals)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`⏳ Async polling attempt ${attempt}/${maxAttempts} for snapshot ${snapshotId}`);
      
      try {
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        
        const response = await fetch(snapshotUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`📡 Snapshot response status: ${response.status}`);
        
        // If status is 202, data is still processing
        if (response.status === 202) {
          console.log(`⏳ Async poll: Snapshot ${snapshotId} still processing (202), waiting...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            console.error(`❌ BrightData snapshot ${snapshotId} timed out - still processing after max attempts`);
            return;
          }
        }
        
        const responseText = await response.text();
        
        // Parse response
        let downloadResult: any;
        
        try {
          downloadResult = JSON.parse(responseText);
          console.log(`✅ Async poll: Successfully parsed JSON response`);
        } catch (parseError) {
          console.log(`⚠️ Async poll: Response is not JSON, data still processing...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            console.error(`❌ BrightData snapshot ${snapshotId} timed out - response is not JSON`);
            return;
          }
        }
        
        // Handle different response structures - BrightData returns array format: [{answer_text, citations, ...}]
        let actualResult = downloadResult;
        
        // If response is an array, take the first element (this is the standard BrightData format)
        if (Array.isArray(downloadResult) && downloadResult.length > 0) {
          actualResult = downloadResult[0];
          console.log(`📦 Async poll: Response is array, using first element`);
        }
        
        // Check if data is ready - look for answer_text field (primary field in BrightData response)
        const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
        const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
        const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
        
        if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
          console.log(`✅ Async poll: Snapshot ${snapshotId} data is ready!`);
          
          // Log the full JSON response in terminal
          console.log(`📋 Full JSON Response for async poll snapshot ${snapshotId}:`, JSON.stringify(downloadResult, null, 2));
          
          // Extract answer - try multiple field names
          let answer = actualResult.answer_text || actualResult.answer || actualResult.response || actualResult.content || 'No response';
          
          if ((!answer || answer === 'No response') && actualResult.answer_section_html) {
            answer = actualResult.answer_section_html.replace(/<[^>]*>/g, '').trim() || actualResult.answer_section_html;
          }
          
          // Extract citations from the response - BrightData format: citations array with objects {url, title, description, icon}
          let citationsArray: any[] = [];
          
          // Primary: Check citations array in actualResult (standard BrightData format)
          if (actualResult.citations && Array.isArray(actualResult.citations)) {
            citationsArray = actualResult.citations;
          } else if (actualResult.links_attached && Array.isArray(actualResult.links_attached)) {
            citationsArray = actualResult.links_attached;
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
          
          console.log(`✅ Async poll: Snapshot ${snapshotId} completed - Answer length: ${answer ? answer.length : 0}, URLs: ${urls.length}`);
          
          // Update database with results using snapshot_id
          try {
            // Find the collector_result record by snapshot_id
            const { data: existingResult, error: findError } = await this.supabase
              .from('collector_results')
              .select('id, execution_id, query_id, brand_id, customer_id')
              .eq('brightdata_snapshot_id', snapshotId)
              .single();
            
            if (findError || !existingResult) {
              console.warn(`⚠️ Async poll: Could not find collector_result with snapshot_id ${snapshotId}:`, findError);
              // Try to find by execution_id from query_executions
              const { data: execution } = await this.supabase
                .from('query_executions')
                .select('id, query_id, brand_id, customer_id')
                .eq('brightdata_snapshot_id', snapshotId)
                .single();
              
              if (execution) {
                // Update or insert collector_result
                // Split into two operations: first upsert essential fields, then update raw_response_json separately
                
                // Step 1: Upsert essential fields
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
                      // Removed raw_response_json from metadata to avoid 413 Request Entity Too Large errors
                    }
                  }, {
                    onConflict: 'execution_id'
                  })
                  .select();
                
                if (upsertError) {
                  console.error(`❌ Async poll: Failed to upsert essential fields:`, upsertError);
                } else {
                  console.log(`✅ Async poll: Successfully upserted essential fields for snapshot ${snapshotId}`);
                  
                  // Step 2: Update raw_response_json separately
                  const resultId = upsertedData && upsertedData.length > 0 ? upsertedData[0].id : null;
                  if (resultId) {
                    try {
                      const { error: jsonUpdateError } = await this.supabase
                        .from('collector_results')
                        .update({
                          raw_response_json: downloadResult
                        })
                        .eq('id', resultId);
                      
                      if (jsonUpdateError) {
                        console.warn(`⚠️ Async poll: Failed to update raw_response_json (data might be too large):`, jsonUpdateError.message);
                        console.log(`✅ But essential fields (raw_answer, citations) were successfully saved`);
                      } else {
                        console.log(`✅ Async poll: Successfully updated raw_response_json for snapshot ${snapshotId}`);
                      }
                    } catch (jsonError: any) {
                      console.warn(`⚠️ Async poll: Error updating raw_response_json:`, jsonError.message);
                      console.log(`✅ But essential fields (raw_answer, citations) were successfully saved`);
                    }
                  }
                  
                  // Step 3: Trigger scoring now that we have the actual answer data
                  if (answer && answer.trim().length > 0 && execution.brand_id && execution.customer_id) {
                    try {
                      console.log(`🔄 Triggering scoring after async data fetch for snapshot ${snapshotId}...`);
                      const { brandScoringService } = await import('../scoring/brand-scoring.orchestrator');
                      brandScoringService.scoreBrandAsync({
                        brandId: execution.brand_id,
                        customerId: execution.customer_id,
                        parallel: false
                      });
                      console.log(`✅ Scoring triggered after async data fetch for snapshot ${snapshotId}`);
                    } catch (scoringError) {
                      console.warn(`⚠️ Failed to trigger scoring after async update (non-blocking):`, scoringError);
                    }
                  }
                }
              }
            } else {
              // Update existing record
              // Split into two updates: first essential fields, then raw_response_json separately
              // This ensures raw_answer gets updated even if raw_response_json is too large
              
              // Step 1: Update essential fields (raw_answer, citations, urls, metadata)
              const { error: updateError } = await this.supabase
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
                    // Removed raw_response_json from metadata to avoid 413 Request Entity Too Large errors
                  }
                })
                .eq('id', existingResult.id);
              
              if (updateError) {
                console.error(`❌ Async poll: Failed to update essential fields:`, updateError);
              } else {
                console.log(`✅ Async poll: Successfully updated essential fields (id: ${existingResult.id}) for snapshot ${snapshotId}`);
                
                // Step 2: Update raw_response_json separately (this might fail if too large, but essential fields are already saved)
                try {
                  const { error: jsonUpdateError } = await this.supabase
                    .from('collector_results')
                    .update({
                      raw_response_json: downloadResult
                    })
                    .eq('id', existingResult.id);
                  
                  if (jsonUpdateError) {
                    console.warn(`⚠️ Async poll: Failed to update raw_response_json (data might be too large):`, jsonUpdateError.message);
                    console.log(`✅ But essential fields (raw_answer, citations) were successfully updated`);
                  } else {
                    console.log(`✅ Async poll: Successfully updated raw_response_json for snapshot ${snapshotId}`);
                  }
                } catch (jsonError: any) {
                  console.warn(`⚠️ Async poll: Error updating raw_response_json:`, jsonError.message);
                  console.log(`✅ But essential fields (raw_answer, citations) were successfully updated`);
                }
                
                // Step 3: Trigger scoring now that we have the actual answer data
                if (answer && answer.trim().length > 0 && existingResult.brand_id && existingResult.customer_id) {
                  try {
                    console.log(`🔄 Triggering scoring after async data fetch for snapshot ${snapshotId}...`);
                    const { brandScoringService } = await import('../scoring/brand-scoring.orchestrator');
                    brandScoringService.scoreBrandAsync({
                      brandId: existingResult.brand_id,
                      customerId: existingResult.customer_id,
                      parallel: false
                    });
                    console.log(`✅ Scoring triggered after async data fetch for snapshot ${snapshotId}`);
                  } catch (scoringError) {
                    console.warn(`⚠️ Failed to trigger scoring after async update (non-blocking):`, scoringError);
                  }
                }
              }
            }
          } catch (dbError: any) {
            console.error(`❌ Async poll: Database update error:`, dbError.message);
          }
          
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
   * Execute Bing Copilot query via BrightData
   */
  async executeBingCopilotQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    const datasetId = this.datasetIds.get('bing_copilot') || '';
    
    if (!this.apiKey || !datasetId) {
      throw new Error('BrightData API key or Bing Copilot dataset ID not configured');
    }

    try {
      console.log(`🚀 Executing Bing Copilot query via BrightData (dataset: ${datasetId})`);
      
      // Correct payload structure based on BrightData docs
      const payload = [{
        url: 'https://copilot.microsoft.com/chats',
        prompt: request.prompt,
        index: 1,
        country: request.country || ''
      }];

      const response = await fetch(`https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`📡 Bing Copilot response status: ${response.status}`);

      let snapshotId: string | undefined;
      if (response.status === 202) {
        const result = await response.json() as any;
        snapshotId = result.snapshot_id;
        
        if (snapshotId) {
          console.log(`✅ Got snapshot_id: ${snapshotId}`);
          console.log(`🔍 FULL SNAPSHOT RESULT:`, JSON.stringify(result, null, 2));
          console.log(`🧪 TESTING SNAPSHOT NOW...`);
          
          return await this.pollForSnapshot(snapshotId, 'bing_copilot', datasetId, request);
        }
      }

      if (!response.ok) {
        throw new Error(`BrightData Bing Copilot API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      snapshotId = result.snapshot_id || snapshotId;
      
      // Log the full JSON response in terminal
      console.log(`📋 Full JSON Response for Bing Copilot:`, JSON.stringify(result, null, 2));
      console.log(`🔍 Bing Copilot result type:`, typeof result);
      console.log(`🔍 Bing Copilot result keys:`, Object.keys(result || {}));

      // Handle Bing Copilot response structure (direct object, not array)
      let answer = 'No response from Bing Copilot';
      let citations: string[] = [];
      let urls: string[] = [];
      
      // Bing Copilot returns data directly in result object
      if (result && typeof result === 'object') {
        // Extract answer from result object
        answer = result.answer_text || result.answer || result.response || result.content || 'No response from Bing Copilot';
        
        // Extract sources/citations from result object
        const sources = result.sources || result.citations || result.urls || [];
        
        // Ensure sources is an array
        if (Array.isArray(sources)) {
          citations = sources.map((s: any) => {
            if (typeof s === 'string') return s;
            if (typeof s === 'object' && s.url) return s.url;
            if (typeof s === 'object' && s.source) return s.source;
            return s;
          }).filter(Boolean);
          urls = [...citations]; // Use same sources for URLs
        }
        
        console.log(`🔍 Bing Copilot extracted - Answer length: ${answer.length}, Sources: ${sources.length}, Citations: ${citations.length}`);
      }
      
      console.log(`📊 Bing Copilot parsed - Answer length: ${answer.length}, Citations: ${citations.length}, URLs: ${urls.length}`);

      return {
        query_id: `brightdata_bing_copilot_${Date.now()}`,
        run_start: new Date().toISOString(),
        run_end: new Date().toISOString(),
        prompt: request.prompt,
        answer: answer,
        response: answer,
        citations: urls,
        urls: urls,
        model_used: 'bing_copilot',
        collector_type: 'bing_copilot',
        metadata: {
          provider: 'brightdata_bing_copilot',
          dataset_id: datasetId,
          snapshot_id: snapshotId,
          success: true,
          brand: request.brand,
          locale: request.locale,
          country: request.country,
          // NEW: Store raw JSON response for debugging and analysis
          raw_response_json: result
        }
      };

    } catch (error: any) {
      console.error('❌ BrightData Bing Copilot error:', error.message);
      throw error;
    }
  }

  /**
   * Execute Grok query via BrightData
   */
  async executeGrokQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    const datasetId = this.datasetIds.get('grok') || '';
    
    if (!this.apiKey || !datasetId) {
      throw new Error('BrightData API key or Grok dataset ID not configured');
    }

    try {
      console.log(`🚀 Executing Grok query via BrightData (dataset: ${datasetId})`);
      
      // Use same payload structure as Bing Copilot (synchronous /scrape endpoint)
      // Array format: [{url, prompt, index, country}]
      const payload = [{
        url: 'https://grok.com/',
        prompt: request.prompt,
        index: 1,
        country: request.country || ''
      }];

      // Use /scrape endpoint (synchronous) - same as Bing Copilot which is working perfectly
      const response = await fetch(`https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`📡 Grok response status: ${response.status}`);

      let snapshotId: string | undefined;
      if (response.status === 202) {
        const result = await response.json() as any;
        snapshotId = result.snapshot_id;
        
        if (snapshotId) {
          console.log(`✅ Got snapshot_id: ${snapshotId}`);
          console.log(`🔍 FULL SNAPSHOT RESULT:`, JSON.stringify(result, null, 2));
          console.log(`🧪 TESTING SNAPSHOT NOW...`);
          
          return await this.pollForSnapshot(snapshotId, 'grok', datasetId, request);
        }
      }

      if (!response.ok) {
        throw new Error(`BrightData Grok API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      snapshotId = result.snapshot_id || snapshotId;
      
      // Log the full JSON response in terminal
      console.log(`📋 Full JSON Response for Grok:`, JSON.stringify(result, null, 2));
      console.log(`🔍 Grok result type:`, typeof result);
      console.log(`🔍 Grok result keys:`, Object.keys(result || {}));

      // Extract answer from result (scrape API returns array directly)
      const responseData = Array.isArray(result) ? result : (result.data || []);
      
      // Handle different response structures
      let answer = 'No response from Grok';
      let citations: string[] = [];
      let urls: string[] = [];
      
      if (responseData && responseData.length > 0) {
        const firstResult = responseData[0];
        
        // Try different field names for answer
        // NEW: BrightData added answer_section_html field - use it if available
        const answerSectionHtml = firstResult.answer_section_html || '';
        const answerText = firstResult.answer || firstResult.answer_text || firstResult.response || firstResult.content || '';
        
        // Prefer answer_text, but use answer_section_html if answer_text is empty
        // If answer_section_html is HTML, we may want to extract text from it
        if (answerText) {
          answer = answerText;
        } else if (answerSectionHtml) {
          // If we only have HTML, strip tags (simple approach) or use as-is
          answer = answerSectionHtml.replace(/<[^>]*>/g, '').trim() || answerSectionHtml;
        } else {
          answer = 'No response from Grok';
        }
        
        // Try different field names for citations/urls
        citations = firstResult.citations || firstResult.sources || firstResult.urls || [];
        urls = firstResult.urls || firstResult.sources || firstResult.citations || [];
        
        // Ensure arrays are properly formatted
        if (!Array.isArray(citations)) citations = [];
        if (!Array.isArray(urls)) urls = [];
        
        // Extract URLs from source objects if needed
        if (citations.length > 0 && typeof citations[0] === 'object') {
          citations = citations.map((c: any) => c.url || c.source || c).filter(Boolean);
        }
        if (urls.length > 0 && typeof urls[0] === 'object') {
          urls = urls.map((u: any) => u.url || u.source || u).filter(Boolean);
        }
      }
      
      console.log(`📊 Grok parsed - Answer length: ${answer.length}, Citations: ${citations.length}, URLs: ${urls.length}`);

      return {
        query_id: `brightdata_grok_${Date.now()}`,
        run_start: new Date().toISOString(),
        run_end: new Date().toISOString(),
        prompt: request.prompt,
        answer: answer,
        response: answer,
        citations: urls,
        urls: urls,
        model_used: 'grok',
        collector_type: 'grok',
        metadata: {
          provider: 'brightdata_grok',
          dataset_id: datasetId,
          snapshot_id: snapshotId,
          success: true,
          brand: request.brand,
          locale: request.locale,
          country: request.country,
          // NEW: Store answer_section_html if available for enhanced data
          answer_section_html: responseData && responseData.length > 0 ? responseData[0].answer_section_html : undefined,
          // NEW: Store raw JSON response for debugging and analysis
          raw_response_json: result
        }
      };

    } catch (error: any) {
      console.error('❌ BrightData Grok error:', error.message);
      throw error;
    }
  }

  /**
   * Poll for snapshot results
   */
  private async pollForSnapshot(snapshotId: string, collectorType: string, datasetId: string, request: BrightDataRequest): Promise<BrightDataResponse> {
    const maxAttempts = 60; // 10 minutes max
    const pollInterval = 10000; // 10 seconds
    
    console.log(`🔄 Starting polling for snapshot ${snapshotId} (max ${maxAttempts} attempts, ${pollInterval/1000}s intervals)`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`⏳ Polling attempt ${attempt}/${maxAttempts} for snapshot ${snapshotId}`);
      
      try {
        // Use the CORRECT endpoint format - /snapshot/{snapshot_id}
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        
        console.log(`🧪 Using CORRECT endpoint: ${snapshotUrl}`);
        
        const response = await fetch(snapshotUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`📡 Snapshot response status: ${response.status}`);
        
        // If status is 202, data is still processing
        if (response.status === 202) {
          console.log(`⏳ Snapshot ${snapshotId} still processing (202), waiting...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            throw new Error('BrightData snapshot timed out - still processing after max attempts');
          }
        }
        
        // Check content type
        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();
        
        console.log(`📄 Response content type: ${contentType}`);
        console.log(`📄 Response preview: ${responseText.substring(0, 500)}`);
        
        // Parse response - try JSON parsing regardless of content type
        let downloadResult: any;
        
        try {
          downloadResult = JSON.parse(responseText);
          console.log(`✅ Successfully parsed JSON response`);
        } catch (parseError) {
          console.log(`⚠️ Response is not JSON, data still processing...`);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            throw new Error('BrightData snapshot timed out - response is not JSON');
          }
        }
        
        // Handle different response structures - BrightData returns array format: [{answer_text, citations, ...}]
        let actualResult = downloadResult;
        
        // If response is an array, take the first element (this is the standard BrightData format)
        if (Array.isArray(downloadResult) && downloadResult.length > 0) {
          actualResult = downloadResult[0];
          console.log(`📦 Response is array with ${downloadResult.length} element(s), using first element`);
        }
        
        // If response has a data property that's an array, use that
        if (actualResult && actualResult.data && Array.isArray(actualResult.data) && actualResult.data.length > 0) {
          actualResult = actualResult.data[0];
          console.log(`📦 Response has data array, using first element`);
        }
        
        // Check if data is ready - look for answer_text field (primary field in BrightData response)
        const hasAnswerText = actualResult && actualResult.answer_text && typeof actualResult.answer_text === 'string' && actualResult.answer_text.trim().length > 0;
        const hasAnswerSectionHtml = actualResult && actualResult.answer_section_html;
        const hasAnswer = actualResult && (actualResult.answer || actualResult.response || actualResult.content);
        
        if (actualResult && (hasAnswerText || hasAnswerSectionHtml || hasAnswer)) {
          console.log(`✅ Data is ready! Found answer fields: answer_text=${!!hasAnswerText}, answer_section_html=${!!hasAnswerSectionHtml}, answer=${!!hasAnswer}`);
          
          // Log the full JSON response in terminal
          console.log(`📋 Full JSON Response for snapshot ${snapshotId}:`, JSON.stringify(downloadResult, null, 2));
          
          // Extract answer - try multiple field names
          let answer = actualResult.answer_text || actualResult.answer || actualResult.response || actualResult.content || 'No response';
          
          // If answer_text is empty but answer_section_html exists, extract text from HTML
          if ((!answer || answer === 'No response') && actualResult.answer_section_html) {
            const htmlContent = actualResult.answer_section_html;
            // Simple HTML tag stripping (can be enhanced with a library if needed)
            answer = htmlContent.replace(/<[^>]*>/g, '').trim() || htmlContent;
            console.log(`📝 Extracted text from answer_section_html (length: ${answer.length})`);
          }
          
          // Validate we actually have content
          if (!answer || answer === 'No response' || answer.trim().length === 0) {
            console.warn(`⚠️ Answer is empty after extraction. Available keys:`, Object.keys(actualResult || {}));
            // Continue anyway to try extracting URLs
          }
          
          // Extract citations from the response - BrightData format: citations array with objects {url, title, description, icon}
          let citationsArray: any[] = [];
          
          // Primary: Check citations array in actualResult (standard BrightData format)
          if (actualResult.citations && Array.isArray(actualResult.citations)) {
            citationsArray = actualResult.citations;
            console.log(`📎 Found citations array with ${citationsArray.length} items`);
          }
          
          // Fallback: Check links_attached (also in BrightData format)
          if (citationsArray.length === 0 && actualResult.links_attached && Array.isArray(actualResult.links_attached)) {
            citationsArray = actualResult.links_attached;
            console.log(`📎 Found links_attached array with ${citationsArray.length} items`);
          }
          
          // Fallback: Check other possible field names
          if (citationsArray.length === 0) {
            if (actualResult.sources && Array.isArray(actualResult.sources)) {
              citationsArray = actualResult.sources;
            } else if (actualResult.urls && Array.isArray(actualResult.urls)) {
              citationsArray = actualResult.urls;
            } else if (actualResult.links && Array.isArray(actualResult.links)) {
              citationsArray = actualResult.links;
            } else if (actualResult.references && Array.isArray(actualResult.references)) {
              citationsArray = actualResult.references;
            }
          }
          
          // Extract URLs from citations array - handle both string arrays and object arrays
          // BrightData format: citations is array of objects with {url, title, description, icon}
          let urls: string[] = [];
          if (Array.isArray(citationsArray) && citationsArray.length > 0) {
            urls = citationsArray
              .map((citation: any) => {
                // If citation is a string, use it directly
                if (typeof citation === 'string') {
                  return citation.startsWith('http://') || citation.startsWith('https://') ? citation : null;
                }
                // If citation is an object, extract url field
                if (typeof citation === 'object' && citation !== null) {
                  return citation.url || citation.source || citation.link || citation.href || null;
                }
                return null;
              })
              .filter((url: string | null): url is string => url !== null && (url.startsWith('http://') || url.startsWith('https://')));
            
            // Remove duplicates
            urls = [...new Set(urls)];
            console.log(`📎 Extracted ${urls.length} unique URLs from citations`);
          }
          
          // If no URLs found in structured fields, try extracting from answer text or answer_section_html
          if (urls.length === 0) {
            const textToSearch = answer || actualResult.answer_section_html || downloadResult.answer_section_html || '';
            if (textToSearch) {
              console.log(`🔍 No URLs in structured fields, extracting from ${answer ? 'answer text' : 'answer_section_html'}...`);
              const urlRegex = /https?:\/\/[^\s\)<>"]+/g;
              const extractedUrls = textToSearch.match(urlRegex) || [];
              urls = [...new Set(extractedUrls as string[])]; // Remove duplicates
              console.log(`📎 Extracted ${urls.length} URLs from text content`);
            }
          }
          
          console.log(`✅ Extracted answer length: ${answer ? answer.length : 0}, Citations found: ${citationsArray.length}, URLs extracted: ${urls.length}`);
          if (urls.length > 0) {
            console.log(`📎 Sample URLs:`, urls.slice(0, 3));
          } else {
            console.warn(`⚠️ No URLs/citations found in response. Available keys in actualResult:`, Object.keys(actualResult || {}));
          }
          
          // Only return if we have a valid answer
          if (answer && answer !== 'No response' && answer.trim().length > 0) {
            console.log(`✅ Successfully extracted answer and citations for snapshot ${snapshotId}`);
          
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
              // NEW: Store answer_section_html if available (for Grok and future collectors)
              answer_section_html: actualResult.answer_section_html || undefined
              // Note: raw_response_json is stored in the column, not in metadata to avoid 413 errors
            }
          };
          } else {
            console.warn(`⚠️ Answer is empty or invalid after extraction. Available keys:`, Object.keys(actualResult || {}));
            // Continue polling if answer is empty
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));
              continue;
            } else {
              throw new Error('BrightData snapshot timed out - answer is empty after max attempts');
            }
          }
        }
        
        // Check if still processing
        if (downloadResult && (downloadResult.status === 'running' || 
            (downloadResult.message && downloadResult.message.includes('not ready')))) {
          console.log('⏳ Data still being collected...');
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          } else {
            throw new Error('BrightData snapshot timed out - data still processing');
          }
        }
        
        // If we get here, data is not ready yet
        console.log('⏳ Data not ready yet, continuing to poll...');
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
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('BrightData snapshot polling exceeded maximum attempts');
  }

  /**
   * Placeholder methods for other collectors (not implemented yet)
   */
  async executeGoogleAIOQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('Google AIO collector not implemented for BrightData');
  }

  async executePerplexityQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('Perplexity collector not implemented for BrightData');
  }

  async executeBaiduQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('Baidu collector not implemented for BrightData');
  }

  async executeBingQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('Bing collector not implemented for BrightData');
  }

  async executeGeminiQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    const datasetId = this.datasetIds.get('gemini') || '';
    
    if (!this.apiKey || !datasetId) {
      throw new Error('BrightData API key or Gemini dataset ID not configured');
    }

    try {
      console.log(`🚀 Executing Gemini query via BrightData (dataset: ${datasetId})`);

      const payload = [{
        url: 'https://gemini.google.com/',
        prompt: request.prompt,
        index: 1,
        country: request.country || ''
      }];

      const response = await fetch(`https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`📡 Gemini response status: ${response.status}`);

      let snapshotId: string | undefined;
      if (response.status === 202) {
        const result = await response.json() as any;
        snapshotId = result.snapshot_id;

        if (snapshotId) {
          console.log(`✅ Got snapshot_id: ${snapshotId}`);
          return await this.pollForSnapshot(snapshotId, 'gemini', datasetId, request);
        }
      }

      if (!response.ok) {
        throw new Error(`BrightData Gemini API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      snapshotId = result.snapshot_id || snapshotId;
      
      // Log the full JSON response in terminal
      console.log(`📋 Full JSON Response for Gemini:`, JSON.stringify(result, null, 2));
      
      const responseData = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : result
            ? [result]
            : [];

      const firstResult = responseData[0] || {};

      const collectUrlCandidates = (value: unknown): string[] => {
        if (!value) return [];
        if (typeof value === 'string') return [value];
        if (Array.isArray(value)) {
          return value.flatMap((item) => collectUrlCandidates(item));
        }
        if (typeof value === 'object') {
          const record = value as Record<string, unknown>;
          const direct =
            record.url ||
            record.href ||
            record.link ||
            record.source ||
            record.domain;
          const nestedValues = Object.values(record);
          return [
            ...(typeof direct === 'string' ? [direct] : []),
            ...nestedValues.flatMap((nested) => collectUrlCandidates(nested)),
          ];
        }
        return [];
      };

      const stripHtmlTags = (html: string): string =>
        html
          .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const answerText: string =
        firstResult.answer_text ||
        firstResult.answer ||
        firstResult.response ||
        firstResult.content ||
        '';
      const answerHtml: string = firstResult.answer_html || '';
      const answer = answerText || stripHtmlTags(answerHtml || '');

      const citationSources: unknown[] = [];
      const citationFields = [
        'citations',
        'links_attached',
        'links',
        'sources',
        'top_sources',
        'urls',
      ];

      citationFields.forEach((field) => {
        if (firstResult[field]) {
          citationSources.push(firstResult[field]);
        }
      });

      const citations = Array.from(
        new Set(
          citationSources
            .flatMap((entry) => collectUrlCandidates(entry))
            .filter((url) => typeof url === 'string' && url.trim().length > 0)
        )
      );

      const urls = [...citations];

      return {
        query_id: `brightdata_gemini_${Date.now()}`,
        run_start: new Date().toISOString(),
        run_end: new Date().toISOString(),
        prompt: request.prompt,
        answer,
        response: answer,
        citations: urls,
        urls,
        model_used: 'gemini',
        collector_type: 'gemini',
        metadata: {
          provider: 'brightdata_gemini',
          dataset_id: datasetId,
          snapshot_id: snapshotId,
          success: true,
          brand: request.brand,
          locale: request.locale,
          country: request.country,
          // NEW: Store raw JSON response for debugging and analysis
          raw_response_json: result
        }
      };
    } catch (error: any) {
      console.error('❌ BrightData Gemini error:', error.message);
      throw error;
    }
  }

  /**
   * Get available dataset information
   */
  async getDatasetInfo(): Promise<any> {
    if (!this.apiKey || !this.datasetIds.get('chatgpt')) {
      throw new Error('BrightData API key or dataset ID not configured');
    }

    try {
      const response = await fetch(`https://api.brightdata.com/datasets/v3/info?dataset_id=${this.datasetIds.get('chatgpt') || ''}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get dataset info: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Error getting dataset info:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const brightDataCollectorService = new BrightDataCollectorService();
