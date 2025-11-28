import { Edit2, History } from 'lucide-react';
import type { TopicConfiguration } from '../types';

interface CurrentConfigCardProps {
  config: TopicConfiguration;
  history: TopicConfiguration[];
  onEdit: () => void;
  onViewTimeline: () => void;
}

const getSourceBadgeColor = (source: string) => {
  switch (source) {
    case 'trending':
      return { bg: 'rgba(252, 235, 150, 0.3)', text: '#927f20' };
    case 'ai_generated':
      return { bg: 'rgba(51, 201, 227, 0.2)', text: '#005a69' };
    case 'preset':
      return { bg: 'rgba(107, 114, 137, 0.2)', text: '#52576d' };
    case 'custom':
      return { bg: 'rgba(172, 89, 251, 0.2)', text: '#54079c' };
    default:
      return { bg: 'rgba(107, 114, 137, 0.2)', text: '#52576d' };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const CurrentConfigCard = ({
  config,
  history,
  onEdit,
  onViewTimeline,
}: CurrentConfigCardProps) => {
  const activeSince = formatDate(config.created_at);
  const versionCount = history.length;

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-headings)] mb-2">
            Current Configuration
          </h2>
          <div className="flex items-center gap-4 text-sm text-[var(--text-caption)]">
            <span className="font-medium">v{config.version}</span>
            <span>•</span>
            <span>Active since {activeSince}</span>
            <span>•</span>
            <span>{config.topics.length}/10 topics</span>
            <span>•</span>
            <span>Used by {config.analysis_count} analyses</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium"
          >
            <Edit2 size={16} />
            Edit Topics
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {config.topics.map((topic) => {
          const colors = getSourceBadgeColor(topic.source);
          return (
            <div
              key={topic.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              <span className="font-medium">{topic.name}</span>
              <span className="text-xs opacity-75">
                {topic.source.replace('_', ' ')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-[var(--border-default)] mb-4">
        <p className="text-sm text-[var(--text-caption)] mb-4">
          <span className="font-medium">Note:</span> Changes affect future analyses only. Historical trends remain unchanged.
        </p>
        
        {/* Configuration History */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <History size={20} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-headings)]">
                Configuration History
              </h3>
              <p className="text-xs text-[var(--text-caption)]">
                {versionCount} {versionCount === 1 ? 'version' : 'versions'} • Full history available
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
    </div>
  );
};
