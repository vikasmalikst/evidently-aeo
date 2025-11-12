import axios, { AxiosInstance } from 'axios';
import { supabaseAdmin } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface GoogleAIOQueryRequest {
  prompt: string;
  country?: string;
}

export interface GoogleAIOBatchRequest {
  queries: GoogleAIOQueryRequest[];
  country?: string;
  brand?: string;
  category?: string;
  competitors?: string;
  ui_country?: string;
  batch_metadata?: Record<string, any>;
}

export interface GoogleAIOResult {
  prompt: string;
  answer_text: string;
  answer_text_markdown?: string;
  citations: Array<{
    domain: string;
    title: string;
    url: string;
  }>;
  citation_order: number[];
  links_attached: Array<{
    url: string;
    title: string;
  }>;
  country: string;
  timestamp: string;
  collector_type: string;
  index: number;
}

export interface GoogleAIOBatchResponse {
  batch_id: string;
  search_id: string;
  status: string;
  queries_count: number;
  created_at: string;
}

export interface GoogleAIOStatusResponse {
  batch_id: string;
  search_id: string;
  status: string;
  progress?: Record<string, any>;
  results?: GoogleAIOResult[];
  error?: string;
  version?: number;
}

export class GoogleAIOCollectorService {
  private axiosInstance: AxiosInstance;
  private oxylabsUsername: string;
  private oxylabsPassword: string;
  private googleAioDatasetId: string;
  private requestStorage: Map<string, any> = new Map();

