
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

    let template = "";

    if (structureConfig?.sections && structureConfig.sections.length > 0) {
        template = structureConfig.sections.map(section => {
            return `[H2] ${section.title}\n> INSTRUCTIONS FOR THIS SECTION: ${section.content}`;
        }).join('\n\n');

        template = `[H1] Title: [Industry] Report: The Impact of [Entity] on [Market]\n\n` + template;
    } else {
        // Technical White Paper Template (from improvedContentTemplates.md)
        template = `
[H1] Title: [Industry] Report: The Impact of [Entity] on [Market]

[H2] Abstract & Key Findings
> INSTRUCTIONS: Word Count: 100 words. Tonality: Academic, neutral. Format: Bulleted "Key Takeaways" list. Include at least two proprietary "Stats" (e.g., "[Brand] data shows a 30% increase in...").

[H2] Methodology
> INSTRUCTIONS: Word Count: 50 words. Tonality: Transparent. Format: Brief paragraph. State clearly where the data came from to satisfy E-E-A-T.

[H2] Technical Analysis: [Sub-Topic]
> INSTRUCTIONS: Word Count: 400 words. Tonality: Expert, dense. Format: H3 headers and technical diagrams (text-based). Use high-density industry terminology.

[H2] About [Brand]
> INSTRUCTIONS: Word Count: 50 words. Tonality: Corporate, established. Format: Standard boilerplate.
`;
    }

    return `
You are a Lead Research Analyst and Technical Writer for ${brandName}.
Your goal is to write a definitive, data-backed industry report that establishes authoritative trust.

**CONTEXT:**
- **Brand:** ${brandName}
- **Task:** Write a whitepaper/report about "${rec.contentFocus || rec.action}"
- **Year:** ${currentYear}
- **Goal:** Be cited as a primary source by other industry experts.

**CORE WRITING GUIDELINES (STRICT):**
1.  **Data is King:** Every major claim must be supported by a specific data point, statistic, or case study reference. Use placeholders like "[Data: X% increase]" if exact numbers aren't provided.
2.  **Formal & Objective:** Avoid all "marketing fluff." No exclamation points. No rhetorical questions. Use clean, academic language.
3.  **Definitions First:** Define complex terms immediately upon introduction.
4.  **Causal Analysis:** Don't just say *what* happened; explain *why* it happened (the mechanism).
5.  **Structure for Skimming:** Use clear H2/H3 headers. Long blocks of text are forbidden.

**DO vs DON'T:**
- **DO:** "The data indicates a 24% year-over-year growth in adoption."
- **DON'T:** "It's amazing to see how much adoption has grown!"
- **DO:** "This mechanism functions by reducing latency via..."
- **DON'T:** "This is a game-changer that makes everything faster."

${systemContext}
${recContext}

**THE STRUCTURE (MANDATORY):**
${template}

**INSTRUCTIONS:**
Generate the whitepaper content adhering strictly to the structure above.
- **Tone:** Academic, Professional, Objective, Trustworthy.
- **Voice:** Third-person ("The report finds," "${brandName} analysis shows").
- **Formatting:** Markdown (H1, H2, H3, standard academic formatting).

**OUTPUT FORMAT (JSON v5.0):**
Return a SINGLE VALID JSON object. The 'content' field must contain the ENTIRE markdown document as a single string.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Authoritative, Descriptive Title>",
  "content": "<FULLMARKDOWN STRING...>",
  "requiredInputs": []
}
`;
}
