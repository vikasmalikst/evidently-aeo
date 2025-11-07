import { X } from 'lucide-react';
import type { Topic } from '../../types/topic';

interface SelectedTopicsSummaryProps {
  selectedTopics: Topic[];
  onRemoveTopic: (topicId: string) => void;
}

export const SelectedTopicsSummary = ({
  selectedTopics,
  onRemoveTopic,
}: SelectedTopicsSummaryProps) => {
  if (selectedTopics.length === 0) {
    return null;
  }

  return (
    <div className="selected-topics-summary">
      <h4 className="selected-topics-title">
        Selected Topics ({selectedTopics.length})
      </h4>
      <div className="selected-topics-chips">
        {selectedTopics.map((topic) => (
          <div key={topic.id} className="topic-chip">
            <span className="topic-chip-name">{topic.name}</span>
            <button
              className="topic-chip-remove"
              onClick={() => onRemoveTopic(topic.id)}
              type="button"
              aria-label={`Remove ${topic.name}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
