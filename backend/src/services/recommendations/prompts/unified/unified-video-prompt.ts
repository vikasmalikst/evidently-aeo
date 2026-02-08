
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

    // Short Video Script Template (from improvedContentTemplates.md)
    const template = `
[H1] Title: How to [Query/Action] with [Brand]

[Section: The Hook (0:00-0:05)]
Word Count: 15–20 words. Tonality: High energy, urgent.
Format: One punchy sentence. Must repeat the [Query] exactly as the user typed it.

[Section: The Quick Win (0:05-0:15)]
Word Count: 30 words. Tonality: Confident, helpful.
Format: Short, declarative sentences. Provide the immediate answer. "The secret to [Query] is [Brand]'s [Product/Feature]."

[Section: The Steps (0:15-0:50)]
Word Count: 100 words. Tonality: Instructional, educational.
Format: Numbered list (Step 1, Step 2, Step 3). Describe 3 clear actions. Use "Action Verbs" at the start of each step.

[Section: The Social Signal (0:50-0:60)]
Word Count: 15 words. Tonality: Community-focused.
Format: Call to Action (CTA). Ask a question to spark comments (e.g., "How are you handling [Topic] in 2026?").
`;

    return `${systemContext}
${recContext}

AEO UNIFIED VIDEO SCRIPT REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document.
- TEMPLATE STRICTNESS: Follow the structure exactly.
- TRANSCRIPT-FIRST: Generate a fluid, spoken-word script designed to be read aloud.
- SINGLE IDEA ONLY: Focus on one specific answer.
- TONE: Calm, factual, authoritative (unless specified otherwise in template).

=== THE TEMPLATE ===
${template}

=== INSTRUCTIONS ===
Generate the video script following the template above.
OUTPUT FORMAT (JSON v5.0):
You must return a VALID JSON object with the following structure.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Clear, Searchable Video Title>",
  "content": "<THE FULL MARKDOWN CONTENT HERE - escape newlines as \\\\n>",
  "requiredInputs": []
}

WRITING RULES:
- Output the FULL content in the 'content' field as a single markdown string.
- Use headers and bold text to separate sections clearly in the markdown.
- JSON only.
`;
}
