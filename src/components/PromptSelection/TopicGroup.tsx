import { ChevronDown, Plus } from 'lucide-react';
import * as TablerIcons from '@tabler/icons-react';
import { useState } from 'react';
import { PromptCard } from './PromptCard';
import type { TopicGroup as TopicGroupType } from '../../data/mockPromptSelectionData';

interface TopicGroupProps {
  topic: TopicGroupType;
  selectedPrompts: Set<string>;
  onTogglePrompt: (promptId: string) => void;
  onAddCustomPrompt?: (topicId: string) => void;
}

export const TopicGroup = ({
  topic,
  selectedPrompts,
  onTogglePrompt,
  onAddCustomPrompt
}: TopicGroupProps) => {
  const [isCollapsed, setIsCollapsed] = useState(topic.collapsed);

  const selectedCount = topic.prompts.filter(p => selectedPrompts.has(p.id)).length;
  const avgConfidence = Math.round(
    topic.prompts.reduce((sum, p) => sum + p.confidence, 0) / topic.prompts.length
  );

  const IconComponent = (TablerIcons as any)[`Icon${topic.icon}`];

  return (
    <div className="topic-group" id={`topic-${topic.id}`}>
      <div
        className="topic-group-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="topic-group-info">
          <span className="topic-group-icon">
            {IconComponent && <IconComponent size={24} />}
          </span>
          <div className="topic-group-title">
            <h3>{topic.name}</h3>
            <p className="topic-group-meta">
              {selectedCount}/{topic.prompts.length} selected • Avg {avgConfidence}% confidence
            </p>
          </div>
        </div>
        <div className="topic-group-actions">
          {selectedCount > 0 && (
            <span className="topic-selection-badge">
              {selectedCount}
            </span>
          )}
          <ChevronDown
            size={20}
            className={`topic-group-chevron ${isCollapsed ? '' : 'topic-group-chevron--expanded'}`}
          />
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="topic-prompts-list">
            {topic.prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                isSelected={selectedPrompts.has(prompt.id)}
                onToggle={onTogglePrompt}
              />
            ))}
          </div>
          <div className="topic-group-footer">
            <button
              className="add-prompt-button"
              onClick={(e) => {
                e.stopPropagation();
                onAddCustomPrompt?.(topic.id);
              }}
            >
              <Plus size={16} />
              Add Prompt
            </button>
          </div>
        </>
      )}
    </div>
  );
};
