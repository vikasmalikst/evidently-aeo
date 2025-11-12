/**
 * Unified Oxylabs Collector Service
 * Handles all data collection through Oxylabs API with different sources
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

// Load environment variables
loadEnvironment();

export interface OxylabsQueryRequest {
  prompt: string;
  source: 'chatgpt' | 'google' | 'perplexity' | 'google_aio';
  brand?: string;
  locale?: string;
  country?: string;
}

export interface OxylabsQueryResponse {
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

export class OxylabsCollectorService {
  private username: string;
  private password: string;
  private baseUrl: string;

  constructor() {
    this.username = getEnvVar('OXYLABS_USERNAME', '');
    this.password = getEnvVar('OXYLABS_PASSWORD', '');
    this.baseUrl = 'https://realtime.oxylabs.io/v1/queries';
    console.log('🔧 Oxylabs Collector Service initialized');
  }

  async executeQuery(request: OxylabsQueryRequest): Promise<OxylabsQueryResponse> {
    const queryId = `oxylabs-${request.source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();
    
    try {
      // Map source to Oxylabs source format
      const sourceMapping: { [key: string]: string } = {
        chatgpt: 'chatgpt',
        google: 'google_search',
        google_aio: 'google_ai_mode',
        perplexity: 'perplexity'
       
      };

      const oxylabsSource = sourceMapping[request.source] || request.source || 'google_search';
      let oxylabsBody: any;

      // Prepare Oxylabs request body based on source type
      switch (oxylabsSource) {
        case 'chatgpt':
          // ChatGPT requires: source, prompt, parse, search, geo_location
          oxylabsBody = {
            source: 'chatgpt',
            prompt: request.prompt,
            parse: true,
            search: true,
            geo_location: request.country || 'United States'
          };
          break;
        case 'google_ai_mode':
          // Google AI Overviews requires: source, query, parse, geo_location
          oxylabsBody = {
            source: 'google_ai_mode',
            query: request.prompt,
            render: 'html',
            parse: true,
            geo_location: request.country || 'United States'
          };
          break;
        case 'perplexity':
          // Perplexity requires: source, query, parse
          oxylabsBody = {
            source: 'perplexity',
            prompt: request.prompt,
            parse: true,
            geo_location: request.country || 'United States'
          };
          break;
       
        default:
          // Default to Google search if unknown
          oxylabsBody = {
            source: oxylabsSource,
            query: request.prompt,
            parse: true,
            geo_location: request.country || 'United States'
          };
      }

      // Make request to Oxylabs with 30-second timeout
      console.log('🔍 Oxylabs Request:', {
        url: this.baseUrl,
        source: request.source,
        oxylabsSource,
        body: oxylabsBody,
        hasCredentials: !!(this.username && this.password)
      });

      // Create an AbortController for timeout
      // ChatGPT needs 90s, others need 60s
      const timeoutDuration = request.source === 'chatgpt' ? 90000 : 60000; // 90s for ChatGPT, 60s for others
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
          },
          body: JSON.stringify(oxylabsBody),
          signal: controller.signal,
          // Increase connection timeout to 30 seconds (default is 10s)
          // @ts-ignore - Node.js fetch doesn't have TypeScript types for connectTimeout
          connectTimeout: 30000
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Oxylabs API Error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            request: oxylabsBody
          });
          throw new Error(`Oxylabs API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const endTime = new Date().toISOString();

        // Extract content from Oxylabs response
        const content = this.extractContentFromOxylabsResponse(data);
        const citations = this.extractCitationsFromOxylabsResponse(data);
        const urls = this.extractUrlsFromOxylabsResponse(data);
        const model = this.extractModelFromOxylabsResponse(data) || `oxylabs-${request.source}`;

        return {
          query_id: queryId,
          run_start: startTime,
          run_end: endTime,
          prompt: request.prompt,
          response: content,
          model_used: model,
          collector_type: this.getCollectorTypeName(request.source),
          citations,
          urls,
          metadata: {
            brand: request.brand,
            locale: request.locale,
            country: request.country,
            oxylabs_source: oxylabsSource,
            original_source: request.source
          }
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error(`❌ Oxylabs request timeout after ${timeoutDuration / 1000} seconds`);
          throw new Error(`Oxylabs request timeout: ${request.source} query took longer than ${timeoutDuration / 1000}s`);
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('❌ Oxylabs execution failed:', error);
      throw new Error(`Oxylabs execution failed: ${error.message}`);
    }
  }

  private extractContentFromOxylabsResponse(data: any): string {
    try {
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.content) {
          // Prefer structured ChatGPT response_text or markdown_text when available
          if (typeof result.content === 'object') {
            if (typeof result.content.response_text === 'string' && result.content.response_text.trim()) {
              return result.content.response_text;
            }
            if (typeof result.content.markdown_text === 'string' && result.content.markdown_text.trim()) {
              return result.content.markdown_text;
            }
            if (typeof result.content.answer_results_md === 'string' && result.content.answer_results_md.trim()) {
              return result.content.answer_results_md;
            }
          }
          // Handle different content structures
          if (typeof result.content === 'string') {
            return result.content;
          } else if (Array.isArray(result.content)) {
            return result.content.join('\n');
          } else if (result.content.text) {
            return result.content.text;
          } else if (Array.isArray(result.content.answer_results)) {
            return this.formatAnswerResults(result.content.answer_results);
          } else if (result.content.results) {
            // Handle Google search results structure
            const organic = result.content.results.organic || [];
            const paid = result.content.results.paid || [];
            const allResults = [...organic, ...paid];
            
            if (allResults.length > 0) {
              return allResults.map(item => 
                `${item.title || 'No title'}\n${item.desc || 'No description'}\nURL: ${item.url || 'No URL'}`
              ).join('\n\n');
            }
          }
        }
      }
      return 'No content available from Oxylabs response';
    } catch (error) {
      console.error('Error extracting content from Oxylabs response:', error);
      return 'Error extracting content from response';
    }
  }

  private extractCitationsFromOxylabsResponse(data: any): string[] {
    try {
      const citations: string[] = [];
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.citations) {
          citations.push(...result.citations);
        }
        if (result.sources) {
          citations.push(...result.sources);
        }
        // Extract from ChatGPT markdown_json annotations
        if (result.content && result.content.markdown_json && Array.isArray(result.content.markdown_json)) {
          result.content.markdown_json.forEach((node: any) => {
            if (node.sections && Array.isArray(node.sections)) {
              node.sections.forEach((sec: any) => {
                if (Array.isArray(sec.annotations)) {
                  sec.annotations.forEach((ann: any) => {
                    const u = ann?.url || ann?.link || ann?.source;
                    if (u) citations.push(u);
                  });
                }
              });
            }
          });
        }
        if (result.content && result.content.results) {
          // Extract URLs from Google search results
          const organic = result.content.results.organic || [];
          const paid = result.content.results.paid || [];
          const allResults = [...organic, ...paid];
          
          allResults.forEach(item => {
            if (item.url) {
              citations.push(item.url);
            }
          });
        }
        const collectFromContent = (content: any) => {
          if (!content || typeof content !== 'object') return;

          const { links, citations: contentCitations, top_sources: topSources } = content;

          if (Array.isArray(links)) {
            links.forEach((link: any) => {
              const url = link?.url || link?.href || link?.link;
              if (url) citations.push(url);
            });
          }

          if (Array.isArray(contentCitations)) {
            contentCitations.forEach((entry: any) => {
              if (Array.isArray(entry?.urls)) {
                entry.urls.forEach((url: any) => {
                  if (typeof url === 'string') {
                    citations.push(url);
                  }
                });
              }
              const directUrl = entry?.url || entry?.href || entry?.link;
              if (directUrl) {
                citations.push(directUrl);
              }
            });
          }

          if (Array.isArray(topSources)) {
            topSources.forEach((src: any) => {
              if (src?.url) citations.push(src.url);
            });
          }
        };

        collectFromContent(result.content);
      }
      return Array.from(new Set(citations));
    } catch (error) {
      console.error('Error extracting citations:', error);
      return [];
    }
  }

  private extractUrlsFromOxylabsResponse(data: any): string[] {
    try {
      const urls: string[] = [];
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.urls) {
          urls.push(...result.urls);
        }
        if (result.links) {
          urls.push(...result.links);
        }
        if (result.content && result.content.results) {
          // Extract URLs from Google search results
          const organic = result.content.results.organic || [];
          const paid = result.content.results.paid || [];
          const allResults = [...organic, ...paid];
          
          allResults.forEach(item => {
            if (item.url) {
              urls.push(item.url);
            }
          });
        }
        // Also extract from ChatGPT markdown_json annotations
        if (result.content && result.content.markdown_json && Array.isArray(result.content.markdown_json)) {
          result.content.markdown_json.forEach((node: any) => {
            if (node.sections && Array.isArray(node.sections)) {
              node.sections.forEach((sec: any) => {
                if (Array.isArray(sec.annotations)) {
                  sec.annotations.forEach((ann: any) => {
                    const u = ann?.url || ann?.link || ann?.source;
                    if (u) urls.push(u);
                  });
                }
              });
            }
          });
        }
        const collectFromContent = (content: any) => {
          if (!content || typeof content !== 'object') return;

          const { links, citations: contentCitations, top_sources: topSources, top_images: topImages } = content;

          if (Array.isArray(links)) {
            links.forEach((link: any) => {
              const url = link?.url || link?.href || link?.link;
              if (url) urls.push(url);
            });
          }

          if (Array.isArray(contentCitations)) {
            contentCitations.forEach((entry: any) => {
              if (Array.isArray(entry?.urls)) {
                entry.urls.forEach((url: any) => {
                  if (typeof url === 'string') {
                    urls.push(url);
                  }
                });
              }
              const directUrl = entry?.url || entry?.href || entry?.link;
              if (directUrl) {
                urls.push(directUrl);
              }
            });
          }

          if (Array.isArray(topSources)) {
            topSources.forEach((src: any) => {
              if (src?.url) urls.push(src.url);
            });
          }

          if (Array.isArray(topImages)) {
            topImages.forEach((img: any) => {
              if (img?.url) urls.push(img.url);
            });
          }
        };

        collectFromContent(result.content);
      }
      return Array.from(new Set(urls));
    } catch (error) {
      console.error('Error extracting URLs:', error);
      return [];
    }
  }

  private extractModelFromOxylabsResponse(data: any): string | null {
    try {
      const result = data?.results?.[0];
      const model = result?.content?.llm_model || result?.content?.model || null;
      return model || null;
    } catch {
      return null;
    }
  }

  private getCollectorTypeName(source: string): string {
    const typeMap: { [key: string]: string } = {
      'chatgpt': 'ChatGPT Collector',
      'google': 'Google AIO Collector', 
      'google_aio': 'Google AIO Collector',
      'google_ai_mode': 'Google AIO Collector',
      'perplexity': 'Perplexity Collector'
    };
    return typeMap[source] || `${source} Collector`;
  }

  private formatAnswerResults(results: any[]): string {
    const lines: string[] = [];
    results.forEach((entry) => {
      if (typeof entry === 'string') {
        lines.push(entry);
      } else if (entry?.list && Array.isArray(entry.list)) {
        lines.push(this.flattenList(entry.list));
      } else if (entry?.table && Array.isArray(entry.table)) {
        lines.push(this.formatTable(entry.table));
      }
    });
    return lines.filter(Boolean).join('\n\n');
  }

  private flattenList(items: any[], indent = 0): string {
    const bullet = indent === 0 ? '-' : '  '.repeat(indent) + '-';
    const lines: string[] = [];
    items.forEach((item) => {
      if (Array.isArray(item)) {
        lines.push(this.flattenList(item, indent));
      } else if (typeof item === 'string') {
        lines.push(`${bullet} ${item}`);
      }
    });
    return lines.filter(Boolean).join('\n');
  }

  private formatTable(table: any[]): string {
    if (!table || table.length < 2) {
      return '';
    }
    const columns = table[0]?.table_columns?.map((col: any) => Array.isArray(col) ? col.join(' ') : col) || [];
    const header = `| ${columns.join(' | ')} |`;
    const separator = `| ${columns.map(() => '---').join(' | ')} |`;
    const rows = table[1]?.table_rows || [];
    const rowLines = rows.map((row: any) => {
      const cells = row.map((cell: any) => Array.isArray(cell) ? cell.flat(Infinity).join(' ') : cell);
      return `| ${cells.join(' | ')} |`;
    });
    return [header, separator, ...rowLines].join('\n');
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Test Oxylabs connection with a simple ChatGPT request
      const testRequest = {
        source: 'chatgpt',
        prompt: 'test health check',
        parse: true,
        search: true,
        geo_location: 'United States'
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
        },
        body: JSON.stringify(testRequest)
      });

      return response.ok;
    } catch (error) {
      console.error('Oxylabs health check failed:', error);
      return false;
    }
  }
}

export const oxylabsCollectorService = new OxylabsCollectorService();
