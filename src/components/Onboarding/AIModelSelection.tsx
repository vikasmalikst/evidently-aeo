import type { ReactNode } from 'react';
import { IconBrandBing, IconBrandOpenai, IconRocket } from '@tabler/icons-react';
import { Check } from 'lucide-react';

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

const ClaudeLogo = () => (
  <svg viewBox="0 0 64 64" role="img" aria-label="Claude logo">
    <rect width="64" height="64" rx="16" fill="#111827" />
    <path
      d="M44 20a12 12 0 1 0 0 24"
      stroke="#FF4D30"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const GeminiLogo = () => (
  <svg viewBox="0 0 64 64" role="img" aria-label="Gemini logo">
    <defs>
      <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1D4ED8" />
        <stop offset="45%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" fill="#020617" />
    <circle cx="26" cy="32" r="15" fill="url(#geminiGradient)" opacity="0.95" />
    <circle cx="40" cy="32" r="15" fill="#38BDF8" opacity="0.8" />
  </svg>
);

const PerplexityLogo = () => (
  <svg viewBox="0 0 64 64" role="img" aria-label="Perplexity logo">
    <rect width="64" height="64" rx="16" fill="#0F172A" />
    <circle cx="32" cy="32" r="18" stroke="#60A5FA" strokeWidth="6" fill="none" opacity="0.85" />
    <path
      d="M32 14c10 0 18 8 18 18s-8 18-18 18"
      stroke="#22D3EE"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="32" cy="32" r="6" fill="#A855F7" />
  </svg>
);

const DeepseekLogo = () => (
  <svg viewBox="0 0 64 64" role="img" aria-label="DeepSeek logo">
    <rect width="64" height="64" rx="16" fill="#022C36" />
    <path
      d="M20 16h14c9 0 15 6 15 16s-6 16-15 16h-6v-9h6c4 0 7-3 7-7s-3-7-7-7H20z"
      fill="#38BDF8"
    />
    <path
      d="M20 19v26"
      stroke="#0EA5E9"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </svg>
);

const MistralLogo = () => (
  <svg viewBox="0 0 64 64" role="img" aria-label="Mistral logo">
    <defs>
      <linearGradient id="mistralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FB923C" />
        <stop offset="60%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#mistralGradient)" />
    <path
      d="M16 44V20l8 8l8-8l8 8l8-8v24"
      stroke="#FFFFFF"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const GroqLogo = () => (
  <svg viewBox="0 0 64 64" role="img" aria-label="Groq logo">
    <rect width="64" height="64" rx="16" fill="#1E1B4B" />
    <path
      d="M44 32c0 6.627-5.373 12-12 12s-12-5.373-12-12s5.373-12 12-12"
      stroke="#F472B6"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M44 32h-9"
      stroke="#C084FC"
      strokeWidth="6"
      strokeLinecap="round"
    />
  </svg>
);

const FutureLLMLogo = () => (
  <div className="ai-model-logo-icon">
    <IconRocket size={40} stroke={1.6} color="#6366F1" />
  </div>
);

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
    logo: <ClaudeLogo />,
    available: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'Google',
    logo: <GeminiLogo />,
    available: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    logo: <PerplexityLogo />,
    available: true,
  },
  {
    id: 'bing-copilot',
    name: 'Microsoft Copilot',
    provider: 'Microsoft',
    logo: <IconBrandBing size={40} stroke={1.6} color="#0EA5E9" />,
    available: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'DeepSeek',
    logo: <DeepseekLogo />,
    available: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    provider: 'Mistral AI',
    logo: <MistralLogo />,
    available: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    provider: 'Groq',
    logo: <GroqLogo />,
    available: true,
  },
  {
    id: 'future-llm',
    name: 'Future LLM',
    provider: 'TBA',
    logo: <FutureLLMLogo />,
    available: false,
  },
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
      </div>
    </div>
  );
};
