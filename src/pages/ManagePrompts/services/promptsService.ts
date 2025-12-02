/**
 * Prompts Management Service
 * Handles all prompt-related operations and state management
 */

import type { Prompt, Topic, PromptConfiguration } from '../../../api/promptManagementApi';
import { getActivePrompts, getVersionHistory, getVersionDetails } from '../../../api/promptManagementApi';

export interface PromptsState {
  topics: Topic[];
  selectedPrompt: Prompt | null;
  configHistory: PromptConfiguration[];
  currentConfigVersion: number;
  summaryStats: {
    totalPrompts: number;
    totalTopics: number;
    coverage: number;
    avgVisibility: number;
    avgSentiment: number;
  };
  isLoading: boolean;
  error: string | null;
}

export interface PromptsService {
  fetchPromptsData: (brandId: string) => Promise<void>;
  updatePrompt: (prompt: Prompt, newText: string) => void;
  deletePrompt: (prompt: Prompt) => void;
  addPrompt: (topicId: number, prompt: Prompt) => void;
  selectPrompt: (prompt: Prompt) => void;
  getState: () => PromptsState;
  setState: (updater: (prev: PromptsState) => PromptsState) => void;
}

export const createPromptsService = (
  initialState: PromptsState,
  stateSetter: (updater: (prev: PromptsState) => PromptsState) => void
): PromptsService => {
  const fetchPromptsData = async (brandId: string): Promise<void> => {
    stateSetter(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('🔄 Fetching prompts data for brand:', brandId);
      
      // Fetch active prompts and version history in parallel
      const [promptsData, historyData] = await Promise.all([
        getActivePrompts(brandId),
        getVersionHistory(brandId),
      ]);
      
      console.log('✅ Received prompts data:', {
        topicsCount: promptsData.topics?.length || 0,
        topics: promptsData.topics,
        currentVersion: promptsData.currentVersion,
        summary: promptsData.summary
      });
      
      // Deduplicate topics by name to prevent duplicates
      const uniqueTopics = deduplicateTopics(promptsData.topics || []);
      
      stateSetter(prev => ({
        ...prev,
        topics: uniqueTopics,
        currentConfigVersion: historyData.currentVersion,
        configHistory: historyData.versions || [],
        summaryStats: {
          totalPrompts: promptsData.summary.totalPrompts,
          totalTopics: uniqueTopics.length,
          coverage: promptsData.summary.coverage,
          avgVisibility: promptsData.summary.avgVisibility || 0,
          avgSentiment: promptsData.summary.avgSentiment || 0,
        },
        isLoading: false,
      }));
    } catch (err) {
      console.error('❌ Error fetching prompts data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load prompts';
      stateSetter(prev => ({
        ...prev,
        error: errorMessage,
        topics: [],
        configHistory: [],
        isLoading: false,
      }));
      throw err;
    }
  };

  const updatePrompt = (prompt: Prompt, newText: string): void => {
    stateSetter(prev => ({
      ...prev,
      topics: prev.topics.map(topic => ({
        ...topic,
        prompts: topic.prompts.map(p => 
          p.id === prompt.id ? { ...p, text: newText } : p
        )
      })),
      selectedPrompt: prev.selectedPrompt?.id === prompt.id
        ? { ...prev.selectedPrompt, text: newText }
        : prev.selectedPrompt,
    }));
  };

  const deletePrompt = (prompt: Prompt): void => {
    stateSetter(prev => {
      const updatedTopics = prev.topics
        .map(topic => ({
          ...topic,
          prompts: topic.prompts.filter(p => p.id !== prompt.id)
        }))
        .filter(topic => topic.prompts.length > 0); // Remove topics with no prompts

      return {
        ...prev,
        topics: updatedTopics,
        selectedPrompt: prev.selectedPrompt?.id === prompt.id
          ? null
          : prev.selectedPrompt,
      };
    });
  };

  const addPrompt = (topicId: number, prompt: Prompt): void => {
    stateSetter(prev => ({
      ...prev,
      topics: prev.topics.map(t =>
        t.id === topicId
          ? { ...t, prompts: [...t.prompts, prompt] }
          : t
      ),
    }));
  };

  const selectPrompt = (prompt: Prompt): void => {
    stateSetter(prev => ({
      ...prev,
      selectedPrompt: prompt,
    }));
  };

  return {
    fetchPromptsData,
    updatePrompt,
    deletePrompt,
    addPrompt,
    selectPrompt,
    getState: () => initialState,
    setState: stateSetter,
  };
};

/**
 * Deduplicate topics by name to prevent duplicates
 */
function deduplicateTopics(topics: Topic[]): Topic[] {
  const topicMap = new Map<string, Topic>();
  
  for (const topic of topics) {
    const key = topic.name.toLowerCase().trim();
    
    if (!topicMap.has(key)) {
      topicMap.set(key, topic);
    } else {
      // Merge prompts from duplicate topics
      const existing = topicMap.get(key)!;
      const existingPromptIds = new Set(existing.prompts.map(p => p.id));
      const newPrompts = topic.prompts.filter(p => !existingPromptIds.has(p.id));
      
      topicMap.set(key, {
        ...existing,
        prompts: [...existing.prompts, ...newPrompts],
      });
    }
  }
  
  return Array.from(topicMap.values());
}

