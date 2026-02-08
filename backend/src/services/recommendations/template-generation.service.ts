/**
 * Template Generation Service (Step 1 of 2-Step Workflow)
 * 
 * Generates the "TemplatePlan" JSON which acts as the architectural blueprint
 * for the final content. This step focuses on AEO structure, headings, and rules,
 * WITHOUT generating the actual prose.
 */

import { supabaseAdmin } from '../../config/database';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { RecommendationV3, TemplatePlan, BrandContextV3 } from './recommendation.types';
const pdf = require('pdf-parse');

interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface GenerateTemplateRequest {
    recommendationId: string;
    customerId: string;
    channel?: string; // e.g. 'article_site', 'youtube', 'linkedin'
    customInstructions?: string;
    force?: boolean;
}

export interface GenerateTemplateResponse {
    success: boolean;
    data?: TemplatePlan;
    error?: string;
}

class TemplateGenerationService {

    /**
     * Generates a TemplatePlan for a specific recommendation
     */
    async generateTemplatePlan(request: GenerateTemplateRequest): Promise<GenerateTemplateResponse> {
        const { recommendationId, customerId, channel = 'article_site', customInstructions } = request;

        try {
            // 1. Fetch Context
            const { data: rec, error: recError } = await supabaseAdmin
                .from('recommendations')
                .select('*')
                .eq('id', recommendationId)
                .eq('customer_id', customerId)
                .single();

            if (recError || !rec) {
                return { success: false, error: 'Recommendation not found' };
            }

            // 1b. Check for Existing Plan (unless forced)
            if (!request.force) {
                const { data: existingPlan } = await supabaseAdmin
                    .from('recommendation_generated_contents')
                    .select('content')
                    .eq('recommendation_id', recommendationId)
                    .eq('content_type', 'template_plan')
                    .maybeSingle();

                if (existingPlan && existingPlan.content) {
                    try {
                        const parsed = JSON.parse(existingPlan.content);
                        if (parsed && parsed.structure) {
                            // Ensure recommendationId is set
                            parsed.recommendationId = recommendationId;
                            console.log(`♻️ [TemplateService] Returning Existing Plan for ${rec.id}`);
                            console.log(`📋 [TemplateService] Cached plan has: targetChannel=${parsed.targetChannel}, primary_entity=${parsed.primary_entity}, aeo_extraction_targets=${!!parsed.aeo_extraction_targets}`);
                            return { success: true, data: parsed };
                        }
                    } catch (e) {
                        console.warn('⚠️ [TemplateService] Failed to parse existing plan, regenerating.');
                    }
                }
            }

            const { data: brand } = await supabaseAdmin
                .from('brands')
                .select('*')
                .eq('id', rec.brand_id)
                .single();

            // 2. Select Base Skeleton (Hardcoded for MVP reliability, can be dynamic later)
            const skeleton = this.getBaseSkeleton(channel, rec.action, brand?.name || 'Brand');

            // 3. Build Prompt
            const prompt = this.buildPlannerPrompt(rec, brand, skeleton, channel, customInstructions);

            // 4. Call LLM (GPT-OSS-20B via OpenRouter)
            console.log(`🏗️ [TemplateService] Generating Plan for ${rec.id} (${channel})`);
            const response = await openRouterCollectorService.executeQuery({
                collectorType: 'content',
                prompt: prompt,
                maxTokens: 1500, // Plans are smaller than full content
                temperature: 0.4, // Lower temperature for structural adherence
                model: 'meta-llama/llama-3.3-70b-instruct' // Using a reliable OSS model
            });

            if (!response.response) {
                return { success: false, error: 'LLM returned empty response' };
            }

            // 5. Parse & Validate
            const plan = this.parseAndValidatePlan(response.response);
            if (!plan) {
                return { success: false, error: 'Failed to parse generated plan' };
            }

            // 5b. Ensure recommendationId is set on the plan
            plan.recommendationId = recommendationId;

            console.log(`✨ [TemplateService] Generated NEW plan for ${rec.id}`);
            console.log(`📋 [TemplateService] New plan has: targetChannel=${plan.targetChannel}, primary_entity=${plan.primary_entity}, aeo_extraction_targets=${!!plan.aeo_extraction_targets}`);

            // 6. Save as "Draft" Content (so it persists)
            // We store it as a special content_type 'template_plan' in the same table
            await this.savePlanToDb(recommendationId, customerId, plan);

            return { success: true, data: plan };

        } catch (error: any) {
            console.error('❌ [TemplateService] Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update an existing template plan
     */
    async updateTemplatePlan(
        recommendationId: string,
        customerId: string,
        updatedPlan: TemplatePlan
    ): Promise<ServiceResponse<TemplatePlan>> {
        try {
            // Validate the plan structure
            if (!updatedPlan.structure || !Array.isArray(updatedPlan.structure)) {
                return { success: false, error: 'Invalid plan structure' };
            }

            // Ensure recommendationId is set
            updatedPlan.recommendationId = recommendationId;

            console.log(`💾 [TemplateService] Updating plan for ${recommendationId}`);

            // Save to database
            await this.savePlanToDb(recommendationId, customerId, updatedPlan);

            return { success: true, data: updatedPlan };
        } catch (error: any) {
            console.error('❌ [TemplateService] Error updating plan:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse uploaded context file (PDF/Text)
     */
    async parseContextFile(buffer: Buffer, mimetype: string): Promise<string> {
        try {
            console.log(`📂 [TemplateService] Parsing file with mime: ${mimetype}`);

            if (mimetype === 'application/pdf') {
                // Version 2.4.5+ uses a class-based API
                const pdfModule = await import('pdf-parse');
                const PDFParse = pdfModule.PDFParse;

                if (!PDFParse) {
                    throw new Error('PDFParse class not found in module exports');
                }

                const parser = new PDFParse({ data: buffer });
                const result = await parser.getText();
                return result.text;
            } else if (mimetype === 'text/plain' || mimetype === 'text/markdown' || mimetype === 'application/json') {
                return buffer.toString('utf-8');
            } else {
                // Try as text for other types
                return buffer.toString('utf-8');
            }
        } catch (error: any) {
            console.error('❌ [TemplateService] Error parsing context file:', error);
            throw new Error(`Failed to parse file: ${error.message}`);
        }
    }

    /**
     * Update the additional_context field of an existing plan
     */
    async updatePlanContext(
        recommendationId: string,
        customerId: string,
        contextText: string
    ): Promise<ServiceResponse<TemplatePlan>> {
        try {
            // Fetch existing plan
            const { data: existingPlan } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('content')
                .eq('recommendation_id', recommendationId)
                .eq('content_type', 'template_plan')
                .maybeSingle();

            if (!existingPlan || !existingPlan.content) {
                return { success: false, error: 'No existing plan found for this recommendation' };
            }

            // Parse and update
            let plan: TemplatePlan;
            if (typeof existingPlan.content === 'string') {
                plan = JSON.parse(existingPlan.content);
            } else {
                plan = existingPlan.content;
            }
            plan.additional_context = contextText;
            plan.recommendationId = recommendationId;

            // Save back to DB
            await this.savePlanToDb(recommendationId, customerId, plan);

            console.log(`✅ [TemplateService] Updated context for ${recommendationId} (${contextText.length} chars)`);
            return { success: true, data: plan };
        } catch (error: any) {
            console.error('❌ [TemplateService] Error updating plan context:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Persist the plan to the DB
     */
    private async savePlanToDb(recId: string, customerId: string, plan: TemplatePlan) {
        // Check for existing plan
        const { data: existing } = await supabaseAdmin
            .from('recommendation_generated_contents')
            .select('id')
            .eq('recommendation_id', recId)
            .eq('content_type', 'template_plan')
            .maybeSingle();

        const payload = {
            recommendation_id: recId,
            customer_id: customerId,
            brand_id: plan.recommendationId ? undefined : undefined, // We need brand_id from somewhere if strictly required, but usually Rec has it. 
            // Actually, we should fetch brand_id from rec above or easier: just ensure table constraint allows it.
            // For now, let's trust the service has access to the record if needed, but here we just follow schema.
            content_type: 'template_plan',
            content: JSON.stringify(plan, null, 2),
            status: 'generated',
            model_provider: 'openrouter',
            model_name: 'llama-3.3-70b-instruct',
            metadata: { is_plan: true, version: '1.0' },
            updated_at: new Date().toISOString()
        };

        // We need to fetch the brand_id and generation_id correctly to insert.
        // Re-fetching strictly for the insert payload if needed, or assume update.
        // To be safe, let's do an upsert logic based on what we know.
        // Getting generation_id from the recommendation is vital.

        // Quick fetch to ensure we have all FKs
        const { data: rec } = await supabaseAdmin.from('recommendations').select('brand_id, generation_id').eq('id', recId).single();

        if (rec) {
            const fullPayload = {
                ...payload,
                brand_id: rec.brand_id,
                generation_id: rec.generation_id,
                created_at: existing ? undefined : new Date().toISOString()
            };

            if (existing) {
                await supabaseAdmin.from('recommendation_generated_contents').update(fullPayload).eq('id', existing.id);
            } else {
                await supabaseAdmin.from('recommendation_generated_contents').insert(fullPayload);
            }
        }
    }

    private extractTopicFromAction(action: string): string {
        // Extract the main topic/keyword from the action
        // Example: "[Expert Community Response] Post an Expert Community Response on Reddit..." -> "Space-Saving Kitchen Designs"

        // Try to extract from title/quoted text first
        const titleMatch = action.match(/titled\s+["']([^"']+)["']/i) || action.match(/["']([^"']+)["']/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1].replace(/\s*–.*$/, '').trim(); // Remove subtitle after dash
        }

        // Fallback: remove bracketed prefixes and take first meaningful phrase
        const cleaned = action.replace(/^\[.*?\]\s*/, '').replace(/^(Post|Create|Write|Publish)\s+(an?\s+)?/i, '');
        const firstSentence = cleaned.split(/[.;]|\son\s/i)[0].trim();
        return firstSentence.substring(0, 80); // Limit length
    }

    private getBaseSkeleton(channel: string, action: string, brandName: string): any {
        // Simple logic to pick a structure type
        if (channel.includes('youtube')) {
            const topic = this.extractTopicFromAction(action);
            return {
                version: '1.0',
                recommendationId: '',
                targetChannel: channel,
                content_type: 'video',
                primary_entity: topic,
                action_description: action,
                aeo_extraction_targets: {
                    snippet: { required: true, instruction: 'Video description snippet' },
                    list: { required: false, instruction: '' },
                    table: { required: false, instruction: '' }
                },
                structure: [
                    { id: 'intro', type: 'section', text_template: 'Video Intro: Hook & Promise', instructions: ['Start with a visual hook', 'State the problem clearly'] },
                    { id: 'step1', type: 'section', text_template: 'Step 1: The Setup', instructions: ['Explain the first step'] },
                    { id: 'cta', type: 'cta', text_template: 'Call to Action', instructions: ['Ask to subscribe'] }
                ]
            };
        }
        // Default Article Skeleton
        const topic = this.extractTopicFromAction(action);

        // Determine content type from action
        let contentType = 'article';
        if (action.toLowerCase().includes('expert community response') || action.toLowerCase().includes('reddit')) {
            contentType = 'expert_community_response';
        } else if (action.toLowerCase().includes('blog')) {
            contentType = 'blog_post';
        } else if (action.toLowerCase().includes('guide')) {
            contentType = 'guide';
        }

        return {
            version: '1.0',
            recommendationId: '', // To be filled by LLM or service
            targetChannel: channel,
            content_type: contentType, // Type of content
            primary_entity: topic, // Extracted topic/keyword
            action_description: action, // Full verbose action for Plan of Action section
            aeo_extraction_targets: {
                snippet: { required: true, instruction: 'Optimize for direct answer box' },
                list: { required: false, instruction: '' },
                table: { required: false, instruction: '' }
            },
            structure: [
                { id: 'h1', type: 'heading', heading_level: 1, text_template: `How to {ACTION_TOPIC} in 2026`, instructions: [`Include ${brandName}`, 'Must mention 2026'] },
                { id: 'answer', type: 'heading', heading_level: 2, text_template: 'Direct Answer', instructions: ['40-60 words bold answer', 'Start with entity name'] },
                { id: 'benefits', type: 'heading', heading_level: 2, text_template: 'Benefits of {KEYWORD}', instructions: ['List 3 key benefits', 'Mention cost savings'] },
                { id: 'faq', type: 'faq', text_template: 'FAQ', instructions: ['Generate 3 PAA questions'] }
            ]
        };
    }

    private buildPlannerPrompt(rec: RecommendationV3, brand: any, skeleton: any, channel: string, customInstructions?: string): string {
        return `You are the Content Architect for ${brand.name}.
    
    TASK: Flesh out this Content Plan.
    1.  Use the provided Skeleton as a base - KEEP ALL FIELDS (version, targetChannel, primary_entity, aeo_extraction_targets, structure).
    2.  Rewrite 'text_template' (Headings) in the structure array to be specific to: "${rec.action}" and KPI: "${rec.kpi}".
    3.  Add specific 'instructions' for the writer based on the Brand Summary: "${brand.summary}".
    4.  Ensure H1 includes "2026".
    5.  ${customInstructions ? `USER INSTRUCTIONS: ${customInstructions}` : ''}

    SKELETON (JSON):
    ${JSON.stringify(skeleton, null, 2)}

    OUTPUT: Return ONLY valid JSON matching the 'TemplatePlan' interface. You MUST include ALL fields from the skeleton (version, targetChannel, primary_entity, aeo_extraction_targets, structure). Do NOT omit any top-level fields.`;
    }

    private parseAndValidatePlan(text: string): TemplatePlan | null {
        try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            console.log(`🔍 [TemplateService] Raw LLM response (first 500 chars): ${text.substring(0, 500)}`);
            const json = JSON.parse(cleaned);
            console.log(`🔍 [TemplateService] Parsed JSON keys: ${Object.keys(json).join(', ')}`);
            console.log(`🔍 [TemplateService] Has targetChannel: ${!!json.targetChannel}, Has primary_entity: ${!!json.primary_entity}, Has aeo_extraction_targets: ${!!json.aeo_extraction_targets}`);
            // Basic schema check
            if (!json.structure || !Array.isArray(json.structure)) return null;
            return json;
        } catch (e) {
            console.error(`❌ [TemplateService] Failed to parse plan:`, e);
            return null;
        }
    }
}

export const templateGenerationService = new TemplateGenerationService();
