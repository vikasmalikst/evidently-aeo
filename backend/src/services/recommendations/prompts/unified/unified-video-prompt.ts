
import { RecommendationV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedVideoPrompt(
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
            return `[H2] ${section.title}\n> INSTRUCTIONS FOR THIS SECTION: ${section.content}`;
        }).join('\n\n');

        template = `[H1] Title: How to [Query/Action] with [Brand]\n\n` + template;
    } else {
        // Short Video Script Template (from improvedContentTemplates.md)
        template = `
[H1] Title: How to [Query/Action] with [Brand]

[H2] The Hook (0:00-0:05)
> INSTRUCTIONS: Word Count: 15–20 words. Tonality: High energy, urgent.
Format: One punchy sentence. Must repeat the [Query] exactly as the user typed it.

[H2] The Quick Win (0:05-0:15)
> INSTRUCTIONS: Word Count: 30 words. Tonality: Confident, helpful.
Format: Short, declarative sentences. Provide the immediate answer. "The secret to [Query] is [Brand]'s [Product/Feature]."

[H2] The Steps (0:15-0:50)
> INSTRUCTIONS: Word Count: 100 words. Tonality: Instructional, educational.
Format: Numbered list (Step 1, Step 2, Step 3). Describe 3 clear actions. Use "Action Verbs" at the start of each step.

[H2] The Social Signal (0:50-0:60)
> INSTRUCTIONS: Word Count: 15 words. Tonality: Community-focused.
Format: Call to Action (CTA). Ask a question to spark comments (e.g., "How are you handling [Topic] in 2026?").
`;
    }

    return `
You are an expert Video Scriptwriter & Visual Storyteller for ${brandName}.
Your goal is to write a highly engaging, retention-focused video script that educates the viewer immediately.

**CONTEXT:**
- **Brand:** ${brandName}
- **Topic:** "${rec.contentFocus || rec.action}"
- **Platform:** YouTube / Shorts / TikTok (Fast-paced, high retention)
- **Year:** ${currentYear}

**CORE SCRIPTWRITING RULES (STRICT):**
1.  **The Hook (0-5s):** You must grab attention instantly. No logos, no "Welcome back." Start with the Problem or the Promise.
2.  **Visual Cues:** You MUST include visual directions in brackets, e.g., **[Visual: Split screen of X vs Y]**. The script is for an editor, not just a narrator.
3.  **Spoken Word:** Write for the ear, not the eye. Use short sentences, contractions ("don't" not "do not"), and natural rhythm.
4.  **No Fluff:** Cut the intro. Get to the value immediately.
5.  **Call to Action:** End with a specific engagement question, not just "Like and Subscribe."

${systemContext}
${recContext}

**THE SCRIPT STRUCTURE (MANDATORY):**
${template}

**INSTRUCTIONS:**
Generate the video script adhering strictly to the structure above.
- **Tone:** Energetic, Confident, Relatable.
- **Format:** 
    - **Header:** [Scene Header]
    - **Visual:** [Visual Direction]
    - **Audio:** (Narrator): Spoken words...

**GROUNDING RULE (MANDATORY):**
If VERIFIED RESEARCH DATA is provided in the context above, you MUST:
1. Cite at least 2 specific data points from the research in your content.
2. Use inline markdown links [Source Title](URL) from the research citations.
3. If research data contradicts your training knowledge, DEFER to the research (it is more current).
4. If no source is available for a claim, use [FILL_IN: source needed] placeholder.

**OUTPUT FORMAT (JSON v5.0):**
Return a SINGLE VALID JSON object. The 'content' field must contain the ENTIRE markdown script as a single string.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Viral Video Title>",
  "content": "<FULL MARKDOWN SCRIPT STRING...>",
  "requiredInputs": []
}
`;
}
