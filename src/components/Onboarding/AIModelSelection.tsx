import { IconInfoCircle } from '@tabler/icons-react';
import { Check } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  logo: string;
  available: boolean;
}

interface AIModelSelectionProps {
  selectedModels: string[];
  onModelToggle: (modelId: string) => void;
}

const AI_MODELS: AIModel[] = [
  { id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI', logo: '🤖', available: true },
  { id: 'perplexity', name: 'Perplexity', provider: 'Perplexity AI', logo: '🔍', available: true },
  { id: 'google-search-ai', name: 'Google Search AI', provider: 'Google', logo: '🔎', available: true },
  { id: 'claude', name: 'Claude', provider: 'Anthropic', logo: '🎯', available: true },
  { id: 'gemini', name: 'Gemini', provider: 'Google', logo: '✨', available: true },
  { id: 'meta-llama', name: 'Meta Llama', provider: 'Meta', logo: '🦙', available: true },
  { id: 'grok', name: 'Grok', provider: 'xAI', logo: '⚡', available: true },
  { id: 'deepseek', name: 'Deepseek', provider: 'DeepSeek', logo: '🧠', available: true },
];

const MAX_SELECTIONS = 4;

export const AIModelSelection = ({ selectedModels, onModelToggle }: AIModelSelectionProps) => {
  const canSelectMore = selectedModels.length < MAX_SELECTIONS;

  const handleCardClick = (modelId: string, available: boolean) => {
    if (!available) return;

    const isSelected = selectedModels.includes(modelId);
    if (!isSelected && !canSelectMore) return;

    onModelToggle(modelId);
  };

  return (
    <div className="ai-model-selection">
      <div className="ai-model-instruction">
        <p>
          Choose which AI platforms you want to track. You can select up to {MAX_SELECTIONS}.
          We recommend starting with ChatGPT and Perplexity.
        </p>
      </div>

      <div className="ai-model-grid">
        {AI_MODELS.map((model) => {
          const isSelected = selectedModels.includes(model.id);
          const isDisabled = !model.available || (!isSelected && !canSelectMore);

          return (
            <button
              key={model.id}
              className={`ai-model-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleCardClick(model.id, model.available)}
              disabled={isDisabled}
              aria-label={`${model.name} by ${model.provider}`}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <div className="ai-model-checkmark">
                  <Check size={16} />
                </div>
              )}
              <div className="ai-model-logo">{model.logo}</div>
              <div className="ai-model-name">{model.name}</div>
              <div className="ai-model-provider">{model.provider}</div>
              {!model.available && (
                <div className="ai-model-badge">Coming Soon</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="ai-model-counter">
        You've selected <strong>{selectedModels.length}</strong> of {MAX_SELECTIONS} models
        {selectedModels.length >= MAX_SELECTIONS && (
          <span className="ai-model-counter-hint"> — Maximum reached</span>
        )}
      </div>
    </div>
  );
};
