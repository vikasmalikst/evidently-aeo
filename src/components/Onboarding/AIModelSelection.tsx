import type { ReactNode } from 'react';
import { IconBrandOpenai } from '@tabler/icons-react';
import { Check } from 'lucide-react';
import claudeLogoSrc from '../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../assets/Grok-icon.svg';
import llamaLogoSrc from '../../assets/LLaMA-Meta-Logo.svg';
import perplexityLogoSrc from '../../assets/Perplexity-Simple-Icon.svg';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  logo: ReactNode;
  available: boolean;
}

interface AIModelSelectionProps {
  selectedModels: string[];
  onModelToggle: (modelId: string) => void;
}

const AI_MODELS: AIModel[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    logo: <IconBrandOpenai size={40} stroke={1.5} color="#74AA9C" />,
    available: true,
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    logo: (
      <img
        src={claudeLogoSrc}
        alt="Claude logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'Google',
    logo: (
      <img
        src={geminiLogoSrc}
        alt="Google Gemini logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    logo: (
      <img
        src={perplexityLogoSrc}
        alt="Perplexity logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: true,
  },
  {
    id: 'bing_copilot',
    name: 'Microsoft Copilot',
    provider: 'Microsoft',
    logo: (
      <img
        src={copilotLogoSrc}
        alt="Microsoft Copilot logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: true,
  },
  {
    id: 'google_aio',
    name: 'Google AIO',
    provider: 'Google',
    logo: (
      <img
        src={googleAioLogoSrc}
        alt="Google AIO logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: true,
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    logo: (
      <img
        src={grokLogoSrc}
        alt="Grok logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: true,
  },
  {
    id: 'llama',
    name: 'LLaMA',
    provider: 'Meta AI',
    logo: (
      <img
        src={llamaLogoSrc}
        alt="LLaMA logo"
        className="ai-model-logo-image"
        loading="lazy"
      />
    ),
    available: false,
  },
];

const MAX_SELECTIONS = 7;

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
      </div>
    </div>
  );
};
