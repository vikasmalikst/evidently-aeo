export const mockSourcesData = {
  sources: [
    {
      id: "chatgpt",
      name: "ChatGPT",
      color: "#06b6d4",
      mentionCount: 45,
      mentionRate: 0.85,
      avgPosition: 1.8,
      trendDirection: "up" as const,
      trendPercent: 12,
      toneBreakdown: {
        positive: 35,
        neutral: 8,
        negative: 2
      },
      competitorComparison: {
        rival1: { name: "Competitor A", mentions: 32, avgPosition: 2.1 },
        rival2: { name: "Competitor B", mentions: 28, avgPosition: 2.4 },
        rival3: { name: "Competitor C", mentions: 25, avgPosition: 2.7 }
      },
      topicPerformance: [
        { topic: "Product Features", rate: 0.92 },
        { topic: "Industry Trends", rate: 0.78 },
        { topic: "Pricing", rate: 0.65 }
      ]
    },
    {
      id: "claude",
      name: "Claude",
      color: "#498cf9",
      mentionCount: 38,
      mentionRate: 0.76,
      avgPosition: 2.1,
      trendDirection: "up" as const,
      trendPercent: 8,
      toneBreakdown: { positive: 32, neutral: 5, negative: 1 },
      competitorComparison: {
        rival1: { name: "Competitor A", mentions: 29, avgPosition: 2.3 },
        rival2: { name: "Competitor B", mentions: 26, avgPosition: 2.6 },
        rival3: { name: "Competitor C", mentions: 22, avgPosition: 2.9 }
      },
      topicPerformance: [
        { topic: "Product Features", rate: 0.88 },
        { topic: "Industry Trends", rate: 0.72 },
        { topic: "Pricing", rate: 0.61 }
      ]
    },
    {
      id: "gemini",
      name: "Gemini",
      color: "#ac59fb",
      mentionCount: 42,
      mentionRate: 0.84,
      avgPosition: 2.3,
      trendDirection: "down" as const,
      trendPercent: -5,
      toneBreakdown: { positive: 33, neutral: 7, negative: 2 },
      competitorComparison: {
        rival1: { name: "Competitor A", mentions: 35, avgPosition: 2.2 },
        rival2: { name: "Competitor B", mentions: 31, avgPosition: 2.5 },
        rival3: { name: "Competitor C", mentions: 28, avgPosition: 2.8 }
      },
      topicPerformance: [
        { topic: "Product Features", rate: 0.90 },
        { topic: "Industry Trends", rate: 0.75 },
        { topic: "Pricing", rate: 0.63 }
      ]
    },
    {
      id: "perplexity",
      name: "Perplexity",
      color: "#fa8a40",
      mentionCount: 35,
      mentionRate: 0.70,
      avgPosition: 2.9,
      trendDirection: "down" as const,
      trendPercent: -8,
      toneBreakdown: { positive: 28, neutral: 6, negative: 1 },
      competitorComparison: {
        rival1: { name: "Competitor A", mentions: 38, avgPosition: 2.0 },
        rival2: { name: "Competitor B", mentions: 34, avgPosition: 2.3 },
        rival3: { name: "Competitor C", mentions: 31, avgPosition: 2.6 }
      },
      topicPerformance: [
        { topic: "Product Features", rate: 0.82 },
        { topic: "Industry Trends", rate: 0.68 },
        { topic: "Pricing", rate: 0.55 }
      ]
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      color: "#f155a2",
      mentionCount: 40,
      mentionRate: 0.80,
      avgPosition: 2.2,
      trendDirection: "up" as const,
      trendPercent: 15,
      toneBreakdown: { positive: 34, neutral: 5, negative: 1 },
      competitorComparison: {
        rival1: { name: "Competitor A", mentions: 33, avgPosition: 2.4 },
        rival2: { name: "Competitor B", mentions: 29, avgPosition: 2.7 },
        rival3: { name: "Competitor C", mentions: 26, avgPosition: 3.0 }
      },
      topicPerformance: [
        { topic: "Product Features", rate: 0.89 },
        { topic: "Industry Trends", rate: 0.76 },
        { topic: "Pricing", rate: 0.64 }
      ]
    }
  ],
  insights: {
    bestSource: "ChatGPT",
    worstSource: "Perplexity",
    trendAnalysis: "Your brand shows strong visibility across most sources, with ChatGPT leading at 85% mention rate. However, Perplexity shows declining trends (-8% month-over-month) and warrants immediate attention. Claude and DeepSeek are emerging as growth opportunities.",
    recommendations: [
      "Increase citation structure optimization for Perplexity-specific algorithms",
      "Expand high-performing product feature content to maintain ChatGPT leadership",
      "Develop fact-based content with clear sourcing for Claude and DeepSeek",
      "Consider topic-specific strategies for Perplexity's declining segments"
    ],
    warnings: [
      {
        level: "warning",
        source: "Perplexity",
        message: "Mention rate declining. Current: 70% (-8% trend). Competitive advantage slipping."
      }
    ]
  },
  lastUpdated: "2024-01-15T10:30:00Z",
  analysisId: "analysis_12345"
};

export type SourceData = typeof mockSourcesData.sources[0];
export type InsightsData = typeof mockSourcesData.insights;
