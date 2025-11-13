import { useState, useCallback } from 'react';
import type { ImpactEstimate } from '../utils/impactCalculator';
import type { PendingChanges } from './usePromptConfiguration';

export interface RecalibrationState {
  isPreviewModalOpen: boolean;
  isExplanationExpanded: boolean;
  isSubmitting: boolean;
  submitted: boolean;
  error: string | null;
}

export function useRecalibrationLogic() {
  const [state, setState] = useState<RecalibrationState>({
    isPreviewModalOpen: false,
    isExplanationExpanded: false,
    isSubmitting: false,
    submitted: false,
    error: null
  });

  const openPreviewModal = useCallback(() => {
    setState(prev => ({ ...prev, isPreviewModalOpen: true }));
  }, []);

  const closePreviewModal = useCallback(() => {
    setState(prev => ({ ...prev, isPreviewModalOpen: false }));
  }, []);

  const toggleExplanation = useCallback(() => {
    setState(prev => ({ ...prev, isExplanationExpanded: !prev.isExplanationExpanded }));
  }, []);

  const submitRecalibration = useCallback(async (
    changes: PendingChanges,
    impact: ImpactEstimate
  ) => {
    setState(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In real implementation, this would call the API
      // await apiClient.post('/prompts/recalibrate', { changes, impact });

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitted: true,
        isPreviewModalOpen: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Failed to submit changes'
      }));
    }
  }, []);

  const resetState = useCallback(() => {
    setState({
      isPreviewModalOpen: false,
      isExplanationExpanded: false,
      isSubmitting: false,
      submitted: false,
      error: null
    });
  }, []);

  return {
    ...state,
    openPreviewModal,
    closePreviewModal,
    toggleExplanation,
    submitRecalibration,
    resetState
  };
}

