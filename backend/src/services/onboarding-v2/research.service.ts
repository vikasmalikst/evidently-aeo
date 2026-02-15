import { groqCompoundService, GROQ_MODELS } from '../recommendations/groq-compound.service';
import { ONBOARDING_V2_SYSTEM_PROMPT, buildUserPrompt } from './system-prompt';

/**
 * Shape of the LLM's JSON output
 */
interface LLMResearchOutput {
    company_profile: {
        company_name: string;
        website: string;
        industry: string;
        description: string;
    };
    competitors: Array<{
        rank: number;
        company_name: string;
        domain: string;
    }>;
    queries: Array<{
        id: number;
        prompt: string;
        category: string;
        query_tag: 'branded' | 'neutral';
    }>;
}

/**
 * Mapped output aligned with BrandOnboardingData on the frontend
 */
export interface OnboardingV2Result {
    brand_name: string;
    website_url: string;
    industry: string;
    description: string;
    competitors: Array<{
        name: string;
        domain: string;
        rank: number;
    }>;
    queries: Array<{
        id: number;
        prompt: string;
        category: string;
        query_tag: 'branded' | 'neutral';
    }>;
    metadata: {
        model: string;
        research_date: string;
        tools_executed: number;
        country: string;
    };
}

/**
 * Onboarding V2 Research Service
 * 
 * Orchestrates the LLM + web search pipeline to auto-generate
 * brand info, competitors, and queries for a new brand onboarding.
 */
export class OnboardingV2ResearchService {

