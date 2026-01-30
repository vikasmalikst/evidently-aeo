
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

    // Default structure for Short Videos (AEO-Optimized)
    // Focused on "One Idea Only"
    const defaultSections = [
        {
            id: "hook",
            title: "The Hook (0-3s)",
            content: "<Visual/Text hook that states the specific problem immediately>",
            sectionType: "hook"
        },
        {
            id: "direct_answer",
            title: "The Answer (Core Concept)",
            content: "<The single, explicit answer/solution. No fluff.>",
            sectionType: "answer"
        },
        {
            id: "explanation",
            title: "The Why (Explanation)",
            content: "<Brief explanation of mechanism or proof (1-2 sentences)>",
            sectionType: "explanation"
        },
        {
            id: "takeaway",
            title: "The Takeaway (Quotable)",
            content: "<One memorable, quotable statement summarizing the value>",
            sectionType: "summary"
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
- SINGLE IDEA ONLY: Do not cover multiple topics. Focus on one specific answer.
- TEXTUAL CLARITY: AI reads captions. Spoken words must be grammatically complete sentences.
- EXPLICIT STATEMENTS: Avoid implied meaning. Say exactly what you mean.
- SELF-CONTAINED: Must make sense without watching previous videos.
- NO "LINK IN BIO": Do not hide the answer. The video *is* the answer.
- TONE: Calm, factual, authoritative. No "You won't believe this!" hype.

${buildShortVideoConstraints(rec)}

=== INSTRUCTIONS ===
Generate a script for a Short Video (TikTok/Reels/Shorts) optimized for AI audio/transcript analysis.

OUTPUT STRUCTURE (JSON v4.0):
You must return a VALID JSON object.
"sections" should represent the temporal flow of the video script.
"content" in the sections should include both [VISUAL] cues and (AUDIO) spoken words.

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Clear, Searchable Video Title>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

WRITING RULES:
- Spoken word count: ~130-150 words total (for 60s).
- Use short, punchy sentences.
- Ensure at least one sentence is a perfect "definition" or "answer" that AI can quote.
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
