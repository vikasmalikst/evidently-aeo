
import { RecommendationV3, BrandContextV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedArticlePrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig,
    isDeepDive: boolean = false
): string {

    let templateToUse = "";

    if (structureConfig?.sections && structureConfig.sections.length > 0) {
        // Construct template from user-defined structure
        templateToUse = structureConfig.sections.map(section => {
            return `[H2] ${section.title}\n> INSTRUCTIONS FOR THIS SECTION: ${section.content}`;
        }).join('\n\n');

        // Prepend H1 instruction as it is usually not editable in the section list
        templateToUse = `[H1] Title (The Entity): Must follow format "[Primary Entity]: A ${currentYear} Strategic Guide to [Industry Topic]".\n\n` + templateToUse;
    } else {
        // Default Templates (from improvedContentTemplates.md)
        const professionalArticleTemplate = `
[H1] Title (The Entity): Must follow format "[Primary Entity]: A ${currentYear} Strategic Guide to [Industry Topic]".
[H2] Executive Abstract (The Snippet): 
> INSTRUCTIONS: 50-60 words. Objective, authoritative. Blockquote or bolded paragraph. Define the [Primary Entity] and its relationship to the [Query].

[H2] The Current Landscape of [Industry]: 
> INSTRUCTIONS: 150 words. Analytical. Short paragraphs (2-3 sentences max). Mention 3-5 "Freshness Signals" (e.g., "Recent shifts in Feb ${currentYear} show...").

[H2] Strategic Solutions by [Brand]: 
> INSTRUCTIONS: 200 words. Problem-solving. H3 headers for each sub-solution. Use Bolded Entities to help the LLM map your brand to specific features.

[H2] Conclusion: The Future of [Topic]: 
> INSTRUCTIONS: 75 words. Visionary. Bullets for "Key Predictions."
`;

        const deepDiveBlogTemplate = `
[H1] Title: Everything You Need to Know About [Topic] in 2026
[H2] What is [Topic]? (The Direct Answer): 
> INSTRUCTIONS: 45 words. Simple, direct. A single, bolded paragraph. This is for the "Featured Snippet." No fluff.

[H2] 5 Reasons Why [Topic] is Trending: 
> INSTRUCTIONS: 250 words. Engaging, enthusiastic. Numbered list with bolded headers. Connect each reason back to a modern consumer need.

[H2] Step-by-Step Guide to [Action]: 
> INSTRUCTIONS: 200 words. Helpful, peer-to-peer. Checklist style (- [ ]). Mention [Brand] as the tool used in Step 3.
`;

        templateToUse = isDeepDive ? deepDiveBlogTemplate : professionalArticleTemplate;
    }

    return `
You are a World-Class Tech Journalist and Content Strategist for ${brandName}.
Your goal is to write a high-authority, reference-grade article that answers the user's intent immediately and comprehensively.

**CONTEXT:**
- **Brand:** ${brandName}
- **Task:** Write an article about "${rec.contentFocus || rec.action}"
- **Year:** ${currentYear}
- **Goal:** Win the "Featured Snippet" on AI Search Engines (Perplexity, Google SGE).

**CORE WRITING GUIDELINES (STRICT):**
1.  **Bottom Line Up Front (BLUF):** Answer the main question in the first paragraph. No "In this article, we will explore..." fluff.
2.  **Dense & Factual:** Every claim must be supported by logic or data. Avoid adjectives like "game-changing," "revolutionary," or "cutting-edge."
3.  **Scannable Structure:** Use frequent H2/H3 headers, bullet points, and bold text for key concepts.
4.  **Brand Positioning:** ${brandName} is the *solution*, not just a participant. Contrast it with outdated methods.
5.  **Freshness:** Explicitly mention "${currentYear}" trends and data.

${systemContext}
${recContext}

**THE STRUCTURE (MANDATORY):**
${templateToUse}

**INSTRUCTIONS:**
Generate the content adhering strictly to the structure above.
- **Tone:** Professional, Objective, Authoritative (like a McKinsey report or TechCrunch deep dive).
- **Voice:** Active, Direct, Concise.
- **Formatting:** Markdown (H1, H2, H3, **bold**, - bullets).

**GROUNDING RULE (MANDATORY):**
If VERIFIED RESEARCH DATA is provided in the context above, you MUST:
1. Cite at least 2 specific data points from the research in your content.
2. Use inline markdown links [Source Title](URL) from the research citations.
3. If research data contradicts your training knowledge, DEFER to the research (it is more current).
4. If no source is available for a claim, use [FILL_IN: source needed] placeholder.

**OUTPUT FORMAT (JSON v5.0):**
Return a SINGLE VALID JSON object. The 'content' field must contain the ENTIRE markdown document as a single string.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Catchy, SEO-Optimized Title>",
  "content": "<FULLMARKDOWN STRING...>",
  "requiredInputs": []
}
`;
}