    /**
     * Run the full research pipeline.
     * 
     * @param input.brandName - The company/brand name
     * @param input.country - Target country/market
     * @param input.websiteUrl - Company website URL
     * @param input.maxCompetitors - Max competitors to research (default: 5)
     * @param input.maxQueries - Total queries to generate (default: 20, must be even)
     */
    async research(input: {
        brandName: string;
        country: string;
        websiteUrl: string;
        maxCompetitors?: number;
        maxQueries?: number;
    }): Promise<OnboardingV2Result> {
        const maxCompetitors = input.maxCompetitors ?? 10;
        let maxQueries = input.maxQueries ?? 20;

        // Ensure even number for 50/50 split
        if (maxQueries % 2 !== 0) {
            maxQueries += 1;
        }

        console.log(`🚀 [OnboardingV2] Starting research for "${input.brandName}" (${input.country})`);
        console.log(`   Competitors: ${maxCompetitors}, Queries: ${maxQueries}`);

        const userPrompt = buildUserPrompt({
            brandName: input.brandName,
            websiteUrl: input.websiteUrl,
            country: input.country,
            maxCompetitors,
            maxQueries,
        });

        const startTime = Date.now();

        const response = await groqCompoundService.generateContent({
            systemPrompt: ONBOARDING_V2_SYSTEM_PROMPT,
            userPrompt,
            model: GROQ_MODELS.LLAMA_70B,  // Switched from GPT_OSS_20B - more reliable with tools
            temperature: 0.4,
            maxTokens: 8192,
            jsonMode: false,        // Can't combine with tool calling on Groq
            enableWebSearch: true,  // Enable MCP search tool loop
        });

        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [OnboardingV2] LLM response received in ${durationSec}s (tools: ${response.executedTools?.length ?? 0})`);

        // Parse JSON from LLM output
        const parsed = this.extractJSON(response.content);

        // Map to our output format
        const result: OnboardingV2Result = {
            brand_name: parsed.company_profile.company_name || input.brandName,
            website_url: parsed.company_profile.website || input.websiteUrl,
            industry: parsed.company_profile.industry || '',
            description: parsed.company_profile.description || '',
            competitors: (parsed.competitors || []).slice(0, maxCompetitors).map((c) => ({
                name: c.company_name,
                domain: c.domain,
                rank: c.rank,
            })),
            queries: (parsed.queries || []).slice(0, maxQueries).map((q, idx) => ({
                id: q.id || idx + 1,
                prompt: q.prompt,
                category: q.category,
                query_tag: q.query_tag,
            })),
            metadata: {
                model: response.model,
                research_date: new Date().toISOString().split('T')[0],
                tools_executed: response.executedTools?.length ?? 0,
                country: input.country,
            },
        };

        console.log(`📊 [OnboardingV2] Result: ${result.competitors.length} competitors, ${result.queries.length} queries`);

        return result;
    }

    /**
     * Extract JSON from LLM output, handling markdown fences and preamble text.
     */
    /**
     * Extract JSON from LLM output, handling markdown fences, preamble text, and potential malformed syntax.
     */
    private extractJSON(content: string): LLMResearchOutput {
        let jsonStr = content.trim();

        // 1. Try to find JSON in markdown code fences
        const fencedMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fencedMatch) {
            jsonStr = fencedMatch[1].trim();
        }

        // 2. Initial attempt: Parse as-is (common case)
        try {
            return this.normalizeOutput(JSON.parse(jsonStr));
        } catch (e) {
            // parsing failed, fall through to repair strategies
        }

        // 3. Strategy: Find the outermost curly braces
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const candidate = jsonStr.substring(firstBrace, lastBrace + 1);
            try {
                return this.normalizeOutput(JSON.parse(candidate));
            } catch (e) {
                // still failed
            }
        }

        // 4. Strategy: Robust "brace balancer" to find the largest valid JSON object
        // This helps if there is trailing text or if the previous regex missed something
        let bestAttempt: any = null;
        try {
            // Simple repair for common issues
            // Remove trailing commas
            const cleaned = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            return this.normalizeOutput(JSON.parse(cleaned));
        } catch (e) {
            // failed
        }

        console.error('❌ [OnboardingV2] Failed to parse LLM JSON output.');
        console.error('❌ [OnboardingV2] Raw content (first 500 chars):', content.substring(0, 500));

        throw new Error('Failed to parse research results from LLM. Please try again.');
    }

    /**
     * Normalize the LLM output to handle key variations (e.g. camelCase vs snake_case).
     */
    private normalizeOutput(raw: any): LLMResearchOutput {
        // Handle key variations from the LLM
        const profile = raw.company_profile || raw.companyprofile || raw.companyProfile || {};
        const competitors = raw.competitors || [];

        // Queries might be in biased/blind prompt sections or a flat array
        let queries: any[] = raw.queries || [];

        // If the LLM used the original prompt format with biasedprompts/blindprompts
        if (queries.length === 0) {
            const biased = raw.biasedprompts || raw.biased_prompts || {};
            const blind = raw.blindprompts || raw.blind_prompts || raw.neutralprompts || raw.neutral_prompts || {};

            // Collect from subcategories
            const collectPrompts = (section: any, tag: 'branded' | 'neutral'): any[] => {
                if (!section || typeof section !== 'object') return [];
                const collected: any[] = [];
                for (const [key, value] of Object.entries(section)) {
                    if (key === 'totalcount' || key === 'total_count') continue;
                    if (Array.isArray(value)) {
                        collected.push(...value.map((q: any) => ({ ...q, query_tag: tag })));
                    }
                }
                return collected;
            };

            queries = [
                ...collectPrompts(biased, 'branded'),
                ...collectPrompts(blind, 'neutral'),
            ];
        }

        return {
            company_profile: {
                company_name: profile.company_name || profile.companyname || profile.name || '',
                website: profile.website || profile.url || '',
                industry: profile.industry || '',
                description: profile.description || '',
            },
            competitors: competitors.map((c: any) => ({
                rank: c.rank || 0,
                company_name: c.company_name || c.companyname || c.name || '',
                domain: c.domain || c.url || c.website || '',
            })),
            queries: queries.map((q: any, idx: number) => ({
                id: q.id || idx + 1,
                prompt: q.prompt || q.text || q.query || '',
                category: q.category || q.intent || '',
                query_tag: q.query_tag || q.tag || (q.category?.toLowerCase().includes('brand') ? 'branded' : 'neutral'),
            })),
        };
    }
}

export const onboardingV2ResearchService = new OnboardingV2ResearchService();
