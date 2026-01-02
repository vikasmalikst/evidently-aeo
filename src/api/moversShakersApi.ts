
import { apiClient } from '../lib/apiClient';

export interface MoverItem {
  title: string;
  type: 'review' | 'news' | 'social_post' | 'forum_thread' | 'video' | 'other';
  sentiment_score: number;
  action_required: string;
  owner: string;
  date_published: string;
  snippet: string;
  domain: string;
  url: string;
}

export interface MoversShakersResult {
  brand: string;
  analyzed_at: string;
  sources_checked: string[];
  items: MoverItem[];
}

export const moversShakersApi = {
  getReport: async (brandId: string, hours: number = 48): Promise<MoversShakersResult> => {
    const { data } = await apiClient.get<{ data: MoversShakersResult }>(`/movers-shakers/${brandId}/report`, {
      params: { hours }
    });
    return data.data;
  },

  addCustomSource: async (brandId: string, domain: string): Promise<void> => {
    await apiClient.post(`/movers-shakers/${brandId}/custom-source`, { domain });
  }
};
