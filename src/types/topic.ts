export type TopicSource = 'trending' | 'ai_generated' | 'preset' | 'custom';
export type TopicCategory = 'awareness' | 'comparison' | 'purchase' | 'support';
export type TrendingIndicator = 'rising' | 'stable' | 'declining';

export interface Topic {
  id: string;
  name: string;
  source: TopicSource;
  category?: TopicCategory;
  relevance: number;
  trendingIndicator?: TrendingIndicator;
}

export interface TopicSelectionState {
  availableTopics: {
    trending: Topic[];
    aiGenerated: {
      awareness: Topic[];
      comparison: Topic[];
      purchase: Topic[];
      support: Topic[];
    };
    preset: Topic[];
  };
  selectedTopics: Topic[];
  customTopics: Topic[];
  qualityScore: number;
  isValid: boolean;
}
