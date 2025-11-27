import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, CalendarDays, Plus, Edit2, Trash2, X, Check, RotateCcw } from 'lucide-react';
import { Topic, Prompt } from '../../api/promptManagementApi';
import { PendingChangesIndicator } from '../PromptConfiguration/PendingChangesIndicator';
import { RecalibrationWarning } from '../PromptConfiguration/RecalibrationWarning';
import { RecalibrationInfoModal } from '../PromptConfiguration/RecalibrationInfoModal';
import { ImpactPreviewModal } from '../PromptConfiguration/ImpactPreviewModal';
import { RecalibrationSuccessState } from '../PromptConfiguration/RecalibrationSuccessState';
import { useImpactCalculation } from '../../hooks/useImpactCalculation';
import { useRecalibrationLogic } from '../../hooks/useRecalibrationLogic';
import { topicsToConfiguration } from '../../utils/promptConfigAdapter';
import {
  addPrompt,
  applyBatchChanges,
  calculateImpact as calculateImpactApi,
} from '../../api/promptManagementApi';
import type { PendingChanges } from '../../hooks/usePromptConfiguration';

interface PromptConfiguration {
  id: string;
  version: number;
  is_active: boolean;
  change_type: string;
  change_summary: string;
  topics: Topic[];
  created_at: string;
  analysis_count: number;
}

interface ManagePromptsListProps {
  brandId: string;
  topics: Topic[];
  selectedPromptId: number | null;
  onPromptSelect: (prompt: Prompt, topicName: string) => void;
  onPromptEdit: (prompt: Prompt, newText: string) => void;
  onPromptDelete: (prompt: Prompt) => void;
  onPromptAdd: (topicId: number, prompt: Prompt) => void;
  onTopicsReplace?: (topics: Topic[]) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onChangesApplied?: () => void;
  currentConfigVersion?: number;
  configHistory?: PromptConfiguration[];
  selectedVersion?: number | null;
  onVersionChange?: (version: number | null) => void;
}

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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
  });
};

const uuidSegmentToNumber = (uuid: string): number => {
  if (!uuid) {
    return Date.now();
  }
  const [segment] = uuid.split('-');
  const parsed = parseInt(segment || '0', 16);
  return Number.isNaN(parsed) ? Date.now() : parsed % 1000000;
};

const resolveBackendId = (
  entryId: number,
  promptId: string | undefined,
  fallbackMap: Map<number, string>
): string => {
  if (promptId) {
    return promptId;
  }
  const fallback = fallbackMap.get(entryId);
  if (fallback) {
    return fallback;
  }
  return entryId.toString();
};

