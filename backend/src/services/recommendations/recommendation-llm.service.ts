
import { getCerebrasKey, getCerebrasModel } from '../../utils/api-key-resolver';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { shouldUseOllama, callOllamaAPI } from '../scoring/ollama-client.service';
import { CerebrasChatResponse } from './recommendation.types';

export class RecommendationLLMService {
    private cerebrasApiKey: string | null;
    private cerebrasModel: string;

    constructor() {
        this.cerebrasApiKey = getCerebrasKey();
        this.cerebrasModel = getCerebrasModel();
    }

    /**
     * Execute LLM Prompt with Fallback Strategy (Ollama -> OpenRouter -> Cerebras)
     * and Parse JSON Response
     */
    /**
     * Execute LLM Prompt with Fallback Strategy and Parse JSON Response
     */
    async executePrompt<T>(
        brandId: string,
        prompt: string,
        systemMessage: string = 'You are a Senior Brand/AEO Expert. Respond only with valid JSON arrays.',
        maxTokens: number = 12000
    ): Promise<T[]> {
        const content = await this.generateContent(brandId, prompt, systemMessage, maxTokens);

        if (!content) {
            console.error('❌ [RecommendationLLMService] Failed to get response from all LLM providers');
            return [];
        }

        return this.parseJSON<T>(content);
    }

    /**
     * Generate raw text content from LLM with fallbacks
     */
    async generateContent(
        brandId: string,
        prompt: string,
        systemMessage: string,
        maxTokens: number
    ): Promise<string | null> {
        let content: string | null = null;
        let providerUsed = 'none';

        // 1. Try Ollama (if enabled)
        const useOllama = await shouldUseOllama(brandId);
        if (useOllama) {
            try {
                console.log('🦙 [RecommendationLLMService] Attempting Ollama API (primary)...');
                const ollamaStartTime = Date.now();
                const ollamaResponse = await callOllamaAPI(systemMessage, prompt, brandId);
                content = ollamaResponse;
                if (content) {
                    providerUsed = 'ollama';
                    console.log(`✅ [RecommendationLLMService] Ollama API succeeded in ${Date.now() - ollamaStartTime}ms`);
                }
            } catch (e: any) {
                console.error('❌ [RecommendationLLMService] Ollama API failed:', e.message || e);
                console.log('🔄 [RecommendationLLMService] Falling back to OpenRouter...');
            }
        }

        // 2. Try OpenRouter (Primary/Fallback)
        if (!content) {
            try {
                console.log('🚀 [RecommendationLLMService] Attempting OpenRouter API...');
                const openRouterStartTime = Date.now();

                // Add timeout wrapper for OpenRouter call
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('OpenRouter request timeout after 180 seconds')), 180000);
                });

                const openRouterPromise = openRouterCollectorService.executeQuery({
                    collectorType: 'content',
                    prompt,
                    maxTokens,
                    temperature: 0.5,
                    topP: 0.9,
                    enableWebSearch: false
                });

                const or = await Promise.race([openRouterPromise, timeoutPromise]) as any;
                content = or.response;

                if (content) {
                    providerUsed = 'openrouter';
                    console.log(`✅ [RecommendationLLMService] OpenRouter API succeeded in ${Date.now() - openRouterStartTime}ms`);
                }
            } catch (e: any) {
                console.error('❌ [RecommendationLLMService] OpenRouter API failed:', e.message || e);
                if (e.message?.includes('timeout')) {
                    console.error('⏱️ [RecommendationLLMService] OpenRouter request timed out, trying Cerebras fallback...');
                }
            }
        }

        // 3. Fallback to Cerebras
        if (!content && this.cerebrasApiKey) {
            try {
                console.log('🔄 [RecommendationLLMService] Trying Cerebras fallback...');
                const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.cerebrasApiKey}`
                    },
                    body: JSON.stringify({
                        model: this.cerebrasModel,
                        messages: [
                            { role: 'system', content: systemMessage },
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: maxTokens,
                        temperature: 0.5
                    })
                });

                if (response.ok) {
                    const data = await response.json() as CerebrasChatResponse;
                    content = data?.choices?.[0]?.message?.content || null;
                    if (content) {
                        providerUsed = 'cerebras';
                        console.log('✅ [RecommendationLLMService] Cerebras fallback succeeded');
                    }
                } else {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    console.error(`❌ [RecommendationLLMService] Cerebras fallback failed: ${response.status} - ${errorText.substring(0, 200)}`);
                }
            } catch (e) {
                console.error('❌ [RecommendationLLMService] Cerebras fallback failed:', e);
            }
        }

        if (content) {
            console.log(`📊 [RecommendationLLMService] Provider used: ${providerUsed}`);
        }

        return content;
    }

    /**
     * Robust JSON Parsing with Error Recovery
     */
    private parseJSON<T>(content: string): T[] {
        console.log('📝 [RecommendationLLMService] Parsing LLM response...');

        let cleaned = content.trim();

        // Remove markdown code blocks
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();

        // Extract JSON array
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        } else {
            // If no array brackets found, try to find where it starts
            const firstBracket = cleaned.indexOf('[');
            const lastBracket = cleaned.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                cleaned = cleaned.substring(firstBracket, lastBracket + 1);
            }
        }

        try {
            return JSON.parse(cleaned);
        } catch (parseError) {
            console.error('❌ [RecommendationLLMService] First pass JSON parse error. Attempting to clean...');

            // Common fix patterns
            cleaned = cleaned
                .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                .replace(/\}\s*\}\s*\]/g, '}]') // Fix double braces
                .replace(/(\})\s*\}(\s*\])/g, '$1$2'); // Fix loose braces

            try {
                return JSON.parse(cleaned);
            } catch (secondError) {
                console.error('❌ [RecommendationLLMService] Second JSON parse failed:', secondError);
                console.error('Cleaned content (tail):', cleaned.substring(Math.max(0, cleaned.length - 200)));

                // Last resort: manual object extraction (regex based)
                // Try to extract objects one by one
                const objects: T[] = [];
                // Match anything between { and } that looks like an object properties
                const objectMatches = cleaned.match(/\{[^{}]*\}/g); // Detailed regex is risky, simple matching relies on non-nested objects

                if (objectMatches && objectMatches.length > 0) {
                    for (const match of objectMatches) {
                        try {
                            objects.push(JSON.parse(match));
                        } catch (e) { /* ignore individual failures */ }
                    }
                    if (objects.length > 0) {
                        console.warn(`⚠️ [RecommendationLLMService] Manually extracted ${objects.length} objects from malformed JSON`);
                        return objects;
                    }
                }

                return [];
            }
        }
    }
}

export const recommendationLLMService = new RecommendationLLMService();
