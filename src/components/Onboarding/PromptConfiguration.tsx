import { IconInfoCircle, IconPlus, IconTrash, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react';
import type { Topic } from '../../types/topic';

interface PromptConfigurationProps {
  selectedTopics: Topic[];
  selectedPrompts: string[];
  onPromptsChange: (prompts: string[]) => void;
}

interface TopicPrompt {
  topicId: string;
  prompt: string;
}

const TOPIC_PROMPTS: Record<string, string[]> = {
  'project-management': [
    'Best tools for project management',
    'Agile project management software',
    'Project collaboration platforms'
  ],
  'productivity': [
    'How to improve team productivity',
    'Team workflow automation',
    'Time management tools'
  ],
  'software-development': [
    'Top software development practices',
    'Best code review tools',
    'CI/CD pipeline solutions'
  ],
  'collaboration': [
    'Enterprise collaboration solutions',
    'Remote work communication tools',
    'Team messaging platforms'
  ],
  'analytics': [
    'Business intelligence platforms',
    'Data visualization tools',
    'Analytics dashboard software'
  ]
};

function getPromptsForTopic(topic: Topic): string[] {
  const topicKey = topic.id.toLowerCase().replace(/\s+/g, '-');
  if (TOPIC_PROMPTS[topicKey]) {
    return TOPIC_PROMPTS[topicKey];
  }

  return [
    `Best ${topic.name.toLowerCase()} solutions`,
    `How to choose ${topic.name.toLowerCase()}`,
    `Top ${topic.name.toLowerCase()} providers`
  ];
}

export const PromptConfiguration = ({ selectedTopics, selectedPrompts, onPromptsChange }: PromptConfigurationProps) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set([selectedTopics[0]?.id]));

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const handleTogglePrompt = (prompt: string) => {
    if (selectedPrompts.includes(prompt)) {
      onPromptsChange(selectedPrompts.filter(p => p !== prompt));
    } else {
      onPromptsChange([...selectedPrompts, prompt]);
    }
  };

  const handleAddCustomPrompt = (topicId?: string) => {
    if (customPrompt.trim() && !selectedPrompts.includes(customPrompt.trim())) {
      onPromptsChange([...selectedPrompts, customPrompt.trim()]);
      setCustomPrompt('');
    }
  };

  const handleRemovePrompt = (prompt: string) => {
    onPromptsChange(selectedPrompts.filter(p => p !== prompt));
  };

  const getSelectedCountForTopic = (topic: Topic): number => {
    const topicPrompts = getPromptsForTopic(topic);
    return topicPrompts.filter(p => selectedPrompts.includes(p)).length;
  };

  return (
    <div className="prompt-configuration">
      <div className="prompt-instruction">
        <IconInfoCircle size={20} className="instruction-icon" />
        <p>
          Select search queries for each topic to track your brand's visibility across AI platforms.
          Choose prompts that are relevant to your selected topics.
        </p>
      </div>

      <div className="prompt-counter">
        You've selected <strong>{selectedPrompts.length}</strong> prompts across {selectedTopics.length} topics
      </div>

      <div className="prompt-topics-accordion">
        {selectedTopics.map((topic) => {
          const isExpanded = expandedTopics.has(topic.id);
          const topicPrompts = getPromptsForTopic(topic);
          const selectedCount = getSelectedCountForTopic(topic);

          return (
            <div key={topic.id} className="prompt-topic-section">
              <button
                className="prompt-topic-header"
                onClick={() => toggleTopic(topic.id)}
                aria-expanded={isExpanded}
              >
                <div className="prompt-topic-header-left">
                  <span className="prompt-topic-name">{topic.name}</span>
                  {selectedCount > 0 && (
                    <span className="prompt-topic-badge">{selectedCount} selected</span>
                  )}
                </div>
                <div className="prompt-topic-header-right">
                  {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                </div>
              </button>

              {isExpanded && (
                <div className="prompt-topic-content">
                  <div className="prompt-list">
                    {topicPrompts.map((prompt) => {
                      const isSelected = selectedPrompts.includes(prompt);
                      return (
                        <label key={prompt} className="prompt-checkbox-item">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTogglePrompt(prompt)}
                            className="prompt-checkbox"
                          />
                          <span className="prompt-label">{prompt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="prompt-section">
        <h3 className="prompt-section-title">Add Custom Prompt</h3>
        <div className="prompt-custom-input-wrapper">
          <input
            type="text"
            className="prompt-custom-input"
            placeholder="Enter your custom search query..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomPrompt();
              }
            }}
          />
          <button
            className="prompt-add-button"
            onClick={() => handleAddCustomPrompt()}
            disabled={!customPrompt.trim()}
            aria-label="Add custom prompt"
          >
            <IconPlus size={20} />
            Add
          </button>
        </div>
      </div>

      {selectedPrompts.length > 0 && (
        <div className="prompt-section">
          <h3 className="prompt-section-title">Your Selected Prompts ({selectedPrompts.length})</h3>
          <div className="prompt-selected-list">
            {selectedPrompts.map((prompt) => (
              <div key={prompt} className="prompt-selected-item">
                <span className="prompt-text">{prompt}</span>
                <button
                  className="prompt-remove-button"
                  onClick={() => handleRemovePrompt(prompt)}
                  aria-label={`Remove ${prompt}`}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
