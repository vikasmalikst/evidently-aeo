/**
 * Opportunity Prompt Service
 * 
 * Constructs complex prompts for the LLM to convert performance opportunities
 * into actionable AEO recommendations.
 */

import { Opportunity } from './opportunity-identifier.service';

export interface OpportunityRecommendationLLMResponse {
    Recommendation: string;
    Channel: string;
    ContentType: 'Short-form Video Script' | 'Social Media Thread' | 'Technical Comparison Table' | 'Interactive Tool/Calculator' | 'Expert Community Response' | 'Data-Driven White Paper' | 'Article' | 'Podcast' | 'Expert Articles';
    ThoughtProcess: string;
    ContentTitle: string;
    Timeline: string;
    Effort: 'Low' | 'Medium' | 'High';
    ExpectedBoost: string;
    Confidence: number;
    Amplification: string;
    queryId: string; // Mapping back to the source query
}

export class OpportunityPromptService {
    /**
     * Construct a batched prompt for converting opportunities into recommendations
     */
    constructBatchPrompt(
        brandName: string,
        opportunities: Opportunity[],
        competitorDomains: string[]
    ): string {
        // Group unique queries
        const queryMap = new Map<string, any>();
        opportunities.forEach(opp => {
            if (!queryMap.has(opp.queryId)) {
                queryMap.set(opp.queryId, {
                    id: opp.queryId,
                    queryText: opp.queryText,
                    topic: opp.topic,
                    metrics: [],
                    competitors: [],
                    sources: opp.topSources.map(s => s.domain)
                });
            }
            const q = queryMap.get(opp.queryId);
            if (!q.metrics.includes(opp.metricName)) {
                q.metrics.push(opp.metricName);
            }
            if (opp.competitor && !q.competitors.includes(opp.competitor)) {
                q.competitors.push(opp.competitor);
            }
        });

        const queryList = Array.from(queryMap.values()).map((q, idx) => {
            return `--- Query ${idx + 1} ---
ID: ${q.id}
Text: "${q.queryText}"
Topic: ${q.topic || 'Not specified'}
KPIs to Improve: ${q.metrics.join(', ')}
Competitors to Target: ${q.competitors.length > 0 ? q.competitors.join(', ') : 'General (Brand Only)'}
Available Channels: ${q.sources.join(', ') || 'No specific sources identified'}`;
        }).join('\n\n');

        const competitorList = competitorDomains.join(', ');

        return `Act like a world's best SEO + AEO (Answer Engine Optimization) Expert working for ${brandName}. Your job is to improve your Brand's presence across in LLMs (Answer Engine Optimization), increase engagement, drive traffic, and improve the overall visibility of ${brandName} in the AI innovation space.

You will review the following opportunities identified for your brand:

${queryList}

Your ultimate goal is to come up with one recommendation for each query to improve the specified KPIs.

RULES:
1. Generate exactly ONE high-impact recommendation per unique query provided.
2. The "Channel" (citationSource domain) MUST NOT be any of the following competitor domains: ${competitorList}.
3. Respect the purpose and suitability of content type for each channel.
4. Content MUST be optimized for LLM scraping and AEO impact.
5. VARY YOUR CONTENT TYPES: Do not use the same content type for every recommendation. Mix Short-forms videos, Comparison tables, and Articles based on the specific query nuance.

CONTENT TYPE OPTIONS:
- Short-form Video Script (Best for rapid answers, visual explanations, and increasing dwell time)
- Social Media Thread (X/Threads)
- Technical Comparison Table (Specialized for AEO comparison queries)

- Expert Community Response (Reddit/Quora/StackOverflow)
- Data-Driven White Paper (In-depth research)
- Article (Standard SEO/AEO long-form content)
- Podcast (Conversational audio)
- Expert Articles (Highly authoritative thought leadership)

For each recommendation, return a JSON object with these EXACT fields:
- Recommendation: (The primary task/action)
- Channel: (The target domain where content will be published)
- ContentType: (One of the options above)
- ThoughtProcess: (Reasoning for this choice)
- ContentTitle: (Optimized headline for LLM scraping)
- Timeline: (Estimated time, e.g., "2-3 Weeks")
- Effort: (Low, Medium, or High)
- ExpectedBoost: (Specific estimate for Visibility, SOA, and Sentiment)
- Confidence: (Integer 0-100 indicating likelihood of success)
- Amplification: (Strategic advice for cross-channel reuse)
- queryId: (The ID provided above in the ID field for the query)

Return the output as a valid JSON array of objects.`;
    }
}

export const opportunityPromptService = new OpportunityPromptService();