import { ChevronDown, ChevronUp } from 'lucide-react';
import { RECALIBRATION_MESSAGES } from '../../utils/recalibrationMessages';

interface RecalibrationExplanationProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export const RecalibrationExplanation = ({
  isExpanded,
  onToggle
}: RecalibrationExplanationProps) => {
  return (
    <div className="mt-4 border-t border-[var(--border-default)] pt-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
        aria-expanded={isExpanded}
        aria-label="Learn more about recalibration"
      >
        <span className="text-sm font-medium text-[var(--accent-primary)]">
          Learn more about recalibration
        </span>
        {isExpanded ? (
          <ChevronUp size={16} className="text-[var(--accent-primary)]" />
        ) : (
          <ChevronDown size={16} className="text-[var(--accent-primary)]" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-headings)] mb-2">
              {RECALIBRATION_MESSAGES.explanation.title}
            </h4>
            <p className="text-sm text-[var(--text-body)] leading-relaxed">
              {RECALIBRATION_MESSAGES.explanation.paragraph}
            </p>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-default)]">
            <h5 className="text-sm font-semibold text-[var(--text-headings)] mb-2">
              {RECALIBRATION_MESSAGES.explanation.example.title}
            </h5>
            <p className="text-sm text-[var(--text-body)] leading-relaxed">
              {RECALIBRATION_MESSAGES.explanation.example.text}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-default)]">
            <div className="flex-1 h-0.5 bg-[var(--primary300)] relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--primary300)] rounded-full border-2 border-white"></div>
            </div>
            <span className="text-xs text-[var(--text-caption)] whitespace-nowrap">
              Recalibration marker
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

