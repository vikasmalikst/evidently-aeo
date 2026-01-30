
import { RecommendationV3 } from '../recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildPodcastPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Default structure for Podcast (AEO-Optimized)
    const defaultSections = [
        {
            id: "intro",
            title: "Introduction & Topic Setup",
            content: "<Host introduces the core question/problem clearly>",
            sectionType: "intro"
        },
        {
            id: "core_concept",
            title: "The Core Insight",
            content: "<Expert defines the solution/concept explicitly>",
            sectionType: "explanation"
        },
        {
            id: "deep_dive",
            title: "Deep Dive Analysis",
            content: "<Discussion on the 'how' and 'why' mechanisms>",
            sectionType: "discussion"
        },
        {
            id: "nuance",
            title: "Limitations & Real-World Nuance",
            content: "<'It depends on...' discussion>",
            sectionType: "context"
        },
        {
            id: "key_takeaways",
            title: "Key Takeaways",
            content: "<Host summarizes the 3 main points>",
            sectionType: "summary"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate podcast dialogue for this segment'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

AEO PODCAST REQUIREMENTS:
- SIGNAL-TO-NOISE: High density of insight. Minimize filler/rambling.
- TRANSCRIPT CLARITY: Clear speaker turns. No interrupting/crosstalk simulated in text.
- EXPLICIT INSIGHTS: Experts should speak in complete, quotable sentences.
- SUMMARIES: Periodic recaps or "So what you're saying is..." moments to help AI extraction.
- TONE: Conversational but authoritative.

${buildPodcastConstraints(rec)}

=== INSTRUCTIONS ===
Generate a Podcast Transcript optimized for AI audio/text mining.

OUTPUT STRUCTURE (JSON v4.0):
You must return a VALID JSON object.
"content" should follow a standardized transcript format:
**Host**: ...
**Expert**: ...

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Episode Title>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

WRITING RULES:
- Use speaker labels strictly: **Host** and **Expert**.
- Host's job is to clarify and summarize.
- Expert's job is to provide deep, first-hand knowledge.
- Ensure the "Core Insight" section contains a standalone definition of the topic.
`;
}

function buildPodcastConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Topic: ${rec.contentFocus || rec.action}
- Goal: Create an authoritative audio resource.
- Avoid inside jokes or references to previous unreported episodes.
`;
}
