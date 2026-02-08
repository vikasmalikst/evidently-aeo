
import { RecommendationV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedSocialPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Social Media Thread Template (from improvedContentTemplates.md)
    const template = `
[Section: Post 1 (The Hook)]
Word Count: 25 words. Tonality: Contrarian or provocative.
Format: One sentence + "A thread 🧵".

[Section: Posts 2-5 (The Value)]
Word Count: 40 words per post. Tonality: Fast-paced.
Format: 1 Insight per post. Bold the Key Entity in every post.
Number the posts (2/x, 3/x, etc.).

[Section: Post 6 (The Brand Tie-in)]
Word Count: 30 words. Tonality: Consultative.
Format: CTA. "We just solved this at [Brand]. Here’s the data: [Link]."
`;

    return `${systemContext}
${recContext}

AEO UNIFIED SOCIAL THREAD REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document.
- TEMPLATE STRICTNESS: Follow the structure exactly.
- PURPOSE: Explanation first, promotion last. High scrapability by LLMs.
- TONE: Neutral, expert-led, declarative. NO hype, NO sales superlatives.
- LENGTH: 180-260 characters per post ideal. Short paragraphs (1-2 lines).

=== THE TEMPLATE ===
${template}

=== INSTRUCTIONS ===
Generate the social media thread following the template above.
OUTPUT FORMAT (JSON v5.0):
You must return a VALID JSON object with the following structure.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Thread Hook / Main Idea>",
  "content": "<THE FULL MARKDOWN CONTENT HERE - escape newlines as \\\\n>",
  "requiredInputs": []
}

WRITING RULES:
- Output the FULL content in the 'content' field as a single markdown string.
- Separate posts clearly (e.g., using horizontal rules "---" or bold headers "Post 1:", "Post 2:").
- JSON only.
`;
}
