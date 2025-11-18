import { X } from 'lucide-react';
import { RECALIBRATION_MESSAGES } from '../../utils/recalibrationMessages';

interface RecalibrationInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecalibrationInfoModal = ({
  isOpen,
  onClose
}: RecalibrationInfoModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 id="modal-title" className="text-xl font-semibold text-[var(--text-headings)]">
            {RECALIBRATION_MESSAGES.explanation.title}
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
          <div className="space-y-4">
            <div>
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

