import { RecommendationV3, BrandContextV3 } from '../recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildComparisonTablePrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    const defaultSections = [
        {
            id: "overview",
            title: "Overview",
            content: "A neutral, high-level summary of the comparison landscape (300-400 words). Define the criteria used for evaluation.",
            sectionType: "context"
        },
        {
            id: "table",
            title: "Comparison Table",
            content: `| Feature | ${brandName} | [Competitor] |\n|---|---|---|\n| [Feature 1] | [Value] | [Value] |`,
            sectionType: "comparison_table"
        },
        {
            id: "detailed_analysis",
            title: "Deep Dive Analysis",
            content: "Prose analysis explaining the 'why' behind the table ratings. Focus on nuances that don't fit in the grid. 400-600 words.",
            sectionType: "strategies"
        },
        {
            id: "verdict",
            title: "Final Verdict",
            content: "A 'Who is this for?' conclusion. Define the ideal user profile for each option rather than declaring a universal winner.",
            sectionType: "cta"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate comparison content for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

=== ASSET TYPE: COMPARISON TABLE/GUIDE ===
You are generating a structured comparison between products/options.
This should be FAIR and BALANCED - not just marketing for ${brandName}.

QUALITY REQUIREMENTS:
- Compare 5-7 realistic features/criteria in DEPTH
- **CRITICAL:** The comparison table must be valid MARKDOWN TABLE syntax.
- The prose analysis should be SUBSTANTIAL (400+ words).
- CRITICAL: DO NOT RENAME SECTIONS. Use the exact "title" provided in the structure for each section.

OUTPUT SCHEMA (GeneratedContentJsonV4):
{
  "version": "4.0",
  "assetType": "comparison_table",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource || ''}" },
  "contentTitle": "<Descriptive comparison title>",
  "sections": ${sectionsJson},
  "requiredInputs": ["[FILL_IN: pricing]", "[FILL_IN: competitor features]"]
}
`;
}
