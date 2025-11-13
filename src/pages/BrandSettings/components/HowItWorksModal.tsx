import { X } from 'lucide-react';
import { HowItWorksDemo } from './HowItWorksDemo';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal = ({ isOpen, onClose }: HowItWorksModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 id="how-it-works-modal-title" className="text-xl font-semibold text-[var(--text-headings)]">
            How It Works
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
          <HowItWorksDemo />
        </div>
      </div>
    </div>
  );
};

