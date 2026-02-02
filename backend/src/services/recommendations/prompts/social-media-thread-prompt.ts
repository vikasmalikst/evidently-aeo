
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

    // Default structure based on "12. Ideal Thread Blueprint" from social-media-ref.md
    const defaultSections = [
        {
            id: "thread_opener",
            title: "Question & Direct Answer",
            content: "State the central question/problem explicitly and provide the core answer in 2-3 sentences. Context: Who this is for and when it applies. NO 'hooks' that delay the answer.",
            sectionType: "answer"
        },
        {
            id: "definition_context",
            title: "Definition / Context",
            content: "Define what the topic is and why it matters. Use neutral, expert-led tone. One clear idea.",
            sectionType: "context"
        },
        {
            id: "mechanism",
            title: "How It Works",
            content: "Explain the mechanism. Use numbered steps if applicable. Focus on 'why' it works, not just 'what' it is.",
            sectionType: "explanation"
        },
        {
            id: "example",
            title: "Real World Example",
            content: "A concrete example or data point validating the concept. Avoid anonymous claims.",
            sectionType: "case_study"
        },
        {
            id: "trade_offs",
            title: "Trade-offs",
            content: "Explicitly explain trade-offs/limitations. Real-world constraints (time, cost, effort).",
            sectionType: "constraints"
        },
        {
            id: "mistakes",
            title: "Common Mistakes",
            content: "List common anti-patterns or misconceptions to avoid.",
            sectionType: "mistakes"
        },
        {
            id: "comparison",
            title: "Comparison",
            content: "Compare with alternatives (side-by-side reasoning). No absolute 'best' claims. Specify scenarios.",
            sectionType: "comparison"
        },
        {
            id: "summary_faq",
            title: "Summary + FAQs",
            content: "Summarize key takeaways in list form. Add 2-3 anticipated follow-up questions with short answers.",
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