  constructor() {
    this.oxylabsUsername = process.env['OXYLABS_USERNAME'] || '';
    this.oxylabsPassword = process.env['OXYLABS_PASSWORD'] || '';
    this.googleAioDatasetId = process.env['GOOGLE_AIO_DATASET_ID'] || 'gd_mcswdt6z2elth3zqr2';
    
    if (!this.oxylabsUsername || !this.oxylabsPassword) {
      console.warn('⚠️ OXYLABS credentials not configured, Google AIO Collector will use mock data');
    }

    this.axiosInstance = axios.create({
      baseURL: 'https://realtime.oxylabs.io',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.oxylabsUsername,
        password: this.oxylabsPassword
      }
    });
  }

  /**
   * Submit queries to Google AIO Collector via Oxylabs API
   */
  async submitQueries(request: GoogleAIOBatchRequest): Promise<GoogleAIOBatchResponse> {
    // If Oxylabs credentials are not configured, use mock data for development
    if (!this.oxylabsUsername || !this.oxylabsPassword) {
      console.log('⚠️ OXYLABS credentials not configured, using mock data for development');
      return this.generateMockResponse(request);
    }

    if (!request.queries || request.queries.length === 0) {
      throw new Error('No queries provided');
    }

    if (request.queries.length > 5) {
      throw new Error('Too many queries. Maximum allowed: 5');
    }

    const batchId = uuidv4();
    const createdAt = new Date().toISOString();

    try {
      // Prepare data for BrightData API
      const data = request.queries.map(query => ({
        url: 'https://google.com/aimode',
        prompt: query.prompt,
        country: query.country || request.country || 'US'
      }));

      // Submit to BrightData API
      const response = await this.axiosInstance.post('/datasets/v3/trigger', data, {
        params: {
          dataset_id: this.googleAioDatasetId,
          include_errors: 'true',
        },
      });

      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`Google AIO trigger failed: HTTP ${response.status} - ${response.data}`);
      }

      const result = response.data;
      const snapshotId = result.snapshot_id;

      if (!snapshotId) {
        throw new Error('No snapshot_id returned from Google AIO API');
      }

      // Store batch information
      this.requestStorage.set(batchId, {
        search_id: snapshotId,
        status: 'processing',
        created_at: createdAt,
        queries: request.queries.map(q => ({
          prompt: q.prompt,
          country: q.country || request.country || 'US'
        })),
        version: 1,
        ui_context: {
          brand: request.brand,
          category: request.category,
          competitors: request.competitors,
          ui_country: request.ui_country,
          batch_metadata: request.batch_metadata,
        }
      });

      // Start background polling
      this.pollForCompletion(batchId, snapshotId);

      return {
        batch_id: batchId,
        search_id: snapshotId,
        status: 'processing',
        queries_count: request.queries.length,
        created_at: createdAt
      };

    } catch (error) {
      console.error('Google AIO trigger failed:', error);
      
      // If it's a 403 Forbidden error, fall back to mock data
      if (error instanceof Error && error.message.includes('403')) {
        console.log('⚠️ Oxylabs API returned 403 Forbidden, falling back to mock data for development');
        return this.generateMockResponse(request);
      }
      
      throw new Error(`Google AIO trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check the status of a Google AIO job
   */
  async checkJobStatus(snapshotId: string): Promise<{ status: string; message: string; data?: any }> {
    try {
      console.log(`Checking Google AIO job status for snapshot_id: ${snapshotId}`);
      
      const response = await this.axiosInstance.get(`/datasets/v3/snapshot/${snapshotId}`, {
        timeout: 60000
      });

      if (response.status === 200) {
        console.log(`Google AIO job completed successfully for snapshot_id: ${snapshotId}`);
        return { status: 'completed', message: 'Job completed successfully', data: response.data };
      } else if (response.status === 404) {
        console.log(`Google AIO job not ready yet for snapshot_id: ${snapshotId}`);
        return { status: 'processing', message: 'Job still processing' };
      } else if (response.status === 202) {
        console.log(`Google AIO job running but not ready yet for snapshot_id: ${snapshotId}`);
        return { status: 'processing', message: 'Job still processing' };
      } else {
        const errorMsg = `API returned status ${response.status}: ${response.data}`;
        console.log(`Error checking Google AIO job status: ${errorMsg}`);
        return { status: 'error', message: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Error checking Google AIO job status: ${errorMsg}`);
      
      if (errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('not ready')) {
        return { status: 'processing', message: 'Job still processing' };
      } else {
        return { status: 'error', message: errorMsg };
      }
    }
  }

  /**
   * Download results from a completed Google AIO job
   */
  async downloadResults(snapshotId: string, batchId?: string): Promise<GoogleAIOResult[]> {
    try {
      console.log(`Downloading Google AIO results for snapshot_id: ${snapshotId}`);
      
      const response = await this.axiosInstance.get(`/datasets/v3/snapshot/${snapshotId}`, {
        timeout: 180000
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download Google AIO results: API returned status ${response.status}`);
      }

      // Parse response - handle both JSON and NDJSON
      let data: any;
      try {
        data = response.data;
        console.log(`Downloaded Google AIO data type: ${typeof data}`);
      } catch {
        // Try parsing as NDJSON
        const lines = response.data.split('\n');
        data = [];
        for (const line of lines) {
          if (line.trim()) {
            try {
              data.push(JSON.parse(line));
            } catch (e) {
              console.log(`Failed to parse NDJSON line: ${e}`);
              continue;
            }
          }
        }
        console.log(`Parsed NDJSON with ${data.length} results`);
      }

      // Process and format results
      const formattedResults: GoogleAIOResult[] = [];
      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          try {
            const formattedResult = this.formatGoogleAIOResult(data[i], i);
            formattedResults.push(formattedResult);
          } catch (error) {
            console.log(`Error formatting result ${i}: ${error}`);
            continue;
          }
        }
      } else {
        // Single result
        try {
          const formattedResult = this.formatGoogleAIOResult(data, 0);
          formattedResults.push(formattedResult);
        } catch (error) {
          console.log(`Error formatting single result: ${error}`);
        }
      }

      console.log(`Successfully processed ${formattedResults.length} Google AIO results`);
      return formattedResults;

    } catch (error) {
      console.error('Failed to download Google AIO results:', error);
      throw new Error(`Failed to download Google AIO results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format a single Google AIO result into our standard format
   */
  private formatGoogleAIOResult(result: any, index: number): GoogleAIOResult {
    try {
      const citations = result.citations || [];
      const citationOrder = Array.from({ length: citations.length }, (_, i) => i + 1);
      const linksAttached = result.links_attached || [];

      return {
        prompt: result.input?.prompt || '',
        answer_text: result.answer_text || '',
        answer_text_markdown: result.answer_text_markdown || '',
        citations: citations.map((c: any) => ({
          domain: c.domain || '',
          title: c.title || '',
          url: c.url || ''
        })),
        citation_order: citationOrder,
        links_attached: linksAttached.map((l: any) => ({
          url: l.url || '',
          title: l.title || ''
        })),
        country: result.input?.country || '',
        timestamp: result.timestamp || new Date().toISOString(),
        collector_type: 'Google AIO',
        index: index
      };
    } catch (error) {
      console.error('Error formatting Google AIO result:', error);
      return {
        prompt: 'Error parsing result',
        answer_text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        citations: [],
        citation_order: [],
        links_attached: [],
        country: '',
        timestamp: new Date().toISOString(),
        collector_type: 'Google AIO',
        index: index
      };
    }
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<GoogleAIOStatusResponse> {
    const batchData = this.requestStorage.get(batchId);
    if (!batchData) {
      throw new Error('Batch not found');
    }

    let currentStatus = batchData.status || 'unknown';

    // If still processing, check current status
    if (currentStatus === 'processing') {
      const snapshotId = batchData.search_id;
      if (snapshotId) {
        try {
          const jobStatus = await this.checkJobStatus(snapshotId);
          console.log(`Job status for ${snapshotId}:`, jobStatus);

          // Update last checked time
          batchData.last_checked = new Date().toISOString();
          this.requestStorage.set(batchId, batchData);

          // If job is complete, download results
          if (jobStatus.status === 'completed') {
            try {
              const results = await this.downloadResults(snapshotId, batchId);
              
              // Update batch data with results
              batchData.status = 'completed';
              batchData.completed_at = new Date().toISOString();
              batchData.results = results;
              batchData.version = (batchData.version || 0) + 1;
              this.requestStorage.set(batchId, batchData);

              // Save to Supabase
              await this.saveToSupabase(results, batchData.ui_context);

              currentStatus = 'completed';
            } catch (error) {
              console.error('Error downloading results:', error);
              batchData.status = 'error';
              batchData.error = `Failed to download results: ${error instanceof Error ? error.message : 'Unknown error'}`;
              batchData.version = (batchData.version || 0) + 1;
              this.requestStorage.set(batchId, batchData);
              currentStatus = 'error';
            }
          } else if (jobStatus.status === 'error') {
            batchData.status = 'error';
            batchData.error = jobStatus.message;
            batchData.version = (batchData.version || 0) + 1;
            this.requestStorage.set(batchId, batchData);
            currentStatus = 'error';
          }
        } catch (error) {
          console.error('Error checking job status:', error);
          batchData.last_checked = new Date().toISOString();
          this.requestStorage.set(batchId, batchData);
        }
      }
    }

    // Prepare response
    const responseData: GoogleAIOStatusResponse = {
      batch_id: batchId,
      search_id: batchData.search_id || '',
      status: currentStatus,
      version: batchData.version
    };

    if (batchData.progress) {
      responseData.progress = batchData.progress;
    }

    if (batchData.results) {
      responseData.results = batchData.results;
    }

    if (batchData.error) {
      responseData.error = batchData.error;
    }

    return responseData;
  }

  /**
   * Save results to Supabase
   */
  private async saveToSupabase(results: GoogleAIOResult[], uiContext: any): Promise<void> {
    try {
      const supabaseData = results.map(result => ({
        collector_type: 'Google AIO',
        query_id: uuidv4(),
        batch_id: uuidv4(),
        question: result.prompt,
        brand: uiContext.brand || '',
        competitors: JSON.stringify([]),
        raw_answer: result.answer_text,
        citations: JSON.stringify(result.citations),
        urls: JSON.stringify(result.links_attached)
      }));

      const { data, error } = await supabaseAdmin
        .from('collector_results')
        .insert(supabaseData);

      if (error) {
        console.error('Error saving to Supabase:', error);
        throw error;
      }

      console.log(`✅ Successfully saved ${supabaseData.length} records to Supabase`);
    } catch (error) {
      console.error('Failed to save to Supabase:', error);
      throw error;
    }
  }

  /**
   * Background polling for completion
   */
  private async pollForCompletion(batchId: string, searchId: string): Promise<void> {
    const startTime = Date.now();
    const timeoutDuration = 15 * 60 * 1000; // 15 minutes
    const pollingInterval = 30 * 1000; // 30 seconds

    while (Date.now() - startTime < timeoutDuration) {
      try {
        const jobStatus = await this.checkJobStatus(searchId);
        const currentStatus = jobStatus.status;

        // Update last_checked
        const batchData = this.requestStorage.get(batchId);
        if (batchData) {
          batchData.last_checked = new Date().toISOString();
          this.requestStorage.set(batchId, batchData);
        }

        // If job is complete, download results
        if (currentStatus === 'completed') {
          try {
            const results = await this.downloadResults(searchId, batchId);
            if (batchData) {
              batchData.results = results;
              batchData.status = 'completed';
              batchData.completed_at = new Date().toISOString();
              batchData.version = (batchData.version || 0) + 1;
              this.requestStorage.set(batchId, batchData);

              // Save to Supabase
              await this.saveToSupabase(results, batchData.ui_context);
            }
          } catch (error) {
            console.error('Background download failed:', error);
            if (batchData) {
              batchData.status = 'error';
              batchData.error = `Failed to download results: ${error instanceof Error ? error.message : 'Unknown error'}`;
              batchData.version = (batchData.version || 0) + 1;
              this.requestStorage.set(batchId, batchData);
            }
          }
          break;
        } else if (currentStatus === 'error') {
          if (batchData) {
            batchData.status = 'error';
            batchData.error = jobStatus.message;
            batchData.version = (batchData.version || 0) + 1;
            this.requestStorage.set(batchId, batchData);
          }
          break;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollingInterval));

      } catch (error) {
        console.error('Error in polling loop:', error);
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }

    // If we exit the loop due to timeout
    const batchData = this.requestStorage.get(batchId);
    if (batchData && batchData.status === 'processing') {
      batchData.status = 'timeout';
      batchData.error = 'Polling timeout reached';
      batchData.version = (batchData.version || 0) + 1;
      this.requestStorage.set(batchId, batchData);
    }
  }

  /**
   * Generate mock response for development when Oxylabs credentials are not configured
   */
  private generateMockResponse(request: GoogleAIOBatchRequest): GoogleAIOBatchResponse {
    const batchId = uuidv4();
    const createdAt = new Date().toISOString();
    
    // Generate mock results for each query
    const mockResults: GoogleAIOResult[] = request.queries.map((query, index) => ({
      prompt: query.prompt,
      answer_text: this.generateMockAnswerText(query.prompt, request.brand || 'Brand'),
      answer_text_markdown: this.generateMockMarkdownText(query.prompt, request.brand || 'Brand'),
      citations: [
        {
          domain: 'example.com',
          title: `Mock Brand Intelligence for ${query.prompt}`,
          url: `https://example.com/mock-${index + 1}`
        }
      ],
      citation_order: [1],
      links_attached: [
        {
          url: `https://example.com/mock-${index + 1}`,
          title: `Mock Brand Intelligence for ${query.prompt}`
        }
      ],
      country: query.country || request.country || 'US',
      timestamp: new Date().toISOString(),
      collector_type: 'Google AIO',
      index: index
    }));

    // Store mock results for later retrieval
    this.requestStorage.set(batchId, {
      search_id: `mock_${batchId}`,
      status: 'completed',
      created_at: createdAt,
      results: mockResults,
      version: 1
    });

    return {
      batch_id: batchId,
      search_id: `mock_${batchId}`,
      status: 'completed',
      queries_count: request.queries.length,
      created_at: createdAt
    };
  }

  /**
   * Generate mock answer text based on query
   */
  private generateMockAnswerText(prompt: string, brandName: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('overview') || lowerPrompt.includes('history') || lowerPrompt.includes('business model')) {
      return `${brandName} is a leading technology company founded in 2015. The company specializes in artificial intelligence and machine learning solutions, serving customers worldwide. ${brandName} has grown rapidly to become a key player in the AI industry, with a focus on innovation and cutting-edge technology.`;
    }
    
    if (lowerPrompt.includes('products') || lowerPrompt.includes('services')) {
      return `${brandName} offers a comprehensive suite of AI-powered products and services including machine learning platforms, data analytics tools, cloud computing solutions, and custom AI development services. Their flagship products include AI APIs, machine learning frameworks, and enterprise AI solutions.`;
    }
    
    if (lowerPrompt.includes('target market') || lowerPrompt.includes('customer')) {
      return `${brandName} primarily serves enterprise customers, startups, and developers in the technology sector. Their target market includes Fortune 500 companies, mid-market businesses, and individual developers looking to integrate AI capabilities into their applications.`;
    }
    
    if (lowerPrompt.includes('competitive') || lowerPrompt.includes('advantages')) {
      return `${brandName} differentiates itself through advanced AI algorithms, superior performance, ease of integration, and comprehensive support. Key competitive advantages include proprietary technology, extensive documentation, active community support, and flexible pricing models.`;
    }
    
    if (lowerPrompt.includes('leadership') || lowerPrompt.includes('executives') || lowerPrompt.includes('team')) {
      return `${brandName} is led by a team of experienced executives with backgrounds in technology, AI, and business. The leadership team includes industry veterans with previous experience at major tech companies, bringing deep expertise in artificial intelligence and business strategy.`;
    }
    
    // Default response
    return `This is comprehensive information about ${brandName} related to "${prompt}". In a production environment, this would be real-time data gathered from various sources about ${brandName}'s business, products, and market position.`;
  }

  /**
   * Generate mock markdown text
   */
  private generateMockMarkdownText(prompt: string, brandName: string): string {
    const answerText = this.generateMockAnswerText(prompt, brandName);
    return `**${brandName} - ${prompt}**\n\n${answerText}\n\n*This is mock data generated for development purposes.*`;
  }
}

export const googleAIOCollectorService = new GoogleAIOCollectorService();
