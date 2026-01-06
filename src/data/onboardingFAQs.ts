export interface FAQItem {
  id: string;
  category: 'getting-started' | 'onboarding' | 'data-collection' | 'metrics' | 'troubleshooting';
  question: string;
  answer: string;
  priority: number; // 1-5, higher = shown first
  keywords: string[]; // For search/filtering
}

export const ONBOARDING_FAQS: FAQItem[] = [
  {
    id: 'faq-onboarding-duration',
    category: 'onboarding',
    question: 'How long does onboarding take?',
    answer: 'The initial onboarding typically takes 5-10 minutes. After you complete the setup:<ul class="list-disc list-inside mt-2 space-y-1"><li>Query generation happens automatically (usually within minutes)</li><li>Data collection begins immediately and runs in the background</li><li>Initial scoring and analytics are typically available within 1-2 hours</li></ul>You\'ll receive a notification when your dashboard is ready with initial data.',
    priority: 5,
    keywords: ['onboarding', 'duration', 'time', 'setup', 'how long']
  },
  {
    id: 'faq-visibility-index',
    category: 'metrics',
    question: 'What is Visibility Index?',
    answer: '<strong>Visibility Index</strong> measures how prominently your brand appears in AI answer engine responses. It\'s calculated based on:<ul class="list-disc list-inside mt-2 space-y-1"><li>How often your brand is mentioned</li><li>The position of mentions in responses</li><li>The context and prominence of mentions</li></ul>A higher visibility index means your brand appears more frequently and prominently in AI responses.',
    priority: 5,
    keywords: ['visibility', 'index', 'metric', 'measurement', 'score']
  },
  {
    id: 'faq-share-of-answer',
    category: 'metrics',
    question: 'What is Share of Answer (SOA)?',
    answer: '<strong>Share of Answer (SOA)</strong> represents the percentage of total mentions in AI responses that belong to your brand versus competitors. For example:<ul class="list-disc list-inside mt-2 space-y-1"><li>If there are 10 total brand mentions in responses and 6 are yours, your SOA is 60%</li><li>Higher SOA indicates stronger brand dominance in AI responses</li></ul>',
    priority: 5,
    keywords: ['share of answer', 'soa', 'percentage', 'mentions', 'competitors']
  },
  {
    id: 'faq-sentiment-score',
    category: 'metrics',
    question: 'What is Sentiment Score?',
    answer: '<strong>Sentiment Score</strong> analyzes the tone and sentiment of how your brand is mentioned in AI responses:<ul class="list-disc list-inside mt-2 space-y-1"><li><strong>Positive</strong>: Favorable mentions, positive associations</li><li><strong>Neutral</strong>: Factual, informational mentions</li><li><strong>Negative</strong>: Critical or unfavorable mentions</li></ul>The score ranges from -100 (very negative) to +100 (very positive).',
    priority: 4,
    keywords: ['sentiment', 'score', 'tone', 'positive', 'negative', 'neutral']
  },
  {
    id: 'faq-data-collection-duration',
    category: 'data-collection',
    question: 'How long does data collection take?',
    answer: 'Data collection time varies based on:<ul class="list-disc list-inside mt-2 space-y-1"><li>Number of queries (typically 20-50 per brand)</li><li>Number of AI models selected (each query runs across all models)</li><li>API response times</li></ul>Typically:<ul class="list-disc list-inside mt-2 space-y-1"><li><strong>Small setup</strong> (20 queries, 3 models): ~2 minutes</li><li><strong>Medium setup</strong> (50 queries, 5 models): ~5 minutes</li><li><strong>Large setup</strong> (100+ queries, 6 models): ~10 minutes</li></ul>You can monitor progress using the notification bell icon in the header.',
    priority: 4,
    keywords: ['data collection', 'duration', 'time', 'queries', 'processing']
  },
  {
    id: 'faq-what-happens-next',
    category: 'onboarding',
    question: 'What happens after data collection completes?',
    answer: 'Once data collection and scoring are complete:<ul class="list-disc list-inside mt-2 space-y-1"><li>Your dashboard will automatically update with all metrics and insights</li><li>You\'ll see your Visibility Index, Share of Answer, and Sentiment Score</li><li>AI-powered recommendations will be generated to help improve your visibility</li><li>You can start exploring topics, sources, and competitor comparisons</li></ul>You\'ll be automatically redirected to your dashboard when everything is ready!',
    priority: 4,
    keywords: ['after', 'complete', 'next', 'dashboard', 'ready']
  },
  {
    id: 'faq-modify-topics',
    category: 'onboarding',
    question: 'Can I modify my topics after onboarding?',
    answer: 'Yes! You can manage topics at any time through:<ul class="list-disc list-inside mt-2 space-y-1"><li><strong>Brand Settings</strong> → <strong>Topic Management</strong> → Add, edit, or remove topics</li><li><strong>Topics Page</strong> → View and manage all your topics in one place</li></ul>Changes will trigger new data collection for the updated topics. You can also regenerate queries for existing topics or add custom queries.',
    priority: 3,
    keywords: ['topics', 'modify', 'edit', 'change', 'update', 'manage']
  },
  {
    id: 'faq-missing-data',
    category: 'troubleshooting',
    question: 'Why do I see zeros or missing data?',
    answer: 'Missing data can occur for several reasons:<ul class="list-disc list-inside mt-2 space-y-1"><li><strong>Data Collection Still Running</strong>: If you just completed onboarding, data collection may still be in progress. Check the notification bell for progress updates.</li><li><strong>No Results Found</strong>: Some queries may not return results mentioning your brand. This is normal - not every query will have brand mentions.</li><li><strong>Scoring Pending</strong>: Data may be collected but not yet scored. Scoring typically completes within 1-2 hours of collection.</li><li><strong>Inactive Queries</strong>: Ensure your queries are marked as active in Brand Settings.</li></ul>If data is missing for more than 24 hours after setup, contact support.',
    priority: 3,
    keywords: ['missing data', 'zeros', 'no data', 'troubleshooting', 'empty']
  },
  {
    id: 'faq-custom-queries',
    category: 'onboarding',
    question: 'Can I add custom queries?',
    answer: 'Yes! You can add custom queries through:<ul class="list-disc list-inside mt-2 space-y-1"><li><strong>Brand Settings</strong> → <strong>Topic Management</strong> → Add queries to existing topics</li><li><strong>Prompts Page</strong> → Create new queries manually</li></ul>Custom queries are immediately added to the collection queue and will be executed across all selected AI models.',
    priority: 3,
    keywords: ['custom queries', 'add queries', 'edit queries', 'queries', 'topics']
  },
  {
    id: 'faq-dashboard-interpretation',
    category: 'getting-started',
    question: 'How do I interpret my dashboard?',
    answer: 'Your dashboard shows key metrics at a glance:<ul class="list-disc list-inside mt-2 space-y-1"><li><strong>Visibility Index</strong>: How prominently your brand appears (higher is better)</li><li><strong>Share of Answer</strong>: Your percentage of mentions vs competitors (aim for higher)</li><li><strong>Sentiment Score</strong>: How positively your brand is mentioned (-100 to +100)</li></ul>Use the time range selector to view trends over time. Click on any metric to dive deeper into detailed analysis and see which topics and sources drive your visibility.',
    priority: 3,
    keywords: ['dashboard', 'interpret', 'understand', 'metrics', 'analysis']
  }
];

