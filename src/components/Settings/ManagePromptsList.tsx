import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import { ChevronDown, ChevronRight, CalendarDays, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
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
import { formatDateWithYear } from '../../utils/dateFormatting';
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
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onChangesApplied?: () => void;
  currentConfigVersion?: number;
  configHistory?: PromptConfiguration[];
  selectedVersion?: number | null;
  onVersionChange?: (version: number | null) => void;
  visibilityScore?: number;
  coverage?: number;
  isLoading?: boolean;
  showVersionSelector?: boolean;
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

const formatDate = formatDateWithYear;

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
  dateRange, 
  onDateRangeChange,
  onChangesApplied,
  currentConfigVersion,
  configHistory = [],
  selectedVersion,
  onVersionChange,
  visibilityScore = 72.4,
  coverage = 94,
  isLoading = false,
  showVersionSelector = true
}: ManagePromptsListProps) => {
  const [expandedTopics, setExpandedTopics] = useState<number[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [editText, setEditText] = useState('');
  const [showAddModal, setShowAddModal] = useState<number | null>(null);
  const [showGlobalAddModal, setShowGlobalAddModal] = useState(false);
  const [selectedTopicForAdd, setSelectedTopicForAdd] = useState<number | null>(null);
  const [newPromptText, setNewPromptText] = useState('');
  const [originalPrompts, setOriginalPrompts] = useState<Map<number, Prompt>>(new Map());
  const [newlyAddedPromptIds, setNewlyAddedPromptIds] = useState<Set<number>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    added: [],
    removed: [],
    edited: []
  });
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
    
    // Reset expanded topics when topics change (e.g., when switching versions)
    // Expand first topic by default if there are topics
    if (topics.length > 0) {
      setExpandedTopics([topics[0].id]);
    } else {
      setExpandedTopics([]);
    }
  }, [topics]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionMenuRef.current && !versionMenuRef.current.contains(event.target as Node)) {
        setIsVersionMenuOpen(false);
      }
    };

    if (isVersionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isVersionMenuOpen]);

  // Convert topics to configuration format for impact calculation
  const currentConfig = useMemo(() => {
    return topicsToConfiguration(topics, coverage, visibilityScore);
  }, [topics, coverage, visibilityScore]);
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
  const backendChanges = useMemo(() => {
    // Build resolved changes - use stored promptId directly since it's saved when the change was made
    const resolvedChanges = {
      added: pendingChanges.added.map(change => ({
        text: change.text,
        topic: change.topic
      })),
      removed: pendingChanges.removed.map(change => {
        // The promptId was stored when the deletion was initiated
        // This should be the UUID from generated_queries table
        const backendId = change.promptId;
        if (!backendId) {
          // Fallback: try to resolve from map (prompt might still be in topics)
          const resolved = resolveBackendId(change.id, undefined, promptIdMap);
          if (!resolved || resolved === change.id.toString()) {
            console.error('❌ Missing backend ID for removed prompt:', {
              change,
              resolved,
              promptIdMapSize: promptIdMap.size,
              promptIdMapHasId: promptIdMap.has(change.id)
            });
            throw new Error(`Missing query ID for prompt: "${change.text.substring(0, 50)}..."`);
          }
          return {
            id: resolved,
            text: change.text
          };
        }
        return {
          id: backendId,
          text: change.text
        };
      }),
      edited: pendingChanges.edited.map(change => {
        const backendId = change.promptId;
        if (!backendId) {
          const resolved = resolveBackendId(change.id, undefined, promptIdMap);
          if (!resolved || resolved === change.id.toString()) {
            console.error('❌ Missing backend ID for edited prompt:', {
              change,
              resolved,
              promptIdMapSize: promptIdMap.size
            });
            throw new Error(`Missing query ID for edited prompt: "${change.newText.substring(0, 50)}..."`);
          }
          return {
            id: resolved,
            newText: change.newText,
            oldText: change.oldText
          };
        }
        return {
          id: backendId,
          newText: change.newText,
          oldText: change.oldText
        };
      })
    };
    console.log('✅ Computed backendChanges:', resolvedChanges);
    return resolvedChanges;
  }, [pendingChanges, promptIdMap]);
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

  const handleEditSave = (event?: SyntheticEvent) => {
    event?.stopPropagation();
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

  const handleEditCancel = (event?: SyntheticEvent) => {
    event?.stopPropagation();
    setEditingPrompt(null);
    setEditText('');
  };

  const deletePrompt = useCallback((prompt: Prompt) => {
    const backendId = resolveBackendId(prompt.id, prompt.queryId, promptIdMap);
    
    // Validate that we have a proper backend ID (UUID, not numeric string)
    if (!backendId || backendId === prompt.id.toString()) {
      console.error('Cannot delete prompt: missing or invalid queryId', {
        prompt,
        backendId,
        queryId: prompt.queryId,
        promptIdMapHasId: promptIdMap.has(prompt.id)
      });
      setSubmissionError('Cannot delete prompt: missing query ID. Please refresh and try again.');
      return;
    }
    
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
    
    // Delete the prompt immediately - user can preview impact and confirm later
    // Note: We don't call API here - deletion happens on batch apply
    onPromptDelete(prompt);
  }, [newlyAddedPromptIds, onPromptDelete, promptIdMap, resolveBackendId, setSubmissionError]);

  const handleDeleteClick = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePrompt(prompt);
  };

  const handleAddClick = (topicId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddModal(topicId);
    setNewPromptText('');
  };

  const handleGlobalAddClick = () => {
    if (topics.length === 0) {
      // If no topics, can't add prompt
      return;
    }
    // If only one topic, directly open add modal for that topic
    if (topics.length === 1) {
      const topicId = topics[0].id;
      // Ensure topic is expanded so the form is visible
      if (!expandedTopics.includes(topicId)) {
        setExpandedTopics([...expandedTopics, topicId]);
      }
      setShowAddModal(topicId);
      setNewPromptText('');
    } else {
      // Multiple topics - show modal to select topic
      setShowGlobalAddModal(true);
      setSelectedTopicForAdd(topics[0]?.id || null);
      setNewPromptText('');
    }
  };

  const handleGlobalAddConfirm = () => {
    if (selectedTopicForAdd) {
      // Expand the selected topic if not already expanded
      if (!expandedTopics.includes(selectedTopicForAdd)) {
        setExpandedTopics([...expandedTopics, selectedTopicForAdd]);
      }
      // Close global modal and open topic-specific modal
      // Keep the prompt text if user already entered it
      setShowGlobalAddModal(false);
      setShowAddModal(selectedTopicForAdd);
    }
  };

  const handleGlobalAddCancel = () => {
    setShowGlobalAddModal(false);
    setSelectedTopicForAdd(null);
    setNewPromptText('');
  };

  const handleAddSave = async (topicId: number, event?: SyntheticEvent) => {
    event?.stopPropagation();
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
        const errorMessage = err instanceof Error 
          ? err.message 
          : typeof err === 'object' && err !== null && 'message' in err
          ? String(err.message)
          : 'Failed to add prompt. Please try again.';
        
        // Show error to user
        setSubmissionError(errorMessage);
        
        // Don't add to UI if there was an error - let user try again
      }
    }
  };

  const handleAddCancel = (event?: SyntheticEvent) => {
    event?.stopPropagation();
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
      const changeSummary = generateChangeSummary(pendingChanges);
      console.log('Applying batch changes:', { backendChanges, changeSummary });
      await applyBatchChanges(brandId, backendChanges, changeSummary);

      try {
        await submitRecalibration(pendingChanges, impact);
      } catch (recalErr) {
        console.warn('Recalibration submission warning:', recalErr);
      }
      
      closePreviewModal();
      
      if (onChangesApplied) {
        await onChangesApplied();
      }
      
      if (onVersionChange && selectedVersion !== null && selectedVersion !== undefined) {
        onVersionChange(null);
      }
      
      setPendingChanges({ added: [], removed: [], edited: [] });
      setNewlyAddedPromptIds(new Set());
    } catch (err) {
      console.error('Error applying changes:', err);
      console.error('Backend changes that failed:', backendChanges);
      console.error('Pending changes:', pendingChanges);
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'object' && err !== null && 'message' in err
        ? String(err.message)
        : 'Failed to apply changes. Please try again.';
      
      setSubmissionError(errorMessage || 'Failed to apply changes. Please try again.');
      closePreviewModal();
      
      try {
        if (onChangesApplied) {
          await onChangesApplied();
        }
        setPendingChanges({ added: [], removed: [], edited: [] });
        setNewlyAddedPromptIds(new Set());
      } catch (reloadErr) {
        console.error('Error reloading data after failed apply:', reloadErr);
      }
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
  };

  const handleModalClose = () => {
    closePreviewModal();
      setPendingChanges({ added: [], removed: [], edited: [] });
  };

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
        {showVersionSelector && currentConfigVersion && configHistory.length > 0 && onVersionChange && (
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
                    type="button"
                    className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors ${
                      selectedVersion === null ? 'bg-[var(--bg-secondary)]' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
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
                      type="button"
                      className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors ${
                        selectedVersion === config.version ? 'bg-[var(--bg-secondary)]' : 'bg-white'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newVersion = config.version === currentConfigVersion ? null : config.version;
                        onVersionChange(newVersion);
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
          {(selectedVersion === null || selectedVersion === undefined) && (
            <button
              onClick={handleGlobalAddClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
              title="Add prompt"
            >
              <Plus size={16} />
              Add Prompt
            </button>
          )}
        </div>
      </div>

      {/* Version info banner */}
      {currentConfigVersion &&
        configHistory.length > 0 &&
        onVersionChange &&
        selectedVersion !== null &&
        selectedVersion !== undefined &&
        selectedVersion !== currentConfigVersion && (() => {
        const selectedConfig = configHistory.find(c => c.version === selectedVersion);
        return (
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-[var(--accent-light)] border-b border-[var(--border-default)]">
              <div className="text-xs font-medium text-[var(--text-headings)]">
                Viewing configuration v{selectedVersion}{' '}
                {selectedConfig ? `from ${formatDate(selectedConfig.created_at)}` : ''}
                . This snapshot is read-only.
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onVersionChange(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent-primary)] text-[var(--accent-primary)] text-xs font-medium hover:bg-white transition-colors shadow-sm"
              >
                Return to current version
              </button>
          </div>
        );
      })()}

      <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 450px)' }}>
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-caption)]">Loading prompts...</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-caption)]">
              {selectedVersion !== null && selectedVersion !== undefined
                ? 'No prompts in this version'
                : 'No prompts found. Add your first prompt to get started.'}
            </p>
          </div>
        ) : (
          topics.map((topic) => {
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
                                handleAddSave(topic.id, e);
                              } else if (e.key === 'Escape') {
                                handleAddCancel(e);
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
                                    handleEditSave(e);
                                  } else if (e.key === 'Escape') {
                                    handleEditCancel(e);
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
          })
        )}
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

      {/* Global Add Prompt Modal */}
      {showGlobalAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleGlobalAddCancel}>
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
              Add Prompt
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                  Select Topic
                </label>
                <select
                  value={selectedTopicForAdd || ''}
                  onChange={(e) => setSelectedTopicForAdd(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)]"
                >
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                  Prompt Text
                </label>
                <textarea
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder="Enter your prompt..."
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-body)] bg-white focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all resize-none"
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleGlobalAddCancel}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  onClick={handleGlobalAddConfirm}
                  disabled={!newPromptText.trim() || !selectedTopicForAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={16} />
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

