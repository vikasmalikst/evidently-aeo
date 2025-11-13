import { X } from 'lucide-react';
import { HistorySection } from './HistorySection';
import type { TopicConfiguration } from '../types';

interface HistoryModalProps {
  history: TopicConfiguration[];
  currentVersion: number;
  onClose: () => void;
  onViewVersion: (config: TopicConfiguration) => void;
  onRevertVersion: (versionId: string) => void;
  onCompareVersion: (config: TopicConfiguration) => void;
}

export const HistoryModal = ({
  history,
  currentVersion,
  onClose,
  onViewVersion,
  onRevertVersion,
  onCompareVersion,
}: HistoryModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 className="text-2xl font-semibold text-[var(--text-headings)]">
            Configuration History
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <X size={24} className="text-[var(--text-caption)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <HistorySection
            history={history}
            currentVersion={currentVersion}
            onViewVersion={onViewVersion}
            onRevertVersion={onRevertVersion}
            onCompareVersion={onCompareVersion}
          />
        </div>
      </div>
    </div>
  );
};

