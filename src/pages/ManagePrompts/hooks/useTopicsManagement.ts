/**
 * Hook for managing topics state and operations
 */

import { useState, useCallback, useMemo } from 'react';
import type { Topic } from '../../../api/promptManagementApi';
import type { TopicCategory } from '../../../types/topic';
import { convertTopicsForDisplay, handleTopicsChange } from '../services/topicsService';

interface UseTopicsManagementProps {
  promptsTopics: Topic[];
  onTopicsUpdate: (topics: Topic[]) => void;
}

export function useTopicsManagement({
  promptsTopics,
  onTopicsUpdate,
}: UseTopicsManagementProps) {
  const [error, setError] = useState<string | null>(null);

  // Convert prompts topics to display format, deduplicated
  const displayTopics = useMemo(() => {
    return convertTopicsForDisplay(promptsTopics);
  }, [promptsTopics]);

  const handleTopicsChangeFromManager = useCallback(async (
    updatedTopics: Array<{
      id: string;
      name: string;
      source: 'custom';
      category: TopicCategory | undefined;
      relevance: number;
    }>
  ) => {
    try {
      setError(null);
      
      handleTopicsChange(
        updatedTopics,
        promptsTopics,
        onTopicsUpdate
      );
    } catch (err) {
      console.error('Failed to update topics:', err);
      setError(err instanceof Error ? err.message : 'Failed to update topics');
    }
  }, [promptsTopics, onTopicsUpdate]);

  return {
    displayTopics,
    error,
    setError,
    handleTopicsChange: handleTopicsChangeFromManager,
  };
}

