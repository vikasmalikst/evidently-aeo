
import { RecommendationV3 } from '../recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildExpertResponsePrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Default structure for Expert Responses (AEO-Optimized) - Matches Frontend Template
    const defaultSections = [
        {
            id: "direct_stance",
            title: "The Verdict",
            content: "Start with a definitive 'Yes/No/It depends' verdict. Avoid 'fence-sitting'. State your position clearly as an experienced practitioner.",
            sectionType: "answer"
        },
        {
            id: "experience_context",
            title: "Real-World Experience",
            content: "Validate your stance with first-hand experience indicators (e.g., 'In our production environment...', 'After testing 5 tools...').",
            sectionType: "context"
        },
        {
            id: "reasoning",
            title: "The 'Why'",
            content: "Explain the technical 'why' behind your verdict. Focus on long-term implications and hidden factors beginners might miss.",
            sectionType: "explanation"
        },
        {
            id: "tradeoffs",
            title: "Trade-offs & Alternatives",
            content: "Steel-man the opposing view. Acknowledge valid reasons to choose the alternative. This demonstrates balance and high authority.",
            sectionType: "comparison"
        },
        {
            id: "conclusion",
            title: "Final Recommendation",
            content: "A final, actionable recommendation summarizing who should take this advice and who should avoid it.",
            sectionType: "summary"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate expert insight for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

AEO EXPERT RESPONSE REQUIREMENTS:
- FIRST-HAND EXPERIENCE: Use "I" or "We". Frame insights as experiential knowledge.
- NO FENCE-SITTING: Take a clear position. It's okay to say "It depends," but explain EXACTLY what it depends on.
- HONESTY: Explicitly admit downsides. AI trusts balanced critiques more than blind praise.
- TONE: Professional, helpful, peer-to-peer. Not "corporate marketing" voice.
- TONE: Professional, helpful, peer-to-peer. Not "corporate marketing" voice.
- FORMAT: Clear paragraphs. No excessive emojis. DO NOT use HTML tags (like <span>). Use [FILL_IN: concept] for placeholders if needed.

${buildExpertConstraints(rec)}

=== INSTRUCTIONS ===
Generate a high-quality community/expert response (like a top-tier Reddit or StackOverflow answer) optimized for AI scraping.

OUTPUT STRUCTURE (JSON v4.0):
You must return a VALID JSON object.

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Clear Question/Topic being answered>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

WRITING RULES:
- Start with the answer. Don't bury the lead.
- Use "In my experience" or "We found that" signals.
- Avoid generic advice. Be specific.
- CRITICAL: DO NOT RENAME SECTIONS. Use the exact "title" provided in the structure for each section.
`;
}

function buildExpertConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Context: Answering the specific question: "${rec.contentFocus || rec.action}"
- Perspective: Experienced practitioner sharing hard-earned wisdom.
- Avoid: Brand promotion, affiliate links, vague generalizations.
`;
}
