import {
    RecommendationV3,
    BrandContextV3,
    ContentAssetType
} from './recommendation.types';
import { buildWhitepaperPrompt } from './prompts/whitepaper-prompt';
import { buildShortVideoPrompt } from './prompts/short-video-prompt';
import { buildExpertResponsePrompt } from './prompts/expert-response-prompt';
import { buildPodcastPrompt } from './prompts/podcast-prompt';
import { buildComparisonTablePrompt } from './prompts/comparison-table-prompt';
import { buildSocialMediaThreadPrompt } from './prompts/social-media-thread-prompt';

// ... (existing imports)

// ... (existing imports)

export interface NewContentPromptContext {
    recommendation: RecommendationV3;
    brandContext: BrandContextV3;
    structureConfig?: StructureConfig;
}

export interface StructureConfig {
    sections: Array<{
        id: string;
        title: string;
        content: string;
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
        case 'whitepaper':
            return buildWhitepaperPrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig);
        case 'short_video':
            return buildShortVideoPrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig);
        case 'expert_community_response':
            return buildExpertResponsePrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig);
        case 'podcast':
            return buildPodcastPrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig);
        case 'comparison_table':
            const competitors = ctx.recommendation.competitors_target?.map((c: any) => typeof c === 'string' ? c : c.name) || [];
            return buildComparisonTablePrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig, competitors);
        case 'social_media_thread':
            return buildSocialMediaThreadPrompt(systemContext, recContext, brandName, currentYear, ctx.recommendation, ctx.structureConfig);
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

    // Default structure if none provided (Matches Frontend "Article" Template)
    const defaultSections = [
        {
            id: "direct_answer",
            title: "Direct Answer",
            content: "Provide a direct, standalone answer to the main user question immediately (80-120 words). Optimize for 'featured snippet' extraction. Bold key concepts.",
            sectionType: "answer"
        },
        {
            id: "how_it_works",
            title: "How It Works",
            content: "Break down the mechanism or process into clear, numbered steps. Focus on 'why' it works, not just 'what' it is to build semantic depth.",
            sectionType: "explanation"
        },
        {
            id: "comparison",
            title: "Comparison With Alternatives",
            content: "Objectively compare with 2-3 main alternatives. Highlight unique differentiators without marketing fluff. Use contrastive language (e.g., 'Unlike X, Y does...').",
            sectionType: "comparison"
        },
        {
            id: "limitations",
            title: "Limitations and Trade-Offs",
            content: "Explicitly state 1-2 limitations or trade-offs. This increases trust and prevents 'too good to be true' penalties in AI scoring.",
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
}

WRITING RULES:
- Answer first, explain second
- Short paragraphs (2–4 lines)
- Bullet points and tables where helpful
- No marketing language
- No CTAs
- JSON only
- CRITICAL: DO NOT RENAME SECTIONS. Use the exact "title" provided in the structure for each section.
`;
}

// ============================================================================
// ASSET TYPE DETECTION (Moved from content-prompt-factory.ts)
// ============================================================================

export interface AssetDetectionResult {
    asset: ContentAssetType;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Detects the Content Asset Type from the recommendation action string.
 * 
 * Priority Order:
 * 1. Explicit content type keywords (article, whitepaper) - HIGHEST priority
 * 2. Specific asset types (calculator, tool, case study, webinar, video)
 * 3. Fallback to comparison if 'vs' present
 * 4. Default to article
 */
export function detectContentAsset(action: string): AssetDetectionResult {
    const actionLower = action.toLowerCase();

    // 1. EXPLICIT ARTICLE/BLOG - Highest priority
    const articleKeywords = ['article', 'standard article', 'publish article', 'blog post', 'guest post', 'write article', 'pillar page', 'resource guide'];
    if (articleKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'article', confidence: 'high' };
    }

    // 2. Expert Community / Forum (Specific Format) - MOVED UP
    const expertKeywords = ['expert community', 'forum response', 'quora', 'reddit', 'reddit response', 'community answer', 'expert answer'];
    if (expertKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'expert_community_response', confidence: 'high' };
    }

    // 3. Podcast (Specific Format) - NEW
    const podcastKeywords = ['podcast', 'audio', 'interview script'];
    if (podcastKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'podcast', confidence: 'high' };
    }

    // 4. Video/YouTube Keywords (Specific Format) - MOVED UP
    const videoKeywords = ['video', 'youtube', 'script', 'vlog', 'tiktok', 'reels'];
    if (videoKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'short_video', confidence: 'high' };
    }

    // 5. Webinar Keywords (Specific Format)
    const webinarKeywords = ['webinar', 'recap', 'event summary', 'presentation', 'talk'];
    if (webinarKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'webinar_recap', confidence: 'high' };
    }

    // 6. Case Study Keywords
    const caseStudyKeywords = ['case study', 'success story', 'customer story'];
    if (caseStudyKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'case_study', confidence: 'high' };
    }

    // 7. Comparison Table (MOVED UP: Prioritize over whitepaper if both keywords exist)
    const explicitComparisonKeywords = ['comparison table', 'create a comparison', 'release a comparison', 'versus table', 'vs table'];
    if (explicitComparisonKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'comparison_table', confidence: 'high' };
    }

    // 8. EXPLICIT WHITEPAPER/REPORT
    const whitepaperKeywords = ['whitepaper', 'white paper', 'research report', 'industry report', 'ebook'];
    if (whitepaperKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'whitepaper', confidence: 'high' };
    }

    // 8. Social Media Thread
    const threadKeywords = ['thread', 'linkedin carousel', 'twitter thread', 'x thread', 'social thread'];
    if (threadKeywords.some(k => actionLower.includes(k))) {
        return { asset: 'social_media_thread', confidence: 'high' };
    }

    // 9. Guide keyword
    if (actionLower.includes('guide')) {
        return { asset: 'article', confidence: 'medium' };
    }

    // 10. Comparison fallback
    if (actionLower.includes(' vs ') || actionLower.includes(' versus ')) {
        return { asset: 'comparison_table', confidence: 'medium' };
    }

    return { asset: 'article', confidence: 'low' };
}

/**
 * Detects the Platform (Container) from the citation source domain.
 */
export type ContentPlatform =
    | 'reddit'
    | 'linkedin'
    | 'youtube'
    | 'dev_to'
    | 'owned_site'
    | 'article_site'
    | 'other';

export function detectPlatform(citationSource: string, brandDomain?: string): ContentPlatform {
    const sourceLower = citationSource.toLowerCase().trim();

    if (sourceLower.includes('youtube.com') || sourceLower.includes('youtu.be')) return 'youtube';
    if (sourceLower.includes('reddit.com')) return 'reddit';
    if (sourceLower.includes('linkedin.com')) return 'linkedin';
    if (sourceLower.includes('dev.to')) return 'dev_to';
    if (sourceLower === 'owned-site' || (brandDomain && sourceLower.includes(brandDomain.toLowerCase()))) return 'owned_site';

    // Known editorial sites
    const articlePatterns = [
        'techcrunch', 'forbes', 'wired', 'medium', 'hashnode', 'smashingmagazine',
        'wikipedia', 'quora', 'stackoverflow', 'hubspot', 'atlassian'
    ];
    if (articlePatterns.some(p => sourceLower.includes(p))) return 'article_site';

    return 'other';
}
