/**
 * DataForSEO Collector Service
 * Free Sandbox SERP API for Baidu, Bing, YouTube, and Claude AI Optimization
 * Documentation:
 * - SERP: https://docs.dataforseo.com/v3/serp/overview/
 * - Claude AI: https://docs.dataforseo.com/v3/ai_optimization/claude/overview/
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

// Load environment variables
loadEnvironment();

export interface DataForSeoQueryRequest {
  prompt: string;
  // Supported sources via DataForSEO
  source: 'baidu' | 'bing' | 'youtube' | 'claude' | 'perplexity' | 'google_aio';
  locale?: string;
  country?: string;
}

export interface DataForSeoQueryResponse {
  query_id: string;
  run_start: string;
  run_end: string;
  prompt: string;
  response: string;
  model_used: string;
  collector_type: string;
  citations?: string[];
  urls?: string[];
  metadata?: any;
}

export class DataForSeoCollectorService {
  private username: string;
  private password: string;
  private baseUrl: string;

  constructor() {
    // DataForSEO credentials from environment
    this.username = getEnvVar('DATAFORSEO_USERNAME', '');
    this.password = getEnvVar('DATAFORSEO_PASSWORD', '');
    this.baseUrl = 'https://sandbox.dataforseo.com/v3/serp';
    
    const hasCredentials = !!(this.username && this.password);
    console.log('🔧 DataForSEO Collector Service initialized:', {
      mode: 'Sandbox',
      hasUsername: !!this.username,
      hasPassword: !!this.password,
      ready: hasCredentials,
      supportedSources: ['baidu', 'bing', 'youtube', 'claude']
    });
    
    if (!hasCredentials) {
      console.warn('⚠️  DataForSEO credentials not found in environment. Collectors may fail with 401 errors.');
    }
  }

  async executeQuery(request: DataForSeoQueryRequest): Promise<DataForSeoQueryResponse> {
    const queryId = `dataforseo-${request.source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();
    
    try {
      // Claude AI Optimization uses a different API structure
      if (request.source === 'claude') {
        return await this.executeClaudeQuery(request, queryId, startTime);
      }
      
      // Perplexity AI Optimization (DataForSEO) - similar to Claude
      if (request.source === 'perplexity') {
        return await this.executePerplexityQuery(request, queryId, startTime);
      }
      
      // Google AI Mode (AI Overviews) uses SERP live advanced endpoint
      if (request.source === 'google_aio') {
        return await this.executeGoogleAioLive(request, queryId, startTime);
      }
      
      // Map source to DataForSEO endpoint
      const endpoint = this.getEndpoint(request.source);
      const taskUrl = `${this.baseUrl}/${endpoint}/task_post`;

      // Create task body
      const taskBody = [{
        keyword: request.prompt,
        language_code: this.getLanguageCode(request.locale || 'en-US'),
        location_code: this.getLocationCode(request.country || 'US'),
        device: 'desktop',
        os: 'windows'
      }];

      console.log('🔍 DataForSEO Request:', {
        url: taskUrl,
        source: request.source,
        keyword: request.prompt.substring(0, 60) + '...',
        hasAuth: !!(this.username && this.password)
      });

      // Create timeout controller (45 seconds for SERP APIs)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        // Step 1: Post task
        const taskResponse = await fetch(taskUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
          },
          body: JSON.stringify(taskBody),
          signal: controller.signal,
          // Increase connection timeout to 30 seconds (default is 10s)
          // @ts-ignore - Node.js fetch doesn't have TypeScript types for connectTimeout
          connectTimeout: 30000
        });

        clearTimeout(timeoutId);

        if (!taskResponse.ok) {
          const errorText = await taskResponse.text();
          console.error('❌ DataForSEO Task Error:', {
            status: taskResponse.status,
            body: errorText
          });
          throw new Error(`DataForSEO task error: ${taskResponse.status}`);
        }

        const taskData: any = await taskResponse.json();
        
        // In sandbox mode, we get dummy data immediately
        // Extract task_id for getting results
        const taskId = taskData.tasks?.[0]?.id || '00000000-0000-0000-0000-000000000000';

        // Step 2: Get results (sandbox returns immediate dummy data)
        const resultsUrl = `${this.baseUrl}/${endpoint}/task_get/advanced/${taskId}`;
        
        const resultsResponse = await fetch(resultsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
          },
          signal: controller.signal,
          // Increase connection timeout to 30 seconds (default is 10s)
          // @ts-ignore - Node.js fetch doesn't have TypeScript types for connectTimeout
          connectTimeout: 30000
        });

        if (!resultsResponse.ok) {
          throw new Error(`DataForSEO results error: ${resultsResponse.status}`);
        }

        const resultsData = await resultsResponse.json();
        const endTime = new Date().toISOString();

        // Extract content from results
        const content = this.extractContent(resultsData, request.source);
        const citations = this.extractCitations(resultsData);
        const urls = this.extractUrls(resultsData);

        return {
          query_id: queryId,
          run_start: startTime,
          run_end: endTime,
          prompt: request.prompt,
          response: content,
          model_used: `dataforseo-${request.source}`,
          collector_type: this.getCollectorTypeName(request.source),
          citations,
          urls,
          metadata: {
            task_id: taskId,
            source: request.source,
            sandbox: true
          }
        };

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error(`❌ DataForSEO request timeout after 30 seconds`);
          throw new Error(`DataForSEO request timeout: ${request.source}`);
        }
        throw fetchError;
      }

    } catch (error: any) {
      console.error('❌ DataForSEO execution failed:', error);
      throw new Error(`DataForSEO execution failed: ${error.message}`);
    }
  }

  /**
   * Execute query using DataForSEO Claude AI Optimization API
   */
  private async executeClaudeQuery(
    request: DataForSeoQueryRequest,
    queryId: string,
    startTime: string
  ): Promise<DataForSeoQueryResponse> {
    // Use LIVE endpoint for synchronous responses
    const claudeUrl = 'https://api.dataforseo.com/v3/ai_optimization/claude/llm_responses/live';
    
    const taskBody = [{
      system_message: encodeURI('communicate as if we are in a business meeting'),
      message_chain: [
        { role: 'user', message: 'Hello, what’s up?' },
        { role: 'ai', message: encodeURI('Hello! I’m doing well, thank you. How can I assist you today? Are there any specific topics or projects you’d like to discuss in our meeting?') }
      ],
      max_output_tokens: 1024,
      model_name: 'claude-opus-4-0',
      temperature: 0.3,
      top_p: 0.5,
      web_search: true,
      web_search_country_iso_code: this.getCountryIso(request.country || 'US'),
      user_prompt: encodeURI(request.prompt)
    }];

    console.log('🔍 DataForSEO Claude Request:', {
      url: claudeUrl,
      prompt: request.prompt.substring(0, 60) + '...',
      model: 'claude-3-5-sonnet-latest',
      hasAuth: !!(this.username && this.password)
    });

    try {
      // Call LIVE endpoint
      const taskResponse = await fetch(claudeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
        },
        body: JSON.stringify(taskBody)
      });

      if (!taskResponse.ok) {
        const errorText = await taskResponse.text();
        console.error('❌ DataForSEO Claude Task Error:', {
          status: taskResponse.status,
          body: errorText
        });
        throw new Error(`DataForSEO Claude task error: ${taskResponse.status}`);
      }

      const taskData: any = await taskResponse.json();
      const task = taskData?.tasks?.[0];
      if (!task || task.status_code >= 40000) {
        throw new Error(`Claude LIVE API error: ${task?.status_message || 'Unknown error'}`);
      }

      const liveResult = task.result?.[0];
      if (!liveResult) {
        throw new Error('No results from Claude LIVE API');
      }

      // Extract text and URLs from items/sections
      const { answer, urls } = this.parseLiveItems(liveResult.items || []);

      return {
        query_id: queryId,
        run_start: startTime,
        run_end: new Date().toISOString(),
        prompt: request.prompt,
        response: answer,
        model_used: liveResult.model_name || 'claude-opus-4-0',
        collector_type: 'claude',
        citations: urls,
        urls,
        metadata: {
          input_tokens: liveResult.input_tokens,
          output_tokens: liveResult.output_tokens,
          money_spent: liveResult.money_spent
        }
      };

    } catch (error: any) {
      console.error('❌ DataForSEO Claude execution failed:', error);
      throw new Error(`DataForSEO Claude execution failed: ${error.message}`);
    }
  }

  /**
   * Execute query using DataForSEO Perplexity AI Optimization API
   */
  private async executePerplexityQuery(
    request: DataForSeoQueryRequest,
    queryId: string,
    startTime: string
  ): Promise<DataForSeoQueryResponse> {
    // Use LIVE endpoint for synchronous responses
    const apiUrl = 'https://api.dataforseo.com/v3/ai_optimization/perplexity/llm_responses/live';

    const taskBody = [{
      system_message: encodeURI('communicate as if we are in a business meeting'),
      message_chain: [
        { role: 'user', message: 'Hello, what’s up?' },
        { role: 'ai', message: encodeURI('Hello! I’m doing well, thank you. How can I assist you today? Are there any specific topics or projects you’d like to discuss in our meeting?') }
      ],
      max_output_tokens: 1024,
      temperature: 0.3,
      top_p: 0.5,
      model_name: 'sonar-reasoning',
      web_search_country_iso_code: this.getCountryIso(request.country || 'US'),
      user_prompt: encodeURI(request.prompt)
    }];

    console.log('🔍 DataForSEO Perplexity Request:', {
      url: apiUrl,
      prompt: request.prompt.substring(0, 60) + '...',
      model: 'sonar-large-online',
      hasAuth: !!(this.username && this.password)
    });

    // Call LIVE endpoint
    const taskResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
      },
      body: JSON.stringify(taskBody)
    });

    if (!taskResponse.ok) {
      const errorText = await taskResponse.text();
      throw new Error(`DataForSEO Perplexity task error: ${taskResponse.status} ${errorText}`);
    }

    const taskData: any = await taskResponse.json();
    const task = taskData?.tasks?.[0];
    if (!task || task.status_code >= 40000) {
      throw new Error(`Perplexity LIVE API error: ${task?.status_message || 'Unknown error'}`);
    }

    const liveResult = task.result?.[0];
    if (!liveResult) {
      throw new Error('No results from Perplexity LIVE API');
    }

    // Extract text and URLs from items/sections
    const { answer, urls } = this.parseLiveItems(liveResult.items || []);

    return {
      query_id: queryId,
      run_start: startTime,
      run_end: new Date().toISOString(),
      prompt: request.prompt,
      response: answer,
      model_used: liveResult.model_name || 'sonar-reasoning',
      collector_type: 'perplexity',
      citations: urls,
      urls,
      metadata: {
        input_tokens: liveResult.input_tokens,
        output_tokens: liveResult.output_tokens,
        money_spent: liveResult.money_spent
      }
    };
  }

  /**
   * Execute Google AI Mode (AI Overviews) via DataForSEO SERP live advanced
   */
  private async executeGoogleAioLive(
    request: DataForSeoQueryRequest,
    queryId: string,
    startTime: string
  ): Promise<DataForSeoQueryResponse> {
    const apiUrl = 'https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced';
    const body = [{
      language_code: this.getLanguageCode(request.locale || 'en-US'),
      location_code: this.getLocationCode(request.country || 'US'),
      keyword: request.prompt
    }];

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`DataForSEO Google AI Mode error: ${resp.status} ${errorText}`);
    }

    const data: any = await resp.json();
    const result = data.tasks?.[0]?.result?.[0];

    const answer = result?.ai_overview?.answer || result?.ai_overview?.content || 'No AI Overview available';
    const urls = (result?.ai_overview?.links || result?.ai_overview?.sources || [])
      .map((x: any) => x.url || x.link || x.source)
      .filter(Boolean);

    return {
      query_id: queryId,
      run_start: startTime,
      run_end: new Date().toISOString(),
      prompt: request.prompt,
      response: answer,
      model_used: 'google_ai_mode',
      collector_type: 'google_aio',
      citations: urls,
      urls,
      metadata: { raw: result?.ai_overview ? undefined : result }
    };
  }

  private getEndpoint(source: string): string {
    const endpoints: { [key: string]: string } = {
      'baidu': 'baidu/organic',
      'bing': 'bing/organic',
      'youtube': 'youtube/video'
    };
    return endpoints[source] || 'bing/organic';
  }

  private getLanguageCode(locale: string): string {
    // Map locale to DataForSEO language codes
    const langMap: { [key: string]: string } = {
      'en-US': 'en',
      'en-GB': 'en',
      'zh-CN': 'zh',
      'ja-JP': 'ja',
      'ko-KR': 'ko',
      'es-ES': 'es',
      'fr-FR': 'fr',
      'de-DE': 'de'
    };
    return langMap[locale] || 'en';
  }

  private getLocationCode(country: string): number {
    // Map country codes to DataForSEO location codes
    const locationMap: { [key: string]: number } = {
      'US': 2840,
      'GB': 2826,
      'CN': 2156,
      'JP': 2392,
      'KR': 2410,
      'ES': 2724,
      'FR': 2250,
      'DE': 2276
    };
    return locationMap[country] || 2840; // Default to US
  }

  private getCountryIso(country: string): string {
    const map: { [key: string]: string } = {
      'US': 'US',
      'GB': 'GB',
      'FR': 'FR',
      'DE': 'DE',
      'ES': 'ES',
      'CN': 'CN',
      'JP': 'JP',
      'KR': 'KR'
    };
    return map[country] || 'US';
  }

  private parseLiveItems(items: any[]): { answer: string; urls: string[] } {
    const texts: string[] = [];
    const urls: string[] = [];
    try {
      items.forEach((it: any) => {
        if (it.sections && Array.isArray(it.sections)) {
          it.sections.forEach((sec: any) => {
            if (sec.type === 'text' && typeof sec.text === 'string') {
              texts.push(sec.text);
              if (Array.isArray(sec.annotations)) {
                sec.annotations.forEach((ann: any) => {
                  const u = ann?.url || ann?.link || ann?.source;
                  if (u) urls.push(u);
                });
              }
            }
          });
        }
      });
    } catch {}
    return { answer: texts.join('\n\n') || 'No response', urls: Array.from(new Set(urls)).slice(0, 25) };
  }

  private extractContent(data: any, source: string): string {
    try {
      const items = data.tasks?.[0]?.result?.[0]?.items || [];
      
      if (items.length === 0) {
        return `No ${source} results available from DataForSEO sandbox`;
      }

      // Extract content based on source type
      const contents: string[] = [];
      
      items.slice(0, 5).forEach((item: any, index: number) => {
        if (source === 'youtube') {
          // YouTube video results
          const title = item.title || '';
          const description = item.description || '';
          const channel = item.channel?.name || '';
          contents.push(`${index + 1}. ${title}\nChannel: ${channel}\n${description}`);
        } else {
          // Baidu/Bing organic results
          const title = item.title || '';
          const snippet = item.description || '';
          contents.push(`${index + 1}. ${title}\n${snippet}`);
        }
      });

      return contents.join('\n\n') || `Sample ${source} search results (sandbox data)`;
    } catch (error) {
      console.error('Error extracting DataForSEO content:', error);
      return `Sample ${source} search results (sandbox data)`;
    }
  }

  private extractCitations(data: any): string[] {
    try {
      const items = data.tasks?.[0]?.result?.[0]?.items || [];
      return items.slice(0, 5).map((item: any) => item.title || '').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  private extractUrls(data: any): string[] {
    try {
      const items = data.tasks?.[0]?.result?.[0]?.items || [];
      return items.slice(0, 5).map((item: any) => item.url || item.link || '').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  private getCollectorTypeName(source: string): string {
    const names: { [key: string]: string } = {
      'baidu': 'Baidu',
      'bing': 'Bing',
      'youtube': 'YouTube'
    };
    return names[source] || source;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Simple health check - try to access the sandbox endpoint
      const response = await fetch(`${this.baseUrl}/bing/organic/task_post`, {
        method: 'OPTIONS'
      });
      return true; // Sandbox is always available
    } catch (error) {
      console.error('DataForSEO health check failed:', error);
      return false;
    }
  }
}

export const dataForSeoCollectorService = new DataForSeoCollectorService();

