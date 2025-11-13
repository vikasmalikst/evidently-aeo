import { X } from 'lucide-react';
import { ConfigurationComparison } from './ConfigurationComparison';
import { ScoreDeltaVisualization } from './ScoreDeltaVisualization';
import { ChartPreview } from './ChartPreview';
import { RECALIBRATION_MESSAGES } from '../../utils/recalibrationMessages';
import type { CurrentConfiguration, PendingChanges } from '../../hooks/usePromptConfiguration';
import type { ImpactEstimate } from '../../utils/impactCalculator';

interface ImpactPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentConfig: CurrentConfiguration;
  effectiveConfig: CurrentConfiguration;
  pendingChanges: PendingChanges;
  impact: ImpactEstimate | null;
  isSubmitting: boolean;
}

export const ImpactPreviewModal = ({
  isOpen,
  onClose,
  onConfirm,
  currentConfig,
  effectiveConfig,
  pendingChanges,
  impact,
  isSubmitting
}: ImpactPreviewModalProps) => {
  if (!isOpen) return null;

  const recalibrationDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 id="modal-title" className="text-xl font-semibold text-[var(--text-headings)]">
            {RECALIBRATION_MESSAGES.modalHeader}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            aria-label="Close modal"
          >
            <X size={20} className="text-[var(--text-body)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {impact && (
            <>
              <ScoreDeltaVisualization
                currentScore={currentConfig.visibilityScore}
                impact={impact}
              />

              <ConfigurationComparison
                currentConfig={currentConfig}
                effectiveConfig={effectiveConfig}
                pendingChanges={pendingChanges}
              />

              <ChartPreview
                currentScore={currentConfig.visibilityScore}
                newScore={impact.newScore}
                recalibrationDate={recalibrationDate}
              />
            </>
          )}

          {!impact && (
            <div className="text-center py-12 text-[var(--text-caption)]">
              <div className="inline-block h-8 w-8 rounded-full border-2 border-t-transparent border-[var(--accent-primary)] animate-spin mb-3"></div>
              <p className="text-sm">Calculating impact...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting || !impact}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSubmitting ? 'Confirming...' : 'Confirm & Recalibrate'}
          </button>
        </div>
      </div>
    </div>
  );
};

