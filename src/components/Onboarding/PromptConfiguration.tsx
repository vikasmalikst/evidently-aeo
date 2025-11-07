import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

interface PromptConfigurationProps {
  selectedPrompts: string[];
  onPromptsChange: (prompts: string[]) => void;
}

const SUGGESTED_PROMPTS = [
  'Best tools for project management',
  'How to improve team productivity',
  'Top software development practices',
  'Enterprise collaboration solutions',
  'Remote work communication tools',
  'Agile project management software',
  'Team workflow automation',
  'Business intelligence platforms',
];

export const PromptConfiguration = ({ selectedPrompts, onPromptsChange }: PromptConfigurationProps) => {
  const [customPrompt, setCustomPrompt] = useState('');

  const handleTogglePrompt = (prompt: string) => {
    if (selectedPrompts.includes(prompt)) {
      onPromptsChange(selectedPrompts.filter(p => p !== prompt));
    } else {
      onPromptsChange([...selectedPrompts, prompt]);
    }
  };

  const handleAddCustomPrompt = () => {
    if (customPrompt.trim() && !selectedPrompts.includes(customPrompt.trim())) {
      onPromptsChange([...selectedPrompts, customPrompt.trim()]);
      setCustomPrompt('');
    }
  };

  const handleRemovePrompt = (prompt: string) => {
    onPromptsChange(selectedPrompts.filter(p => p !== prompt));
  };

  return (
    <div className="prompt-configuration">
      <div className="prompt-instruction">
        <IconInfoCircle size={20} className="instruction-icon" />
        <p>
          Select or create search queries that we'll use to track your brand's visibility across AI platforms.
          Choose prompts that are relevant to your industry and target audience.
        </p>
      </div>

      <div className="prompt-counter">
        You've selected <strong>{selectedPrompts.length}</strong> prompts
      </div>

      <div className="prompt-section">
        <h3 className="prompt-section-title">Suggested Prompts</h3>
        <div className="prompt-suggestions-grid">
          {SUGGESTED_PROMPTS.map((prompt) => {
            const isSelected = selectedPrompts.includes(prompt);
            return (
              <button
                key={prompt}
                className={`prompt-suggestion-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleTogglePrompt(prompt)}
                aria-pressed={isSelected}
              >
                <span className="prompt-text">{prompt}</span>
                {isSelected && <span className="prompt-checkmark">✓</span>}
              </button>
            );
          })}
        </div>
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
            onClick={handleAddCustomPrompt}
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
          <h3 className="prompt-section-title">Your Selected Prompts</h3>
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
