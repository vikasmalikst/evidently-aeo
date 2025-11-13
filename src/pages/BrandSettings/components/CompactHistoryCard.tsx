import { History } from 'lucide-react';
import type { TopicConfiguration } from '../types';

interface CompactHistoryCardProps {
  history: TopicConfiguration[];
  onViewTimeline: () => void;
}

export const CompactHistoryCard = ({
  history,
  onViewTimeline,
}: CompactHistoryCardProps) => {
  const versionCount = history.length;

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
            <History size={20} className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-headings)]">
              Configuration History
            </h3>
            <p className="text-xs text-[var(--text-caption)]">
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} • Can revert anytime
            </p>
          </div>
        </div>
        <button
          onClick={onViewTimeline}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--accent-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors font-medium"
        >
          View Timeline
          <span>→</span>
        </button>
      </div>
    </div>
  );
};

