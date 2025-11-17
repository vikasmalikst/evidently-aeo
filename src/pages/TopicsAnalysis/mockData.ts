import type { TopicsAnalysisData } from './types';

// Helper function to generate realistic 12-week visibility trend
// Creates a trend that starts lower and trends toward the target SoA value
function generateVisibilityTrend(targetSoA: number, trendDirection: 'up' | 'down' | 'neutral'): number[] {
  const targetValue = targetSoA * 20; // Convert 0-5x scale to 0-100%
  const startValue = targetValue * (trendDirection === 'up' ? 0.5 : trendDirection === 'down' ? 1.2 : 0.8);
  const endValue = targetValue;
  const step = (endValue - startValue) / 11;
  
  // Add some realistic variance
  const variance = targetValue * 0.1;
  
  return Array.from({ length: 12 }, (_, i) => {
    const baseValue = startValue + (step * i);
    const randomVariance = (Math.random() - 0.5) * variance;
    return Math.max(0, Math.min(100, Math.round((baseValue + randomVariance) * 10) / 10));
  });
}

// Mock data matching the specification structure
export const mockTopicsAnalysisData: TopicsAnalysisData = {
  portfolio: {
    totalTopics: 15,
    searchVolume: 137610,
    categories: 6,
    lastUpdated: '2025-11-13T00:00:00Z',
  },
  performance: {
    avgSoA: 2.16,
    maxSoA: 3.5,
    minSoA: 0.9,
    weeklyGainer: {
      topic: 'AI Assistants',
      delta: 0.8,
      category: 'Technology',
    },
  },
  topics: [
    {
      id: 'ai-assistants',
      rank: 1,
      name: 'AI Assistants',
      category: 'Technology',
      soA: 3.5,
      currentSoA: 70, // 3.5 * 20
      visibilityTrend: generateVisibilityTrend(3.5, 'up'),
      trend: { direction: 'up', delta: 0.8 },
      searchVolume: 15420,
      sentiment: 'positive',
      sources: [
        { 
          name: 'your-brand.com', 
          url: 'https://your-brand.com', 
          type: 'brand', 
          citations: 28, 
          mentionRate: 45,
          pages: ['Product Overview', 'Pricing Page', 'Features Comparison', 'Customer Success Stories', 'Integration Documentation']
        },
        { 
          name: 'techcrunch.com', 
          url: 'https://techcrunch.com', 
          type: 'editorial', 
          citations: 15, 
          mentionRate: 32,
          pages: ['AI Assistants Article', 'Technology Review', 'Industry Analysis']
        },
        { 
          name: 'wikipedia.org', 
          url: 'https://wikipedia.org', 
          type: 'reference', 
          citations: 12, 
          mentionRate: 18,
          pages: ['AI Assistants Page', 'Machine Learning Entry', 'Natural Language Processing']
        },
        { 
          name: 'forbes.com', 
          url: 'https://forbes.com', 
          type: 'editorial', 
          citations: 8, 
          mentionRate: 22,
          pages: ['Business Technology Article', 'AI Trends Report']
        },
      ],
    },
    {
      id: 'large-language-models',
      rank: 2,
      name: 'Large Language Models',
      category: 'Technology',
      soA: 3.2,
      currentSoA: 64, // 3.2 * 20
      visibilityTrend: generateVisibilityTrend(3.2, 'up'),
      trend: { direction: 'up', delta: 0.5 },
      searchVolume: 12350,
      sentiment: 'positive',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 24, mentionRate: 38 },
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 18, mentionRate: 25 },
        { name: 'arstechnica.com', url: 'https://arstechnica.com', type: 'editorial', citations: 10, mentionRate: 28 },
        { name: 'microsoft.com', url: 'https://microsoft.com', type: 'corporate', citations: 7, mentionRate: 15 },
      ],
    },
    {
      id: 'ai-search',
      rank: 3,
      name: 'AI Search',
      category: 'Search',
      soA: 2.8,
      currentSoA: 56, // 2.8 * 20
      visibilityTrend: generateVisibilityTrend(2.8, 'up'),
      trend: { direction: 'up', delta: 0.3 },
      searchVolume: 10890,
      sentiment: 'positive',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 20, mentionRate: 35 },
        { name: 'theverge.com', url: 'https://theverge.com', type: 'editorial', citations: 12, mentionRate: 30 },
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 9, mentionRate: 20 },
      ],
    },
    {
      id: 'search-results',
      rank: 4,
      name: 'Search Results',
      category: 'Search',
      soA: 2.5,
      currentSoA: 50, // 2.5 * 20
      visibilityTrend: generateVisibilityTrend(2.5, 'neutral'),
      trend: { direction: 'neutral', delta: 0 },
      searchVolume: 9870,
      sentiment: 'neutral',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 15, mentionRate: 22 },
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 18, mentionRate: 28 },
        { name: 'reddit.com', url: 'https://reddit.com', type: 'ugc', citations: 6, mentionRate: 12 },
      ],
    },
    {
      id: 'machine-learning',
      rank: 5,
      name: 'Machine Learning',
      category: 'Technology',
      soA: 2.3,
      currentSoA: 46, // 2.3 * 20
      visibilityTrend: generateVisibilityTrend(2.3, 'up'),
      trend: { direction: 'up', delta: 0.2 },
      searchVolume: 15230,
      sentiment: 'positive',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 22, mentionRate: 30 },
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 16, mentionRate: 25 },
        { name: 'coursera.org', url: 'https://coursera.org', type: 'institutional', citations: 8, mentionRate: 18 },
        { name: 'github.com', url: 'https://github.com', type: 'ugc', citations: 5, mentionRate: 10 },
      ],
    },
    {
      id: 'natural-language-processing',
      rank: 6,
      name: 'Natural Language Processing',
      category: 'Technology',
      soA: 2.1,
      currentSoA: 42, // 2.1 * 20
      visibilityTrend: generateVisibilityTrend(2.1, 'down'),
      trend: { direction: 'down', delta: -0.1 },
      searchVolume: 11200,
      sentiment: 'neutral',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 18, mentionRate: 28 },
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 14, mentionRate: 22 },
        { name: 'stanford.edu', url: 'https://stanford.edu', type: 'institutional', citations: 7, mentionRate: 15 },
      ],
    },
    {
      id: 'ai-applications',
      rank: 7,
      name: 'AI Applications',
      category: 'Business',
      soA: 1.9,
      currentSoA: 38, // 1.9 * 20
      visibilityTrend: generateVisibilityTrend(1.9, 'up'),
      trend: { direction: 'up', delta: 0.4 },
      searchVolume: 8750,
      sentiment: 'positive',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 12, mentionRate: 20 },
        { name: 'forbes.com', url: 'https://forbes.com', type: 'editorial', citations: 8, mentionRate: 18 },
        { name: 'microsoft.com', url: 'https://microsoft.com', type: 'corporate', citations: 6, mentionRate: 12 },
      ],
    },
    {
      id: 'ai-tools',
      rank: 8,
      name: 'AI Tools',
      category: 'Business',
      soA: 1.7,
      currentSoA: 34, // 1.7 * 20
      visibilityTrend: generateVisibilityTrend(1.7, 'neutral'),
      trend: { direction: 'neutral', delta: 0 },
      searchVolume: 9200,
      sentiment: 'neutral',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 10, mentionRate: 18 },
        { name: 'techcrunch.com', url: 'https://techcrunch.com', type: 'editorial', citations: 7, mentionRate: 15 },
        { name: 'reddit.com', url: 'https://reddit.com', type: 'ugc', citations: 4, mentionRate: 8 },
      ],
    },
    {
      id: 'ai-strategy',
      rank: 9,
      name: 'AI Strategy',
      category: 'Business',
      soA: 1.5,
      currentSoA: 30, // 1.5 * 20
      visibilityTrend: generateVisibilityTrend(1.5, 'up'),
      trend: { direction: 'up', delta: 0.2 },
      searchVolume: 6800,
      sentiment: 'positive',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 8, mentionRate: 15 },
        { name: 'mckinsey.com', url: 'https://mckinsey.com', type: 'corporate', citations: 5, mentionRate: 12 },
        { name: 'hbr.org', url: 'https://hbr.org', type: 'editorial', citations: 4, mentionRate: 10 },
      ],
    },
    {
      id: 'ai-marketing',
      rank: 10,
      name: 'AI Marketing',
      category: 'Marketing',
      soA: 1.3,
      currentSoA: 26, // 1.3 * 20
      visibilityTrend: generateVisibilityTrend(1.3, 'up'),
      trend: { direction: 'up', delta: 0.3 },
      searchVolume: 7500,
      sentiment: 'positive',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 7, mentionRate: 12 },
        { name: 'marketingland.com', url: 'https://marketingland.com', type: 'editorial', citations: 5, mentionRate: 10 },
      ],
    },
    {
      id: 'ai-automation',
      rank: 11,
      name: 'AI Automation',
      category: 'Business',
      soA: 1.1,
      currentSoA: 22, // 1.1 * 20
      visibilityTrend: generateVisibilityTrend(1.1, 'down'),
      trend: { direction: 'down', delta: -0.2 },
      searchVolume: 6200,
      sentiment: 'neutral',
      sources: [
        { name: 'your-brand.com', url: 'https://your-brand.com', type: 'brand', citations: 6, mentionRate: 10 },
        { name: 'gartner.com', url: 'https://gartner.com', type: 'institutional', citations: 4, mentionRate: 8 },
      ],
    },
    {
      id: 'ai-ethics',
      rank: 12,
      name: 'AI Ethics',
      category: 'Technology',
      soA: 0.95,
      currentSoA: 19, // 0.95 * 20
      visibilityTrend: generateVisibilityTrend(0.95, 'down'),
      trend: { direction: 'down', delta: -0.1 },
      searchVolume: 4800,
      sentiment: 'negative',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 8, mentionRate: 15 },
        { name: 'theguardian.com', url: 'https://theguardian.com', type: 'editorial', citations: 5, mentionRate: 10 },
      ],
    },
    {
      id: 'ai-governance',
      rank: 13,
      name: 'AI Governance',
      category: 'Business',
      soA: 0.85,
      currentSoA: 17, // 0.85 * 20
      visibilityTrend: generateVisibilityTrend(0.85, 'neutral'),
      trend: { direction: 'neutral', delta: 0 },
      searchVolume: null, // Missing data
      sentiment: 'neutral',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 6, mentionRate: 12 },
        { name: 'oecd.org', url: 'https://oecd.org', type: 'institutional', citations: 4, mentionRate: 8 },
      ],
    },
    {
      id: 'ai-regulation',
      rank: 14,
      name: 'AI Regulation',
      category: 'Business',
      soA: 0.75,
      currentSoA: 15, // 0.75 * 20
      visibilityTrend: generateVisibilityTrend(0.75, 'down'),
      trend: { direction: 'down', delta: -0.3 },
      searchVolume: 3500,
      sentiment: 'negative',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 5, mentionRate: 10 },
        { name: 'reuters.com', url: 'https://reuters.com', type: 'editorial', citations: 3, mentionRate: 6 },
      ],
    },
    {
      id: 'ai-future',
      rank: 15,
      name: 'AI Future',
      category: 'Technology',
      soA: 0.65,
      currentSoA: 13, // 0.65 * 20
      visibilityTrend: generateVisibilityTrend(0.65, 'up'),
      trend: { direction: 'up', delta: 0.1 },
      searchVolume: 2800,
      sentiment: 'neutral',
      sources: [
        { name: 'wikipedia.org', url: 'https://wikipedia.org', type: 'reference', citations: 4, mentionRate: 8 },
        { name: 'wired.com', url: 'https://wired.com', type: 'editorial', citations: 2, mentionRate: 5 },
      ],
    },
  ],
  categories: [
    {
      id: 'technology',
      name: 'Technology',
      topicCount: 6,
      avgSoA: 2.75,
      trend: { direction: 'up', delta: 0.8 },
      status: 'leader',
    },
    {
      id: 'search',
      name: 'Search',
      topicCount: 2,
      avgSoA: 2.65,
      trend: { direction: 'up', delta: 0.3 },
      status: 'growing',
    },
    {
      id: 'business',
      name: 'Business',
      topicCount: 5,
      avgSoA: 1.35,
      trend: { direction: 'up', delta: 0.2 },
      status: 'emerging',
    },
    {
      id: 'marketing',
      name: 'Marketing',
      topicCount: 1,
      avgSoA: 1.3,
      trend: { direction: 'up', delta: 0.3 },
      status: 'growing',
    },
    {
      id: 'legal',
      name: 'Legal',
      topicCount: 1,
      avgSoA: 0.75,
      trend: { direction: 'down', delta: -0.3 },
      status: 'declining',
    },
  ],
};

