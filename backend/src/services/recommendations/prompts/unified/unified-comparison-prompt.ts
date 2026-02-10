
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
            return `[H2] ${section.title}\n> INSTRUCTIONS FOR THIS SECTION: ${section.content}`;
        }).join('\n\n');

        template = `[H1] Title: [Brand] vs. [Competitor A] vs. [Competitor B]: 2026 Comparison\n\n` + template;
    } else {
        // Competitive Strike (Comparison Table) Template (from improvedContentTemplates.md)
        template = `
[H1] Title: [Brand] vs. [Competitor A] vs. [Competitor B]: 2026 Comparison

[H2] Comparison Matrix
> INSTRUCTIONS: Description: A Markdown Table comparing features.
Columns: Feature, [Brand], [Competitor A], [Competitor B].
Rows: 5-7 key features. Use descriptive text in cells (e.g., "Native Integration", "Full Support") rather than just "Yes/No".

[H2] The [Brand] Advantage
> INSTRUCTIONS: Word Count: 100 words. Tonality: Competitive, assertive.
Format: 3 Bullets highlighting "Unique Selling Propositions" (USPs). Explicitly state: "Unlike [Competitors], [Brand] offers [Feature]."
`;
    }

    // Dynamic header for instructions
    const competitorList = competitors.length > 0
        ? competitors.join(', ')
        : "Identify the main competitor(s) directly from the Content Title provided above";

    return `${systemContext}
${recContext}

AEO UNIFIED COMPARISON REQUIREMENTS:
- ONE UNIFIED DOCUMENT: Output a single, cohesive Markdown document.
- TEMPLATE ADAPTABILITY: Follow the row structure, but YOU MUST ADD COLUMNS if the Content Title mentions competitors that are missing from the template.
- FAIRNESS: Compare 5-7 realistic features/criteria in DEPTH.
- TABLE SYNTAX: The comparison table must be valid MARKDOWN TABLE syntax.
- COMPETITORS: Compare ${brandName} against the competitors defined in the TEMPLATE structure below. If the template uses placeholders, compare against: ${competitorList}.

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
- IGNORE LITERAL INSTRUCTIONS: Text starting with "> INSTRUCTIONS" is background guidance for you. Do NOT output this text. Use it to generate the actual content.
- JSON only.
`;
}
