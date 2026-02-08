
import { RecommendationV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedComparisonPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig,
    competitors: string[] = []
): string {

    let template = "";

    if (structureConfig?.sections && structureConfig.sections.length > 0) {
        template = structureConfig.sections.map(section => {
            return `[H2] ${section.title}\n${section.content}`;
        }).join('\n\n');

        template = `[H1] Title: [Brand] vs. [Competitor A] vs. [Competitor B]: 2026 Comparison\n\n` + template;
    } else {
        // Competitive Strike (Comparison Table) Template (from improvedContentTemplates.md)
        template = `
[H1] Title: [Brand] vs. [Competitor A] vs. [Competitor B]: 2026 Comparison

[H2] Comparison Matrix
Description: A Markdown Table comparing features.
Columns: Feature, [Brand], [Competitor A], [Competitor B].
Rows: 5-7 key features. Use descriptive text in cells (e.g., "Native Integration", "Full Support") rather than just "Yes/No".

[H2] The [Brand] Advantage
Word Count: 100 words. Tonality: Competitive, assertive.
Format: 3 Bullets highlighting "Unique Selling Propositions" (USPs). Explicitly state: "Unlike [Competitors], [Brand] offers [Feature]."
`;
    }

    // Dynamic header for instructions
    const competitorList = competitors.length > 0 ? competitors.join(', ') : "[Competitor A], [Competitor B]";

    return `${systemContext}
${recContext}

AEO UNIFIED COMPARISON REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document.
- TEMPLATE STRICTNESS: Follow the structure exactly.
- FAIRNESS: Compare 5-7 realistic features/criteria in DEPTH.
- TABLE SYNTAX: The comparison table must be valid MARKDOWN TABLE syntax.
- COMPETITORS: Compare ${brandName} against: ${competitorList}.

=== THE TEMPLATE ===
${template}

=== INSTRUCTIONS ===
Generate the comparison content following the template above.
OUTPUT FORMAT (JSON v5.0):
You must return a VALID JSON object with the following structure.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Descriptive comparison title>",
  "content": "<THE FULL MARKDOWN CONTENT HERE - escape newlines as \\\\n>",
  "requiredInputs": ["[FILL_IN: pricing]", "[FILL_IN: competitor features]"]
}

WRITING RULES:
- Output the FULL content in the 'content' field as a single markdown string.
- Use H1 (#), H2 (##) for headers in the markdown.
- Ensure the table is properly formatted in markdown.
- JSON only.
`;
}
