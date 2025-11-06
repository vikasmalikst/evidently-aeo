import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Topic } from '../../types/topic';
import { TopicCard } from './TopicCard';

interface TopicSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  topics: Topic[];
  selectedTopics: Set<string>;
  maxTopics: number;
  onToggleTopic: (topicId: string) => void;
  defaultOpen?: boolean;
  showTabs?: boolean;
  tabs?: string[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const TopicSection = ({
  title,
  description,
  icon,
  topics,
  selectedTopics,
  maxTopics,
  onToggleTopic,
  defaultOpen = false,
  showTabs = false,
  tabs = [],
  activeTab = '',
  onTabChange,
}: TopicSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="topic-section">
      <button
        className="topic-section-header"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="topic-section-icon">{icon}</div>
        <div className="topic-section-info">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <ChevronDown
          className={`topic-section-chevron ${isOpen ? 'rotated' : ''}`}
          size={20}
        />
      </button>

      {isOpen && (
        <div className="topic-section-content">
          {showTabs && tabs.length > 0 && (
            <div className="topic-category-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`topic-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => onTabChange?.(tab)}
                  type="button"
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )}

          <div className="topics-grid">
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isSelected={selectedTopics.has(topic.id)}
                isDisabled={!selectedTopics.has(topic.id) && selectedTopics.size >= maxTopics}
                onToggle={() => onToggleTopic(topic.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
