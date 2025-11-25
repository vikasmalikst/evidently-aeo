/**
 * SerpApi Collector Service
 * SerpApi provides SERP APIs for various search engines including Bing Copilot
 * Documentation: https://serpapi.com/
 */

import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

// Load environment variables
loadEnvironment();

export interface SerpApiRequest {
  prompt: string;
  brand?: string;
  locale?: string;
  country?: string;
}

export interface SerpApiResponse {
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
    success: boolean;
    brand?: string;
    locale?: string;
    country?: string;
    [key: string]: any;
  };
}

// SerpApi response structure
interface SerpApiJsonResponse {
  header?: string;
  header_video?: {
    title?: string;
    link?: string;
    duration?: string;
    thumbnail?: string;
    source?: string;
    channel?: string;
    views?: string;
    published?: string;
  };
  images_link?: string;
  videos_link?: string;
  text_blocks?: Array<{
    type: 'paragraph' | 'heading' | 'list' | 'code_block' | 'table';
    snippet?: string;
    snippet_links?: Array<{
      text: string;
      link: string;
    }>;
    snippet_highlighted_words?: string[];
    reference_indexes?: number[];
    level?: number;
    list?: Array<{
      snippet?: string;
      snippet_links?: Array<{
        text: string;
        link: string;
      }>;
      snippet_highlighted_words?: string[];
      reference_indexes?: number[];
    }>;
    code?: string;
    language?: string;
    headers?: string[];
    table?: string[][];
    formatted?: Array<{
      [key: string]: any;
    }>;
  }>;
  references?: Array<{
    index: number;
    title?: string;
    link: string;
    snippet?: string;
    source?: string;
  }>;
  error?: string;
}

