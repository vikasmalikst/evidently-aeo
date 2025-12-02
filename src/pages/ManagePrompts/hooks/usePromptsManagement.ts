/**
 * Hook for managing prompts state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { createPromptsService, type PromptsState } from '../services/promptsService';
import type { Prompt, Topic } from '../../../api/promptManagementApi';

export function usePromptsManagement(brandId: string | null, brandsLoading: boolean) {
  const [state, setState] = useState<PromptsState>({
    topics: [],
    selectedPrompt: null,
    configHistory: [],
    currentConfigVersion: 0,
    summaryStats: {
      totalPrompts: 0,
      totalTopics: 0,
      coverage: 0,
      avgVisibility: 0,
      avgSentiment: 0,
    },
    isLoading: true,
    error: null,
  });

  const service = createPromptsService(state, setState);

  // Fetch prompts data when brand ID is available
  useEffect(() => {
    if (!brandId || brandsLoading) return;

    service.fetchPromptsData(brandId).catch((err) => {
      console.error('Failed to fetch prompts data:', err);
    });
  }, [brandId, brandsLoading]);

  const handlePromptEdit = useCallback((prompt: Prompt, newText: string) => {
    service.updatePrompt(prompt, newText);
  }, [service]);

  const handlePromptDelete = useCallback((prompt: Prompt) => {
    service.deletePrompt(prompt);
  }, [service]);

  const handlePromptAdd = useCallback((topicId: number, prompt: Prompt) => {
    service.addPrompt(topicId, prompt);
  }, [service]);

  const handlePromptSelect = useCallback((prompt: Prompt) => {
    service.selectPrompt(prompt);
  }, [service]);

  return {
    ...state,
    handlePromptEdit,
    handlePromptDelete,
    handlePromptAdd,
    handlePromptSelect,
    refreshPrompts: () => brandId ? service.fetchPromptsData(brandId) : Promise.resolve(),
    setState,
  };
}

