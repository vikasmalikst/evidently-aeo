import { useState, useCallback } from 'react';
import { Plus, X, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Topic, TopicCategory } from '../../types/topic';
import { apiClient } from '../../lib/apiClient';

interface InlineTopicManagerProps {
  topics: Topic[];
  brandId: string | null;
  onTopicsChange: (topics: Topic[]) => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  onTopicDeleteRequest?: (topic: Topic) => void;
}

const CATEGORIES: { value: TopicCategory | 'post_purchase_support'; label: string }[] = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'post_purchase_support', label: 'Post-Purchase Support' },
];

const getCategoryBadgeColor = (category?: TopicCategory | string) => {
  switch (category) {
    case 'awareness':
      return { bg: 'rgba(25, 118, 210, 0.12)', text: '#1976D2', border: '#1976D2' };
    case 'comparison':
      return { bg: 'rgba(123, 31, 162, 0.12)', text: '#7B1FA2', border: '#7B1FA2' };
    case 'purchase':
      return { bg: 'rgba(56, 142, 60, 0.12)', text: '#388E3C', border: '#388E3C' };
    case 'support':
    case 'post_purchase_support':
      return { bg: 'rgba(245, 124, 0, 0.12)', text: '#F57C00', border: '#F57C00' };
    default:
      return { bg: 'rgba(97, 97, 97, 0.12)', text: '#616161', border: '#616161' };
  }
};

const getCategoryDisplayName = (category?: TopicCategory | string): string => {
  if (category === 'post_purchase_support') return 'Post-Purchase Support';
  if (category === 'support') return 'Post-Purchase Support';
  return category ? category.charAt(0).toUpperCase() + category.slice(1) : 'General';
};

