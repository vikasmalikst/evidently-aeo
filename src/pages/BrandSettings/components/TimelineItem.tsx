import { useState } from 'react';
import { Eye } from 'lucide-react';
import { formatDateWithYear } from '../../../utils/dateFormatting';
import type { TopicConfiguration } from '../types';

interface TimelineItemProps {
  config: TopicConfiguration;
  isActive: boolean;
  isLast: boolean;
  onView: () => void;
}

const formatDate = formatDateWithYear;

export const TimelineItem = ({
  config,
  isActive,
  isLast,
  onView,
}: TimelineItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-[var(--border-default)]" />
      )}

      {/* Version circle */}
      <div
        className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full border-2 ${
          isActive
            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
            : 'bg-white border-[var(--border-default)]'
        }`}
      />

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-white border border-[var(--border-default)] rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[var(--text-headings)]">
                  v{config.version}
                </span>
                {isActive && (
                  <span className="px-2 py-0.5 bg-[var(--success500)]/20 text-[var(--success500)] rounded text-xs font-medium">
                    Active
                  </span>
                )}
                <span className="text-sm text-[var(--text-caption)]">
                  {formatDate(config.created_at)}
                </span>
              </div>
              <p className="text-sm text-[var(--text-body)] mb-2">
                {config.change_summary}
              </p>
              <p className="text-xs text-[var(--text-caption)]">
                {config.topics.length} topics • Used by {config.analysis_count} analyses
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onView}
                className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                title="View version details"
              >
                <Eye size={16} className="text-[var(--text-caption)]" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
              <div className="flex flex-wrap gap-2">
                {config.topics.map((topic) => (
                  <span
                    key={topic.id}
                    className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-body)]"
                  >
                    {topic.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
          >
            {isExpanded ? 'Show less' : 'Show topics'}
          </button>
        </div>
      </div>
    </div>
  );
};

