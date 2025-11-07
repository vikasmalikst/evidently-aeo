import { IconBookmark } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';

interface TopicFilterBarProps {
  topics: Array<{ id: string; name: string; icon: string }>;
  onFilterClick: (topicId: string) => void;
}

export const TopicFilterBar = ({ topics, onFilterClick }: TopicFilterBarProps) => {
  return (
    <div className="topic-filter-bar">
      <div className="topic-filter-label">
        <IconBookmark size={16} />
        <span>Filter by Topic</span>
      </div>
      <div className="topic-filter-list">
        {topics.map((topic) => {
          const IconComponent = (TablerIcons as any)[`Icon${topic.icon}`];
          return (
            <button
              key={topic.id}
              className="topic-filter-button"
              onClick={() => onFilterClick(topic.id)}
            >
              <span className="topic-filter-icon">
                {IconComponent && <IconComponent size={18} />}
              </span>
              {topic.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
