
import { BrandContextV3, IdentifiedKPI, RecommendationV3 } from './recommendation.types';

export class RecommendationPromptService {


    /**
     * Construct prompt for generating recommendations
     */
    constructRecommendationPrompt(context: BrandContextV3): string {
        const normalizePercent = (value: number | null | undefined) => this.normalizePercent(value);
        const normalizeSentiment100 = (value: number | null | undefined) =>
            value === null || value === undefined ? null : Math.max(0, Math.min(100, ((value + 1) / 2) * 100));

        // Build brand metrics summary
        const brandLines: string[] = [];
        const brandVisibility = normalizePercent(context.visibilityIndex ?? null);
        if (brandVisibility !== null) {
            brandLines.push(`- Visibility: ${Math.round(brandVisibility * 10) / 10}`);
        }
        const brandSoa = normalizePercent(context.shareOfAnswers ?? null);
        if (brandSoa !== null) {
            brandLines.push(`- SOA: ${Math.round(brandSoa * 10) / 10}%`);
        }
        const brandSentiment = normalizeSentiment100(context.sentimentScore ?? null);
        if (brandSentiment !== null) {
            brandLines.push(`- Sentiment: ${Math.round(brandSentiment * 10) / 10}`);
        }

        // Format source metrics
        const sourceSummary = context.sourceMetrics && context.sourceMetrics.length > 0
            ? context.sourceMetrics.slice(0, 10).map((s, idx) => {
                const visibility = normalizePercent(s.visibility);
                const soa = normalizePercent(s.soa);
                const sentiment = normalizeSentiment100(s.sentiment);
                const parts: string[] = [`${idx + 1}. ${s.domain}`, `(${s.citations} citations, Impact ${s.impactScore}/10`];
                if (Number.isFinite(s.mentionRate)) parts.push(`Mention Rate ${Math.round(s.mentionRate * 10) / 10}%`);
                if (soa !== null) parts.push(`SOA ${soa}%`);
                if (sentiment !== null) parts.push(`Sentiment ${Math.round(sentiment * 10) / 10}`);
                if (visibility !== null) parts.push(`Visibility ${visibility}`);

                if (s.topCompetitor) {
                    parts.push(`Dominant Competitor: ${s.topCompetitor.name} (${Math.round(s.topCompetitor.soa * 100)}% SOA)`);
                }

                parts.push(')');
                return parts.join(', ');
            }).join('\n  ')
            : 'No source data available';

        const exactDomains = context.sourceMetrics && context.sourceMetrics.length > 0
            ? context.sourceMetrics.slice(0, 10).map(s => s.domain)
            : [];

        // Industry Benchmark
        const competitorContext = context._competitorAvgMetrics && context._competitorAvgMetrics.count > 0
            ? `Industry Benchmark (${context._competitorAvgMetrics.count} competitors analyzed):
- Average Visibility: ${context._competitorAvgMetrics.visibility !== undefined ? Math.round(context._competitorAvgMetrics.visibility * 10) / 10 : 'N/A'}
- Average SOA: ${context._competitorAvgMetrics.soa !== undefined ? Math.round(context._competitorAvgMetrics.soa * 10) / 10 : 'N/A'}%
- Average Sentiment: ${context._competitorAvgMetrics.sentiment !== undefined ? Math.round(context._competitorAvgMetrics.sentiment * 10) / 10 : 'N/A'}`
            : 'No industry benchmark data available';

        // Graph Insights
        let graphContextParts: string[] = [];

        if (context.graphInsights?.opportunityGaps && context.graphInsights.opportunityGaps.length > 0) {
            graphContextParts.push(`CONFIRMED COMPETITOR WEAKNESSES (Attack these gaps):
${context.graphInsights.opportunityGaps.map(g => `- Weakness: "${g.topic}" (Score: ${g.score.toFixed(4)})\n  Context: ${g.context}\n  Evidence: "${g.evidence[0] || 'N/A'}"`).join('\n')}`);
        }

        if (context.graphInsights?.battlegrounds && context.graphInsights.battlegrounds.length > 0) {
            graphContextParts.push(`ACTIVE BATTLEGROUNDS (High contention - differentiate here):
${context.graphInsights.battlegrounds.map(g => `- Topic: "${g.topic}" (Score: ${g.score.toFixed(4)})\n  Context: ${g.context}`).join('\n')}`);
        }

        if (context.graphInsights?.competitorStrongholds && context.graphInsights.competitorStrongholds.length > 0) {
            graphContextParts.push(`COMPETITOR STRONGHOLDS (Learn from their success / "Envy" strategy):
${context.graphInsights.competitorStrongholds.map(g => `- Strength: "${g.topic}" (Score: ${g.score.toFixed(4)})\n  Context: ${g.context}`).join('\n')}`);
        }

        const graphContext = graphContextParts.length > 0
            ? `GRAPH-DRIVEN STRATEGIC CONTEXT:\n${graphContextParts.join('\n\n')}`
            : 'No specific graph insights available (insufficient data overlap).';

        const lowDataMode = context._dataMaturity === 'low_data';
        const lowDataGuidance = lowDataMode
            ? `\nLOW-DATA MODE (important):\n- The brand has limited evidence/signals. Avoid making strong assumptions.\n- Prefer owned-site actions and foundational improvements that reliably create measurable signals.\n- If recommending external work, keep it conservative and tied to the provided safe sources list.\n- Use “audit/verify/optimize” language where you suspect basics already exist.\n`
            : '';

        return `You are a Brand/AEO expert. Generate 8-12 actionable recommendations to improve brand performance. Return ONLY a JSON array.

RULES
- citationSource MUST be EXACTLY one of the domains from the "Available Citation Sources" list below
- DO NOT use any domain that is not in the list - this is critical
- Use numeric scores as provided (0–100 scales). Do NOT add % signs except for expectedBoost
- expectedBoost should use percent style like "+5-10%"
- confidence is integer 0-100
- timeline is a range ("2-4 weeks", "4-6 weeks")
- focusArea must be: "visibility", "soa", or "sentiment"
- priority must be: "High", "Medium", or "Low"
- effort must be: "Low", "Medium", or "High"
- **PUBLISHING RULE**: Publishing content on a competitor's website is NOT an option. Do not suggest guest posting, commenting, or any form of content placement on domains that belong to competitors.
- **COMPETITOR EXCLUSION**: Competitor sources have already been filtered out from the available citation sources list.
- **STRATEGIC COMPARISONS**: You CAN mention competitors in the action, reason, or explanation IF it is for differentiation or comparison (e.g., "Create a comparison guide: Us vs. [Competitor]").
- **NO PROMOTION**: Do NOT recommend promoting competitors. Never suggest sending users to a competitor's website. Publishing content on a competitor's domain is strictly forbidden.
${lowDataGuidance}

Brand Performance
- Name: ${context.brandName}
- Industry: ${context.industry || 'Not specified'}
${brandLines.join('\n')}


${graphContext}



Known Competitors (for comparison context only):
${context.competitors && context.competitors.length > 0 ? context.competitors.map(c => `- ${c.name}`).join('\n') : 'No specific competitors identified.'}
    


Available Citation Sources (you MUST use ONLY these exact domains - copy them EXACTLY):
These are the top sources from the Citations Sources page, sorted by Value score (composite of Visibility, SOA, Sentiment, and Citations).
Competitor sources have been automatically excluded from this list.
${exactDomains.length > 0 ? exactDomains.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'No sources available'}



Your Task:
Generate 8-12 recommendations. Each recommendation should:
1. Have a clear action (what to do)
2. Specify a citation source/domain from the "Available Citation Sources" list above - use the EXACT domain name as shown
3. Have a focus area (visibility/soa/sentiment) based on brand metrics
4. Have priority (High/Medium/Low) and effort (Low/Medium/High)
6. Include reason (why this matters), explanation (4-5 sentences), expectedBoost, timeline, confidence
7. Include focusSources, contentFocus, kpi ("Visibility Index" | "SOA %" | "Sentiment Score")
8. **CONTENT ASSET STRATEGY (FSA Framework)**: When recommending content, choose the most effective Asset Type:
  
   - **Comparison Table** -> For 'vs' or 'best' queries (e.g., "X vs Y", "best X for Y"). Generate structured markdown tables.
   - **Whitepaper / Report** -> For complex B2B topics requiring authority. Generates metadata (summary, chapters).
   - **Webinar Recap** -> For trending topics requiring Q&A or event summaries.
   - **Standard Article** -> Default fallback for informational content.
   - Include the intended asset type in the 'contentFocus' field (e.g., "Interactive ROI Calculator for...", "Comparison Table: X vs Y").
9.- **STRATEGIC COMPARISONS**: You CAN mention competitors in the action, reason, or explanation IF it is for differentiation or comparison (e.g., "Create a comparison guide: Us vs. [Competitor]").

IMPORTANT: Do NOT generate impactScore, mentionRate, soa, sentiment, visibilityScore, or citationCount. These will be automatically filled from the source data.

Return ONLY a JSON array. Here are two examples showing different recommendation types:
[
  {
    "action": "Create FAQ content on reddit.com about enterprise security",
    "citationSource": "reddit.com",
    "focusArea": "visibility",
    "priority": "High",
    "effort": "Medium",
    "kpi": "Visibility Index",
    "reason": "Reddit has high citation volume but low visibility for this brand",
    "explanation": "Reddit is a high-traffic platform with significant citation opportunities. Creating structured FAQ content will improve citation opportunities and brand mentions in AI responses.",
    "expectedBoost": "+5-10%",
    "focusSources": "reddit.com",
    "contentFocus": "Technical FAQs and troubleshooting guides",
    "timeline": "2-4 weeks",
    "confidence": 75
  },
  {
    "action": "Create a comparison page 'insiderSports vs ASM Pricing' targeting 'Cheap Super Bowl Tickets'",
    "citationSource": "insidersports.com.au",
    "focusArea": "visibility",
    "priority": "High",
    "effort": "Medium",
    "kpi": "Visibility Index",
    "reason": "Graph analysis shows ASM is failing at 'Cheap Super Bowl Tickets' with negative sentiment. This is an opportunity to capture their dissatisfied audience.",
    "explanation": "ASM's weakness on affordable tickets represents a direct market opportunity. Creating comparison content that positions insiderSports as the affordable alternative will capture users searching for cheaper options. Include specific pricing comparisons and value propositions.",
    "expectedBoost": "+8-15%",
    "focusSources": "insidersports.com.au",
    "contentFocus": "Pricing comparison, value positioning, affordable ticket options",
    "timeline": "2-4 weeks",
    "confidence": 80
  }
]

Respond only with the JSON array.`;
    }

