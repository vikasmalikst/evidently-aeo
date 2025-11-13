import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import type { PromptConfig } from '../../utils/impactCalculator';

interface PromptEditorProps {
  prompts: PromptConfig[];
  onAdd: (text: string, topic: string) => void;
  onEdit: (id: number, oldText: string, newText: string) => void;
  onRemove: (id: number, text: string) => void;
  pendingChanges: {
    added: Array<{ text: string; topic: string }>;
    removed: Array<{ id: number; text: string }>;
    edited: Array<{ id: number; oldText: string; newText: string }>;
  };
}

export const PromptEditor = ({
  prompts,
  onAdd,
  onEdit,
  onRemove,
  pendingChanges
}: PromptEditorProps) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptTopic, setNewPromptTopic] = useState('');

  const handleStartEdit = (prompt: PromptConfig) => {
    setEditingId(prompt.id);
    setEditText(prompt.text);
  };

  const handleSaveEdit = (id: number, oldText: string) => {
    if (editText.trim() && editText !== oldText) {
      onEdit(id, oldText, editText.trim());
    }
    setEditingId(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleAddPrompt = () => {
    if (newPromptText.trim() && newPromptTopic.trim()) {
      onAdd(newPromptText.trim(), newPromptTopic.trim());
      setNewPromptText('');
      setNewPromptTopic('');
      setShowAddForm(false);
    }
  };

  const isRemoved = (id: number) => {
    return pendingChanges.removed.some(r => r.id === id);
  };

  const isEdited = (id: number) => {
    return pendingChanges.edited.some(e => e.id === id);
  };

  const getEditedText = (id: number) => {
    const edit = pendingChanges.edited.find(e => e.id === id);
    return edit?.newText;
  };

  const selectedPrompts = prompts.filter(p => p.isSelected && !isRemoved(p.id));

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Prompts
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Prompt
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-headings)] mb-1.5">
                Prompt Text
              </label>
              <textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder="Enter your prompt..."
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-headings)] mb-1.5">
                Topic
              </label>
              <input
                type="text"
                value={newPromptTopic}
                onChange={(e) => setNewPromptTopic(e.target.value)}
                placeholder="Enter topic..."
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAddPrompt}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
              >
                <Check size={16} />
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewPromptText('');
                  setNewPromptTopic('');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {selectedPrompts.length === 0 && !showAddForm && (
          <div className="text-center py-8 text-[var(--text-caption)]">
            No prompts selected. Add a prompt to get started.
          </div>
        )}

        {selectedPrompts.map((prompt) => {
          const isEditing = editingId === prompt.id;
          const editedText = getEditedText(prompt.id);
          const displayText = editedText || prompt.text;

          return (
            <div
              key={prompt.id}
              className={`p-3 rounded-lg border transition-colors ${
                isRemoved(prompt.id)
                  ? 'bg-[var(--text-error)]/10 border-[var(--text-error)] opacity-50'
                  : isEdited(prompt.id)
                  ? 'bg-[var(--text-warning)]/10 border-[var(--text-warning)]'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-default)]'
              }`}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveEdit(prompt.id, prompt.text)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[var(--success500)] hover:bg-[var(--success500)]/10 transition-colors font-medium"
                    >
                      <Check size={14} />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[var(--text-caption)] bg-white px-2 py-0.5 rounded border border-[var(--border-default)]">
                        {prompt.topic}
                      </span>
                      {prompt.type === 'custom' && (
                        <span className="text-xs text-[var(--text-caption)]">Custom</span>
                      )}
                      {isEdited(prompt.id) && (
                        <span className="text-xs text-[var(--text-warning)] font-semibold">Edited</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-body)] leading-relaxed">{displayText}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleStartEdit(prompt)}
                      className="p-1.5 rounded hover:bg-white transition-colors"
                      aria-label="Edit prompt"
                    >
                      <Edit2 size={16} className="text-[var(--text-body)]" />
                    </button>
                    <button
                      onClick={() => onRemove(prompt.id, prompt.text)}
                      className="p-1.5 rounded hover:bg-white transition-colors"
                      aria-label="Remove prompt"
                    >
                      <Trash2 size={16} className="text-[var(--text-error)]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Show added prompts */}
        {pendingChanges.added.map((added, index) => (
          <div
            key={`added-${index}`}
            className="p-3 rounded-lg border bg-[var(--success500)]/10 border-[var(--success500)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[var(--text-caption)] bg-white px-2 py-0.5 rounded border border-[var(--border-default)]">
                    {added.topic}
                  </span>
                  <span className="text-xs text-[var(--success500)] font-semibold">New</span>
                </div>
                <p className="text-sm text-[var(--text-body)] leading-relaxed">{added.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

