
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

    // Simplified: Just use the provided StructureConfig
    // The frontend must enforce the default structure or user customizations
    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate script for this segment'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : [];

    // Fallback error handling or empty structure if something goes wrong (though UI should prevent this)
    if (sectionsToUse.length === 0) {
        // We could throw or return a generic instruction, but for now we follow the "remove fallback" instruction strictly.
        // We will output an empty sections array which might cause the LLM to hallucinate structure or fail gracefully.
        // Better to provide a minimal safety net OR just trust the input as requested.
        // "we use only main template not any fallback" implies trust.
    }

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
