import axios from 'axios';
import type { WikipediaSummary } from '../types';

/**
 * Service for fetching Wikipedia summaries
 */
export class WikipediaService {
  async fetchSummary(companyName: string): Promise<WikipediaSummary | null> {
    const candidates = [
      companyName,
      `${companyName} (company)`,
      `${companyName} Inc.`,
      `${companyName} company`,
    ];

    for (const candidate of candidates) {
      try {
        const encoded = encodeURIComponent(candidate);
        const response = await axios.get<any>(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
          { timeout: 5000 }
        );

        if (!response.data) {
          continue;
        }

        if (response.data.type === 'disambiguation') {
          continue;
        }

        return {
          extract: response.data.extract ?? '',
          description: response.data.description ?? '',
          url:
            response.data?.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encoded}`,
        };
      } catch (error) {
        // 404 or other issues, try next candidate
      }
    }

    return null;
  }
}

export const wikipediaService = new WikipediaService();

