import { TimelineItem } from './TimelineItem';
import type { TopicConfiguration } from '../types';

interface HistorySectionProps {
  history: TopicConfiguration[];
  currentVersion: number;
  onSelectVersion: (config: TopicConfiguration) => void;
}

export const HistorySection = ({
  history,
  currentVersion,
  onSelectVersion,
}: HistorySectionProps) => {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-[var(--text-headings)] mb-4">
        Configuration History
      </h2>

      <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
        <p className="text-sm text-[var(--text-body)] leading-relaxed">
          Past analyses are not affected by topic changes. All historical data is preserved, and changes only apply to future analyses.
        </p>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)] text-center py-8">
          No configuration history available
        </p>
      ) : (
        <div className="space-y-0">
          {history.map((config, index) => (
            <TimelineItem
              key={config.id}
              config={config}
              isActive={config.version === currentVersion}
              isLast={index === history.length - 1}
              onView={() => onSelectVersion(config)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
