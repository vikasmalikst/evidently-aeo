import { useState } from 'react';
import { Edit2, X, RotateCcw, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { IconBulb } from '@tabler/icons-react';
import type { Topic } from '../../../types/topic';
import type { TopicConfiguration } from '../types';

type SortOption = 'relevance' | 'recency' | 'performance';

interface ActiveTopicsSectionProps {
  topics: Topic[];
  history: TopicConfiguration[];
  currentVersion: number;
  selectedVersion: number | null;
  onEdit: () => void;
  onRemoveTopic: (topicId: string) => void;
  onVersionChange: (version: number | null) => void;
  onRestoreVersion: () => void;
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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Mock data - in production this would come from an API
const topicPrompts: Record<string, string[]> = {
  'topic-1': [
    'best product reviews',
    'product reviews 2024',
    'top rated products',
    'trusted product reviews',
    'product comparison reviews',
    'unbiased product reviews',
    'where to buy products',
    'product review sites'
  ],
  'topic-2': [
    'product pricing comparison',
    'best product deals',
    'product cost',
    'affordable products',
    'product price range',
    'discount products',
    'product value for money',
    'cheapest products'
  ],
  'topic-3': [
    'sustainable products',
    'eco friendly products',
    'sustainable brands',
    'green products',
    'environmentally conscious products',
    'carbon neutral products',
    'recyclable products',
    'eco-conscious brands'
  ]
};

// Get prompts for a topic - fallback to mock data if not found
const getTopicPrompts = (topicId: string, topicName: string): string[] => {
  return topicPrompts[topicId] || Array(8).fill(null).map((_, i) => `${topicName.toLowerCase()} query ${i + 1}`);
};

export const ActiveTopicsSection = ({
  topics,
  history,
  currentVersion,
  selectedVersion,
  onEdit,
  onRemoveTopic,
  onVersionChange,
  onRestoreVersion,
}: ActiveTopicsSectionProps) => {
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [hoveredTopicId, setHoveredTopicId] = useState<string | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());

  const sortedTopics = [...topics].sort((a, b) => {
    switch (sortBy) {
      case 'relevance':
        return b.relevance - a.relevance;
      case 'recency':
        return 0; // Placeholder
      case 'performance':
        return 0; // Placeholder
      default:
        return 0;
    }
  });

  const promptCounts: Record<string, number> = {}; // Would come from API
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
            {topics.length} — {topics.length * 8} total search queries across all AI engines
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
            <option value="relevance">Relevance</option>
            <option value="recency">Recency</option>
            <option value="performance">Performance</option>
          </select>
        </div>
      </div>

      {isViewingOldVersion && (
        <div className="mb-4 p-3 bg-[var(--accent-light)] border border-[var(--accent-primary)]/30 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-headings)]">
              You are viewing a previous version. Restore this version to make it active.
            </p>
            <button
              onClick={onRestoreVersion}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium"
            >
              <RotateCcw size={16} />
              Restore This Version
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {sortedTopics.map((topic) => {
          const colors = getSourceBadgeColor(topic.source);
          const isHovered = hoveredTopicId === topic.id;
          const isExpanded = expandedTopicIds.has(topic.id);
          const prompts = getTopicPrompts(topic.id, topic.name);
          
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
                        <span>Relevance: <span className="font-medium text-[var(--text-headings)]">{topic.relevance}%</span></span>
                        <span>Prompts: <span className="font-medium text-[var(--text-headings)]">{prompts.length}</span></span>
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
