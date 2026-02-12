
/**
 * Groq Compound Service
 * 
 * Handles interactions with Groq API for both:
 * 1. Compound Content Generation (with built-in web search)
 * 2. Strategy Generation (Standard Llama 3.3 70B, no search, JSON mode)
 */

import Groq from 'groq-sdk';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';

loadEnvironment();

// Standard Groq models
export const GROQ_MODELS = {
    COMPOUND: 'groq/compound',
    COMPOUND_MINI: 'groq/compound-mini',
    LLAMA_70B: 'llama-3.3-70b-versatile',
    // Strict mode capable models (not used for tools)
    GPT_OSS_20B: 'openai/gpt-oss-20b'
};

export interface GroqGenerationRequest {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean; // Use response_format: { type: 'json_object' }
    enableWebSearch?: boolean; // Use compound tools
}

export interface GroqGenerationResponse {
    content: string;
    model: string;
    usage?: any;
    executedTools?: any[];
}

export class GroqCompoundService {
    private groq: Groq | null = null;
    private apiKey: string | null = null;

    constructor() {
        this.apiKey = getEnvVar('GROQ_API_KEY');
        if (this.apiKey) {
            this.groq = new Groq({
                apiKey: this.apiKey,
                // Recommended header for compound features
                defaultHeaders: {
                    'Groq-Model-Version': 'latest'
                }
            });
        } else {
            console.warn('⚠️ [GroqCompoundService] GROQ_API_KEY not found. Service disabled.');
        }
    }

    /**
     * Generate content using Groq
     * Supports both Compound (Web Search) and Standard (JSON Mode)
     */
    async generateContent(request: GroqGenerationRequest): Promise<GroqGenerationResponse> {
        if (!this.groq) {
            throw new Error('Groq API key not configured');
        }

        const {
            systemPrompt,
            userPrompt,
            model = GROQ_MODELS.LLAMA_70B, // Default to standard model
            temperature = 0.5,
            maxTokens = 4096,
            jsonMode = false,
            enableWebSearch = false
        } = request;

        // Determine effective model
        // If web search is requested, force compound model if not already set
        let effectiveModel = model;
        if (enableWebSearch && !model.includes('compound')) {
            effectiveModel = GROQ_MODELS.COMPOUND;
        }

        console.log(`🚀 [GroqCompoundService] Generating with ${effectiveModel} (Search: ${enableWebSearch}, JSON: ${jsonMode})`);

        try {
            const completionParams: any = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: effectiveModel,
                temperature,
                max_tokens: maxTokens,
            };

            // 1. JSON Mode (Standard models only, usually)
            if (jsonMode) {
                completionParams.response_format = { type: 'json_object' };
            }

            // 2. Web Search (Compound models only)
            if (enableWebSearch) {
                // According to Groq docs, we use 'compound_custom' for configuring tools
                // But the SDK might support standard 'tools' array if mapping exists.
                // For 'groq/compound', it enables tools automatically, but we can explicitly request them
                // to be safe or to restrict them.

                // Docs example: 
                // compound_custom: { tools: { enabled_tools: ["web_search"] } }
                // The SDK might require this as a custom property or via 'tools' depending on version.
                // We'll use the 'extra body' approach for 'compound_custom' to compatibility.
                // Wait, SDK v0.9+ support. We'll try passing it in the options or check type defs.
                // Since we can't check type defs easily, we'll cast to any.

                (completionParams as any).compound_custom = {
                    tools: {
                        enabled_tools: ["web_search"]
                    }
                };
            }

            const completion = await this.groq.chat.completions.create(completionParams);

            const choice = completion.choices[0];
            const content = choice.message?.content || '';
            const usage = completion.usage;
            const executedTools = (choice.message as any).executed_tools || [];

            if (!content && !executedTools.length) {
                throw new Error('Groq returned empty content and no tools executed');
            }

            return {
                content,
                model: effectiveModel,
                usage,
                executedTools
            };

        } catch (error: any) {
            console.error('❌ [GroqCompoundService] Generation failed:', error.message || error);
            throw error;
        }
    }
}

export const groqCompoundService = new GroqCompoundService();
