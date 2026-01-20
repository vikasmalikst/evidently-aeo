import type { RecommendationV3 } from './recommendation.types';

export type DataMaturityLevel = 'cold_start' | 'low_data' | 'normal';

export type ColdStartContext = {
  brandName: string;
  industry?: string;
};

/**
 * Deterministic baseline recommendations for brands with sparse data.
 *
 * Note: We intentionally avoid recommending "publish on X.com" style tactics here.
 * These are foundation steps that apply broadly.
 */
export function generateColdStartRecommendations(
  context: ColdStartContext
): RecommendationV3[] {
  const brand = context.brandName || 'your brand';
  const industry = context.industry ? ` in ${context.industry}` : '';

  const recs: RecommendationV3[] = [
    {
      action: `Ensure ${brand}'s website is indexed (submit XML sitemap, fix robots.txt, and verify key pages are crawlable)`,
      citationSource: 'owned-site',
      focusArea: 'visibility',
      priority: 'High',
      effort: 'Low',
      kpi: 'Visibility Index',
      reason: `If AI/search engines can’t reliably crawl and index ${brand}, you will remain invisible${industry}.`,
      explanation:
        `Cold-start foundation step. Confirm your core pages (Homepage, Pricing, Features, Integrations, Docs, Security) are indexable and discoverable. ` +
        `Success criteria: index coverage shows key pages indexed + impressions start increasing within 2-4 weeks.`,
      expectedBoost: '+2-5%',
      timeline: '2-4 weeks',
      confidence: 45,
      focusSources: 'Owned channels (website)',
      contentFocus: 'Indexation + technical discoverability'
    },
    {
      action: `Create an “Answer-First” FAQ hub: “What is ${brand}?”, “How does ${brand} work?”, “${brand} use cases”, “${brand} pricing”, and “${brand} security”`,
      citationSource: 'owned-site',
      focusArea: 'visibility',
      priority: 'High',
      effort: 'Medium',
      kpi: 'Visibility Index',
      reason: `When a brand is new or barely visible, AI systems rely on clear, structured pages that directly answer common questions.`,
      explanation:
        `Publish 5-10 short, answer-first pages with clear headings, examples, and internal links. ` +
        `Success criteria: citations/mentions increase and visibility improves within 4-6 weeks.`,
      expectedBoost: '+5-10%',
      timeline: '4-6 weeks',
      confidence: 50,
      focusSources: 'Owned channels (website)',
      contentFocus: 'FAQ + “What is/How to/Use cases” pages'
    },
    {
      action: `Create trust pages: Pricing, Security/Privacy, Integrations, and a Docs landing page with clear product positioning`,
      citationSource: 'owned-site',
      focusArea: 'visibility',
      priority: 'High',
      effort: 'Medium',
      kpi: 'Visibility Index',
      reason: `Trust pages reduce ambiguity and help AI systems confidently describe and recommend ${brand}.`,
      explanation:
        `Ship the minimum trust surface area: pricing tiers, security posture, integration list, and an easy-to-navigate docs entry point. ` +
        `Success criteria: brand presence increases and negative/uncertain mentions decrease within 4-8 weeks.`,
      expectedBoost: '+3-8%',
      timeline: '4-8 weeks',
      confidence: 50,
      focusSources: 'Owned channels (website)',
      contentFocus: 'Trust & credibility pages'
    },
    {
      action: `Create 2-3 case studies that show measurable outcomes and link them from your homepage and docs`,
      citationSource: 'owned-site',
      focusArea: 'sentiment',
      priority: 'Medium',
      effort: 'High',
      kpi: 'Sentiment Score',
      reason: `Case studies improve credibility and give AI systems concrete proof points to cite when describing ${brand}.`,
      explanation:
        `Write case studies with clear metrics (before/after), implementation steps, and quotes. ` +
        `Success criteria: improved sentiment and higher mention quality within 6-10 weeks.`,
      expectedBoost: '+2-6%',
      timeline: '6-10 weeks',
      confidence: 45,
      focusSources: 'Owned channels (website)',
      contentFocus: 'Customer outcomes + proof points'
    },
    {
      action: `List ${brand} on 3-5 reputable directories/review sites (where applicable) and ensure descriptions match your positioning`,
      citationSource: 'directories',
      focusArea: 'visibility',
      priority: 'Medium',
      effort: 'Medium',
      kpi: 'Visibility Index',
      reason: `Early citations and consistent descriptions help AI systems learn what ${brand} is and where it fits${industry}.`,
      explanation:
        `Use a consistent one-liner + feature bullets + category tags. ` +
        `Success criteria: citations/mentions increase within 4-8 weeks.`,
      expectedBoost: '+3-7%',
      timeline: '4-8 weeks',
      confidence: 45,
      focusSources: 'Directories & review sites',
      contentFocus: 'Listings + consistent positioning'
    }
  ];

  return recs;
}


