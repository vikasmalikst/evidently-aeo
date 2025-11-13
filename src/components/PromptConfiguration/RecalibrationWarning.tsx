import { AlertTriangle } from 'lucide-react';
import { RECALIBRATION_MESSAGES } from '../../utils/recalibrationMessages';
import { RecalibrationExplanation } from './RecalibrationExplanation';

interface RecalibrationWarningProps {
  isExpanded: boolean;
  onToggleExplanation: () => void;
  onPreviewClick: () => void;
}

export const RecalibrationWarning = ({
  isExpanded,
  onToggleExplanation,
  onPreviewClick
}: RecalibrationWarningProps) => {
  return (
    <div className="bg-[var(--text-warning)]/10 border border-[var(--text-warning)] rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-[var(--dataviz-4)] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-[var(--text-body)] leading-relaxed">
            {RECALIBRATION_MESSAGES.warningBanner}
          </p>
          
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={onPreviewClick}
              className="text-sm font-medium text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors underline"
            >
              Preview impact
            </button>
            <span className="text-[var(--primary300)]">•</span>
            <button
              onClick={onToggleExplanation}
              className="text-sm font-medium text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors"
            >
              Learn more
            </button>
          </div>

          <RecalibrationExplanation
            isExpanded={isExpanded}
            onToggle={onToggleExplanation}
          />
        </div>
      </div>
    </div>
  );
};

