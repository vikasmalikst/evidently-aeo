import axios from 'axios';

export interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
}

export class BraveSearchService {
  private apiKey = process.env['BRAVE_API_KEY'];
  private apiUrl = 'https://api.search.brave.com/res/v1/web/search';

  /**
   * Performs a web search using Brave Search API
   * Logs execution time and output as requested
   * Includes retry logic for rate limits (429)
   */
  async search(query: string, limit: number = 5, retries = 2): Promise<BraveSearchResult[]> {
    if (!this.apiKey) {
      console.warn('⚠️ BRAVE_API_KEY not configured. Skipping web search.');
      return [];
    }

    const startTime = performance.now();
    console.log(`🔍 [BRAVE-SEARCH] Starting search for: "${query}" (Retries left: ${retries})`);

    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
        params: {
          q: query,
          count: limit,
        },
        timeout: 5000, // 5s timeout to ensure speed
      });

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      const results = response.data?.web?.results || [];
      
      const simplifiedResults: BraveSearchResult[] = results.map((r: any) => ({
        title: r.title,
        description: r.description,
        url: r.url,
      }));

      // Log timing and output as requested
      console.log(`⏱️ [BRAVE-SEARCH] Completed in ${duration}ms`);
      console.log(`📄 [BRAVE-SEARCH] Output (${simplifiedResults.length} results):`);
      console.log(JSON.stringify(simplifiedResults, null, 2));

      return simplifiedResults;
    } catch (error: any) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      // Retry on 429 (Rate Limit)
      if (error.response?.status === 429 && retries > 0) {
        console.warn(`⚠️ [BRAVE-SEARCH] Rate limited (429) after ${duration}ms. Retrying in 1000ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.search(query, limit, retries - 1);
      }

      console.error(`❌ [BRAVE-SEARCH] Failed after ${duration}ms:`, error instanceof Error ? error.message : error);
      return [];
    }
  }
}

export const braveSearchService = new BraveSearchService();
