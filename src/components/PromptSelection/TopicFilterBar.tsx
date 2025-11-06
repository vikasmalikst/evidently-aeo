import { Bookmark } from 'lucide-react';

interface TopicFilterBarProps {
  topics: Array<{ id: string; name: string; icon: string }>;
  onFilterClick: (topicId: string) => void;
}

export const TopicFilterBar = ({ topics, onFilterClick }: TopicFilterBarProps) => {
  return (
    <div className="topic-filter-bar">
      <div className="topic-filter-label">
        <Bookmark size={16} />
        <span>Filter by Topic</span>
      </div>
      <div className="topic-filter-list">
        {topics.map((topic) => (
          <button
            key={topic.id}
            className="topic-filter-button"
            onClick={() => onFilterClick(topic.id)}
          >
            <span className="topic-filter-icon">{topic.icon}</span>
            {topic.name}
          </button>
        ))}
      </div>
    </div>
  );
};
