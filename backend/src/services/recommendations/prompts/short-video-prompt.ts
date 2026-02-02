
import { RecommendationV3 } from '../recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildShortVideoPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Default structure for Short Videos (AEO-Optimized) - Matches Frontend Template
    const defaultSections = [
        {
            id: "transcript",
            title: "Full Audio Transcript",
            content: "Verbatim spoken-word script optimized for high-velocity reading. Must include a 'Hook' (0-3s), direct 'Answer' (3-20s), 'Explanation' (20-50s) and a quotable 'Takeaway' (50-60s).",
            sectionType: "transcript"
        },
        {
            id: "production_tips",
            title: "Production Guidelines",
            content: "Strategic visual & audio direction. Include camera angles, tone of voice, text overlays for key terms, and timing cues to maximize retention and AEO signals.",
            sectionType: "tips"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate script for this segment'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

AEO SHORT VIDEO REQUIREMENTS:
- SINGLE IDEA ONLY: Focus on one specific answer.
- TRANSCRIPT-FIRST: Generate a fluid, spoken-word script designed to be read aloud.
- STRUCTURE: The transcript must naturally flow through: Hook -> Direct Answer -> Explanation -> Takeaway.
- TONE: Calm, factual, authoritative.

${buildShortVideoConstraints(rec)}

=== INSTRUCTIONS ===
Generate a Short Video script optimized for AI audio/transcript analysis.

OUTPUT STRUCTURE (JSON v4.0):
1. **Full Audio Transcript**: The exact words to be spoken. No visual cues.
2. **Production Guidelines**: A strategic timeline explaining how to film the script (e.g., "0-5s: Close up, speak with urgency...").

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Clear, Searchable Video Title>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

WRITING RULES:
- Transcript must be ~130-150 words (60s).
- Production Tips must explicitly map the Transcript to the AEO Structure (Hook, Answer, Explanation).
- CRITICAL: DO NOT RENAME SECTIONS. Use the exact "title" provided in the structure for each section.
`;
}

function buildShortVideoConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Primary Question: ${rec.contentFocus || rec.action}
- The script must define: "What is X?" or "How to Y?" explicitly.
- Avoid slang or filler words that confuse transcripts.
`;
}
