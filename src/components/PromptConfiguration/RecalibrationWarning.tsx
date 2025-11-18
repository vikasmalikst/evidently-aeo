import { IconInfoCircle } from '@tabler/icons-react';
import { RECALIBRATION_MESSAGES } from '../../utils/recalibrationMessages';

interface RecalibrationWarningProps {
  onToggleExplanation: () => void;
  onPreviewClick: () => void;
}

export const RecalibrationWarning = ({
  onToggleExplanation,
  onPreviewClick
}: RecalibrationWarningProps) => {
  return (
    <div className="bg-[var(--text-warning)]/20 border border-[var(--text-warning)] rounded-lg p-4">
      <div className="flex items-start gap-3">
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
              className="p-1 text-[var(--accent-primary)] hover:text-[var(--accent-hover)] hover:bg-[var(--accent-primary)]/10 rounded transition-colors"
              aria-label="Learn more about recalibration"
            >
              <IconInfoCircle size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

