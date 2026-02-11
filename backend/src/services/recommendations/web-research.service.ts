/**
 * Web Research Service
 * 
 * Handles execution of web search queries to ground content generation in real-time facts.
 * Uses Brave Search API.
 */

import { getBraveApiKey } from '../../utils/api-key-resolver';

export interface ResearchResult {
    query: string;
    answer: string;       // Summarized answer or snippet
    citations: { url: string; title: string; snippet?: string }[];
}

export class WebResearchService {
    private braveKey: string | null;

    constructor() {
        this.braveKey = getBraveApiKey();
    }

    /**
     * Execute research queries in parallel using Brave Search
     */
    async executeResearch(queries: string[]): Promise<ResearchResult[]> {
        if (!queries || queries.length === 0) return [];

        if (!this.braveKey) {
            console.warn('⚠️ [WebResearchService] BRAVE_API_KEY not found in environment. Skipping research.');
            return [];
        }

        console.log(`🔎 [WebResearchService] Executing ${queries.length} research queries via Brave...`);
        return this.executeBraveResearch(queries);
    }

    /**
     * Execute queries against Brave Search API
     */
    private async executeBraveResearch(queries: string[]): Promise<ResearchResult[]> {
        try {
            const promises = queries.map(async (query) => {
                try {
                    // Using Brave Search API (Web Search)
                    // We request up to 5 results per query
                    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
                        headers: {
                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip',
                            'X-Subscription-Token': this.braveKey!
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Brave API error: ${response.status}`);
                    }

                    const data: any = await response.json();

                    // Brave Search Response Structure
                    const results = data.web?.results || [];
                    const citations = results.map((r: any) => ({
                        title: r.title,
                        url: r.url,
                        snippet: r.description
                    }));

                    // Construct an "answer" from the description of top results
                    // In a more advanced version, we could use the "summarizer" endpoint if available
                    const answer = citations.slice(0, 3).map((c: any) => c.snippet).join('\n\n');

                    return {
                        query,
                        answer,
                        citations
                    };

                } catch (e: any) {
                    console.error(`❌ [WebResearchService] Query failed "${query}":`, e.message);
                    return null;
                }
            });

            const results = await Promise.all(promises);
            return results.filter((r): r is ResearchResult => r !== null);

        } catch (error) {
            console.error('❌ [WebResearchService] Brave research failed:', error);
            return [];
        }
    }

    /**
     * Format results into a context block for the LLM
     */
    buildResearchContext(results: ResearchResult[]): string {
        if (!results || results.length === 0) return '';

        let context = '## VERIFIED RESEARCH DATA (Use these facts to ground your content)\n\n';

        results.forEach((result, index) => {
            context += `### Query ${index + 1}: "${result.query}"\n`;
            context += `${result.answer}\n`;
            if (result.citations && result.citations.length > 0) {
                context += `**Sources:**\n`;
                result.citations.slice(0, 3).forEach(c => {
                    context += `- [${c.title}](${c.url})\n`;
                });
            }
            context += `\n---\n`;
        });

        context += `
## RESEARCH COMPLIANCE RULES:
1. Prioritize facts and statistics from the "VERIFIED RESEARCH DATA" above.
2. If the research contradicts your internal knowledge, defer to the research (it is more current).
3. You may cite these sources inline using standard markdown links [Source Title](URL).
`;

        return context;
    }
}

export const webResearchService = new WebResearchService();
