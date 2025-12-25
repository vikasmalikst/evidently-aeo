import { useState, useEffect, useMemo } from 'react';
import { Edit2, X, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { IconBulb } from '@tabler/icons-react';
import { apiClient } from '../../../lib/apiClient';
import { formatDateWithYear } from '../../../utils/dateFormatting';
import type { Topic } from '../../../types/topic';
import type { TopicConfiguration } from '../types';

type SortOption = 'alphabetical' | 'prompts';

interface ActiveTopicsSectionProps {
  topics: Topic[];
  history: TopicConfiguration[];
  currentVersion: number;
  selectedVersion: number | null;
  brandId: string;
  onEdit: () => void;
  onRemoveTopic: (topicId: string) => void;
  onVersionChange: (version: number | null) => void;
}

const getSourceBadgeColor = (source: string) => {
  switch (source) {
    case 'trending':
      return { bg: 'rgba(252, 235, 150, 0.3)', text: '#927f20' };
    case 'ai_generated':
      return { bg: 'rgba(51, 201, 227, 0.2)', text: '#005a69' };
    case 'preset':
      return { bg: 'rgba(107, 114, 137, 0.2)', text: '#52576d' };
    case 'custom':
      return { bg: 'rgba(172, 89, 251, 0.2)', text: '#54079c' };
    default:
      return { bg: 'rgba(107, 114, 137, 0.2)', text: '#52576d' };
  }
};

const formatDate = formatDateWithYear;

// Helper to get prompts for a topic from API data
const getTopicPrompts = (topicId: string, topicName: string, promptsByTopic: Record<string, string[]> = {}): string[] => {
  // Try to find prompts by topic ID first
  if (promptsByTopic[topicId]) {
    return promptsByTopic[topicId];
  }
  // Fallback: try to find by topic name (case-insensitive)
  const topicKey = Object.keys(promptsByTopic).find(
    key => key.toLowerCase().trim() === topicName.toLowerCase().trim()
  );
  if (topicKey) {
    return promptsByTopic[topicKey];
  }
  // If no prompts found, return empty array (don't show mock data)
  return [];
};

export const ActiveTopicsSection = ({
  topics,
  history,
  currentVersion,
  selectedVersion,
  brandId,
  onEdit,
  onRemoveTopic,
  onVersionChange,
}: ActiveTopicsSectionProps) => {
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());
  const [promptsByTopic, setPromptsByTopic] = useState<Record<string, string[]>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Fetch prompts for topics
  useEffect(() => {
    if (!brandId || topics.length === 0) {
      setPromptsByTopic({});
      return;
    }

    const fetchPrompts = async () => {
      try {
        setLoadingPrompts(true);
        // Fetch prompts for all topics
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
        
        const response = await apiClient.request<{ 
          success: boolean; 
          data?: { 
            topics?: Array<{ 
              name: string; 
              prompts?: Array<{ question: string }> 
            }> 
          } 
        }>(
          `/brands/${brandId}/prompts?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (response.success && response.data?.topics) {
          const promptsMap: Record<string, string[]> = {};
          response.data.topics.forEach((topic) => {
            if (topic.name && topic.prompts) {
              // Map both by topic name and by normalized topic name for better matching
              const normalizedName = topic.name.toLowerCase().trim();
              promptsMap[normalizedName] = topic.prompts
                .map(p => p.question)
                .filter(Boolean);
            }
          });
          setPromptsByTopic(promptsMap);
        }
      } catch (error) {
        console.error('Failed to fetch prompts:', error);
        // Don't show error to user, just use empty prompts
        setPromptsByTopic({});
      } finally {
        setLoadingPrompts(false);
      }
    };

    fetchPrompts();
  }, [brandId, topics.length]); // Only depend on length to avoid re-fetching on every topic change

  // Calculate prompt counts from fetched prompts
  const promptCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    topics.forEach((topic) => {
      const prompts = getTopicPrompts(topic.id, topic.name, promptsByTopic);
      counts[topic.id] = prompts.length;
    });
    return counts;
  }, [topics, promptsByTopic]);

  const sortedTopics = [...topics].sort((a, b) => {
    switch (sortBy) {
      case 'prompts':
        return (promptCounts[b.id] || 0) - (promptCounts[a.id] || 0);
      case 'alphabetical':
      default:
        return a.name.localeCompare(b.name);
    }
  });
  const isViewingOldVersion = selectedVersion !== null && selectedVersion !== currentVersion;
  const selectedConfig = selectedVersion !== null 
    ? history.find(c => c.version === selectedVersion) 
    : null;

  const toggleTopicExpansion = (topicId: string) => {
    setExpandedTopicIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-headings)] mb-1">
            Active Topics
          </h2>
          <p className="text-sm text-[var(--text-caption)]">
            {topics.length} topics — {Object.values(promptCounts).reduce((sum, count) => sum + count, 0)} total queries
            {isViewingOldVersion && selectedConfig && (
              <span className="ml-2 text-[var(--text-warning)]">
                • Viewing v{selectedVersion} from {formatDate(selectedConfig.created_at)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedVersion !== null ? selectedVersion.toString() : 'current'}
            onChange={(e) => {
              if (e.target.value === 'current') {
                onVersionChange(null);
              } else {
                onVersionChange(parseInt(e.target.value));
              }
            }}
            className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-headings)] bg-white"
          >
            <option value="current">Current (v{currentVersion})</option>
            {history
              .filter(c => c.version !== currentVersion)
              .sort((a, b) => b.version - a.version)
              .map((config) => (
                <option key={config.id} value={config.version}>
                  v{config.version} - {formatDate(config.created_at)} ({config.topics.length} topics)
                </option>
              ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-headings)] bg-white"
          >
            <option value="alphabetical">Topic Name</option>
            <option value="prompts">Prompt Count</option>
          </select>
        </div>
      </div>

      {isViewingOldVersion && selectedConfig && (
        <div className="mb-4 p-3 bg-[var(--accent-light)] border border-[var(--accent-primary)]/30 rounded-lg">
          <p className="text-sm text-[var(--text-headings)] leading-relaxed">
            Viewing version v{selectedVersion} from {formatDate(selectedConfig.created_at)}. This snapshot is read-only —
            switch back to the current configuration to make edits.
          </p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {sortedTopics.map((topic) => {
          const colors = getSourceBadgeColor(topic.source);
          const isHovered = hoveredTopicId === topic.id;
          const isExpanded = expandedTopicIds.has(topic.id);
          const prompts = getTopicPrompts(topic.id, topic.name, promptsByTopic);
          
          return (
            <div
              key={topic.id}
              className={`border border-[var(--border-default)] rounded-lg overflow-hidden ${
                isViewingOldVersion ? 'opacity-75' : ''
              }`}
            >
              <div
                onMouseEnter={() => setHoveredTopicId(topic.id)}
                onMouseLeave={() => setHoveredTopicId(null)}
                onClick={() => {
                  if (!isViewingOldVersion) {
                    toggleTopicExpansion(topic.id);
                  }
                }}
                className={`flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)] transition-colors group cursor-pointer ${
                  isViewingOldVersion ? 'cursor-default' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {!isViewingOldVersion && (
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-[var(--text-caption)]" />
                      ) : (
                        <ChevronRight size={20} className="text-[var(--text-caption)]" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-[var(--text-headings)]">
                          {topic.name}
                        </h3>
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {topic.source.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[var(--text-caption)]">
                        <span>
                          Category:{' '}
                          <span className="font-medium text-[var(--text-headings)]">
                            {topic.category ? topic.category.toString().replace(/_/g, ' ') : 'General'}
                          </span>
                        </span>
                        <span>Prompts: <span className="font-medium text-[var(--text-headings)]">{prompts.length || 0}</span></span>
                        {loadingPrompts && (
                          <span className="text-xs text-[var(--text-caption)]">(Loading...)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {isHovered && !isViewingOldVersion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTopic(topic.id);
                    }}
                    className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--text-error)] text-[var(--text-caption)] hover:text-white transition-colors ml-2 flex-shrink-0"
                    aria-label="Remove topic"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              {isExpanded && (
                <div className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                  {loadingPrompts ? (
                    <div className="text-center py-4 text-sm text-[var(--text-caption)]">
                      Loading prompts...
                    </div>
                  ) : prompts.length > 0 ? (
                    <div className="space-y-2">
                      {prompts.map((prompt, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <Search size={14} className="text-[var(--text-caption)] flex-shrink-0" />
                          <p className="flex-1 text-sm text-[var(--text-body)]">
                            {prompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-[var(--text-caption)]">
                      No prompts available for this topic yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isViewingOldVersion && (
        <>
          <div className="pt-4 border-t border-[var(--border-default)] mb-4">
            <div className="flex items-start gap-2 p-3 bg-[var(--accent-light)] rounded-lg">
              <IconBulb size={18} className="text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--text-body)]">
                <strong className="text-[var(--text-headings)]">Pro tip:</strong> 5-10 topics is ideal. More topics = more data, but also more analysis time.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-[var(--border-default)]">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium"
            >
              <Edit2 size={16} />
              Edit Topics
            </button>
          </div>
        </>
      )}
    </div>
  );
};
