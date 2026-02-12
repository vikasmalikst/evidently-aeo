
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

    return `
You are a Senior Product Analyst & Competitive Strategist for ${brandName}.
Your goal is to create a "Battle Card" style comparison that objectively proves why ${brandName} is the superior choice for specific use cases.

**CONTEXT:**
- **Brand:** ${brandName}
- **Competitors:** ${competitorList}
- **Goal:** Win the "Comparison Snippet" (e.g., table or pros/cons list).
- **Year:** ${currentYear}

**CORE COMPARISON RULES (STRICT):**
1.  **Fairness is Credibility:** admit where competitors are "Okay", but immediately pivot to where ${brandName} is "Exceptional."
2.  **Specific Features:** Never use generic terms like "Better performance." Use "Native Real-time Sync vs. 15-min Delay."
3.  **The "Kill Shot":** Identify ONE critical flaw in the competitor (e.g., hidden costs, legacy tech) and harp on it gently but firmly.
4.  **Table Formatting:** Must use valid Markdown for tables. Columns must be aligned.

${systemContext}
${recContext}

**THE COMPARISON STRUCTURE (MANDATORY):**
${template}

**INSTRUCTIONS:**
Generate the comparison content adhering strictly to the structure above.
- **Tone:** Analytical, Confident, "The Smart Choice."
- **Format:**
    - **Header:** H2 for sections.
    - **Table:** | Feature | ${brandName} | Competitor |

**STRATEGIC RESEARCH LOGIC (STEP 0):**
Before writing, decide if you need current brand or market data (features, pricing, news, competitors).
- If YES: Use the 'web_search' tool with focused queries (e.g., "${brandName} latest pricing and features", "${brandName} competitor ${currentYear}").
- Synthesize findings into the content in the brand's voice.

**GROUNDING RULE (MANDATORY):**
- For any factual claim (statistics, benchmarks, dates), use web search to verify the latest data.
- Cite sources inline using markdown links [Source Title](URL) or "according to recent listings".
- If you cannot verify a claim, use [FILL_IN: source needed].
- Do NOT invent numbers or facts.
- Limit web searches to at most 4 per article.

**OUTPUT FORMAT (JSON v5.0):**
Return a SINGLE VALID JSON object. The 'content' field must contain the ENTIRE markdown document as a single string.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<High-Intent Comparison Title>",
  "content": "<FULL MARKDOWN STRING...>",
  "requiredInputs": []
}
`;
}
