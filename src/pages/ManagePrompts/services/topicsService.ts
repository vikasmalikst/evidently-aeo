/**
 * Topics Management Service
 * Handles all topic-related operations and state management
 */

import type { Topic } from '../../../api/promptManagementApi';
import type { TopicCategory } from '../../../types/topic';

export interface TopicsState {
  topics: Topic[];
  error: string | null;
}

export interface TopicsService {
  updateTopicName: (topicId: number, newName: string) => void;
  deleteTopic: (topicId: number, deletePrompts?: boolean) => void;
  renameTopic: (oldName: string, newName: string) => void;
  getTopicsForDisplay: () => Array<{
    id: string;
    name: string;
    source: 'custom';
    category: TopicCategory | undefined;
    relevance: number;
  }>;
  getState: () => TopicsState;
  setState: (updater: (prev: TopicsState) => TopicsState) => void;
  syncWithPromptsTopics: (promptsTopics: Topic[]) => void;
}

export const createTopicsService = (
  initialState: TopicsState,
  stateSetter: (updater: (prev: TopicsState) => TopicsState) => void,
  promptsStateSetter: (updater: (prev: { topics: Topic[] }) => { topics: Topic[] }) => void
): TopicsService => {
  const updateTopicName = (topicId: number, newName: string): void => {
    promptsStateSetter(prev => ({
      topics: prev.topics.map(topic => 
        topic.id === topicId
          ? { ...topic, name: newName.trim() }
          : topic
      ),
    }));
  };

  const deleteTopic = (topicId: number, deletePrompts: boolean = false): void => {
    promptsStateSetter(prev => {
      if (deletePrompts) {
        // Delete the topic and all its prompts
        return {
          topics: prev.topics.filter(topic => topic.id !== topicId),
        };
      } else {
        // Only delete if no prompts exist
        const topic = prev.topics.find(t => t.id === topicId);
        if (topic && topic.prompts.length === 0) {
          return {
            topics: prev.topics.filter(t => t.id !== topicId),
          };
        }
        // If topic has prompts, don't delete - log a warning
        console.warn(`Cannot delete topic ${topicId}: it has ${topic?.prompts.length || 0} prompts`);
        return prev;
      }
    });
  };

  const renameTopic = (oldName: string, newName: string): void => {
    promptsStateSetter(prev => ({
      topics: prev.topics.map(topic => 
        topic.name === oldName
          ? { ...topic, name: newName.trim() }
          : topic
      ),
    }));
  };

  const getTopicsForDisplay = (): Array<{
    id: string;
    name: string;
    source: 'custom';
    category: TopicCategory | undefined;
    relevance: number;
  }> => {
    // This will be called with the current prompts topics
    // Return empty array for now, will be populated dynamically
    return [];
  };

  const syncWithPromptsTopics = (promptsTopics: Topic[]): void => {
    stateSetter(prev => ({
      ...prev,
      topics: promptsTopics,
    }));
  };

  return {
    updateTopicName,
    deleteTopic,
    renameTopic,
    getTopicsForDisplay,
    getState: () => initialState,
    setState: stateSetter,
    syncWithPromptsTopics,
  };
};

/**
 * Convert prompts Topic format to display format for InlineTopicManager
 */
export function convertTopicsForDisplay(topics: Topic[]): Array<{
  id: string;
  name: string;
  source: 'custom';
  category: TopicCategory | undefined;
  relevance: number;
}> {
  // Deduplicate topics by name first
  const uniqueTopicsMap = new Map<string, Topic>();
  
  for (const topic of topics) {
    const key = topic.name.toLowerCase().trim();
    if (!uniqueTopicsMap.has(key)) {
      uniqueTopicsMap.set(key, topic);
    } else {
      // Merge prompts from duplicate topics
      const existing = uniqueTopicsMap.get(key)!;
      const existingPromptIds = new Set(existing.prompts.map(p => p.id));
      const newPrompts = topic.prompts.filter(p => !existingPromptIds.has(p.id));
      
      uniqueTopicsMap.set(key, {
        ...existing,
        prompts: [...existing.prompts, ...newPrompts],
      });
    }
  }

  const uniqueTopics = Array.from(uniqueTopicsMap.values());

  // Return only unique topics (by ID as well)
  const topicsById = new Map<number, Topic>();
  for (const topic of uniqueTopics) {
    if (!topicsById.has(topic.id)) {
      topicsById.set(topic.id, topic);
    }
  }

  return Array.from(topicsById.values()).map(topic => ({
    id: topic.id.toString(),
    name: topic.name,
    source: 'custom' as const,
    category: undefined as TopicCategory | undefined,
    relevance: 70,
  }));
}

/**
 * Handle topic changes from InlineTopicManager
 */
export function handleTopicsChange(
  updatedTopics: Array<{
    id: string;
    name: string;
    source: 'custom';
    category: TopicCategory | undefined;
    relevance: number;
  }>,
  currentTopics: Topic[],
  onUpdate: (updatedTopics: Topic[]) => void
): void {
  // Deduplicate current topics by name first
  const uniqueCurrentTopics = deduplicateTopics(currentTopics);
  
  const updatedTopicsMap = new Map(updatedTopics.map(t => [t.id, t]));

  // Find renamed and deleted topics
  const renamedTopics: Array<{ topicId: number; oldName: string; newName: string }> = [];
  const deletedTopicIds: number[] = [];

  // Check for renamed topics
  uniqueCurrentTopics.forEach(topic => {
    const updatedTopic = updatedTopicsMap.get(topic.id.toString());
    if (updatedTopic && updatedTopic.name !== topic.name) {
      renamedTopics.push({
        topicId: topic.id,
        oldName: topic.name,
        newName: updatedTopic.name,
      });
    }
  });

  // Check for deleted topics - allow deletion even if they have prompts
  uniqueCurrentTopics.forEach(topic => {
    if (!updatedTopicsMap.has(topic.id.toString())) {
      deletedTopicIds.push(topic.id);
    }
  });

  // Apply changes: rename topics first
  let finalTopics = uniqueCurrentTopics.map(topic => {
    const renameInfo = renamedTopics.find(r => r.topicId === topic.id);
    if (renameInfo) {
      return { ...topic, name: renameInfo.newName };
    }
    return topic;
  });

  // Delete topics (allow deletion even if they have prompts - delete the entire topic with all prompts)
  finalTopics = finalTopics.filter(topic => !deletedTopicIds.includes(topic.id));

  // Deduplicate final topics by name
  finalTopics = deduplicateTopics(finalTopics);

  // Update the topics
  onUpdate(finalTopics);
}

/**
 * Deduplicate topics by name
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

