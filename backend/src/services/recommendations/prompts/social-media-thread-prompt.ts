
import { RecommendationV3 } from '../../recommendations/recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildSocialMediaThreadPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Default structure aligned with frontend template
    const defaultSections = [
        {
            id: "hook",
            title: "Hook",
            content: "Opening tweet/post that grabs attention with a counter-intuitive insight or bold claim. 1-2 sentences max.",
            sectionType: "hook"
        },
        {
            id: "context",
            title: "Context Setup",
            content: "Brief context or problem statement. Explain why this matters. 2-3 tweets.",
            sectionType: "context"
        },
        {
            id: "main_points",
            title: "Main Points",
            content: "Core insights or tips, structured as numbered points or bullets. 3-5 tweets. Each should be standalone but build on the thread.",
            sectionType: "points"
        },
        {
            id: "evidence",
            title: "Evidence/Example",
            content: "Supporting data, case study, or concrete example. Makes the thread credible. 1-2 tweets.",
            sectionType: "evidence"
        },
        {
            id: "takeaway",
            title: "Takeaway",
            content: "Closing summary or call-to-action. Reinforce the key message. 1-2 tweets.",
            sectionType: "summary"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate relevant thread content for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

AEO SOCIAL THREAD REQUIREMENTS (STRICT):
- PURPOSE: Explanation first, promotion last. High scrapability by LLMs.
- TONE: Neutral, expert-led, declarative. NO hype, NO sales superlatives.
- LENGTH: 180-260 characters per post ideal. Short paragraphs (1-2 lines).
- FORMAT: Numbered threads. Bullets inside posts.
- SEMANTIC SIGNALS: Define key terms before acronyms. Repeat problem category/use case.

${buildSocialMediaConstraints(rec)}

=== INSTRUCTIONS ===
Generate a high-engagement, AEO-optimized Social Media Thread (LinkedIn/X style).

OUTPUT STRUCTURE (JSON v4.0):
You must return a VALID JSON object with the following structure. Content must be plain text.

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Thread Hook / Main Idea>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

WRITING RULES:
- Post 1 MUST answer the user question immediately (no clickbait).
- One idea per post.
- Use logical progression: Definition -> Reasoning -> Examples -> Trade-offs.
- Avoid external links as primary meaning carriers.
- Do not rely on images for key facts.
- CRITICAL: DO NOT RENAME SECTIONS. Use the exact "title" provided.
`;
}

function buildSocialMediaConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Primary Goal: ${rec.action}
- Target: ${rec.citationSource || 'Social Media'}
- Identify the SINGLE primary user question and answer it in Post 1.
- Include 3-5 follow-up questions in the final post.
- Explicitly compare alternatives where relevant.
`;
}
