
import { RecommendationV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedWhitepaperPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Technical White Paper Template (from improvedContentTemplates.md)
    const template = `
[H1] Title: [Industry] Report: The Impact of [Entity] on [Market]

[H2] Abstract & Key Findings
Word Count: 100 words. Tonality: Academic, neutral. Format: Bulleted "Key Takeaways" list. Include at least two proprietary "Stats" (e.g., "[Brand] data shows a 30% increase in...").

[H2] Methodology
Word Count: 50 words. Tonality: Transparent. Format: Brief paragraph. State clearly where the data came from to satisfy E-E-A-T.

[H2] Technical Analysis: [Sub-Topic]
Word Count: 400 words. Tonality: Expert, dense. Format: H3 headers and technical diagrams (text-based). Use high-density industry terminology.

[H2] About [Brand]
Word Count: 50 words. Tonality: Corporate, established. Format: Standard boilerplate.
`;

    return `${systemContext}
${recContext}

AEO UNIFIED WHITEPAPER REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document.
- TEMPLATE STRICTNESS: Follow the structure exactly.
- TRUST & DEPTH: Focus on authority, evidence, and transparency.
- EXPLICIT DEFINITIONS: Define all key concepts before using them.
- WHY OVER WHAT: Explain causal relationships and mechanisms.

=== THE TEMPLATE ===
${template}

=== INSTRUCTIONS ===
Generate the whitepaper content following the template above.
OUTPUT FORMAT (JSON v5.0):
You must return a VALID JSON object with the following structure.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Authoritative, Descriptive Title>",
  "content": "<THE FULL MARKDOWN CONTENT HERE - escape newlines as \\\\n>",
  "requiredInputs": ["[FILL_IN: stat 1]", "[FILL_IN: stat 2]"]
}

WRITING RULES:
- Output the FULL content in the 'content' field as a single markdown string.
- Use H1 (#), H2 (##), H3 (###) for headers in the markdown.
- JSON only.
`;
}
