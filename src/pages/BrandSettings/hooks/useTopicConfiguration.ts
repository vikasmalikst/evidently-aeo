import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../../lib/apiClient';
import type { TopicConfiguration, TopicChangeImpact } from '../types';
import type { Topic } from '../../../types/topic';

interface UseTopicConfigurationReturn {
  currentConfig: TopicConfiguration | null;
  history: TopicConfiguration[];
  unsavedChanges: Topic[];
  changeType: 'add' | 'remove' | 'significant' | 'none';
  changeImpact: TopicChangeImpact | null;
  isLoading: boolean;
  isUpdating: boolean;
  handleTopicChange: (topics: Topic[]) => void;
  saveChanges: (topicsOverride?: Topic[]) => Promise<void>;
  discardChanges: () => void;
  resetTopics: () => Promise<void>;
}

// Mock data generator removed - now using real API

export const useTopicConfiguration = (brandId?: string | null): UseTopicConfigurationReturn => {
  const [currentConfig, setCurrentConfig] = useState<TopicConfiguration | null>(null);
  const [history, setHistory] = useState<TopicConfiguration[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate change impact
  const changeImpact = useMemo<TopicChangeImpact | null>(() => {
    if (!currentConfig || unsavedChanges.length === 0) return null;

    const currentIds = new Set(currentConfig.topics.map(t => t.id));
    const newIds = new Set(unsavedChanges.map(t => t.id));

    const added = unsavedChanges.filter(t => !currentIds.has(t.id));
    const removed = currentConfig.topics.filter(t => !newIds.has(t.id));

    return {
      added,
      removed,
      newPromptCount: added.length * 8, // Estimate: ~8 prompts per topic
      isSignificant: Math.abs(added.length - removed.length) >= 3,
    };
  }, [currentConfig, unsavedChanges]);

  // Determine change type
  const changeType = useMemo<'add' | 'remove' | 'significant' | 'none'>(() => {
    if (!changeImpact) return 'none';
    if (changeImpact.isSignificant) return 'significant';
    if (changeImpact.added.length > 0) return 'add';
    if (changeImpact.removed.length > 0) return 'remove';
    return 'none';
  }, [changeImpact]);

  // Fetch current configuration
  const fetchCurrentConfig = useCallback(async () => {
    if (!brandId) {
      setCurrentConfig(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.request<{ success: boolean; data?: TopicConfiguration }>(
        `/brands/${brandId}/topic-configuration/current`
      );
      
      if (response.success && response.data) {
        setCurrentConfig(response.data);
      } else {
        console.error('Failed to fetch current configuration: No data returned');
        // Fallback to empty config if no data
        setCurrentConfig(null);
      }
    } catch (error) {
      console.error('Failed to fetch current configuration:', error);
      // On error, set to null to show empty state
      setCurrentConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!brandId) {
      setHistory([]);
      return;
    }

    try {
      const response = await apiClient.request<{ success: boolean; data?: TopicConfiguration[] }>(
        `/brands/${brandId}/topic-configuration/history`
      );
      
      if (response.success && response.data) {
        setHistory(response.data);
      } else {
        console.error('Failed to fetch history: No data returned');
        setHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setHistory([]);
    }
  }, [brandId]);

  useEffect(() => {
    fetchCurrentConfig();
    fetchHistory();
  }, [fetchCurrentConfig, fetchHistory]);

  const handleTopicChange = useCallback((topics: Topic[]) => {
    setUnsavedChanges(topics);
  }, []);

  const saveChanges = useCallback(
    async (topicsOverride?: Topic[]) => {
      if (!brandId || !currentConfig) return;

      const topicsToSave =
        topicsOverride && topicsOverride.length > 0
          ? topicsOverride
          : unsavedChanges;

      if (!topicsToSave || topicsToSave.length === 0) {
        return;
      }

    try {
      setIsUpdating(true);
        setUnsavedChanges(topicsToSave);

      const response = await apiClient.request<{ success: boolean; data?: TopicConfiguration }>(
        `/brands/${brandId}/topic-configuration/update`,
        {
          method: 'POST',
            body: JSON.stringify({ topics: topicsToSave }),
        }
      );
      
      if (response.success && response.data) {
        const newConfig = response.data;
        
        // Update current config and history
        setCurrentConfig(newConfig);
        setHistory(prevHistory => {
          // Mark old configs as inactive and add new one
          const updatedHistory = prevHistory.map(c => ({ ...c, is_active: false }));
          return [newConfig, ...updatedHistory];
        });
        setUnsavedChanges([]);
      } else {
        throw new Error('Failed to save changes: No data returned');
      }
    } catch (error) {
      console.error('Failed to save changes:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
    },
    [brandId, currentConfig, unsavedChanges]
  );

  const discardChanges = useCallback(() => {
    setUnsavedChanges([]);
  }, []);

  const resetTopics = useCallback(async () => {
    if (!brandId) {
      setCurrentConfig(null);
      setHistory([]);
      setUnsavedChanges([]);
      return;
    }

    try {
      setIsUpdating(true);
      // Refetch current config and history
      await fetchCurrentConfig();
      await fetchHistory();
      setUnsavedChanges([]);
    } catch (error) {
      console.error('Failed to reset topics:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [fetchCurrentConfig, fetchHistory]);

  return {
    currentConfig,
    history,
    unsavedChanges,
    changeType,
    changeImpact,
    isLoading,
    isUpdating,
    handleTopicChange,
    saveChanges,
    discardChanges,
    resetTopics,
  };
};

