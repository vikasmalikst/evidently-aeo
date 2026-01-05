export const mockCitationSourcesData = {
  domainsData: [
    {
      id: "techcrunch",
      domain: "techcrunch.com",
      type: "Editorial",
      typeColor: "#498cf9",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 28,
      avgCitations: 1.2,
      trend: { direction: "up" as const, percent: 8 },
      topTopic: "Product Features",
      urlCount: 3,
      competitiveComparison: null
    },
    {
      id: "your-brand",
      domain: "your-brand.com",
      type: "Corporate",
      typeColor: "#06b6d4",
      isYourDomain: true,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 22,
      avgCitations: 2.1,
      trend: { direction: "up" as const, percent: 15 },
      topTopic: "Pricing",
      urlCount: 5,
      competitiveComparison: null
    },
    {
      id: "competitor",
      domain: "competitor.com",
      type: "Corporate",
      typeColor: "#06b6d4",
      isYourDomain: false,
      isCompetitor: true,
      competitorName: "Competitor A",
      usedPercentage: 18,
      avgCitations: 1.8,
      trend: { direction: "stable" as const, percent: 2 },
      topTopic: "Use Cases",
      urlCount: 4,
      competitiveComparison: { delta: -4, interpretation: "vs Your Domain: -4%" }
    },
    {
      id: "wikipedia",
      domain: "wikipedia.org",
      type: "Reference",
      typeColor: "#fa8a40",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 15,
      avgCitations: 0.8,
      trend: { direction: "stable" as const, percent: -1 },
      topTopic: "Industry Trends",
      urlCount: 2,
      competitiveComparison: null
    },
    {
      id: "medium",
      domain: "medium.com",
      type: "Editorial",
      typeColor: "#498cf9",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 12,
      avgCitations: 1.5,
      trend: { direction: "up" as const, percent: 5 },
      topTopic: "How-To Guides",
      urlCount: 3,
      competitiveComparison: null
    },
    {
      id: "forbes",
      domain: "forbes.com",
      type: "Editorial",
      typeColor: "#498cf9",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 10,
      avgCitations: 1.1,
      trend: { direction: "stable" as const, percent: 1 },
      topTopic: "Industry Trends",
      urlCount: 2,
      competitiveComparison: null
    },
    {
      id: "g2",
      domain: "g2.com",
      type: "Corporate",
      typeColor: "#06b6d4",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 8,
      avgCitations: 1.3,
      trend: { direction: "up" as const, percent: 22 },
      topTopic: "Pricing",
      urlCount: 1,
      competitiveComparison: null
    },
    {
      id: "reddit",
      domain: "reddit.com",
      type: "UGC",
      typeColor: "#ac59fb",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 6,
      avgCitations: 0.9,
      trend: { direction: "up" as const, percent: 3 },
      topTopic: "Use Cases",
      urlCount: 1,
      competitiveComparison: null
    },
    {
      id: "youtube",
      domain: "youtube.com",
      type: "UGC",
      typeColor: "#ac59fb",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 5,
      avgCitations: 1.2,
      trend: { direction: "up" as const, percent: 8 },
      topTopic: "Product Benefits",
      urlCount: 2,
      competitiveComparison: null
    },
    {
      id: "stanford",
      domain: "stanford.edu",
      type: "Institutional",
      typeColor: "#f155a2",
      isYourDomain: false,
      isCompetitor: false,
      competitorName: null,
      usedPercentage: 4,
      avgCitations: 0.7,
      trend: { direction: "stable" as const, percent: 0 },
      topTopic: "Industry Trends",
      urlCount: 1,
      competitiveComparison: null
    }
  ],

  urlsData: [
    {
      url: "techcrunch.com/2024/01/your-product-launch",
      domain: "techcrunch.com",
      brandMentioned: "Yes",
      usedTotal: 12,
      avgCitations: 1.4,
      brandsMentioned: ["Your Brand", "Competitor A"],
      topics: ["Product Benefits", "Industry Trends"],
      trend: { direction: "up" as const, percent: 8 },
      competitorMentioned: "Competitor A"
    },
    {
      url: "your-brand.com/pricing",
      domain: "your-brand.com",
      brandMentioned: "Yes",
      usedTotal: 8,
      avgCitations: 2.3,
      brandsMentioned: ["Your Brand"],
      topics: ["Pricing"],
      trend: { direction: "up" as const, percent: 12 },
      competitorMentioned: null
    },
    {
      url: "your-brand.com/case-studies",
      domain: "your-brand.com",
      brandMentioned: "Yes",
      usedTotal: 6,
      avgCitations: 2.0,
      brandsMentioned: ["Your Brand", "Customer Names"],
      topics: ["Use Cases", "Customer Success"],
      trend: { direction: "up" as const, percent: 20 },
      competitorMentioned: null
    },
    {
      url: "competitor.com/features",
      domain: "competitor.com",
      brandMentioned: "No",
      usedTotal: 7,
      avgCitations: 1.9,
      brandsMentioned: ["Competitor A"],
      topics: ["Product Benefits"],
      trend: { direction: "stable" as const, percent: 0 },
      competitorMentioned: "Competitor A"
    },
    {
      url: "wikipedia.org/Product-Category",
      domain: "wikipedia.org",
      brandMentioned: "Partial",
      usedTotal: 5,
      avgCitations: 0.9,
      brandsMentioned: ["Generic Mention"],
      topics: ["Industry Trends"],
      trend: { direction: "stable" as const, percent: -2 },
      competitorMentioned: null
    },
    {
      url: "techcrunch.com/2024/industry-report",
      domain: "techcrunch.com",
      brandMentioned: "Partial",
      usedTotal: 9,
      avgCitations: 1.1,
      brandsMentioned: ["Your Brand", "Multiple Competitors"],
      topics: ["Industry Trends", "Market Analysis"],
      trend: { direction: "up" as const, percent: 5 },
      competitorMentioned: "Multiple"
    },
    {
      url: "your-brand.com/blog/best-practices",
      domain: "your-brand.com",
      brandMentioned: "Yes",
      usedTotal: 5,
      avgCitations: 1.8,
      brandsMentioned: ["Your Brand"],
      topics: ["How-To Guides"],
      trend: { direction: "up" as const, percent: 25 },
      competitorMentioned: null
    },
    {
      url: "medium.com/tech/comprehensive-guide",
      domain: "medium.com",
      brandMentioned: "No",
      usedTotal: 4,
      avgCitations: 1.5,
      brandsMentioned: ["Industry Leaders"],
      topics: ["How-To Guides"],
      trend: { direction: "up" as const, percent: 10 },
      competitorMentioned: null
    }
  ],

  racingChartData: {
    timePoints: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
    sources: [
      { domain: "techcrunch.com", type: "Editorial", data: [25, 26, 26, 27, 28, 28, 28], color: "#498cf9" },
      { domain: "your-brand.com", type: "Corporate", data: [18, 19, 20, 21, 22, 22, 22], color: "#06c686" },
      { domain: "competitor.com", type: "Corporate", data: [18, 18, 18, 18, 18, 18, 18], color: "#f9db43" },
      { domain: "wikipedia.org", type: "Reference", data: [15, 15, 15, 15, 15, 15, 15], color: "#fa8a40" },
      { domain: "medium.com", type: "Editorial", data: [10, 10, 11, 11, 12, 12, 12], color: "#498cf9" },
      { domain: "forbes.com", type: "Editorial", data: [8, 8, 9, 9, 10, 10, 10], color: "#498cf9" },
      { domain: "g2.com", type: "Corporate", data: [6, 6, 7, 7, 8, 8, 8], color: "#06b6d4" },
      { domain: "reddit.com", type: "UGC", data: [5, 5, 5, 6, 6, 6, 6], color: "#ac59fb" },
      { domain: "youtube.com", type: "UGC", data: [4, 4, 4, 5, 5, 5, 5], color: "#ac59fb" },
      { domain: "stanford.edu", type: "Institutional", data: [4, 4, 4, 4, 4, 4, 4], color: "#f155a2" }
    ]
  },

  sourceTypeDistribution: [
    { type: "Editorial", count: 45, percentage: 35, trend: { direction: "up" as const, percent: 8 }, color: "#498cf9" },
    { type: "Corporate", count: 36, percentage: 28, trend: { direction: "stable" as const, percent: 2 }, color: "#06b6d4" },
    { type: "Reference", count: 23, percentage: 18, trend: { direction: "stable" as const, percent: 1 }, color: "#fa8a40" },
    { type: "UGC", count: 15, percentage: 12, trend: { direction: "up" as const, percent: 5 }, color: "#ac59fb" },
    { type: "Institutional", count: 7, percentage: 5, trend: { direction: "stable" as const, percent: 0 }, color: "#f155a2" },
    { type: "Other", count: 3, percentage: 2, trend: { direction: "down" as const, percent: -2 }, color: "#c6c9d2" }
  ],

  insights: {
    yourBrandVisibility: {
      domainUsage: 22,
      brandMentioned: 18,
      gap: 4,
      gapInterpretation: "Your domain is trusted by AI, but 4% of responses use your content without explicit credit. Optimize for citation-friendliness."
    },

    partnershipOpportunities: [
      {
        rank: 1,
        source: "forbes.com",
        type: "Editorial",
        usage: 10,
        trend: { direction: "stable" as const, percent: 1 },
        recommendation: "Most influential uncited source - Consider pursuing feature placement"
      },
      {
        rank: 2,
        source: "g2.com",
        type: "Corporate",
        usage: 8,
        trend: { direction: "up" as const, percent: 22 },
        recommendation: "Review aggregator - Growing platform important for Pricing/Comparison topics"
      },
      {
        rank: 3,
        source: "capterra.com",
        type: "Corporate",
        usage: 7,
        trend: { direction: "up" as const, percent: 18 },
        recommendation: "Alternative review platform - Opportunity for review presence"
      }
    ],

    sourceTypeInsight: "AI prioritizes Editorial (35%) + Corporate (28%) + Reference (18%) - totaling 81% of all citations.",

    contentGapsByTopic: [
      {
        topic: "Pricing",
        totalCitations: 42,
        yourDomainPercent: 60,
        alternativeSources: ["g2.com (20%)", "capterra.com (12%)"],
        underrepresentedSources: ["Review sites - major gap"],
        sourceDiversity: 3,
        recommendation: "You lead in Pricing but review platforms are underutilized - get listed on G2/Capterra"
      }
    ]
  },

  lastUpdated: "2024-01-15T10:30:00Z",
  analysisId: "analysis_12345"
};

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendData {
  direction: TrendDirection;
  percent: number;
}

export interface DomainData {
  id: string;
  domain: string;
  type: string;
  typeColor: string;
  isYourDomain: boolean;
  isCompetitor: boolean;
  competitorName: string | null;
  usedPercentage: number;
  avgCitations: number;
  trend: TrendData;
  topTopic: string;
  urlCount: number;
  competitiveComparison: { delta: number; interpretation: string } | null;
}

export interface URLData {
  url: string;
  domain: string;
  brandMentioned: string;
  usedTotal: number;
  avgCitations: number;
  brandsMentioned: string[];
  topics: string[];
  trend: TrendData;
  competitorMentioned: string | null;
}

export type CitationInsightsData = typeof mockCitationSourcesData.insights;
export type SourceTypeDistribution = typeof mockCitationSourcesData.sourceTypeDistribution[0];
