import { CheckCircle, ExternalLink } from 'lucide-react';
import { RECALIBRATION_MESSAGES } from '../../utils/recalibrationMessages';
import type { PendingChanges } from '../../hooks/usePromptConfiguration';

interface RecalibrationSuccessStateProps {
  changes: PendingChanges;
  onViewChart: () => void;
  onMakeMoreChanges: () => void;
  estimatedTime?: number;
}

export const RecalibrationSuccessState = ({
  changes,
  onViewChart,
  onMakeMoreChanges,
  estimatedTime = 8
}: RecalibrationSuccessStateProps) => {
  const totalChanges =
    changes.added.length + changes.removed.length + changes.edited.length;

  return (
    <div className="bg-white border-2 border-[var(--success500)] rounded-lg shadow-sm p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-[var(--success500)]/10 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={24} className="text-[var(--success500)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-1">
            {RECALIBRATION_MESSAGES.success.title}
          </h3>
          <p className="text-sm text-[var(--text-body)] leading-relaxed">
            {RECALIBRATION_MESSAGES.success.message}
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6 border border-[var(--border-default)]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success500)] animate-pulse"></div>
          <span className="text-sm font-semibold text-[var(--text-headings)]">
            {RECALIBRATION_MESSAGES.success.queueStatus}
          </span>
        </div>
        <p className="text-sm text-[var(--text-body)] ml-4">
          {RECALIBRATION_MESSAGES.success.processing}
        </p>
        <p className="text-sm text-[var(--text-caption)] ml-4 mt-1">
          {RECALIBRATION_MESSAGES.success.estimatedTime.replace('{minutes}', estimatedTime.toString())}
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={onViewChart}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
        >
          <ExternalLink size={18} />
          View Updated Chart
        </button>
        <button
          onClick={onMakeMoreChanges}
          className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] text-[var(--text-body)] font-medium hover:bg-[var(--bg-secondary)] transition-colors bg-white"
        >
          Make Additional Changes
        </button>
      </div>
    </div>
  );
};

