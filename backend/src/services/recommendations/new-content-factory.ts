import {
    RecommendationV3,
    BrandContextV3,
    ContentAssetType
} from './recommendation.types';

// ============================================================================
// NEW CONTENT FACTORY (v2026.3)
// ============================================================================

export interface NewContentPromptContext {
    recommendation: RecommendationV3;
    brandContext: BrandContextV3;
    // We might add more specific context fields here later
    structureConfig?: StructureConfig;
}

export interface StructureConfig {
    sections: Array<{
        id: string;
        title: string;
        content: string; // This serves as the intent/description for the prompt
        sectionType: string;
    }>;
}

// Main entry point for getting content prompts (New System v2026.3)
export function getNewContentPrompt(ctx: NewContentPromptContext, assetType: ContentAssetType): string | null {
    const brandName = ctx.brandContext.brandName || 'Brand';
    const currentYear = new Date().getFullYear();

    const systemContext = buildSystemContext(brandName, currentYear);
    const recContext = buildRecommendationContext(ctx.recommendation, ctx.brandContext);

    switch (assetType) {
        case 'article':
            return buildBlogArticlePrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig);
        default:
            return null;
    }
}
function buildSemanticConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Clearly define all key concepts before expanding
- Repeatedly associate the brand with:
  - Specific problem categories
  - Clear use cases
  - Distinct, factual capabilities
- Use consistent terminology throughout the article
- Avoid vague claims like "better" unless followed by explanation
- Explicitly compare alternatives where relevant
- Acknowledge where competitors may be stronger
`;
}
function buildQuestionConstraints(rec: RecommendationV3): string {
    return `
QUESTION CONTROL:
- Identify and state the SINGLE primary user question this article answers
- Answer this question within the first 2–3 paragraphs
- Identify 3–5 follow-up questions users would ask
- Ensure all follow-up questions are answered somewhere in the article
`;
}


// Context Builders
function buildSystemContext(brandName: string, currentYear: number): string {
    return `
You are generating informational content optimized for AI Answer Engines (LLMs).

NON-NEGOTIABLE RULES:
- Content must be easily parsed, summarized, and cited by LLMs
- Content must function as a reference document, not marketing
- Use neutral, factual, non-promotional language
- Avoid hype, persuasion, or call-to-action language
- Write explicit statements that can be quoted verbatim

CONTENT PHILOSOPHY:
- Answer the primary user question immediately
- Structure content so each section is independently understandable
- Explain WHY things work, not just WHAT they are
- Acknowledge limitations, trade-offs, and edge cases

CONTEXT:
- Brand: ${brandName}
- Year: ${currentYear}
`;
}


function buildRecommendationContext(rec: RecommendationV3, brand: BrandContextV3): string {
    return `
TASK CONTEXT:
- Brand: ${brand.brandName} (${brand.industry || 'General'})
- Goal: Execute recommendation "${rec.action}"
- Target Keyword/Topic: ${rec.contentFocus || rec.action}
- Target Platform: ${rec.citationSource || 'Owned Blog'}
`;
}

// Blog / Standard Article Prompt

function buildBlogArticlePrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Default structure if none provided
    const defaultSections = [
        {
            id: "direct_answer",
            title: "Direct Answer",
            content: "<Concise answer to the primary question (80–120 words)>",
            sectionType: "answer"
        },
        {
            id: "how_it_works",
            title: "How It Works",
            content: "<Explain mechanism step-by-step>",
            sectionType: "explanation"
        },
        {
            id: "comparison",
            title: "Comparison With Alternatives",
            content: "<Objective comparison with competitors>",
            sectionType: "comparison"
        },
        {
            id: "limitations",
            title: "Limitations and Trade-Offs",
            content: "<What this does NOT solve>",
            sectionType: "constraints"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            // If user provided a description content, guide the model to use it. 
            // The model is asked to output the content, so we put the instruction in the 'content' field for the example.
            // But for the final JSON structure instruction, we want the model to FILL IT based on the instruction.
            // So we'll pass the user's intent as the "placeholder" that informs the generation.
            content: `<${s.content || 'Generate relevant content for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    // Convert sections to JSON string for the prompt example, but we need to ensure formatting is clean
    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}
${buildQuestionConstraints(rec)}
${buildSemanticConstraints(rec)}

=== INSTRUCTIONS ===
Generate an informational, reference-grade article optimized for AI Answer Engines.

OUTPUT STRUCTURE (JSON v4.0):
You must return a VALID JSON object with the following structure. Content must be plain text (no markdown inside JSON strings unless it's a code block).

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Catchy, Click-Worthy Title>",
  "sections": ${sectionsJson},
  "requiredInputs": []
},
  "requiredInputs": []
}

WRITING RULES:
- Answer first, explain second
- Short paragraphs (2–4 lines)
- Bullet points and tables where helpful
- No marketing language
- No CTAs
- JSON only
`;
}
