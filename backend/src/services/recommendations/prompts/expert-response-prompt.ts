
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

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate expert insight for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : [];

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
