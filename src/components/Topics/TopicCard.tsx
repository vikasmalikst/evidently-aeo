import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Topic } from '../../types/topic';

interface TopicCardProps {
  topic: Topic;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

export const TopicCard = ({ topic, isSelected, isDisabled, onToggle }: TopicCardProps) => {
  const getTrendingIcon = () => {
    if (!topic.trendingIndicator) return null;

    switch (topic.trendingIndicator) {
      case 'rising':
        return <TrendingUp size={12} className="topic-trending-icon rising" />;
      case 'declining':
        return <TrendingDown size={12} className="topic-trending-icon declining" />;
      case 'stable':
        return <Minus size={12} className="topic-trending-icon stable" />;
    }
  };

  return (
    <div className={`topic-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}>
      <label className="topic-label">
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isDisabled}
          onChange={onToggle}
          className="topic-checkbox"
        />
        <div className="topic-content">
          <span className="topic-name">{topic.name}</span>
          <div className="topic-meta">
            <span className="topic-relevance-badge">
              {topic.relevance}% relevant
            </span>
            {getTrendingIcon()}
          </div>
        </div>
      </label>
    </div>
  );
};
