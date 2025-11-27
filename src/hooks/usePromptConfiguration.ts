import { useState, useCallback, useMemo, useEffect } from 'react';
import type { PromptConfig } from '../utils/impactCalculator';

export interface CurrentConfiguration {
  prompts: PromptConfig[];
  coverage: number;
  visibilityScore: number;
  lastUpdated: string;
}

export interface PendingChanges {
  added: Array<{ text: string; topic: string; promptId?: string }>;
  removed: Array<{ id: number; text: string; promptId?: string }>;
  edited: Array<{ id: number; oldText: string; newText: string; promptId?: string }>;
}

export function usePromptConfiguration(initialConfig: CurrentConfiguration) {
  const [currentConfig, setCurrentConfig] = useState<CurrentConfiguration>(initialConfig);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    added: [],
    removed: [],
    edited: []
  });

  // Sync with external config changes (when changes are made outside the workflow)
  useEffect(() => {
    // Only update if the config actually changed (not just a reference change)
    const configChanged = 
      initialConfig.prompts.length !== currentConfig.prompts.length ||
      initialConfig.coverage !== currentConfig.coverage ||
      initialConfig.visibilityScore !== currentConfig.visibilityScore ||
      initialConfig.prompts.some((p, i) => {
        const existing = currentConfig.prompts[i];
        return !existing || p.id !== existing.id || p.text !== existing.text || p.isSelected !== existing.isSelected;
      });

    if (configChanged && pendingChanges.added.length === 0 && 
        pendingChanges.removed.length === 0 && pendingChanges.edited.length === 0) {
      // Only sync if there are no pending changes in the workflow
      setCurrentConfig(initialConfig);
    }
  }, [initialConfig, currentConfig, pendingChanges]);

  // Add a new prompt
  const addPrompt = useCallback((text: string, topic: string) => {
    setPendingChanges(prev => ({
      ...prev,
      added: [...prev.added, { text, topic }]
    }));
  }, []);

  // Remove a prompt
  const removePrompt = useCallback((id: number, text: string) => {
    // Check if it was added (not yet saved)
    const addedIndex = pendingChanges.added.findIndex(
      a => a.text === text
    );
    
    if (addedIndex >= 0) {
      // Remove from added list
      setPendingChanges(prev => ({
        ...prev,
        added: prev.added.filter((_, i) => i !== addedIndex)
      }));
    } else {
      // Add to removed list
      setPendingChanges(prev => ({
        ...prev,
        removed: [...prev.removed, { id, text }]
      }));
    }
  }, [pendingChanges.added]);

  // Edit a prompt
  const editPrompt = useCallback((id: number, oldText: string, newText: string) => {
    // Check if it was added (not yet saved)
    const addedIndex = pendingChanges.added.findIndex(a => a.text === oldText);
    
    if (addedIndex >= 0) {
      // Update in added list
      setPendingChanges(prev => ({
        ...prev,
        added: prev.added.map((a, i) => 
          i === addedIndex ? { ...a, text: newText } : a
        )
      }));
    } else {
      // Check if already edited
      const editedIndex = pendingChanges.edited.findIndex(e => e.id === id);
      
      if (editedIndex >= 0) {
        // Update existing edit
        setPendingChanges(prev => ({
          ...prev,
          edited: prev.edited.map((e, i) =>
            i === editedIndex ? { ...e, newText } : e
          )
        }));
      } else {
        // Add new edit
        setPendingChanges(prev => ({
          ...prev,
          edited: [...prev.edited, { id, oldText, newText }]
        }));
      }
    }
  }, [pendingChanges]);

  // Clear all pending changes
  const clearPendingChanges = useCallback(() => {
    setPendingChanges({
      added: [],
      removed: [],
      edited: []
    });
  }, []);

  // Apply pending changes to current config
  const applyChanges = useCallback(() => {
    // This would typically call an API to save changes
    // For now, we'll update local state
    const updatedPrompts = [...currentConfig.prompts];
    
    // Remove prompts
    pendingChanges.removed.forEach(({ id }) => {
      const index = updatedPrompts.findIndex(p => p.id === id);
      if (index >= 0) {
        updatedPrompts[index].isSelected = false;
      }
    });

    // Add prompts (create new entries)
    pendingChanges.added.forEach(({ text, topic }) => {
      const newId = Math.max(...updatedPrompts.map(p => p.id), 0) + 1;
      updatedPrompts.push({
        id: newId,
        text,
        topic,
        type: 'custom',
        isSelected: true
      });
    });

    // Edit prompts
    pendingChanges.edited.forEach(({ id, newText }) => {
      const prompt = updatedPrompts.find(p => p.id === id);
      if (prompt) {
        prompt.text = newText;
      }
    });

    setCurrentConfig(prev => ({
      ...prev,
      prompts: updatedPrompts,
      lastUpdated: new Date().toISOString().split('T')[0]
    }));

    clearPendingChanges();
  }, [currentConfig, pendingChanges, clearPendingChanges]);

  // Check if there are pending changes
  const hasPendingChanges = useMemo(() => {
    return pendingChanges.added.length > 0 ||
           pendingChanges.removed.length > 0 ||
           pendingChanges.edited.length > 0;
  }, [pendingChanges]);

  // Get effective configuration (current + pending)
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

    // Add new prompts (for preview)
    pendingChanges.added.forEach(({ text, topic }) => {
      effectivePrompts.push({
        id: -Date.now(), // Temporary ID
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

  return {
    currentConfig,
    pendingChanges,
    effectiveConfig,
    hasPendingChanges,
    addPrompt,
    removePrompt,
    editPrompt,
    clearPendingChanges,
    applyChanges
  };
}

