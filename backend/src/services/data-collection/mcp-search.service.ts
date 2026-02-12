import axios from 'axios';
import * as cheerio from 'cheerio';

export interface SearchResult {
    title: string;
    url: string;
    content: string;
    engine?: string;
}

export interface SearchResponse {
    query: string;
    results: SearchResult[];
    suggestions: string[];
}

export class McpSearchService {
    private readonly baseUrl: string;
    private readonly timeout: number;

    constructor() {
        // Default to localhost:8082 if not set (Tunnel or VPS local)
        this.baseUrl = process.env.MCP_SEARCH_URL || 'http://localhost:8082';
        this.timeout = parseInt(process.env.MCP_SEARCH_TIMEOUT || '5000', 10);
    }

    /**
     * Quick Search: Returns snippets from SearXNG (Speed Mode)
     * Latency: ~1-2s
     */
    async quickSearch(query: string, maxResults: number = 5): Promise<SearchResponse> {
        try {
            // SearXNG JSON API
            const response = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    q: query,
                    format: 'json',
                    language: 'en',
                    pageno: 1
                },
                timeout: this.timeout
            });

            if (!response.data.results) {
                console.warn('[McpSearchService] No results structure in response');
                return { query, results: [], suggestions: [] };
            }

            return {
                query,
                results: response.data.results.slice(0, maxResults).map((r: any) => ({
                    title: r.title,
                    url: r.url,
                    content: r.content || r.snippet || '',
                    engine: r.engine
                })),
                suggestions: response.data.suggestions || []
            };
        } catch (error: any) {
            console.error(`[McpSearchService] Quick search failed: ${error.message}`);
            // Fallback: Return empty rather than crashing only specific service
            return { query, results: [], suggestions: [] };
        }
    }

    /**
     * Deep Research: Fetches full page content (Extraction Mode)
     * Uses simple Axios+Cheerio as a lightweight fallback since Firecrawl is not yet deployed.
     * Latency: ~2-5s
     */
    async deepResearch(urlOrQuery: string): Promise<string> {
        try {
            let targetUrl = urlOrQuery;

            // If it looks like a query (no http), search first
            if (!urlOrQuery.startsWith('http')) {
                const search = await this.quickSearch(urlOrQuery, 1);
                if (search.results.length > 0) {
                    targetUrl = search.results[0].url;
                } else {
                    throw new Error('No search results found to scrape');
                }
            }

            console.log(`[McpSearchService] Scraping: ${targetUrl}`);
            // Simple HTML fetch
            const response = await axios.get(targetUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            // Parse HTML to Text
            const $ = cheerio.load(response.data);

            // Remove noise
            $('script, style, nav, footer, iframe, svg, path').remove();

            // Extract main text
            const title = $('title').text().trim();
            const body = $('body').text().replace(/\s+/g, ' ').trim();

            return `# ${title}\n\nSource: ${targetUrl}\n\n${body.substring(0, 5000)}...`; // Cap length
        } catch (error: any) {
            console.warn(`[McpSearchService] Deep research failed for ${urlOrQuery}: ${error.message}`);
            return `Failed to scrape ${urlOrQuery}. Error: ${error.message}`;
        }
    }

    /**
     * Format search results into a context string for LLM injection
     */
    formatContext(searchResponse: SearchResponse): string {
        if (!searchResponse.results.length) return '';

        const contextParts = searchResponse.results.map((result, idx) =>
            `[${idx + 1}] **${result.title}**\n   URL: ${result.url}\n   Snippet: ${result.content}`
        );

        return `### Web Search Context (${searchResponse.query})\n${contextParts.join('\n\n')}`;
    }
}

export const mcpSearchService = new McpSearchService();
