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
  };
}

export class BrightDataCollectorService {
  private apiKey: string;
  private baseUrl: string;
  private datasetIds: Map<string, string>;

  constructor() {
    this.apiKey = process.env.BRIGHTDATA_API_KEY || '';
    this.baseUrl = 'https://api.brightdata.com';
    this.datasetIds = new Map();
    
    // Initialize dataset IDs for different collectors
    this.datasetIds.set('chatgpt', 'gd_m7di5jy6s9geokz8w'); // ChatGPT dataset ID
    this.datasetIds.set('bing_copilot', 'gd_m7di5jy6s9geokz8w'); // Bing Copilot dataset ID
    this.datasetIds.set('grok', 'gd_m8ve0u141icu75ae74'); // Grok dataset ID
    this.datasetIds.set('gemini', 'gd_mbz66arm2mf9cu856y'); // Gemini dataset ID
    
    if (!this.apiKey) {
      console.warn('⚠️ BrightData API key not configured');
    }
  }

  /**
   * Execute ChatGPT query via BrightData
   */
  async executeChatGPTQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
    return await this.executeChatGPTSync(request);
  }

  /**
   * Execute ChatGPT query synchronously
   */
  private async executeChatGPTSync(request: BrightDataRequest): Promise<BrightDataResponse> {
    const datasetId = this.datasetIds.get('chatgpt') || '';
    
    if (!this.apiKey || !datasetId) {
      throw new Error('BrightData API key or ChatGPT dataset ID not configured');
    }

    try {
      console.log(`🚀 Executing ChatGPT query via BrightData (dataset: ${datasetId})`);
      
      const payload = [{
        url: 'https://chat.openai.com/',
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

      console.log(`📡 ChatGPT response status: ${response.status}`);

      if (response.status === 202) {
        const result = await response.json() as any;
        const snapshotId = result.snapshot_id;
        
        if (snapshotId) {
          console.log(`✅ Got snapshot_id: ${snapshotId}`);
          return await this.pollForSnapshot(snapshotId, 'chatgpt', datasetId, request);
        }
      }

      if (!response.ok) {
        throw new Error(`BrightData ChatGPT API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;

      // Extract answer from result (scrape API returns array directly)
      const responseData = Array.isArray(result) ? result : (result.data || []);
      const answer = responseData[0]?.answer || 'No response from ChatGPT';
      const citations = responseData[0]?.citations || [];
      const urls = responseData[0]?.urls || [];
      const snapshotId = result.snapshot_id || undefined;

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
          country: request.country
        }
      };

    } catch (error: any) {
      console.error('❌ BrightData ChatGPT error:', error.message);
      throw error;
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
      console.log(`📊 Bing Copilot result:`, JSON.stringify(result, null, 2));
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
          country: request.country
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
      
      // Correct payload structure based on BrightData docs
      const payload = [{
        url: 'https://grok.com/',
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
      console.log(`📊 Grok result:`, JSON.stringify(result, null, 2));
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
        answer = firstResult.answer || firstResult.answer_text || firstResult.response || firstResult.content || 'No response from Grok';
        
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
          country: request.country
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
        
        // Check content type
        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();
        
        console.log(`📄 Response content type: ${contentType}`);
        console.log(`📄 Response preview: ${responseText.substring(0, 300)}`);
        
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
        
        // Check if data is ready - look for answer_text field directly
        if (downloadResult && downloadResult.answer_text) {
          console.log(`✅ Data is ready! Found answer_text field`);
          
          // Extract answer directly from the response
          const answer = downloadResult.answer_text || 'No response';
          
          // Extract sources/urls from the response
          const sources = downloadResult.sources || downloadResult.citations || [];
          const urls = Array.isArray(sources) ? sources.map((s: any) => s.url || s).filter(Boolean) : [];
          
          console.log(`✅ Extracted answer length: ${answer.length}, URLs count: ${urls.length}`);
          
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
              country: request.country
            }
          };
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
          country: request.country
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
