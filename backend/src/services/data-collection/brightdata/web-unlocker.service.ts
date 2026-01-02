import axios from 'axios';
import { BaseBrightDataService } from './base.service';
import { BrightDataRequest, BrightDataResponse } from './types';
import TurndownService from 'turndown';

export class WebUnlockerService extends BaseBrightDataService {
  private zone: string;
  private turndownService: TurndownService;

  constructor() {
    super();
    this.zone = process.env.BRIGHTDATA_UNLOCKER_ZONE || 'sdk_unlocker';
    this.turndownService = new TurndownService();
    this.turndownService.remove(['script', 'style', 'iframe', 'nav', 'footer', 'header', 'form', 'button', 'svg']);
  }

  async scrapeUrl(url: string, format: 'raw' | 'markdown' = 'markdown'): Promise<string> {
    try {
      console.log(`[WebUnlocker] Scraping URL: ${url} (Zone: ${this.zone})`);

      const useServerMarkdown = format === 'markdown' && !url.includes('youtube.com');
      const unlockerHeaders =
        url.includes('youtube.com')
          ? {
              'x-unblock-expect': JSON.stringify({ element: 'ytd-video-renderer' }),
            }
          : undefined;

      const response = await axios.post(
        `${this.baseUrl}/request`,
        {
          zone: this.zone,
          url,
          format: 'raw',
          method: 'GET',
          data_format: useServerMarkdown ? 'markdown' : undefined,
          headers: unlockerHeaders,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000,
        }
      );

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      const trimmed = responseText.trim();
      if (!trimmed) {
        const headerHint = {
          'x-brd-err-code': response.headers?.['x-brd-err-code'],
          'x-brd-err-msg': response.headers?.['x-brd-err-msg'],
          'proxy-status': response.headers?.['proxy-status'],
          'content-type': response.headers?.['content-type'],
        };
        throw new Error(`Empty response (${response.status}) | ${JSON.stringify(headerHint)}`);
      }

      if (trimmed.startsWith('Request Failed')) {
        const normalized = trimmed.toLowerCase();
        if (normalized.includes('robots.txt') || normalized.includes('immediate access mode')) {
          throw new Error(`${trimmed} | blocked_by=robots_txt`);
        }
        throw new Error(trimmed);
      }

      if (format === 'markdown') {
        if (useServerMarkdown) {
          return responseText;
        }
        const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
        return looksLikeHtml ? this.turndownService.turndown(responseText) : responseText;
      }

      return responseText;
    } catch (error: any) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      const responseHeaders = error.response?.headers;

      console.error(
        `[WebUnlocker] Error scraping ${url}:`,
        responseData || error.message
      );

      const headerHint = responseHeaders
        ? {
            'x-brd-err-code': responseHeaders['x-brd-err-code'],
            'x-brd-err-msg': responseHeaders['x-brd-err-msg'],
            'proxy-status': responseHeaders['proxy-status'],
          }
        : undefined;

      const details = responseData
        ? typeof responseData === 'string'
          ? responseData
          : JSON.stringify(responseData)
        : '';

      throw new Error(
        `Failed to unlock URL: ${url} (${status || 'unknown'}): ${details || error.message}${
          headerHint ? ` | ${JSON.stringify(headerHint)}` : ''
        }`
      );
    }
  }

  async executeQuery(_request: BrightDataRequest): Promise<BrightDataResponse> {
    throw new Error('WebUnlocker does not support generic prompt queries. Use scrapeUrl() instead.');
  }
}

export const webUnlockerService = new WebUnlockerService();
