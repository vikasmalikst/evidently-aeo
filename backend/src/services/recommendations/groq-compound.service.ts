import Groq from 'groq-sdk';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { mcpSearchService } from '../data-collection/mcp-search.service';

loadEnvironment();

// Standard Groq models
export const GROQ_MODELS = {
    COMPOUND: 'groq/compound',
    COMPOUND_MINI: 'groq/compound-mini',
    LLAMA_70B: 'llama-3.3-70b-versatile',
    GPT_OSS_20B: 'openai/gpt-oss-20b'
};

export interface GroqGenerationRequest {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    enableWebSearch?: boolean; // If true, enables our custom MCP tool-calling loop
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
                defaultHeaders: {
                    'Groq-Model-Version': 'latest'
                }
            });
        } else {
            console.warn('⚠️ [GroqCompoundService] GROQ_API_KEY not found. Service disabled.');
        }
    }

    async generateContent(request: GroqGenerationRequest): Promise<GroqGenerationResponse> {
        if (!this.groq) {
            throw new Error('Groq API key not configured');
        }

        const {
            systemPrompt,
            userPrompt,
            model = GROQ_MODELS.LLAMA_70B,
            temperature = 0.5,
            maxTokens = 4096,
            jsonMode = false,
            enableWebSearch = false
        } = request;

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        // Define our custom MCP search tool for the LLM
        // Simplified schema (no maxResults) to reduce parsing errors on Llama/Groq
        const tools: any[] = enableWebSearch ? [
            {
                type: 'function',
                function: {
                    name: 'web_search',
                    description: 'Search the web for real-time information, facts, or data gaps. Returns a list of relevant snippets.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'The search query' },
                        },
                        required: ['query']
                    }
                }
            }
        ] : [];

        console.log(`🚀 [GroqCompoundService] Generating with ${model} (Active Grounding: ${enableWebSearch}, JSON: ${jsonMode})`);

        let iterations = 0;
        const maxIterations = 5;
        const allExecutedTools: any[] = [];

        while (iterations < maxIterations) {
            iterations++;

            const completionParams: any = {
                messages,
                model,
                temperature,
                max_tokens: maxTokens,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
            };

            // Llama on Groq usually doesn't like both tools and response_format: json_object at the same time
            if (jsonMode && !enableWebSearch) {
                completionParams.response_format = { type: 'json_object' };
            }

            try {
                const completion = await this.groq.chat.completions.create(completionParams);
                const message = completion.choices[0].message;

                // Handle Tool Calls
                if (message.tool_calls && message.tool_calls.length > 0) {
                    console.log(`🔎 [GroqCompoundService] LLM requested ${message.tool_calls.length} tool(s) (Iteration: ${iterations})`);

                    messages.push(message);

                    for (const toolCall of message.tool_calls) {
                        const functionName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        let result: any = 'Tool not found';

                        if (functionName === 'web_search') {
                            console.log(`🌐 [GroqCompoundService] Executing MCP Search: "${args.query}"`);
                            const searchRes = await mcpSearchService.quickSearch(args.query, 3);
                            result = mcpSearchService.formatContext(searchRes);
                            allExecutedTools.push({ tool: 'web_search', query: args.query });
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: result
                        });
                    }
                    continue;
                }

                // If no more tools, or first response had no tools
                if (!message.content && iterations === 1) {
                    throw new Error('Groq returned empty content without a tool call');
                }

                return {
                    content: message.content || '',
                    model: model,
                    usage: completion.usage,
                    executedTools: allExecutedTools
                };
            } catch (err: any) {
                if (err.message && err.message.includes('tool_use_failed')) {
                    console.error('⚠️ [GroqCompoundService] Tool use failed error. Attempting fallback fix...');
                    // Sometimes adding a "Please use the tool" user message helps Llama recover
                    messages.push({ role: 'user', content: 'SYSTEM: Your previous tool call failed to parse. Please try again with ONLY the tool call, or provide the answer if you already have it.' });
                    if (iterations >= 3) throw err; // Don't loop forever
                    continue;
                }
                throw err;
            }
        }

        throw new Error('Groq tool-calling loop exceeded max iterations');
    }
}

export const groqCompoundService = new GroqCompoundService();
