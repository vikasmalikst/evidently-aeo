/**
 * Prompt Management API Service
 * Handles all API calls for managing prompts and versions
 */

import { apiClient } from '../lib/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Backend types (matching backend response)
interface BackendManagedPrompt {
  id: string;
  queryId: string;
  text: string;
  topic: string;
  response: string | null;
  lastUpdated: string | null;
  createdAt: string;
  sentiment: number | null;
  visibilityScore: number | null;
  volumeCount: number;
  keywords: {
    brand: string[];
    products: string[];
    keywords: string[];
    competitors: string[];
  };
}

interface BackendPromptTopic {
  id: string;
  name: string;
  promptCount: number;
  prompts: BackendManagedPrompt[];
  category?: string | null;
}

interface BackendManagePromptsResponse {
  brandId: string;
  brandName: string;
  currentVersion: number;
  topics: BackendPromptTopic[];
  summary: {
    totalPrompts: number;
    totalTopics: number;
    coverage: number;
    avgVisibility: number | null;
    avgSentiment: number | null;
  };
}

interface BackendVersion {
  id: string;
  version: number;
  isActive: boolean;
  changeType: string;
  changeSummary: string | null;
  createdAt: string;
  createdBy: string | null;
  metrics: {
    totalPrompts: number;
    totalTopics: number;
    coverage: number | null;
    analysesCount: number;
  } | null;
}

interface BackendVersionHistory {
  currentVersion: number;
  versions: BackendVersion[];
}

interface BackendVersionDetails {
  id: string;
  brandId: string;
  customerId: string;
  version: number;
  isActive: boolean;
  changeType: string;
  changeSummary: string | null;
  createdAt: string;
  snapshots: Array<{
    id: string;
    configurationId: string;
    queryId: string;
    topic: string;
    queryText: string;
    isIncluded: boolean;
    sortOrder: number | null;
    createdAt: string;
  }>;
}

interface BackendImpactResponse {
  estimatedImpact: {
    promptCountChange: number;
    topicCountChange: number;
    coverageChange: number;
  };
}

export type {
  BackendManagedPrompt,
  BackendPromptTopic,
  BackendManagePromptsResponse,
  BackendVersion,
  BackendVersionHistory,
  BackendVersionDetails,
  BackendImpactResponse,
};

/**
 * Get managed prompts for a brand
 */
