import { openRouterCollectorService } from '../../data-collection/openrouter-collector.service';
import { ARTICLE_AEO_SCORING_PROMPT } from './article-scoring-prompt';

export interface LLMAnalysisResult {
    final_score: number;
    category: string;
    signal_breakdown: Record<string, string>;
    key_strengths: string[];
    key_weaknesses: string[];
    recommendations: string[];
}

export class LlmAeoScoringService {

    /**
     * Score article content using LLM (GPT-OSS-20B via OpenRouter)
     * Returns a qualitative analysis with -5 to +5 score and detailed breakdown.
     */
    async scoreArticleWithLLM(content: string): Promise<LLMAnalysisResult> {
        console.log('🤖 [LlmAeoScoring] Starting deep analysis for article...');

        try {
            // Construct full prompt
            const prompt = `${ARTICLE_AEO_SCORING_PROMPT}\n\nARTICLE CONTENT:\n${content}`;

            // Execute query using OpenRouter Service directly
            // Using gpt-oss-20b as requested
            const response = await openRouterCollectorService.executeQuery({
                prompt,
                model: 'openai/gpt-oss-20b',
                maxTokens: 6000,
                temperature: 0.1, // Low temp for consistent scoring
                systemPrompt: 'You are an strict AEO scoring engine. Output JSON only.',
                collectorType: 'content' // Required by OpenRouter service
            });

            const resultText = response.response;

            // Clean and Parse JSON
            const json = this.parseJSON(resultText);

            return json;

        } catch (error: any) {
            console.error('❌ [LlmAeoScoring] Error during LLM analysis:', error);
            throw new Error(`LLM Scoring Failed: ${error.message}`);
        }
    }

    /**
     * Robust JSON Parsing
     */
    private parseJSON(text: string): LLMAnalysisResult {
        let cleanText = text.trim();
        // Remove markdown
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.slice(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.slice(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.slice(0, -3);
        }

        try {
            return JSON.parse(cleanText) as LLMAnalysisResult;
        } catch (e) {
            console.error('❌ [LlmAeoScoring] Failed to parse JSON response:', text);
            // Return a safe fallback error object (or throw)
            throw new Error('Invalid JSON response from LLM');
        }
    }
}

export const llmAeoScoringService = new LlmAeoScoringService();
