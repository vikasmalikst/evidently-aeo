/**
 * Competitor Management API Service
 * Handles all API calls for managing competitors and versions
 */

import { apiClient } from '../lib/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Backend types (matching backend response)
export interface ManagedCompetitor {
  id?: string;
  name: string;
  url?: string;
  domain?: string;
  relevance?: string;
  industry?: string;
  logo?: string;
  source?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface CompetitorConfiguration {
  id: string;
  brandId: string;
  customerId: string;
  version: number;
  isActive: boolean;
  changeType: string;
  changeSummary: string | null;
  createdAt: string;
  createdBy: string | null;
  metadata: Record<string, unknown>;
}

export interface ManageCompetitorsResponse {
  brandId: string;
  brandName: string;
  currentVersion: number;
  competitors: ManagedCompetitor[];
  summary: {
    totalCompetitors: number;
  };
}

export interface VersionHistoryResponse {
  currentVersion: number;
  versions: Array<{
    id: string;
    version: number;
    isActive: boolean;
    changeType: string;
    changeSummary: string | null;
    createdAt: string;
    createdBy: string | null;
    competitorCount: number;
  }>;
}

/**
 * Get all active competitors for a brand
 */
export async function getActiveCompetitors(
  brandId: string
): Promise<ManageCompetitorsResponse> {
  const response = await apiClient.request<ApiResponse<ManageCompetitorsResponse>>(
    `/brands/${brandId}/competitors`,
    { method: 'GET' },
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch competitors');
  }

  return response.data;
}

/**
 * Add a new competitor
 */
export async function addCompetitor(
  brandId: string,
  competitor: Omit<ManagedCompetitor, 'id'>
): Promise<ManagedCompetitor> {
  const response = await apiClient.request<ApiResponse<ManagedCompetitor>>(
    `/brands/${brandId}/competitors`,
    {
      method: 'POST',
      body: JSON.stringify(competitor),
    },
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to add competitor');
  }

  return response.data;
}

/**
 * Remove a competitor
 */
export async function removeCompetitor(
  brandId: string,
  competitorName: string
): Promise<void> {
  const response = await apiClient.request<ApiResponse<void>>(
    `/brands/${brandId}/competitors/${encodeURIComponent(competitorName)}`,
    { method: 'DELETE' },
    { requiresAuth: true }
  );

  if (!response.success) {
    throw new Error(response.error || 'Failed to remove competitor');
  }
}

/**
 * Update a competitor
 */
export async function updateCompetitor(
  brandId: string,
  competitorName: string,
  updates: Partial<Omit<ManagedCompetitor, 'id' | 'name'>>
): Promise<ManagedCompetitor> {
  const response = await apiClient.request<ApiResponse<ManagedCompetitor>>(
    `/brands/${brandId}/competitors/${encodeURIComponent(competitorName)}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update competitor');
  }

  return response.data;
}

/**
 * Bulk update competitors (for reordering, bulk operations)
 */
export async function bulkUpdateCompetitors(
  brandId: string,
  competitors: ManagedCompetitor[],
  changeSummary?: string
): Promise<ManageCompetitorsResponse> {
  const response = await apiClient.request<ApiResponse<ManageCompetitorsResponse>>(
    `/brands/${brandId}/competitors`,
    {
      method: 'PUT',
      body: JSON.stringify({ competitors, changeSummary }),
    },
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update competitors');
  }

  return response.data;
}

/**
 * Get version history for competitors
 */
export async function getCompetitorVersionHistory(
  brandId: string
): Promise<VersionHistoryResponse> {
  const response = await apiClient.request<ApiResponse<VersionHistoryResponse>>(
    `/brands/${brandId}/competitors/versions`,
    { method: 'GET' },
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch version history');
  }

  return response.data;
}

// Source attribution types (matching backend)
export interface CompetitorSourceData {
  name: string;
  url: string;
  type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
  mentionRate: number;
  mentionChange: number;
  soa: number;
  soaChange: number;
  sentiment: number;
  sentimentChange: number;
  citations: number;
  topics: string[];
  prompts: string[];
  pages: string[];
}

export interface CompetitorSourceAttributionResponse {
  sources: CompetitorSourceData[];
  overallMentionRate: number;
  overallMentionChange: number;
  avgSentiment: number;
  avgSentimentChange: number;
  totalSources: number;
  dateRange: { start: string; end: string };
}

/**
 * Get source attribution data for a competitor
 */
export async function getCompetitorSources(
  brandId: string,
  competitorName: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<CompetitorSourceAttributionResponse> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) {
    params.append('startDate', dateRange.startDate);
  }
  if (dateRange?.endDate) {
    params.append('endDate', dateRange.endDate);
  }

  const queryString = params.toString();
  const url = `/brands/${brandId}/competitors/${encodeURIComponent(competitorName)}/sources${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient.request<ApiResponse<CompetitorSourceAttributionResponse>>(
    url,
    { method: 'GET' },
    { requiresAuth: true }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch competitor sources');
  }

  return response.data;
}

