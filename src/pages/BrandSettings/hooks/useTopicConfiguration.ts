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
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
  resetTopics: () => Promise<void>;
  revertToVersion: (versionId: string) => Promise<void>;
}

// Mock data generator for development
const generateMockConfig = (version: number, isActive: boolean): TopicConfiguration => {
  const mockTopics: Topic[] = [
    { id: '1', name: 'AI Assistants', source: 'trending', relevance: 85 },
    { id: '2', name: 'Large Language Models', source: 'ai_generated', relevance: 78 },
    { id: '3', name: 'AI Search', source: 'trending', relevance: 72 },
    { id: '4', name: 'Search Results', source: 'preset', relevance: 68 },
    { id: '5', name: 'Research Tools', source: 'ai_generated', relevance: 75 },
  ].slice(0, version === 1 ? 3 : version === 2 ? 4 : 5);

  return {
    id: `config-${version}`,
    brand_id: 'brand-1',
    version,
    is_active: isActive,
    change_type: version === 1 ? 'initial_setup' : version === 2 ? 'topic_added' : 'topic_added',
    change_summary: version === 1 
      ? 'Initial topic setup' 
      : version === 2 
      ? "Added 'Research Tools'" 
      : "Added 'Research Tools', removed 'Search Results'",
    topics: mockTopics,
    created_at: new Date(Date.now() - (3 - version) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    analysis_count: version === 1 ? 0 : version === 2 ? 2 : 4,
  };
};

export const useTopicConfiguration = (brandId: string): UseTopicConfigurationReturn => {
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
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      // const config = await apiClient.request<TopicConfiguration>(
      //   `/brands/${brandId}/topic-configuration/current`
      // );
      
      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      const config = generateMockConfig(3, true);
      setCurrentConfig(config);
    } catch (error) {
      console.error('Failed to fetch current configuration:', error);
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      // const configs = await apiClient.request<TopicConfiguration[]>(
      //   `/brands/${brandId}/topic-configuration/history`
      // );
      
      // Mock data for now
      const configs = [
        generateMockConfig(3, true),
        generateMockConfig(2, false),
        generateMockConfig(1, false),
      ];
      setHistory(configs);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  }, [brandId]);

  useEffect(() => {
    fetchCurrentConfig();
    fetchHistory();
  }, [fetchCurrentConfig, fetchHistory]);

  const handleTopicChange = useCallback((topics: Topic[]) => {
    setUnsavedChanges(topics);
  }, []);

  const saveChanges = useCallback(async () => {
    if (!currentConfig || unsavedChanges.length === 0) return;

    try {
      setIsUpdating(true);
      // TODO: Replace with actual API call
      // const newConfig = await apiClient.request<TopicConfiguration>(
      //   `/brands/${brandId}/topic-configuration/update`,
      //   {
      //     method: 'POST',
      //     body: JSON.stringify({ topics: unsavedChanges }),
      //   }
      // );
      
      // Mock: Create new version
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newConfig: TopicConfiguration = {
        ...currentConfig,
        id: `config-${currentConfig.version + 1}`,
        version: currentConfig.version + 1,
        is_active: true,
        change_type: changeImpact?.added.length ? 'topic_added' : 'topic_removed',
        change_summary: changeImpact 
          ? `Added ${changeImpact.added.length}, removed ${changeImpact.removed.length}`
          : 'Updated topics',
        topics: unsavedChanges,
        created_at: new Date().toISOString(),
        analysis_count: 0,
      };

      // Update current config and history
      setCurrentConfig(prev => {
        if (prev) {
          setHistory(prevHistory => [newConfig, ...prevHistory.map(c => ({ ...c, is_active: false }))]);
        }
        return newConfig;
      });
      setUnsavedChanges([]);
    } catch (error) {
      console.error('Failed to save changes:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [brandId, currentConfig, unsavedChanges, changeImpact]);

  const discardChanges = useCallback(() => {
    setUnsavedChanges([]);
  }, []);

  const resetTopics = useCallback(async () => {
    try {
      setIsUpdating(true);
      // TODO: Replace with actual API call
      // await apiClient.request(`/brands/${brandId}/topic-configuration/reset`, {
      //   method: 'POST',
      // });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchCurrentConfig();
      await fetchHistory();
    } catch (error) {
      console.error('Failed to reset topics:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [brandId, fetchCurrentConfig, fetchHistory]);

  const revertToVersion = useCallback(async (versionId: string) => {
    try {
      setIsUpdating(true);
      // TODO: Replace with actual API call
      // const newConfig = await apiClient.request<TopicConfiguration>(
      //   `/brands/${brandId}/topic-configuration/${versionId}/revert`,
      //   { method: 'POST' }
      // );
      
      const versionToRevert = history.find(c => c.id === versionId);
      if (!versionToRevert) throw new Error('Version not found');

      await new Promise(resolve => setTimeout(resolve, 1000));
      const newConfig: TopicConfiguration = {
        ...versionToRevert,
        id: `config-${currentConfig ? currentConfig.version + 1 : 1}`,
        version: currentConfig ? currentConfig.version + 1 : 1,
        is_active: true,
        change_type: 'full_refresh',
        change_summary: `Reverted to v${versionToRevert.version}`,
        created_at: new Date().toISOString(),
        analysis_count: 0,
      };

      setCurrentConfig(newConfig);
      setHistory(prev => [newConfig, ...prev.map(c => ({ ...c, is_active: false }))]);
      setUnsavedChanges([]);
    } catch (error) {
      console.error('Failed to revert version:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [brandId, history, currentConfig]);

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
    revertToVersion,
  };
};

