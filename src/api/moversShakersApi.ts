
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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const moversShakersApi = {
  getReport: async (brandId: string, hours: number = 48): Promise<MoversShakersResult> => {
    const params = new URLSearchParams({ hours: String(hours) });
    const endpoint = `/movers-shakers/${brandId}/report?${params.toString()}`;
    const response = await apiClient.request<ApiResponse<MoversShakersResult>>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || 'Failed to fetch Movers & Shakers report');
    }

    return response.data;
  },

  addCustomSource: async (brandId: string, domain: string): Promise<void> => {
    await apiClient.post(`/movers-shakers/${brandId}/custom-source`, { domain });
  }
};