export const ManagePromptsList = ({ 
  brandId,
  topics, 
  selectedPromptId, 
  onPromptSelect,
  onPromptEdit,
  onPromptDelete,
  onPromptAdd,
  onTopicsReplace,
  dateRange, 
  onDateRangeChange,
  onChangesApplied,
  currentConfigVersion,
  configHistory = [],
  selectedVersion,
  onVersionChange
}: ManagePromptsListProps) => {
  const [expandedTopics, setExpandedTopics] = useState<number[]>([1]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editText, setEditText] = useState('');
  const [showAddModal, setShowAddModal] = useState<number | null>(null);
  const [newPromptText, setNewPromptText] = useState('');
  const [originalPrompts, setOriginalPrompts] = useState<Map<number, Prompt>>(new Map());
  const [newlyAddedPromptIds, setNewlyAddedPromptIds] = useState<Set<number>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    added: [],
    removed: [],
    edited: []
  });
  const [revertingToVersion, setRevertingToVersion] = useState<number | null>(null);
  const weeklyRanges = getWeeklyDateRanges();
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);
  const versionMenuRef = useRef<HTMLDivElement | null>(null);
  const promptIdMap = useMemo(() => {
    const map = new Map<number, string>();
    topics.forEach(topic => {
      topic.prompts.forEach(prompt => {
        if (typeof prompt.id === 'number' && prompt.queryId) {
          map.set(prompt.id, prompt.queryId);
        }
      });
    });
    return map;
  }, [topics]);

  // Initialize original prompts map on mount and when topics change
  useEffect(() => {
    const originalMap = new Map<number, Prompt>();
    topics.forEach(topic => {
      topic.prompts.forEach(prompt => {
        originalMap.set(prompt.id, { ...prompt });
      });
    });
    setOriginalPrompts(originalMap);
  }, [topics]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionMenuRef.current && !versionMenuRef.current.contains(event.target as Node)) {
        setIsVersionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Convert topics to configuration format for impact calculation
  const currentConfig = useMemo(() => {
    return topicsToConfiguration(topics, 94, 72.4);
  }, [topics]);
  const sortedConfigHistory = useMemo(
    () => [...configHistory].sort((a, b) => b.version - a.version),
    [configHistory]
  );
  const currentConfigEntry = useMemo(
    () => configHistory.find(config => config.version === currentConfigVersion),
    [configHistory, currentConfigVersion]
  );

  // Calculate effective config with pending changes
  const effectiveConfig = useMemo(() => {
    const effectivePrompts = [...currentConfig.prompts];
    
    // Apply removals
    pendingChanges.removed.forEach(({ id }) => {
      const index = effectivePrompts.findIndex(p => p.id === id);
      if (index >= 0) {
        effectivePrompts[index] = { ...effectivePrompts[index], isSelected: false };
      }
    });

    // Apply edits
    pendingChanges.edited.forEach(({ id, newText }) => {
      const index = effectivePrompts.findIndex(p => p.id === id);
      if (index >= 0) {
        effectivePrompts[index] = { ...effectivePrompts[index], text: newText };
      }
    });

    // Add new prompts
    pendingChanges.added.forEach(({ text, topic }) => {
      effectivePrompts.push({
        id: -Date.now(),
        text,
        topic,
        type: 'custom',
        isSelected: true
      });
    });

    return {
      ...currentConfig,
      prompts: effectivePrompts.filter(p => p.isSelected)
    };
  }, [currentConfig, pendingChanges]);

  // Impact calculation hook
  const { impact, calculateImpactEstimate } = useImpactCalculation(
    currentConfig,
    pendingChanges
  );

  // Recalibration logic hook
  const {
    isPreviewModalOpen,
    isSubmitting,
    submitted,
    error,
    openPreviewModal,
    closePreviewModal,
    submitRecalibration,
    resetState,
    setSubmissionError
  } = useRecalibrationLogic();

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const hasPendingChanges = pendingChanges.added.length > 0 || 
                           pendingChanges.removed.length > 0 || 
                           pendingChanges.edited.length > 0;
  const backendChanges = useMemo(() => ({
    added: pendingChanges.added.map(change => ({
      text: change.text,
      topic: change.topic
    })),
    removed: pendingChanges.removed.map(change => ({
      id: resolveBackendId(change.id, change.promptId, promptIdMap),
      text: change.text
    })),
    edited: pendingChanges.edited.map(change => ({
      id: resolveBackendId(change.id, change.promptId, promptIdMap),
      newText: change.newText,
      oldText: change.oldText
    }))
  }), [pendingChanges, promptIdMap]);
  const selectedConfigMeta =
    selectedVersion !== null && selectedVersion !== undefined
      ? configHistory.find(config => config.version === selectedVersion)
      : configHistory.find(config => config.version === currentConfigVersion);
  const versionButtonLabel =
    selectedVersion === null || selectedVersion === undefined
      ? `Current (v${currentConfigVersion ?? 0})`
      : `Viewing v${selectedVersion}`;
  const versionButtonCaption = selectedConfigMeta
    ? `${formatDate(selectedConfigMeta.created_at)} • ${selectedConfigMeta.change_summary}`
    : 'No configuration history yet';

  // Check if a prompt has pending changes
  const getPromptChangeType = (promptId: number): 'added' | 'edited' | 'removed' | null => {
    // Check if this is a newly added prompt
    if (newlyAddedPromptIds.has(promptId)) {
      return 'added';
    }
    // Check if it's been edited
    if (pendingChanges.edited.some(e => e.id === promptId)) {
      return 'edited';
    }
    // Check if it's been removed
    if (pendingChanges.removed.some(r => r.id === promptId)) {
      return 'removed';
    }
    return null;
  };

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
      const originalText = originalPrompts.get(editingPrompt.id)?.text || editingPrompt.text;
      const newText = editText.trim();
      const backendId = resolveBackendId(editingPrompt.id, editingPrompt.queryId, promptIdMap);
      
      // Track as pending change if different from original
      if (newText !== originalText) {
        setPendingChanges(prev => {
          const existingEdit = prev.edited.find(e => e.id === editingPrompt.id);
          if (existingEdit) {
            return {
              ...prev,
              edited: prev.edited.map(e => 
                e.id === editingPrompt.id ? { ...e, newText, promptId: backendId } : e
              )
            };
          }
          return {
            ...prev,
            edited: [...prev.edited, { 
              id: editingPrompt.id, 
              oldText: originalText, 
              newText,
              promptId: backendId
            }]
          };
        });
      } else {
        // Remove from pending changes if reverted to original
        setPendingChanges(prev => ({
          ...prev,
          edited: prev.edited.filter(e => e.id !== editingPrompt.id)
        }));
      }
      
      onPromptEdit(editingPrompt, newText);
      setEditingPrompt(null);
      setEditText('');
    }
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPrompt(null);
    setEditText('');
  };

  const handleDeleteClick = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation();
    const backendId = resolveBackendId(prompt.id, prompt.queryId, promptIdMap);
    
    // If it was a newly added prompt, just remove it from added list
    if (newlyAddedPromptIds.has(prompt.id)) {
      setPendingChanges(prev => ({
        ...prev,
        added: prev.added.filter(a => {
          if (a.promptId && backendId) {
            return a.promptId !== backendId;
          }
          return a.text !== prompt.text;
        })
      }));
      setNewlyAddedPromptIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(prompt.id);
        return newSet;
      });
    } else {
      // Track as pending change for existing prompts - this will trigger the warning section
      setPendingChanges(prev => ({
        ...prev,
        removed: [...prev.removed, { id: prompt.id, text: prompt.text, promptId: backendId }],
        // Remove from edited if it was being edited
        edited: prev.edited.filter(e => e.id !== prompt.id)
      }));
    }
    
    // Delete the prompt immediately - user can preview impact and confirm/revert later
    // Note: We don't call API here - deletion happens on batch apply
    onPromptDelete(prompt);
  };

  const handleAddClick = (topicId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddModal(topicId);
    setNewPromptText('');
  };

  const handleAddSave = async (topicId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (newPromptText.trim()) {
      const topic = topics.find(t => t.id === topicId);
      const promptText = newPromptText.trim();
      
      try {
        // Add prompt via API (but don't create version yet - that happens on batch apply)
        const { promptId } = await addPrompt(brandId, promptText, topic?.name || 'Uncategorized');
        const derivedId = uuidSegmentToNumber(promptId);
        const now = new Date().toISOString();
        const newPrompt: Prompt = {
          id: derivedId,
          text: promptText,
          response: '',
          lastUpdated: now,
          sentiment: 0,
          volume: 0,
          keywords: {
            brand: [],
            target: [],
            top: []
          },
          queryId: promptId,
          createdAt: now,
          source: 'custom'
        };
        
        // Track as pending change and mark as newly added
        setPendingChanges(prev => ({
          ...prev,
          added: [...prev.added, { text: promptText, topic: topic?.name || '', promptId }]
        }));
        setNewlyAddedPromptIds(prev => new Set([...prev, derivedId]));
        
        onPromptAdd(topicId, newPrompt);
        setShowAddModal(null);
        setNewPromptText('');
      } catch (err) {
        console.error('Error adding prompt:', err);
        // Still add to UI for optimistic update, but mark as error
      }
    }
  };

  const handleAddCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddModal(null);
    setNewPromptText('');
  };

  const handlePreviewClick = async () => {
    // Use real API for impact calculation (optional - falls back to local if fails)
    try {
      await calculateImpactApi(brandId, backendChanges);
    } catch (apiErr) {
      console.warn('API impact calculation failed, using local calculation:', apiErr);
    }
    
    // Use local calculation for now (can be enhanced to use API result)
    await calculateImpactEstimate();
    openPreviewModal();
  };

  const handleConfirm = async () => {
    if (!impact) return;

    try {
      // If reverting to a version, replace entire topics structure to match selected version exactly
      if (revertingToVersion !== null && onTopicsReplace) {
        const selectedConfig = configHistory.find(c => c.version === revertingToVersion);
        if (selectedConfig) {
          // Deep clone the selected config's topics to avoid reference issues
          const revertedTopics = selectedConfig.topics.map(topic => ({
            ...topic,
            prompts: topic.prompts.map(prompt => ({ ...prompt }))
          }));
          onTopicsReplace(revertedTopics);
        }
      }

      // Apply batch changes via API
      const changeSummary = generateChangeSummary(pendingChanges);
      await applyBatchChanges(brandId, backendChanges, changeSummary);

      await submitRecalibration(pendingChanges, impact);
      
      // Clear pending changes and reset original prompts
      setPendingChanges({ added: [], removed: [], edited: [] });
      setNewlyAddedPromptIds(new Set());
      setRevertingToVersion(null);
      const newOriginalMap = new Map<number, Prompt>();
      topics.forEach(topic => {
        topic.prompts.forEach(prompt => {
          newOriginalMap.set(prompt.id, { ...prompt });
        });
      });
      setOriginalPrompts(newOriginalMap);
      
      if (onChangesApplied) {
        onChangesApplied();
      }
    } catch (err) {
      console.error('Error applying changes:', err);
      setSubmissionError('Failed to apply changes. Please try again.');
      return;
    }
  };

  // Helper function to generate change summary
  const generateChangeSummary = (changes: PendingChanges): string => {
    const parts: string[] = [];
    if (changes.added.length > 0) {
      parts.push(`Added ${changes.added.length} prompt${changes.added.length > 1 ? 's' : ''}`);
    }
    if (changes.removed.length > 0) {
      parts.push(`Removed ${changes.removed.length} prompt${changes.removed.length > 1 ? 's' : ''}`);
    }
    if (changes.edited.length > 0) {
      parts.push(`Edited ${changes.edited.length} prompt${changes.edited.length > 1 ? 's' : ''}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'No changes';
  };

  const handleMakeMoreChanges = () => {
    resetState();
    setPendingChanges({ added: [], removed: [], edited: [] });
    setNewlyAddedPromptIds(new Set());
    setRevertingToVersion(null);
  };

  const handleModalClose = () => {
    closePreviewModal();
    // If closing without confirming a revert, clear the revert state
    if (revertingToVersion !== null) {
      setPendingChanges({ added: [], removed: [], edited: [] });
      setRevertingToVersion(null);
    }
  };

  const handleRevertVersion = useCallback(async () => {
    if (selectedVersion === null || selectedVersion === undefined || !currentConfigVersion) return;
    
    const selectedConfig = configHistory.find(c => c.version === selectedVersion);
    if (!selectedConfig) return;

    // Create a map of current prompts by ID for easy lookup
    const currentPromptsById = new Map<number, { prompt: Prompt; topicName: string; topicId: number }>();
    topics.forEach(topic => {
      topic.prompts.forEach(prompt => {
        currentPromptsById.set(prompt.id, { prompt, topicName: topic.name, topicId: topic.id });
      });
    });

    // Create a map of current prompts by topic+text for comparison
    const currentPromptsByKey = new Map<string, { prompt: Prompt; topicName: string; topicId: number }>();
    topics.forEach(topic => {
      topic.prompts.forEach(prompt => {
        const key = `${topic.name}:${prompt.text}`;
        currentPromptsByKey.set(key, { prompt, topicName: topic.name, topicId: topic.id });
      });
    });

    // Create a map of selected version prompts by topic+text
    const selectedPromptsByKey = new Map<string, { prompt: Prompt; topicName: string; topicId: number }>();
    selectedConfig.topics.forEach(topic => {
      topic.prompts.forEach(prompt => {
        const key = `${topic.name}:${prompt.text}`;
        selectedPromptsByKey.set(key, { prompt, topicName: topic.name, topicId: topic.id });
      });
    });

    // Calculate differences - DON'T apply changes yet, just calculate
    const added: Array<{ text: string; topic: string; promptId?: string }> = [];
    const removed: Array<{ id: number; text: string; promptId?: string }> = [];
    const edited: Array<{ id: number; oldText: string; newText: string; promptId?: string }> = [];

    // Find prompts in selected version that don't exist in current (by text+topic)
    selectedConfig.topics.forEach(topic => {
      topic.prompts.forEach(selectedPrompt => {
        const key = `${topic.name}:${selectedPrompt.text}`;
        const existsInCurrent = currentPromptsByKey.has(key);
        
        if (!existsInCurrent) {
          // Check if there's a prompt with same ID but different text (edit)
          const currentPromptData = currentPromptsById.get(selectedPrompt.id);
          if (currentPromptData && currentPromptData.prompt.text !== selectedPrompt.text) {
            edited.push({
              id: selectedPrompt.id,
              oldText: currentPromptData.prompt.text,
              newText: selectedPrompt.text,
              promptId: selectedPrompt.queryId
            });
          } else {
            // New prompt to add (topic may or may not exist)
            added.push({ text: selectedPrompt.text, topic: topic.name, promptId: selectedPrompt.queryId });
          }
        }
      });
    });

    // Find prompts in current that don't exist in selected version
    topics.forEach(topic => {
      topic.prompts.forEach(currentPrompt => {
        const key = `${topic.name}:${currentPrompt.text}`;
        const existsInSelected = selectedPromptsByKey.has(key);
        
        if (!existsInSelected) {
          // Check if this prompt ID exists in selected version with different text (already handled as edit)
          const existsAsEdit = selectedConfig.topics.some(t => 
            t.prompts.some(p => p.id === currentPrompt.id && p.text !== currentPrompt.text)
          );
          
          if (!existsAsEdit) {
            // This prompt should be removed
            removed.push({ id: currentPrompt.id, text: currentPrompt.text, promptId: currentPrompt.queryId });
          }
        }
      });
    });

    // Set pending changes - this will trigger the recalibration warning
    setPendingChanges({
      added,
      removed,
      edited
    });
    
    // Store which version we're reverting to
    setRevertingToVersion(selectedVersion);
    
    // Switch back to viewing current version so user can see the proposed changes
    if (onVersionChange) {
      onVersionChange(null);
    }

    // Calculate impact and open preview modal
    await calculateImpactEstimate();
    openPreviewModal();
  }, [selectedVersion, currentConfigVersion, configHistory, topics, onVersionChange, calculateImpactEstimate, openPreviewModal]);

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden h-full">
      {/* Progressive Disclosure Workflow - Above prompts section */}
      {hasPendingChanges && !submitted && (
        <div className="border-b border-[var(--border-default)] p-4 bg-[var(--text-warning)]/20">
          <PendingChangesIndicator changes={pendingChanges} />
          
          <RecalibrationWarning
            onToggleExplanation={() => setIsInfoModalOpen(true)}
            onPreviewClick={handlePreviewClick}
          />

          {error && (
            <div className="mt-3 p-3 bg-[var(--text-error)]/10 border border-[var(--text-error)] rounded-lg">
              <p className="text-sm text-[var(--text-error)]">{error}</p>
            </div>
          )}
        </div>
      )}

      {submitted && (
        <div className="border-b border-[var(--border-default)] p-4">
          <RecalibrationSuccessState
            changes={pendingChanges}
            onViewChart={() => window.location.href = '/prompts'}
            onMakeMoreChanges={handleMakeMoreChanges}
          />
        </div>
      )}

      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-headings)]">
          Prompts
        </h3>
        <div className="flex items-center gap-3">
        {currentConfigVersion && configHistory.length > 0 && onVersionChange && (
          <div className="relative" ref={versionMenuRef}>
            <button
              type="button"
              onClick={() => setIsVersionMenuOpen(prev => !prev)}
              className="flex items-center gap-3 px-4 py-2 border border-[var(--border-default)] rounded-xl bg-white hover:shadow-sm transition-all"
            >
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-caption)] mb-0.5">
                  Configuration
                </p>
                <p className="text-sm font-semibold text-[var(--text-headings)]">
                  {versionButtonLabel}
                </p>
                <p className="text-[11px] text-[var(--text-caption)] line-clamp-1 max-w-[200px]">
                  {versionButtonCaption}
                </p>
              </div>
              <ChevronDown
                size={16}
                className={`text-[var(--text-caption)] transition-transform ${isVersionMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isVersionMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[var(--border-default)] rounded-2xl shadow-xl z-20 overflow-hidden">
                <div className="p-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                  <p className="text-sm font-semibold text-[var(--text-headings)]">Select version</p>
                  <p className="text-xs text-[var(--text-caption)]">Switch between saved configurations</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <button
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors ${
                      selectedVersion === null ? 'bg-[var(--bg-secondary)]' : ''
                    }`}
                    onClick={() => {
                      onVersionChange(null);
                      setIsVersionMenuOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-[var(--text-headings)]">
                        Current (v{currentConfigVersion})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success500)]/15 text-[var(--success500)] font-semibold">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-caption)]">
                      {currentConfigEntry ? formatDate(currentConfigEntry.created_at) : 'Awaiting first version'}
                    </p>
                  </button>
                  {sortedConfigHistory
                    .filter(config => config.version !== currentConfigVersion)
                    .map(config => (
                    <button
                      key={config.id}
                      className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors ${
                        selectedVersion === config.version ? 'bg-[var(--bg-secondary)]' : 'bg-white'
                      }`}
                      onClick={() => {
                        onVersionChange(config.version === currentConfigVersion ? null : config.version);
                        setIsVersionMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--text-headings)]">
                          Version v{config.version}
                        </span>
                        {config.version === currentConfigVersion && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success500)]/15 text-[var(--success500)] font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-caption)] mb-1">
                        {formatDate(config.created_at)}
                      </p>
                      <p className="text-xs text-[var(--text-body)] line-clamp-2">
                        {config.change_summary}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
      </div>

      {/* Version info and revert button */}
      {currentConfigVersion && configHistory.length > 0 && onVersionChange && selectedVersion !== null && selectedVersion !== undefined && selectedVersion !== currentConfigVersion && (() => {
        const selectedConfig = configHistory.find(c => c.version === selectedVersion);
        return (
          <div className="px-4 py-2 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: '#ca8a04' }}>
                Configuration Version v{selectedVersion} • {selectedConfig ? formatDate(selectedConfig.created_at) : ''}
              </span>
              <button
                onClick={handleRevertVersion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[var(--border-default)] text-xs font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                title={`Revert to version ${selectedVersion}`}
              >
                <RotateCcw size={14} />
                Revert to v{selectedVersion}
              </button>
            </div>
          </div>
        );
      })()}

      <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 450px)' }}>
        {topics.map((topic) => {
          const isExpanded = expandedTopics.includes(topic.id);
          const isAdding = showAddModal === topic.id;

          return (
            <div key={topic.id} className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => toggleTopic(topic.id)}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-[var(--text-caption)]" />
                  ) : (
                    <ChevronRight size={16} className="text-[var(--text-caption)]" />
                  )}
                  <span className="text-base font-semibold text-[var(--text-headings)]">
                    {topic.name}
                  </span>
                  <span className="text-xs text-[var(--text-caption)]">
                    ({topic.prompts.length})
                  </span>
                </button>
                {isExpanded && !isAdding && (selectedVersion === null || selectedVersion === undefined) && (
                  <button
                    onClick={(e) => handleAddClick(topic.id, e)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                    title="Add prompt"
                  >
                    <Plus size={16} />
                    Add Prompt
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4">
                  {/* Add Prompt Form */}
                  {isAdding && (
                    <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-headings)] mb-1.5">
                            Prompt Text
                          </label>
                          <textarea
                            value={newPromptText}
                            onChange={(e) => setNewPromptText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                handleAddSave(topic.id, e as any);
                              } else if (e.key === 'Escape') {
                                handleAddCancel(e as any);
                              }
                            }}
                            placeholder="Enter your prompt..."
                            className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all resize-none"
                            rows={2}
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            onClick={handleAddCancel}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                          >
                            <X size={16} />
                            Cancel
                          </button>
                          <button
                            onClick={(e) => handleAddSave(topic.id, e)}
                            disabled={!newPromptText.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check size={16} />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Prompts Cards */}
                  <div className="space-y-2">
                    {topic.prompts.map((prompt) => {
                      const isSelected = selectedPromptId === prompt.id;
                      const isEditing = editingPrompt?.id === prompt.id;
                      const changeType = getPromptChangeType(prompt.id);

                      const getCardStyles = () => {
                        if (changeType === 'removed') {
                          return 'bg-[var(--text-error)]/10 border-[var(--text-error)] opacity-50';
                        }
                        if (changeType === 'edited') {
                          return 'bg-[var(--text-warning)]/10 border-[var(--text-warning)]';
                        }
                        if (changeType === 'added') {
                          return 'bg-[var(--success500)]/10 border-[var(--success500)]';
                        }
                        if (isSelected && !isEditing) {
                          return 'bg-[var(--accent-light)] border-[var(--accent-primary)]';
                        }
                        return 'bg-[var(--bg-secondary)] border-[var(--border-default)]';
                      };

                      return (
                        <div
                          key={prompt.id}
                          onClick={() => !isEditing && onPromptSelect(prompt, topic.name)}
                          className={`p-3 rounded-lg border transition-colors ${getCardStyles()} ${
                            !isEditing ? 'cursor-pointer hover:shadow-sm' : ''
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    handleEditSave(e as any);
                                  } else if (e.key === 'Escape') {
                                    handleEditCancel(e as any);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all resize-none"
                                onClick={(e) => e.stopPropagation()}
                                rows={3}
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={handleEditCancel}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                  <X size={14} />
                                  Cancel
                                </button>
                                <button
                                  onClick={handleEditSave}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-[var(--success500)] hover:bg-[var(--success500)]/10 transition-colors font-medium"
                                >
                                  <Check size={14} />
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[var(--text-body)] leading-relaxed mb-1.5">
                                  {prompt.text}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-normal text-[var(--text-caption)] bg-white px-2 py-0.5 rounded-full border border-[var(--border-default)]">
                                    {topic.name}
                                  </span>
                                  {changeType === 'edited' && (
                                    <span className="text-xs text-[var(--text-warning)] font-semibold">Edited</span>
                                  )}
                                  {changeType === 'added' && (
                                    <span className="text-xs text-[var(--success500)] font-semibold">New</span>
                                  )}
                                  {prompt.source === 'custom' && (
                                    <span className="text-xs text-[var(--text-caption)]">Custom</span>
                                  )}
                                </div>
                              </div>
                              {(selectedVersion === null || selectedVersion === undefined) && (
                                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => handleEditClick(prompt, e)}
                                    className="p-1.5 rounded hover:bg-white transition-colors"
                                    aria-label="Edit prompt"
                                  >
                                    <Edit2 size={16} className="text-[var(--text-body)]" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteClick(prompt, e)}
                                    className="p-1.5 rounded hover:bg-white transition-colors"
                                    aria-label="Remove prompt"
                                  >
                                    <Trash2 size={16} className="text-[var(--text-error)]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Impact Preview Modal */}
      <ImpactPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={handleModalClose}
        onConfirm={handleConfirm}
        currentConfig={currentConfig}
        effectiveConfig={effectiveConfig}
        pendingChanges={pendingChanges}
        impact={impact}
        isSubmitting={isSubmitting}
      />

      {/* Recalibration Info Modal */}
      <RecalibrationInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
};

