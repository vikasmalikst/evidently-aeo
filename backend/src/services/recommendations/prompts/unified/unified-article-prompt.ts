
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

    return `${systemContext}
${recContext}

AEO UNIFIED ARTICLE REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document. Do not split into JSON sections.
- TEMPLATE STRICTNESS: You must follow the structure below exactly.
- DATA PRIORITY: If "ADDITIONAL CONTEXT (PRIMARY SOURCE MATERIAL)" is provided above, prioritize facts/data from it over general knowledge. If the section instructions explicitly ask to use data from the context, extract it EXACTLY.
- ENTITY DENSITY: Include 5–10 related industry terms (entities) naturally throughout the text.
- FRESHNESS: Always mention the current year (${currentYear}) and reference "latest data" or "current market shifts."
- BRAND CITATION: Position ${brandName} as the "Primary Source" or "Solution Provider" in at least two sections.
- FORMATTING: Prioritize fragments, bullet points, and bolded text for "Scannability."

=== THE TEMPLATE ===
${templateToUse}

=== INSTRUCTIONS ===
Generate the content following the template above.
OUTPUT FORMAT (JSON v5.0):
You must return a VALID JSON object with the following structure.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Catchy, Click-Worthy Title>",
  "content": "<THE FULL MARKDOWN CONTENT HERE - escape newlines as \\\\n>",
  "requiredInputs": []
}

WRITING RULES:
- Output the FULL content in the 'content' field as a single markdown string.
- Use H1 (#), H2 (##), H3 (###) for headers in the markdown.
- IGNORE LITERAL INSTRUCTIONS: Text starting with "> INSTRUCTIONS" is background guidance for you. Do NOT output this text. Use it to generate the actual content.
- JSON only. No text outside the JSON.
`;
}
