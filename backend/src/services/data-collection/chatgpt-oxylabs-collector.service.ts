/**
 * ChatGPT Collector Service via Oxylabs
 * Handles ChatGPT data collection specifically through Oxylabs API
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

// Load environment variables
loadEnvironment();

export interface ChatGPTOxylabsRequest {
  prompt: string;
  brand?: string;
  locale?: string;
  country?: string;
}

export interface ChatGPTOxylabsResponse {
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

export class ChatGPTOxylabsCollectorService {
  private username: string;
  private password: string;
  private baseUrl: string;

  constructor() {
    this.username = getEnvVar('OXYLABS_USERNAME', '');
    this.password = getEnvVar('OXYLABS_PASSWORD', '');
    this.baseUrl = 'https://realtime.oxylabs.io/v1/queries';
    console.log('🔧 ChatGPT Oxylabs Collector Service initialized');
  }

  async executeQuery(request: ChatGPTOxylabsRequest): Promise<ChatGPTOxylabsResponse> {
    const queryId = `chatgpt-oxylabs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();
    
    try {
      // Prepare Oxylabs request body for ChatGPT
      // Following the exact structure from Oxylabs documentation
      const oxylabsBody = {
        source: 'chatgpt',
        prompt: request.prompt,
        parse: true,
        search: true,
        geo_location: request.country || 'United States'
      };

      // Make request to Oxylabs with 90-second timeout for ChatGPT
      console.log('🔍 ChatGPT Oxylabs Request:', {
        url: this.baseUrl,
        body: oxylabsBody,
        hasCredentials: !!(this.username && this.password)
      });

      // Create an AbortController for timeout
      const timeoutDuration = 90000; // 90s for ChatGPT
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
          // Increase connection timeout to 30 seconds
          // @ts-ignore - Node.js fetch doesn't have TypeScript types for connectTimeout
          connectTimeout: 30000
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ ChatGPT Oxylabs API Error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            request: oxylabsBody,
            url: this.baseUrl
          });
          
          // Try to parse error details for better error messages
          let errorMessage = `ChatGPT Oxylabs API error: ${response.status} ${response.statusText}`;
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message || errorJson.error) {
              errorMessage += ` - ${errorJson.message || errorJson.error}`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }
          
          throw new Error(errorMessage);
        }

        // Get response text first to check if it's empty
        const responseText = await response.text();
        
        if (!responseText || responseText.trim().length === 0) {
          console.error('❌ ChatGPT Oxylabs API returned empty response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            request: oxylabsBody
          });
          throw new Error('ChatGPT Oxylabs API returned empty response');
        }

        // Try to parse JSON
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch (parseError: any) {
          console.error('❌ ChatGPT Oxylabs API returned invalid JSON:', {
            status: response.status,
            statusText: response.statusText,
            responseText: responseText.substring(0, 500), // Log first 500 chars
            parseError: parseError.message,
            request: oxylabsBody
          });
          throw new Error(`ChatGPT Oxylabs API returned invalid JSON: ${parseError.message}. Response preview: ${responseText.substring(0, 200)}`);
        }
        const endTime = new Date().toISOString();

        // Extract content from Oxylabs response
        const content = this.extractContentFromOxylabsResponse(data);
        const citations = this.extractCitationsFromOxylabsResponse(data);
        const urls = this.extractUrlsFromOxylabsResponse(data);
        const model = this.extractModelFromOxylabsResponse(data) || 'chatgpt';

        return {
          query_id: queryId,
          run_start: startTime,
          run_end: endTime,
          prompt: request.prompt,
          response: content,
          model_used: model,
          collector_type: 'ChatGPT Collector',
          citations,
          urls,
          metadata: {
            brand: request.brand,
            locale: request.locale,
            country: request.country,
            provider: 'oxylabs',
            source: 'chatgpt'
          }
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error(`❌ ChatGPT Oxylabs request timeout after ${timeoutDuration / 1000} seconds`);
          throw new Error(`ChatGPT Oxylabs request timeout: query took longer than ${timeoutDuration / 1000}s`);
        }
        // Check if it's a JSON parse error that wasn't caught
        if (fetchError.message && fetchError.message.includes('JSON')) {
          console.error('❌ ChatGPT Oxylabs JSON parse error:', {
            error: fetchError.message,
            stack: fetchError.stack,
            request: oxylabsBody
          });
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('❌ ChatGPT Oxylabs execution failed:', error);
      throw new Error(`ChatGPT Oxylabs execution failed: ${error.message}`);
    }
  }

  private extractContentFromOxylabsResponse(data: any): string {
    try {
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.content) {
          // Prefer response_text (main text response) - this is the primary content
          if (typeof result.content === 'object') {
            // Priority 1: response_text (clean text response)
            if (typeof result.content.response_text === 'string' && result.content.response_text.trim()) {
              return result.content.response_text.trim();
            }
            // Priority 2: markdown_text (formatted markdown)
            if (typeof result.content.markdown_text === 'string' && result.content.markdown_text.trim()) {
              return result.content.markdown_text.trim();
            }
            // Priority 3: answer_results_md (if available)
            if (typeof result.content.answer_results_md === 'string' && result.content.answer_results_md.trim()) {
              return result.content.answer_results_md.trim();
            }
            // Priority 4: Try to extract from markdown_json if other fields are not available
            if (Array.isArray(result.content.markdown_json) && result.content.markdown_json.length > 0) {
              return this.extractTextFromMarkdownJson(result.content.markdown_json);
            }
          }
          // Handle different content structures
          if (typeof result.content === 'string') {
            return result.content.trim();
          } else if (Array.isArray(result.content)) {
            return result.content.join('\n').trim();
          } else if (result.content.text) {
            return result.content.text.trim();
          } else if (Array.isArray(result.content.answer_results)) {
            return this.formatAnswerResults(result.content.answer_results);
          }
        }
      }
      return 'No content available from ChatGPT Oxylabs response';
    } catch (error) {
      console.error('Error extracting content from ChatGPT Oxylabs response:', error);
      return 'Error extracting content from response';
    }
  }

  /**
   * Extract text content from markdown_json structure
   */
  private extractTextFromMarkdownJson(markdownJson: any[]): string {
    const textParts: string[] = [];
    
    const extractFromNode = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      
      // Extract raw text
      if (node.raw && typeof node.raw === 'string') {
        textParts.push(node.raw);
      }
      
      // Extract from children
      if (Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          if (child.raw && typeof child.raw === 'string') {
            textParts.push(child.raw);
          } else if (child.children) {
            extractFromNode(child);
          }
        });
      }
      
      // Extract from list items
      if (node.type === 'list' && Array.isArray(node.children)) {
        node.children.forEach((item: any) => {
          if (item.children) {
            item.children.forEach((child: any) => {
              extractFromNode(child);
            });
          }
        });
      }
    };
    
    markdownJson.forEach(node => extractFromNode(node));
    
    return textParts.filter(Boolean).join('\n').trim();
  }

  private extractCitationsFromOxylabsResponse(data: any): string[] {
    try {
      const citations: string[] = [];
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        
        // Check top-level citations/sources
        if (Array.isArray(result.citations)) {
          citations.push(...result.citations);
        }
        if (Array.isArray(result.sources)) {
          citations.push(...result.sources);
        }
        
        // Extract from content object
        if (result.content && typeof result.content === 'object') {
          // Check for direct citations/sources in content
          if (Array.isArray(result.content.citations)) {
            citations.push(...result.content.citations);
          }
          if (Array.isArray(result.content.sources)) {
            citations.push(...result.content.sources);
          }
          if (Array.isArray(result.content.links)) {
            result.content.links.forEach((link: any) => {
              const url = link?.url || link?.href || link?.link;
              if (url && typeof url === 'string') citations.push(url);
            });
          }
          if (Array.isArray(result.content.top_sources)) {
            result.content.top_sources.forEach((src: any) => {
              if (src?.url && typeof src.url === 'string') citations.push(src.url);
            });
          }
          
          // Extract from markdown_json structure - look for annotations with URLs
          if (Array.isArray(result.content.markdown_json)) {
            this.extractUrlsFromMarkdownJson(result.content.markdown_json, citations);
          }
          
          // NEW: Extract URLs from markdown_text (markdown links: [text](url))
          if (typeof result.content.markdown_text === 'string' && result.content.markdown_text.trim()) {
            const markdownUrls = this.extractUrlsFromMarkdownText(result.content.markdown_text);
            citations.push(...markdownUrls);
          }
          
          // NEW: Extract URLs from response_text (plain text URLs)
          if (typeof result.content.response_text === 'string' && result.content.response_text.trim()) {
            const textUrls = this.extractUrlsFromPlainText(result.content.response_text);
            citations.push(...textUrls);
          }
        }
      }
      // Remove duplicates and filter out empty strings
      return Array.from(new Set(citations.filter(url => url && typeof url === 'string' && url.trim().length > 0)));
    } catch (error) {
      console.error('Error extracting citations:', error);
      return [];
    }
  }

  /**
   * Extract URLs from markdown text (e.g., [text](https://example.com))
   */
  private extractUrlsFromMarkdownText(markdownText: string): string[] {
    const urls: string[] = [];
    try {
      // Match markdown links: [text](url) or [text](url "title")
      const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
      let match;
      while ((match = markdownLinkRegex.exec(markdownText)) !== null) {
        const url = match[2].trim();
        // Remove title if present: "url" or 'url'
        const cleanUrl = url.replace(/^["']|["']$/g, '').split(/\s+/)[0];
        if (this.isValidUrl(cleanUrl)) {
          urls.push(cleanUrl);
        }
      }
      
      // Also extract plain URLs that might be in markdown
      const plainUrls = this.extractUrlsFromPlainText(markdownText);
      urls.push(...plainUrls);
    } catch (error) {
      console.error('Error extracting URLs from markdown text:', error);
    }
    return urls;
  }

  /**
   * Extract URLs from plain text using regex
   */
  private extractUrlsFromPlainText(text: string): string[] {
    const urls: string[] = [];
    try {
      // Match http/https URLs
      // This regex matches URLs with optional trailing punctuation (but excludes it)
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?]/gi;
      const matches = text.match(urlRegex);
      
      if (matches) {
        matches.forEach(url => {
          // Clean up trailing punctuation that might have been captured
          const cleanUrl = url.replace(/[.,;:!?]+$/, '');
          if (this.isValidUrl(cleanUrl)) {
            urls.push(cleanUrl);
          }
        });
      }
    } catch (error) {
      console.error('Error extracting URLs from plain text:', error);
    }
    return urls;
  }

  /**
   * Validate if a string is a valid URL
   */
  private isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Recursively extract URLs from markdown_json structure
   */
  private extractUrlsFromMarkdownJson(markdownJson: any[], urls: string[]): void {
    const extractFromNode = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      
      // Check for annotations with URLs
      if (Array.isArray(node.annotations)) {
        node.annotations.forEach((ann: any) => {
          const url = ann?.url || ann?.link || ann?.source || ann?.href;
          if (url && typeof url === 'string') {
            urls.push(url);
          }
        });
      }
      
      // Check sections for annotations
      if (Array.isArray(node.sections)) {
        node.sections.forEach((sec: any) => {
          if (Array.isArray(sec.annotations)) {
            sec.annotations.forEach((ann: any) => {
              const url = ann?.url || ann?.link || ann?.source || ann?.href;
              if (url && typeof url === 'string') {
                urls.push(url);
              }
            });
          }
        });
      }
      
      // Recursively check children
      if (Array.isArray(node.children)) {
        node.children.forEach((child: any) => {
          extractFromNode(child);
        });
      }
    };
    
    markdownJson.forEach(node => extractFromNode(node));
  }

  private extractUrlsFromOxylabsResponse(data: any): string[] {
    try {
      const urls: string[] = [];
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        
        // Check top-level URLs/links
        if (Array.isArray(result.urls)) {
          urls.push(...result.urls);
        }
        if (Array.isArray(result.links)) {
          urls.push(...result.links);
        }
        
        // Extract from content object
        if (result.content && typeof result.content === 'object') {
          // Check for direct URLs/links in content
          if (Array.isArray(result.content.urls)) {
            urls.push(...result.content.urls);
          }
          if (Array.isArray(result.content.links)) {
            result.content.links.forEach((link: any) => {
              const url = link?.url || link?.href || link?.link;
              if (url && typeof url === 'string') urls.push(url);
            });
          }
          if (Array.isArray(result.content.top_sources)) {
            result.content.top_sources.forEach((src: any) => {
              if (src?.url && typeof src.url === 'string') urls.push(src.url);
            });
          }
          if (Array.isArray(result.content.top_images)) {
            result.content.top_images.forEach((img: any) => {
              if (img?.url && typeof img.url === 'string') urls.push(img.url);
            });
          }
          
          // Extract from markdown_json structure
          if (Array.isArray(result.content.markdown_json)) {
            this.extractUrlsFromMarkdownJson(result.content.markdown_json, urls);
          }
          
          // Check citations array for URLs
          if (Array.isArray(result.content.citations)) {
            result.content.citations.forEach((entry: any) => {
              if (Array.isArray(entry?.urls)) {
                entry.urls.forEach((url: any) => {
                  if (url && typeof url === 'string') urls.push(url);
                });
              }
              const directUrl = entry?.url || entry?.href || entry?.link;
              if (directUrl && typeof directUrl === 'string') {
                urls.push(directUrl);
              }
            });
          }
          
          // NEW: Extract URLs from markdown_text (markdown links: [text](url))
          if (typeof result.content.markdown_text === 'string' && result.content.markdown_text.trim()) {
            const markdownUrls = this.extractUrlsFromMarkdownText(result.content.markdown_text);
            urls.push(...markdownUrls);
          }
          
          // NEW: Extract URLs from response_text (plain text URLs)
          if (typeof result.content.response_text === 'string' && result.content.response_text.trim()) {
            const textUrls = this.extractUrlsFromPlainText(result.content.response_text);
            urls.push(...textUrls);
          }
        }
      }
      // Remove duplicates and filter out empty strings
      return Array.from(new Set(urls.filter(url => url && typeof url === 'string' && url.trim().length > 0)));
    } catch (error) {
      console.error('Error extracting URLs:', error);
      return [];
    }
  }

  private extractModelFromOxylabsResponse(data: any): string | null {
    try {
      const result = data?.results?.[0];
      // Extract model from content.llm_model (as per Oxylabs ChatGPT response structure)
      const model = result?.content?.llm_model || result?.content?.model || result?.llm_model || null;
      return model || null;
    } catch {
      return null;
    }
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
      console.error('ChatGPT Oxylabs health check failed:', error);
      return false;
    }
  }
}

export const chatgptOxylabsCollectorService = new ChatGPTOxylabsCollectorService();

