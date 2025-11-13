import { usePromptConfiguration } from '../../hooks/usePromptConfiguration';
import { useImpactCalculation } from '../../hooks/useImpactCalculation';
import { useRecalibrationLogic } from '../../hooks/useRecalibrationLogic';
import { PromptConfigPanel } from './PromptConfigPanel';
import { ImpactPreviewModal } from './ImpactPreviewModal';
import { RecalibrationSuccessState } from './RecalibrationSuccessState';
import type { CurrentConfiguration } from '../../hooks/usePromptConfiguration';
import type { PromptConfig } from '../../utils/impactCalculator';

interface PromptConfigurationWorkflowProps {
  initialConfig: CurrentConfiguration;
  onViewChart?: () => void;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export const PromptConfigurationWorkflow = ({
  initialConfig,
  onViewChart,
  onComplete,
  onDismiss
}: PromptConfigurationWorkflowProps) => {
  const {
    currentConfig,
    pendingChanges,
    effectiveConfig,
    hasPendingChanges,
    addPrompt,
    removePrompt,
    editPrompt,
    clearPendingChanges,
    applyChanges
  } = usePromptConfiguration(initialConfig);

  const { impact, isCalculating, calculateImpactEstimate } = useImpactCalculation(
    currentConfig,
    pendingChanges
  );

  const {
    isPreviewModalOpen,
    isExplanationExpanded,
    isSubmitting,
    submitted,
    error,
    openPreviewModal,
    closePreviewModal,
    toggleExplanation,
    submitRecalibration,
    resetState
  } = useRecalibrationLogic();

  const handlePreviewClick = async () => {
    await calculateImpactEstimate();
    openPreviewModal();
  };

  const handleConfirm = async () => {
    if (!impact) return;

    await submitRecalibration(pendingChanges, impact);
    applyChanges();
    if (onComplete) {
      onComplete();
    }
  };

  const handleViewChart = () => {
    if (onViewChart) {
      onViewChart();
    }
  };

  const handleMakeMoreChanges = () => {
    resetState();
    clearPendingChanges();
  };

  const handleModalClose = () => {
    closePreviewModal();
    // If there are no pending changes in workflow, allow dismissal
    if (!hasPendingChanges && onDismiss) {
      onDismiss();
    }
  };

  if (submitted) {
    return (
      <RecalibrationSuccessState
        changes={pendingChanges}
        onViewChart={handleViewChart}
        onMakeMoreChanges={handleMakeMoreChanges}
      />
    );
  }

  return (
    <>
      <PromptConfigPanel
        currentConfig={currentConfig}
        pendingChanges={pendingChanges}
        isExplanationExpanded={isExplanationExpanded}
        onToggleExplanation={toggleExplanation}
        onPreviewClick={handlePreviewClick}
        onAddPrompt={addPrompt}
        onEditPrompt={editPrompt}
        onRemovePrompt={removePrompt}
      />

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

      {error && (
        <div className="mt-4 p-4 bg-[var(--text-error)]/10 border border-[var(--text-error)] rounded-lg">
          <p className="text-sm text-[var(--text-error)]">{error}</p>
        </div>
      )}
    </>
  );
};

