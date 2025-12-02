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
    coverage: {
      current: number;
      projected: number | null;
      change: number | null;
      changePercent: number | null;
    };
    visibilityScore: {
      current: number | null;
      projected: number | null;
      change: number | null;
      changePercent: number | null;
    };
    topicCoverage: {
      increased: string[];
      decreased: string[];
      unchanged: string[];
    };
    affectedAnalyses: number;
    warnings: string[];
  };
  calculatedAt: string;
}

interface PendingChanges {
  added: Array<{ text: string; topic: string }>;
  removed: Array<{ id: string; text?: string }>;
  edited: Array<{ id: string; oldText?: string; newText: string }>;
}

// Frontend types (matching existing UI)
export interface Prompt {
  id: number;
  text: string;
  response: string;
  lastUpdated: string;
  sentiment: number;
  volume: number;
  keywords: {
    brand: string[];
    target: string[];
    top: string[];
  };
  // Additional fields from backend
  queryId?: string;
  visibilityScore?: number | null;
  createdAt?: string;
  source?: 'custom' | 'generated';
}

export interface Topic {
  id: number;
  name: string;
  prompts: Prompt[];
  category?: string | null;
}

export interface PromptConfiguration {
  id: string;
  version: number;
  is_active: boolean;
  change_type: string;
  change_summary: string;
  topics: Topic[];
  created_at: string;
  analysis_count: number;
}

/**
 * Transform backend prompt to frontend format
 */
function transformPrompt(backend: BackendManagedPrompt, topicName: string): Prompt {
  return {
    id: parseInt(backend.id.split('-')[0] || '0', 16) % 1000000, // Convert UUID to number for compatibility
    text: backend.text,
    response: backend.response || '',
    lastUpdated: backend.lastUpdated || backend.createdAt.split('T')[0],
    sentiment: backend.sentiment ?? 0,
    volume: backend.volumeCount,
    keywords: {
      brand: backend.keywords.brand || [],
      target: backend.keywords.products || [],
      top: backend.keywords.keywords || [],
    },
    queryId: backend.queryId,
    visibilityScore: backend.visibilityScore,
    createdAt: backend.createdAt,
    source: 'generated',
  };
}

/**
 * Transform backend topic to frontend format
 */
function transformTopic(backend: BackendPromptTopic): Topic {
  // Convert topic ID from string to number
  const topicId = parseInt(backend.id.split('-')[0] || '0', 16) % 1000000;
  
  return {
    id: topicId,
    name: backend.name,
    prompts: backend.prompts.map(p => transformPrompt(p, backend.name)),
    category: backend.category ?? null,
  };
}

/**
 * Transform backend version to frontend format
 */
function transformVersion(backend: BackendVersion, topics: Topic[]): PromptConfiguration {
  return {
    id: backend.id,
    version: backend.version,
    is_active: backend.isActive,
    change_type: backend.changeType,
    change_summary: backend.changeSummary || 'No summary',
    topics: topics, // Will be populated from version details if needed
    created_at: backend.createdAt,
    analysis_count: backend.metrics?.analysesCount || 0,
  };
}

/**
 * Get active prompts for management UI
 */
export async function getActivePrompts(brandId: string): Promise<{
  brandId: string;
  brandName: string;
  currentVersion: number;
  topics: Topic[];
  summary: {
    totalPrompts: number;
    totalTopics: number;
    coverage: number;
    avgVisibility: number | null;
    avgSentiment: number | null;
  };
}> {
  try {
    const response = await apiClient.request<ApiResponse<BackendManagePromptsResponse>>(
      `/brands/${brandId}/prompts/manage`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch prompts');
    }

    const backend = response.data;

    return {
      brandId: backend.brandId,
      brandName: backend.brandName,
      currentVersion: backend.currentVersion,
      topics: backend.topics.map(transformTopic),
      summary: backend.summary,
    };
  } catch (error) {
    console.error('Error fetching active prompts:', error);
    throw error;
  }
}

