import { CurrentConfigSummary } from './CurrentConfigSummary';
import { PromptEditor } from './PromptEditor';
import { RecalibrationWarning } from './RecalibrationWarning';
import { PendingChangesIndicator } from './PendingChangesIndicator';
import type { CurrentConfiguration, PendingChanges } from '../../hooks/usePromptConfiguration';
import type { PromptConfig } from '../../utils/impactCalculator';

interface PromptConfigPanelProps {
  currentConfig: CurrentConfiguration;
  pendingChanges: PendingChanges;
  isExplanationExpanded: boolean;
  onToggleExplanation: () => void;
  onPreviewClick: () => void;
  onAddPrompt: (text: string, topic: string) => void;
  onEditPrompt: (id: number, oldText: string, newText: string) => void;
  onRemovePrompt: (id: number, text: string) => void;
}

export const PromptConfigPanel = ({
  currentConfig,
  pendingChanges,
  isExplanationExpanded,
  onToggleExplanation,
  onPreviewClick,
  onAddPrompt,
  onEditPrompt,
  onRemovePrompt
}: PromptConfigPanelProps) => {
  const hasPendingChanges =
    pendingChanges.added.length > 0 ||
    pendingChanges.removed.length > 0 ||
    pendingChanges.edited.length > 0;

  return (
    <div className="space-y-6">
      <CurrentConfigSummary
        promptCount={currentConfig.prompts.filter(p => p.isSelected).length}
        coverage={currentConfig.coverage}
        visibilityScore={currentConfig.visibilityScore}
        lastUpdated={currentConfig.lastUpdated}
      />

      {hasPendingChanges && (
        <>
          <PendingChangesIndicator changes={pendingChanges} />
          <RecalibrationWarning
            isExpanded={isExplanationExpanded}
            onToggleExplanation={onToggleExplanation}
            onPreviewClick={onPreviewClick}
          />
        </>
      )}

      <PromptEditor
        prompts={currentConfig.prompts}
        onAdd={onAddPrompt}
        onEdit={onEditPrompt}
        onRemove={onRemovePrompt}
        pendingChanges={pendingChanges}
      />
    </div>
  );
};

