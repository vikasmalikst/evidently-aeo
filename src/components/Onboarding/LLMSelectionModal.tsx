import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from './common/Button';

interface LLM {
  id: string;
  name: string;
  description: string;
  logo: string;
  preselected: boolean;
}

interface LLMSelectionModalProps {
  isOpen: boolean;
  onComplete: (selectedLLMs: string[]) => void;
}

const llms: LLM[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'OpenAI\'s conversational AI assistant',
    logo: '🤖',
    preselected: true
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic\'s advanced AI assistant',
    logo: '🧠',
    preselected: true
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'AI-powered search engine',
    logo: '🔍',
    preselected: true
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google\'s multimodal AI model',
    logo: '✨',
    preselected: true
  },
  {
    id: 'copilot',
    name: 'Copilot',
    description: 'Microsoft\'s AI assistant',
    logo: '🚀',
    preselected: true
  },
  {
    id: 'metaai',
    name: 'Meta AI',
    description: 'Meta\'s AI assistant',
    logo: '🌐',
    preselected: true
  }
];

export const LLMSelectionModal = ({ isOpen, onComplete }: LLMSelectionModalProps) => {
  const [selectedLLMs, setSelectedLLMs] = useState<Set<string>>(
    new Set(llms.filter(llm => llm.preselected).map(llm => llm.id))
  );

  if (!isOpen) return null;

  const toggleLLM = (id: string) => {
    setSelectedLLMs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        if (newSet.size > 1) {
          newSet.delete(id);
        }
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    onComplete(Array.from(selectedLLMs));
  };

  return (
    <div className="onboarding-modal-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-modal-header">
          <div className="progress-indicator">
            <div className="progress-dot"></div>
            <div className="progress-dot active"></div>
            <div className="progress-dot"></div>
          </div>
          <h2 className="onboarding-modal-title">Select AI Platforms to Track</h2>
          <p className="onboarding-modal-subtitle">
            Choose which AI platforms you want to monitor for your brand visibility (select at least 1)
          </p>
          <div className="onboarding-selection-count">
            <span className="onboarding-selection-count__number">{selectedLLMs.size}</span>
            <span className="onboarding-selection-count__text">of {llms.length} selected</span>
          </div>
        </div>

        <div className="onboarding-llm-grid">
          {llms.map((llm) => {
            const isSelected = selectedLLMs.has(llm.id);
            return (
              <button
                key={llm.id}
                className={`onboarding-llm-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleLLM(llm.id)}
              >
                <div className="onboarding-llm-card__checkbox">
                  {isSelected && <Check size={16} />}
                </div>
                <div className="onboarding-llm-card__logo">{llm.logo}</div>
                <h3 className="onboarding-llm-card__name">{llm.name}</h3>
                <p className="onboarding-llm-card__description">{llm.description}</p>
              </button>
            );
          })}
        </div>

        <div className="onboarding-modal-footer">
          <Button onClick={handleContinue} disabled={selectedLLMs.size === 0}>
            Continue to Prompts
          </Button>
        </div>
      </div>
    </div>
  );
};