/**
 * Get version history
 */
export async function getVersionHistory(brandId: string): Promise<{
  currentVersion: number;
  versions: PromptConfiguration[];
}> {
  try {
    const response = await apiClient.request<ApiResponse<BackendVersionHistory>>(
      `/brands/${brandId}/prompts/versions`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch version history');
    }

    const backend = response.data;

    // For now, return versions without topics (will be loaded on demand)
    const versions: PromptConfiguration[] = backend.versions.map(v => ({
      id: v.id,
      version: v.version,
      is_active: v.isActive,
      change_type: v.changeType,
      change_summary: v.changeSummary || 'No summary',
      topics: [], // Will be loaded separately if needed
      created_at: v.createdAt,
      analysis_count: v.metrics?.analysesCount || 0,
    }));

    return {
      currentVersion: backend.currentVersion,
      versions,
    };
  } catch (error) {
    console.error('Error fetching version history:', error);
    throw error;
  }
}

/**
 * Get specific version details with snapshots
 */
export async function getVersionDetails(
  brandId: string,
  version: number
): Promise<PromptConfiguration> {
  try {
    const response = await apiClient.request<ApiResponse<BackendVersionDetails>>(
      `/brands/${brandId}/prompts/versions/${version}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch version details');
    }

    const backend = response.data;

    // Group snapshots by topic
    const topicMap = new Map<string, Prompt[]>();
    backend.snapshots.forEach(snapshot => {
      if (!snapshot.isIncluded) return;

      if (!topicMap.has(snapshot.topic)) {
        topicMap.set(snapshot.topic, []);
      }

      const prompt: Prompt = {
        id: parseInt(snapshot.queryId.split('-')[0] || '0', 16) % 1000000,
        text: snapshot.queryText,
        response: '',
        lastUpdated: snapshot.createdAt.split('T')[0],
        sentiment: 0,
        volume: 0,
        keywords: {
          brand: [],
          target: [],
          top: [],
        },
        queryId: snapshot.queryId,
        createdAt: snapshot.createdAt,
        source: 'generated',
      };

      topicMap.get(snapshot.topic)!.push(prompt);
    });

    // Convert to Topic array
    const topics: Topic[] = Array.from(topicMap.entries()).map(([name, prompts], index) => ({
      id: index + 1,
      name,
      prompts,
    }));

    return {
      id: backend.id,
      version: backend.version,
      is_active: backend.isActive,
      change_type: backend.changeType,
      change_summary: backend.changeSummary || 'No summary',
      topics,
      created_at: backend.createdAt,
      analysis_count: 0,
    };
  } catch (error) {
    console.error('Error fetching version details:', error);
    throw error;
  }
}

/**
 * Add a new prompt
 */
export async function addPrompt(
  brandId: string,
  text: string,
  topic: string
): Promise<{ promptId: string }> {
  try {
    const response = await apiClient.request<ApiResponse<{ promptId: string }>>(
      `/brands/${brandId}/prompts`,
      {
        method: 'POST',
        body: JSON.stringify({ text, topic }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to add prompt');
    }

    return response.data;
  } catch (error) {
    console.error('Error adding prompt:', error);
    throw error;
  }
}

/**
 * Update an existing prompt
 */
export async function updatePrompt(
  brandId: string,
  promptId: string,
  text: string
): Promise<void> {
  try {
    const response = await apiClient.request<ApiResponse<void>>(
      `/brands/${brandId}/prompts/${promptId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ text }),
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
  metricsComparison: {
    prompts: { v1: number; v2: number; diff: number };
    topics: { v1: number; v2: number; diff: number };
    coverage: { v1: number; v2: number; diff: number };
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
      metricsComparison: {
        prompts: { v1: number; v2: number; diff: number };
        topics: { v1: number; v2: number; diff: number };
        coverage: { v1: number; v2: number; diff: number };
      };
    }>>(
      `/brands/${brandId}/prompts/versions/compare?version1=${version1}&version2=${version2}`
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