    /**
     * Construct prompt for cold start recommendation personalization
     */
    constructColdStartPrompt(context: BrandContextV3, templates: RecommendationV3[]): string {
        const templatesJson = JSON.stringify(
            templates.map(t => ({
                action: t.action,
                citationSource: t.citationSource,
                focusArea: t.focusArea,
                priority: t.priority,
                effort: t.effort,
                kpi: t.kpi,
                reason: t.reason,
                explanation: t.explanation,
                expectedBoost: t.expectedBoost,
                timeline: t.timeline,
                confidence: t.confidence,
                focusSources: t.focusSources,
                contentFocus: t.contentFocus
            })),
            null,
            2
        );

        return `Context:
- Brand: ${context.brandName}
- Industry: ${context.industry || 'Unknown'}
- Brand summary: ${context.brandSummary || 'Unknown'}
- Data maturity: cold_start

Task:
You will receive baseline cold-start recommendations. Improve them using these rules:
1) If the brand is likely established or already has the basics, DO NOT output naive "create pricing page" style items. Instead rewrite as "audit/verify/optimize" with concrete checks.
2) Remove any items that are clearly redundant for an established brand (but keep if uncertain and rewrite as an audit).
3) Rewrite each kept recommendation into a concrete deliverable (specific page names, outlines, checklist steps, directory copy bullets).
4) Add explicit success criteria inside explanation (what to measure, and when).
5) Keep citationSource as one of: "owned-site" | "directories"
6) Keep fields: action, citationSource, focusArea, priority, effort, kpi, reason, explanation, expectedBoost, timeline, confidence, focusSources, contentFocus
7) Output 5-10 recommendations max. Return ONLY a JSON array.

Baseline recommendations JSON:
${templatesJson}`;
    }

    // Helper method for normalizing percentages
    private normalizePercent(value: number | null | undefined): number | null {
        if (value === null || value === undefined) return null;
        return Math.max(0, Math.min(100, (value || 0)));
    }
}

export const recommendationPromptService = new RecommendationPromptService();
