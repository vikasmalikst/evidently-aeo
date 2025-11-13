import { Topic } from '../../types/topic';

export type ChangeType = 'initial_setup' | 'topic_added' | 'topic_removed' | 'full_refresh';

export interface TopicConfiguration {
  id: string;
  brand_id: string;
  version: number;
  is_active: boolean;
  change_type: ChangeType;
  change_summary: string;
  topics: Topic[];
  created_at: string;
  analysis_count: number;
}

export interface TopicChangeImpact {
  added: Topic[];
  removed: Topic[];
  newPromptCount: number;
  isSignificant: boolean;
}