export async function getManagedPrompts(brandId: string): Promise<BackendManagePromptsResponse> {
  try {
    const response = await apiClient.request<ApiResponse<BackendManagePromptsResponse>>(
      `/brands/${brandId}/prompts`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch prompts');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
}

export async function getActivePrompts(brandId: string): Promise<BackendManagePromptsResponse> {
  const response = await apiClient.request<ApiResponse<BackendManagePromptsResponse>>(
    `/brands/${brandId}/prompts/manage`
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch prompts');
  }

  return response.data;
}

/**
 * Add a new prompt
 */
export async function addPrompt(
  brandId: string,
  text: string,
  topic: string,
  metadata?: Record<string, unknown>
): Promise<{ promptId: string }> {
  const response = await apiClient.request<ApiResponse<{ promptId: string }>>(
    `/brands/${brandId}/prompts`,
    {
      method: 'POST',
      body: JSON.stringify({ text, topic, metadata }),
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to add prompt');
  }

  return response.data;
}

/**
 * Get prompt version history
 */
export async function getVersionHistory(brandId: string): Promise<BackendVersionHistory> {
  try {
    const response = await apiClient.request<ApiResponse<BackendVersionHistory>>(
      `/brands/${brandId}/prompts/versions`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch version history');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching version history:', error);
    throw error;
  }
}

/**
 * Get details for a specific version
 */
export async function getVersionDetails(
  brandId: string,
  version: number
): Promise<BackendVersionDetails> {
  try {
    const response = await apiClient.request<ApiResponse<BackendVersionDetails>>(
      `/brands/${brandId}/prompts/versions/${version}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch version details');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching version details:', error);
    throw error;
  }
}

export interface PendingChanges {
  added: Array<{ text: string; topic: string; metadata?: Record<string, any> }>;
  removed: string[]; // IDs of prompts to remove
  edited: Array<{ id: string; text: string; topic: string; metadata?: Record<string, any> }>;
}

/**
 * Update a prompt
 */
export async function updatePrompt(
  brandId: string,
  promptId: string,
  updates: { text?: string; topic?: string; metadata?: Record<string, any> }
): Promise<void> {
  try {
    const response = await apiClient.request<ApiResponse<void>>(
      `/brands/${brandId}/prompts/${promptId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to update prompt');
    }
  } catch (error) {
    console.error('Error updating prompt:', error);
    throw error;
  }
}

/**
 * Delete/archive a prompt
 */
export async function deletePrompt(
  brandId: string,
  promptId: string,
  permanent: boolean = false
): Promise<void> {
  try {
    const response = await apiClient.request<ApiResponse<void>>(
      `/brands/${brandId}/prompts/${promptId}?permanent=${permanent}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete prompt');
    }
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
}

/**
 * Apply batch changes and create a new version
 */
export async function applyBatchChanges(
  brandId: string,
  changes: PendingChanges,
  changeSummary: string
): Promise<{ newVersion: number; configurationId: string }> {
  try {
    const response = await apiClient.request<ApiResponse<{
      newVersion: number;
      configurationId: string;
    }>>(
      `/brands/${brandId}/prompts/batch`,
      {
        method: 'POST',
        body: JSON.stringify({ changes, changeSummary }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to apply changes');
    }

    return response.data;
  } catch (error) {
    console.error('Error applying batch changes:', error);
    throw error;
  }
}

/**
 * Calculate impact of pending changes
 */
export async function calculateImpact(
  brandId: string,
  changes: PendingChanges
): Promise<BackendImpactResponse['estimatedImpact']> {
  try {
    const response = await apiClient.request<ApiResponse<BackendImpactResponse>>(
      `/brands/${brandId}/prompts/calculate-impact`,
      {
        method: 'POST',
        body: JSON.stringify({ changes }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to calculate impact');
    }

    return response.data.estimatedImpact;
  } catch (error) {
    console.error('Error calculating impact:', error);
    throw error;
  }
}

export interface TopicsPromptsConfigV2Row {
  id: string;
  topic: string;
  prompt: string;
  locale: string;
  country: string;
  version?: number;
  queryTag?: string;
}

export interface BrightdataCountry {
  code: string;
  name: string;
}

export async function getBrightdataCountries(): Promise<BrightdataCountry[]> {
  const response = await apiClient.request<ApiResponse<{ countries: BrightdataCountry[] }>>(
    `/brightdata/countries`
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch countries');
  }

  return response.data.countries;
}

export interface ArchivedTopicsPromptsV2 {
  id: string;
  topic_id: string;
  topic_name: string;
  prompts: Array<{
    id: string;
    query_text: string;
    locale: string;
    country: string;
    metadata?: any;
    created_at: string;
  }>;
  version_tag: string;
  brand_id: string;
  created_at: string;
}

export async function getArchivedTopicsPromptsV2(brandId: string): Promise<ArchivedTopicsPromptsV2[]> {
  const response = await apiClient.request<ApiResponse<ArchivedTopicsPromptsV2[]>>(
    `/brands/${brandId}/prompts/config-v2/archived`
  );
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch archived versions');
  }
  return response.data;
}

export async function getTopicsPromptsConfigV2Rows(
  brandId: string
): Promise<TopicsPromptsConfigV2Row[]> {
  const response = await apiClient.request<ApiResponse<{ rows: TopicsPromptsConfigV2Row[] }>>(
    `/brands/${brandId}/prompts/config-v2`
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch config rows');
  }

  return response.data.rows;
}

export async function saveTopicsPromptsConfigV2Rows(
  brandId: string,
  rows: Array<{ id?: string; topic: string; prompt: string; locale: string; country: string }>,
  deleteIds: string[] = []
): Promise<{ created: number; updated: number; topicsCreated: number; topicsReactivated: number }> {
  const response = await apiClient.request<
    ApiResponse<{ created: number; updated: number; topicsCreated: number; topicsReactivated: number }>
  >(`/brands/${brandId}/prompts/config-v2`, {
    method: 'POST',
    body: JSON.stringify({ rows, deleteIds }),
  });

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to save config rows');
  }

  return response.data;
}

/**
 * Revert to a specific version
 */
export async function revertToVersion(
  brandId: string,
  version: number,
  reason?: string
): Promise<{ newVersion: number; configurationId: string; revertedTo: number }> {
  try {
    const response = await apiClient.request<ApiResponse<{
      newVersion: number;
      configurationId: string;
      revertedTo: number;
    }>>(
      `/brands/${brandId}/prompts/versions/${version}/revert`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to revert version');
    }

    return response.data;
  } catch (error) {
    console.error('Error reverting version:', error);
    throw error;
  }
}

/**
 * Compare two versions
 */
export async function compareVersions(
  brandId: string,
  version1: number,
  version2: number
): Promise<{
  version1: number;
  version2: number;
  changes: {
    added: Array<{ id: string; text: string; topic: string }>;
    removed: Array<{ id: string; text: string; topic: string }>;
    edited: Array<{ id: string; oldText: string; newText: string; topic: string }>;
    topicChanges: {
      added: string[];
      removed: string[];
    };
  };
}> {
  try {
    const response = await apiClient.request<ApiResponse<{
      version1: number;
      version2: number;
      changes: {
        added: Array<{ id: string; text: string; topic: string }>;
        removed: Array<{ id: string; text: string; topic: string }>;
        edited: Array<{ id: string; oldText: string; newText: string; topic: string }>;
        topicChanges: {
          added: string[];
          removed: string[];
        };
      };
    }>>(
      `/brands/${brandId}/prompts/versions/compare`,
      {
        method: 'POST',
        body: JSON.stringify({ version1, version2 }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to compare versions');
    }

    return response.data;
  } catch (error) {
    console.error('Error comparing versions:', error);
    throw error;
  }
}

export interface ArchivedTopicPrompt {
  id: string;
  topic_id: string | null;
  topic_name: string;
  prompts: Array<{
    id: string;
    query_text: string;
    locale: string;
    country: string;
    metadata: any;
    created_at: string;
  }>;
  version_tag: string;
  created_at: string;
  brand_id: string;
}

export async function getHistoryV2(brandId: string): Promise<ArchivedTopicPrompt[]> {
  const response = await apiClient.request<ApiResponse<ArchivedTopicPrompt[]>>(
    `/brands/${brandId}/prompts/history-v2`
  );

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch history');
  }

  return response.data || [];
}