export class SerpApiCollectorService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = getEnvVar('SERPAPI_API_KEY', '');
    this.baseUrl = 'https://serpapi.com/search.json';
    
    if (!this.apiKey) {
      console.warn('⚠️ SerpApi API key not configured');
    } else {
      console.log('✅ SerpApi Collector Service initialized');
    }
  }

  /**
   * Execute Bing Copilot query via SerpApi
   */
  async executeBingCopilotQuery(request: SerpApiRequest): Promise<SerpApiResponse> {
    if (!this.apiKey) {
      throw new Error('SerpApi API key not configured');
    }

    try {
      console.log(`🚀 Executing Bing Copilot query via SerpApi`);
      
      // Build query parameters
      const params = new URLSearchParams({
        engine: 'bing_copilot',
        q: request.prompt,
        api_key: this.apiKey
      });

      // Add optional parameters
      if (request.country) {
        params.append('location', request.country);
      }
      if (request.locale) {
        params.append('hl', request.locale);
      }

      const url = `${this.baseUrl}?${params.toString()}`;
      
      console.log(`📡 SerpApi Request URL: ${url.replace(this.apiKey, '***')}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 SerpApi response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SerpApi Bing Copilot API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const jsonResponse: SerpApiJsonResponse = await response.json();

      // Check for API errors in response
      if (jsonResponse.error) {
        throw new Error(`SerpApi error: ${jsonResponse.error}`);
      }

      // Log response structure for debugging
      console.log(`📦 SerpApi Response Structure:`, {
        has_header: !!jsonResponse.header,
        text_blocks_count: jsonResponse.text_blocks?.length || 0,
        references_count: jsonResponse.references?.length || 0,
        has_video: !!jsonResponse.header_video
      });

      // Extract answer text from text_blocks
      const answer = this.extractAnswerFromTextBlocks(jsonResponse.text_blocks || []);

      // Extract citations/URLs from references
      const citations = this.extractCitations(jsonResponse.references || [], jsonResponse.text_blocks || []);

      console.log(`✅ SerpApi Bing Copilot response extracted - Answer length: ${answer.length}, Citations: ${citations.length}`);
      if (citations.length > 0) {
        console.log(`📎 Sample citations:`, citations.slice(0, 3));
      }

      return {
        query_id: `serpapi_bing_copilot_${Date.now()}`,
        run_start: new Date().toISOString(),
        run_end: new Date().toISOString(),
        prompt: request.prompt,
        answer: answer,
        response: answer,
        citations: citations,
        urls: citations,
        model_used: 'bing_copilot',
        collector_type: 'bing_copilot',
        metadata: {
          provider: 'serpapi_bing_copilot',
          success: true,
          brand: request.brand,
          locale: request.locale,
          country: request.country,
          header: jsonResponse.header,
          has_video: !!jsonResponse.header_video,
          text_blocks_count: jsonResponse.text_blocks?.length || 0,
          references_count: jsonResponse.references?.length || 0
        }
      };

    } catch (error: any) {
      console.error('❌ SerpApi Bing Copilot error:', error.message);
      throw error;
    }
  }

  /**
   * Extract answer text from text_blocks array
   * Parses different block types: paragraph, heading, list, code_block, table
   */
  private extractAnswerFromTextBlocks(textBlocks: SerpApiJsonResponse['text_blocks']): string {
    if (!textBlocks || textBlocks.length === 0) {
      console.log('⚠️ No text_blocks found in SerpApi response');
      return 'No response available';
    }

    const answerParts: string[] = [];
    const blockTypeCounts: { [key: string]: number } = {};

    for (const block of textBlocks) {
      // Track block types for logging
      blockTypeCounts[block.type] = (blockTypeCounts[block.type] || 0) + 1;

      switch (block.type) {
        case 'paragraph':
          if (block.snippet) {
            answerParts.push(block.snippet);
          }
          break;

        case 'heading':
          if (block.snippet) {
            // Add heading with appropriate formatting
            const level = block.level || 1;
            const prefix = '#'.repeat(level) + ' ';
            answerParts.push(prefix + block.snippet);
          }
          break;

        case 'list':
          if (block.list && Array.isArray(block.list)) {
            block.list.forEach((item, index) => {
              if (item.snippet) {
                answerParts.push(`${index + 1}. ${item.snippet}`);
              }
            });
          }
          break;

        case 'code_block':
          if (block.code) {
            answerParts.push(`\n\`\`\`${block.language || ''}\n${block.code}\n\`\`\`\n`);
          }
          break;

        case 'table':
          // For tables, we can format them as markdown or plain text
          if (block.headers && block.table) {
            answerParts.push('\n' + block.headers.join(' | ') + '\n');
            answerParts.push(block.headers.map(() => '---').join(' | ') + '\n');
            block.table.forEach(row => {
              answerParts.push(row.join(' | ') + '\n');
            });
          }
          break;
      }
    }

    const result = answerParts.join('\n\n').trim() || 'No response available';
    console.log(`📝 Extracted answer from ${textBlocks.length} text blocks:`, blockTypeCounts);
    return result;
  }

  /**
   * Extract citations/URLs from references and text_blocks
   * Sources:
   * 1. references array - primary citation source
   * 2. snippet_links in text_blocks - embedded links in content
   */
  private extractCitations(
    references: SerpApiJsonResponse['references'],
    textBlocks: SerpApiJsonResponse['text_blocks']
  ): string[] {
    const urls = new Set<string>();

    // Extract URLs from references array (primary source)
    if (references && Array.isArray(references)) {
      references.forEach(ref => {
        if (ref.link && (ref.link.startsWith('http://') || ref.link.startsWith('https://'))) {
          urls.add(ref.link);
        }
      });
      console.log(`🔗 Extracted ${urls.size} URLs from references array`);
    }

    // Extract URLs from snippet_links in text_blocks (secondary source)
    let snippetLinksCount = 0;
    if (textBlocks && Array.isArray(textBlocks)) {
      textBlocks.forEach(block => {
        // Check snippet_links in main block
        if (block.snippet_links && Array.isArray(block.snippet_links)) {
          block.snippet_links.forEach(link => {
            if (link.link && (link.link.startsWith('http://') || link.link.startsWith('https://'))) {
              urls.add(link.link);
              snippetLinksCount++;
            }
          });
        }

        // Check snippet_links in list items
        if (block.type === 'list' && block.list && Array.isArray(block.list)) {
          block.list.forEach(item => {
            if (item.snippet_links && Array.isArray(item.snippet_links)) {
              item.snippet_links.forEach(link => {
                if (link.link && (link.link.startsWith('http://') || link.link.startsWith('https://'))) {
                  urls.add(link.link);
                  snippetLinksCount++;
                }
              });
            }
          });
        }
      });
    }

    if (snippetLinksCount > 0) {
      console.log(`🔗 Extracted ${snippetLinksCount} additional URLs from snippet_links`);
    }

    const finalUrls = Array.from(urls);
    console.log(`📎 Total unique citations extracted: ${finalUrls.length}`);
    return finalUrls;
  }
}

// Export singleton instance
export const serpApiCollectorService = new SerpApiCollectorService();

