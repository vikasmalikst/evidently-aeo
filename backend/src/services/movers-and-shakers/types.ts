export interface MoverItem {
  domain: string;
  url: string;
  title: string;
  type: 'review' | 'news' | 'social_post' | 'forum_thread' | 'video' | 'other';
  sentiment_score: number; // -1 to 1
  action_required: string;
  owner: string; // Author or poster
  date_published?: string;
  snippet?: string;
}

export interface MoversShakersResult {
  brand: string;
  analyzed_at: string;
  sources_checked: string[];
  items: MoverItem[];
}
