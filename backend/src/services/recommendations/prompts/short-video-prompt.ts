
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
            content: "Verbatim spoken-word script (approx 150 words). USE LINE BREAKS between sections:\n\n**[0-5s] Hook:** <Hook text>\n**[5-20s] Answer:** <Direct answer>\n**[20-50s] Explanation:** <Details>\n**[50-60s] Takeaway:** <Final thought>",
            sectionType: "transcript"
        },
        {
            id: "production_tips",
            title: "Production Guidelines",
            content: "Strategic visual direction. Use a Bulleted List:\n* **Visuals:** <Camera angles/B-roll>\n* **Text Overlay:** <Keywords to show>\n* **Tone:** <Speaker emotion>",
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
