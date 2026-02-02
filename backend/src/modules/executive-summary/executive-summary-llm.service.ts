import { ExecutiveSummaryData } from './executive-summary.service';
import { recommendationLLMService } from '../../services/recommendations/recommendation-llm.service';

export class ExecutiveLLMService {

  async generateExecutiveNarrative(brandId: string, data: ExecutiveSummaryData): Promise<any> {
    const prompt = this.constructPrompt(data);
    const systemMessage = "You are a Senior Strategic Analyst. Output ONLY valid JSON. No markdown formatting. No preamble.";

    const response = await recommendationLLMService.generateContent(
      brandId,
      prompt,
      systemMessage,
      4000
    );

    if (!response) return null;

    try {
      // Clean up potentially malformed JSON (e.g. wrapper markdown)
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse LLM JSON response:", e);
      console.error("Raw response:", response);
      // Fallback object to prevent crash
      return {
        overview: { headline: "Analysis Error", summary: "Raw output could not be parsed." },
        defenseGap: { headline: "Defense Gaps", items: [] },
        thematicRisks: { headline: "Thematic Risks", items: [] },
        actions: { headline: "Strategic Actions", items: [] }
      };
    }
  }

  private constructPrompt(data: ExecutiveSummaryData): string {
    const { volumeContext, competitorInsights, topicGaps, topQueries } = data;

    // 1. Executive Overview Stats
    const overviewSection = `EXECUTIVE SCORING:
- Global Health Score: ${volumeContext.healthScore}/100
- Impact Scope: Performance gaps detected in ${volumeContext.gapPercentage}% of total query footprint.
- Critical Severity: ${volumeContext.criticalPercentage}% of queries are in a CRITICAL state.`;

    // 2. Competitor Threat Analysis (Head-to-Head)
    const h2hSection = competitorInsights.map(c => {
      const weakMetric = c.primaryWeakness;
      const metricStat = c.metrics[weakMetric as keyof typeof c.metrics];
      return `- **${c.competitorName}**: Leading threat with ${c.totalGaps} aggregated gaps. 
               Primary Attack Vector: ${weakMetric.toUpperCase()} (Winning ${metricStat.percentage}% of total queries).`;
    }).join('\n');

    // 3. Topic Clusters
    const topicSection = topicGaps.slice(0, 5).map(t =>
      `- **${t.topic}**: Avg Gap -${t.avgGap} pts. Specific weakness: ${t.primaryWeakness}. Leading threat: ${t.leadingCompetitor}.`
    ).join('\n');

    // 4. Evidence (Top Queries)
    const evidenceSection = topQueries.slice(0, 5).map(q =>
      `- Query: "${q.queryText}" | Metric: ${q.metricName} | Gap: ${q.gap}`
    ).join('\n');

    return `
You are writing an Executive Strategy Summary based on the following performance data.

${overviewSection}

THREAT ANALYSIS (Head-to-Head Conquesting):
${h2hSection}

THEMATIC GAPS:
${topicSection}

EVIDENCE (Key Examples):
${evidenceSection}

INSTRUCTIONS:
Analyze the data and output a JSON object with the following structure.
Ensure "headlines" are punchy, "So What?" style insights (e.g. "Competitors are dominating brand queries").

REQUIRED JSON STRUCTURE:
{
  "overview": {
    "headline": "Short, punchy 3-5 word status (e.g. 'Critical Vulnerability Detected')",
    "summary": "One sentence summary of the Health Score and overall risk level."
  },
  "defenseGap": {
    "headline": "Insight about head-to-head losses (e.g. 'Events Travel is eroding your brand authority')",
    "items": ["Competitor A is winning because...", "Competitor B is winning because..."]
  },
  "thematicRisks": {
    "headline": "Insight about topic weaknesses (e.g. 'Pricing pages are losing visibility')",
    "items": ["Topic A is weak due to...", "Topic B is suffering from..."]
  },
  "actions": {
    "headline": "Immediate Strategic Fixes",
    "items": ["Action 1", "Action 2", "Action 3"]
  }
}`;
  }
}

export const executiveLLMService = new ExecutiveLLMService();