export const InlineTopicManager = ({
  topics,
  brandId,
  onTopicsChange,
  isLoading = false,
  isReadOnly = false,
  onTopicDeleteRequest,
}: InlineTopicManagerProps) => {
  // Debug: Log topics when component receives them
  console.log('🔍 InlineTopicManager received topics:', topics);
  console.log('🔍 Topics details:', topics.map(t => ({ id: t.id, name: t.name, category: t.category })));
  console.log('🔍 onTopicDeleteRequest prop:', onTopicDeleteRequest);
  console.log('🔍 Type of onTopicDeleteRequest:', typeof onTopicDeleteRequest);
  
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState<TopicCategory | 'post_purchase_support'>('awareness');
  const [isAdding, setIsAdding] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicCategory, setEditTopicCategory] = useState<TopicCategory | 'post_purchase_support'>('awareness');

  const toggleTopicExpansion = useCallback((topicId: string) => {
    setExpandedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  }, []);

  const handleAddTopic = useCallback(async () => {
    if (!newTopicName.trim() || !brandId) return;

    setIsAdding(true);
    try {
      // Map post_purchase_support to support for the API
      const categoryForApi = newTopicCategory === 'post_purchase_support' ? 'support' : newTopicCategory;

      const newTopic: Topic = {
        id: `custom-${Date.now()}`,
        name: newTopicName.trim(),
        source: 'custom',
        category: categoryForApi,
        relevance: 70,
      };

      // For now, optimistically update the UI
      // In a real implementation, you'd call the API to persist this
      onTopicsChange([...topics, newTopic]);
      
      // Reset form
      setNewTopicName('');
      setNewTopicCategory('awareness');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add topic:', error);
    } finally {
      setIsAdding(false);
    }
  }, [newTopicName, newTopicCategory, brandId, topics, onTopicsChange]);

  const handleStartEdit = useCallback((topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
    setEditTopicCategory((topic.category === 'support' ? 'post_purchase_support' : topic.category) || 'awareness');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTopicId || !editTopicName.trim()) return;

    const categoryForApi = editTopicCategory === 'post_purchase_support' ? 'support' : editTopicCategory;

    const updatedTopics = topics.map((topic) =>
      topic.id === editingTopicId
        ? { ...topic, name: editTopicName.trim(), category: categoryForApi }
        : topic
    );

    onTopicsChange(updatedTopics);
    setEditingTopicId(null);
    setEditTopicName('');
    setEditTopicCategory('awareness');
  }, [editingTopicId, editTopicName, editTopicCategory, topics, onTopicsChange]);

  const handleCancelEdit = useCallback(() => {
    setEditingTopicId(null);
    setEditTopicName('');
    setEditTopicCategory('awareness');
  }, []);

  const handleDeleteTopic = useCallback((topicId: string) => {
    const updatedTopics = topics.filter((topic) => topic.id !== topicId);
    onTopicsChange(updatedTopics);
  }, [topics, onTopicsChange]);

  if (isLoading) {
    return (
      <div className="bg-white border border-[var(--border-default)] rounded-lg p-6">
        <p className="text-sm text-[var(--text-caption)]">Loading topics...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-1">
            Current Topics
          </h3>
          <p className="text-sm text-[var(--text-caption)]">
            {topics.length} {topics.length === 1 ? 'topic' : 'topics'} configured
          </p>
        </div>
        {!isReadOnly && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Custom Topic
          </button>
        )}
      </div>

      {showAddForm && !isReadOnly && (
        <div className="mb-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                Category <span className="text-[var(--text-error)]">*</span>
              </label>
              <select
                value={newTopicCategory}
                onChange={(e) => setNewTopicCategory(e.target.value as TopicCategory | 'post_purchase_support')}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                Topic Name <span className="text-[var(--text-error)]">*</span>
              </label>
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g., Product quality, Customer service, Shipping speed"
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTopicName.trim()) {
                    handleAddTopic();
                  } else if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewTopicName('');
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTopicName('');
                  setNewTopicCategory('awareness');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleAddTopic}
                disabled={!newTopicName.trim() || isAdding}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                {isAdding ? 'Adding...' : 'Add Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-caption)]">
          No topics configured yet. Click "Add Custom Topic" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => {
            const isExpanded = expandedTopics.has(topic.id);
            const isEditing = editingTopicId === topic.id;
            const colors = getCategoryBadgeColor(topic.category);
            const categoryDisplay = getCategoryDisplayName(topic.category);

            return (
              <div
                key={topic.id}
                className="border border-[var(--border-default)] rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)] transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTopicExpansion(topic.id)}
                      className="flex-shrink-0 p-1 hover:bg-white rounded transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-[var(--text-caption)]" />
                      ) : (
                        <ChevronRight size={20} className="text-[var(--text-caption)]" />
                      )}
                    </button>
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-3">
                        <select
                          value={editTopicCategory}
                          onChange={(e) => setEditTopicCategory(e.target.value as TopicCategory | 'post_purchase_support')}
                          className="px-3 py-1.5 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)]"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editTopicName}
                          onChange={(e) => setEditTopicName(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 text-sm text-[var(--success500)] hover:bg-[var(--success500)]/10 rounded transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm text-[var(--text-error)] hover:bg-[var(--text-error)]/10 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-semibold text-[var(--text-headings)]">
                              {topic.name}
                            </h4>
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                              style={{ backgroundColor: colors.bg, color: colors.text }}
                            >
                              {categoryDisplay}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-caption)]">
                            {topic.source === 'custom' ? 'Custom topic' : topic.source.replace('_', ' ')}
                          </p>
                        </div>
                        {!isReadOnly && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleStartEdit(topic)}
                            className="p-2 rounded hover:bg-white transition-colors"
                            aria-label="Edit topic"
                          >
                            <Edit2 size={16} className="text-[var(--text-body)]" />
                          </button>
                          <button
                              onClick={() => {
                                console.log('🗑️ Delete button clicked for topic:', topic);
                                console.log('🗑️ onTopicDeleteRequest exists:', !!onTopicDeleteRequest);
                                if (onTopicDeleteRequest) {
                                  console.log('🗑️ Calling onTopicDeleteRequest');
                                  onTopicDeleteRequest(topic);
                                } else {
                                  console.log('🗑️ Calling handleDeleteTopic');
                                  handleDeleteTopic(topic.id);
                                }
                              }}
                            className="p-2 rounded hover:bg-white transition-colors"
                            aria-label="Delete topic"
                          >
                            <Trash2 size={16} className="text-[var(--text-error)]" />
                          </button>
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

