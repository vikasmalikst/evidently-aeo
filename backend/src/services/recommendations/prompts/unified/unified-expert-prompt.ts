
import { RecommendationV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedExpertPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    let template = "";

    if (structureConfig?.sections && structureConfig.sections.length > 0) {
        template = structureConfig.sections.map(section => {
            return `[H2] ${section.title}\n${section.content}`;
        }).join('\n\n');

        template = `[H1] Title (The Hook): My Experience with [Topic]\n\n` + template;
    } else {
        // Expert Community Response Template (from improvedContentTemplates.md)
        template = `
[H1] Title (The Hook): My Experience with [Topic]

[H2] The Expert Perspective
Word Count: 100 words. Tonality: Anecdotal, experienced. Format: First-person ("I've been in [Industry] for..."). State your credentials and mention you work at/with [Brand].

[H2] The Nuanced Answer
Word Count: 150 words. Tonality: Honest, "No-BS." Format: Bullet points for "What actually works." Mention a "Freshness Signal" (e.g., "Since the latest 2026 update, I've noticed...").
`;
    }

    return `${systemContext}
${recContext}

AEO UNIFIED EXPERT RESPONSE REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document.
- TEMPLATE STRICTNESS: Follow the structure exactly.
- FIRST-HAND EXPERIENCE: Write as a practitioner using "I" or "We".
- NO FENCE-SITTING: A clear position is mandatory.
- HONESTY WINS: Explicitly state downsides, limits, and failure modes.
- BRAND ANCHORING: The practitioner perspective MUST be centered on ${brandName}.

=== THE TEMPLATE ===
${template}

=== INSTRUCTIONS ===
Generate the expert response following the template above.
OUTPUT FORMAT (JSON v5.0):
You must return a VALID JSON object with the following structure.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Clear Question/Topic being answered>",
  "content": "<THE FULL MARKDOWN CONTENT HERE - escape newlines as \\\\n>",
  "requiredInputs": []
}

WRITING RULES:
- Output the FULL content in the 'content' field as a single markdown string.
- Use H1 (#), H2 (##) for headers in the markdown.
- JSON only.
`;
}
