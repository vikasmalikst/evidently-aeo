import { useState } from 'react';
import { ChevronDown, ChevronRight, CalendarDays, Plus, Edit2, Trash2 } from 'lucide-react';
import { IconMoodSadSquint, IconMoodSad, IconMoodEmpty, IconMoodSmile, IconMoodHappy } from '@tabler/icons-react';
import { Topic, Prompt } from '../../data/mockPromptsData';

interface ManagePromptsListProps {
  topics: Topic[];
  selectedPromptId: number | null;
  onPromptSelect: (prompt: Prompt) => void;
  onPromptEdit: (prompt: Prompt, newText: string) => void;
  onPromptDelete: (prompt: Prompt) => void;
  onPromptAdd: (topicId: number, promptText: string) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const getSentimentIcon = (sentiment: number) => {
  if (sentiment <= 1) return <IconMoodSadSquint size={18} className="text-[#f94343]" />;
  if (sentiment <= 2) return <IconMoodSad size={18} className="text-[#fa8a40]" />;
  if (sentiment <= 3) return <IconMoodEmpty size={18} className="text-[#f9db43]" />;
  if (sentiment <= 4) return <IconMoodSmile size={18} className="text-[#06c686]" />;
  return <IconMoodHappy size={18} className="text-[#06c686]" />;
};

const getSentimentLabel = (sentiment: number) => {
  if (sentiment <= 1) return 'Very Negative';
  if (sentiment <= 2) return 'Negative';
  if (sentiment <= 3) return 'Neutral';
  if (sentiment <= 4) return 'Positive';
  return 'Very Positive';
};

const getWeeklyDateRanges = () => {
  const ranges = [];
  const today = new Date('2025-11-01');

  for (let i = 0; i < 8; i++) {
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - (i * 7));
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);

    const formatDate = (date: Date) => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day}`;
    };

    ranges.push({
      value: `week-${i}`,
      label: `${formatDate(startDate)} - ${formatDate(endDate)}`
    });
  }

  return ranges;
};

export const ManagePromptsList = ({ 
  topics, 
  selectedPromptId, 
  onPromptSelect,
  onPromptEdit,
  onPromptDelete,
  onPromptAdd,
  dateRange, 
  onDateRangeChange 
}: ManagePromptsListProps) => {
  const [expandedTopics, setExpandedTopics] = useState<number[]>([1]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editText, setEditText] = useState('');
  const [showAddModal, setShowAddModal] = useState<number | null>(null);
  const [newPromptText, setNewPromptText] = useState('');
  const weeklyRanges = getWeeklyDateRanges();

  const toggleTopic = (topicId: number) => {
    if (expandedTopics.includes(topicId)) {
      setExpandedTopics(expandedTopics.filter(id => id !== topicId));
    } else {
      setExpandedTopics([...expandedTopics, topicId]);
    }
  };

  const handleEditClick = (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPrompt(prompt);
    setEditText(prompt.text);
  };

  const handleEditSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingPrompt && editText.trim()) {
      onPromptEdit(editingPrompt, editText.trim());
      setEditingPrompt(null);
      setEditText('');
    }
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPrompt(null);
    setEditText('');
  };

  const handleDeleteClick = (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${prompt.text}"?`)) {
      onPromptDelete(prompt);
    }
  };

  const handleAddClick = (topicId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddModal(topicId);
    setNewPromptText('');
  };

  const handleAddSave = (topicId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (newPromptText.trim()) {
      onPromptAdd(topicId, newPromptText.trim());
      setShowAddModal(null);
      setNewPromptText('');
    }
  };

  const handleAddCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddModal(null);
    setNewPromptText('');
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-headings)]">
          Prompts
        </h3>
        <div className="relative">
          <CalendarDays size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-caption)] pointer-events-none" />
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="text-xs border border-[var(--border-default)] rounded pl-7 pr-2 py-1 text-[var(--text-body)] bg-white font-data appearance-none"
          >
            {weeklyRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-4 py-2">Prompt</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-2 py-2 w-20">Volume</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-2 py-2 w-32">Sentiment</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-4 py-2 w-32">Topic</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-4 py-2 w-24">Actions</th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 450px)' }}>
        {topics.map((topic) => {
          const isExpanded = expandedTopics.includes(topic.id);
          const isAdding = showAddModal === topic.id;

          return (
            <div key={topic.id} className="border-b border-[var(--border-default)] last:border-b-0">
              <button
                onClick={() => toggleTopic(topic.id)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-[var(--bg-secondary)] transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-[var(--text-caption)]" />
                  ) : (
                    <ChevronRight size={16} className="text-[var(--text-caption)]" />
                  )}
                  <span className="text-sm font-semibold text-[var(--text-headings)]">
                    {topic.name}
                  </span>
                  <span className="text-xs text-[var(--text-caption)]">
                    ({topic.prompts.length})
                  </span>
                </div>
                {isExpanded && (
                  <button
                    onClick={(e) => handleAddClick(topic.id, e)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
                    title="Add prompt"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                )}
              </button>

              {isExpanded && (
                <div>
                  {isAdding && (
                    <tr className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newPromptText}
                            onChange={(e) => setNewPromptText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSave(topic.id, e as any);
                              } else if (e.key === 'Escape') {
                                handleAddCancel(e as any);
                              }
                            }}
                            placeholder="Enter new prompt text..."
                            className="flex-1 px-3 py-1.5 text-sm border border-[var(--border-default)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleAddSave(topic.id, e)}
                            disabled={!newPromptText.trim()}
                            className="px-3 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleAddCancel}
                            className="px-3 py-1.5 text-xs border border-[var(--border-default)] rounded hover:bg-[var(--bg-secondary)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  <table className="w-full">
                    <tbody>
                      {topic.prompts.map((prompt) => {
                        const isSelected = selectedPromptId === prompt.id;
                        const isEditing = editingPrompt?.id === prompt.id;

                        return (
                          <tr
                            key={prompt.id}
                            onClick={() => !isEditing && onPromptSelect(prompt)}
                            className={`border-t border-[var(--border-default)] transition-all ${
                              isSelected && !isEditing
                                ? 'bg-[var(--accent-light)]'
                                : isEditing
                                ? 'bg-[var(--bg-secondary)]'
                                : 'hover:bg-[var(--bg-secondary)]'
                            } ${!isEditing ? 'cursor-pointer' : ''}`}
                          >
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleEditSave(e as any);
                                    } else if (e.key === 'Escape') {
                                      handleEditCancel(e as any);
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-[var(--border-default)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              ) : (
                                <p className="text-sm line-clamp-2 text-[var(--text-body)] font-data">
                                  {prompt.text}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-3 w-20 text-center">
                              <span className="text-sm font-data text-[var(--text-body)]">
                                {prompt.volume}%
                              </span>
                            </td>
                            <td className="px-2 py-3 w-32">
                              <div className="flex items-center justify-center gap-2">
                                {getSentimentIcon(prompt.sentiment)}
                                <span className="text-xs text-[var(--text-caption)] whitespace-nowrap font-data">
                                  {getSentimentLabel(prompt.sentiment)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 w-32 text-center">
                              <span className="text-xs text-[var(--text-caption)] font-data">
                                {topic.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 w-24">
                              <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={handleEditSave}
                                      className="p-1 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
                                      title="Save"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={handleEditCancel}
                                      className="p-1 text-[var(--text-caption)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
                                      title="Cancel"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => handleEditClick(prompt, e)}
                                      className="p-1 text-[var(--text-caption)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
                                      title="Edit prompt"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteClick(prompt, e)}
                                      className="p-1 text-[var(--text-caption)] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                      title="Delete prompt"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

