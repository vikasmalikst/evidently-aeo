import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Topic } from '../../../types/topic';

interface TopicCardProps {
  topic: Topic;
  promptCount?: number;
  performanceTrend?: 'up' | 'down' | 'stable';
  onRemove?: () => void;
  showRemove?: boolean;
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

const getPerformanceIcon = (trend?: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up':
      return <TrendingUp size={14} className="text-[var(--success500)]" />;
    case 'down':
      return <TrendingDown size={14} className="text-[var(--error500)]" />;
    default:
      return <Minus size={14} className="text-[var(--text-caption)]" />;
  }
};

export const TopicCard = ({
  topic,
  promptCount = 0,
  performanceTrend,
  onRemove,
  showRemove = false,
}: TopicCardProps) => {
  const colors = getSourceBadgeColor(topic.source);

  return (
    <div className="relative bg-white border border-[var(--border-default)] rounded-lg p-4 hover:shadow-md transition-all group">
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--error500)] text-[var(--text-caption)] hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10"
          aria-label="Remove topic"
        >
          <X size={16} />
        </button>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[var(--text-headings)] mb-1">
            {topic.name}
          </h3>
          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {topic.source.replace('_', ' ')}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-caption)]">Category</span>
          <span className="font-medium text-[var(--text-headings)]">
            {topic.category ? topic.category.replace(/_/g, ' ') : 'General'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-caption)]">Prompts</span>
          <span className="font-medium text-[var(--text-headings)]">
            {promptCount}
          </span>
        </div>
        {performanceTrend && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-caption)]">Trend</span>
            <div className="flex items-center gap-1">
              {getPerformanceIcon(performanceTrend)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

