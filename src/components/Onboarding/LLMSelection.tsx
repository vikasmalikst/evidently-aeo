import { useState } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Check, Sparkles } from 'lucide-react';

interface LLMSelectionProps {
  onContinue: (selectedLLMs: string[]) => void;
}

const llms = [
  { id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI' },
  { id: 'perplexity', name: 'Perplexity', provider: 'Perplexity AI' },
  { id: 'google-search-ai', name: 'Google Search AI', provider: 'Google' },
  { id: 'claude', name: 'Claude', provider: 'Anthropic' },
  { id: 'microsoft-copilot', name: 'Microsoft Copilot', provider: 'Microsoft' },
  { id: 'google-gemini', name: 'Google Gemini', provider: 'Google' },
  { id: 'grok', name: 'Grok', provider: 'xAI' },
  { id: 'meta-llama', name: 'Meta Llama', provider: 'Meta' },
  { id: 'deepseek-r1', name: 'Deepseek R1', provider: 'Deepseek' }
];

export const LLMSelection = ({ onContinue }: LLMSelectionProps) => {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['chatgpt', 'perplexity', 'claude'])
  );

  const toggleLLM = (llmId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(llmId)) {
      if (newSelected.size <= 1) return;
      newSelected.delete(llmId);
    } else {
      newSelected.add(llmId);
    }
    setSelected(newSelected);
  };

  const handleContinue = () => {
    onContinue(Array.from(selected));
  };

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__content onboarding-step__content--wide">
        <div className="onboarding-hero">
          <div className="onboarding-hero__icon">
            <Sparkles size={48} />
          </div>
          <h1 className="onboarding-hero__title">
            Select AI Platforms to Track
          </h1>
          <p className="onboarding-hero__subtitle">
            Choose which AI platforms you want to monitor for brand visibility
          </p>
        </div>

        <div className="onboarding-section-header">
          <div className="onboarding-selection-count">
            <span className="onboarding-selection-count__number">{selected.size}</span>
            <span className="onboarding-selection-count__text">platform{selected.size !== 1 ? 's' : ''} selected</span>
          </div>
        </div>

        <div className="onboarding-llm-grid">
          {llms.map((llm) => {
            const isSelected = selected.has(llm.id);
            return (
              <Card
                key={llm.id}
                selected={isSelected}
                hoverable
                onClick={() => toggleLLM(llm.id)}
              >
                <div className="onboarding-llm-card">
                  <div className="onboarding-llm-card__checkbox">
                    {isSelected && <Check size={16} />}
                  </div>
                  <h3 className="onboarding-llm-card__name">{llm.name}</h3>
                  <p className="onboarding-llm-card__provider">{llm.provider}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="onboarding-actions onboarding-actions--single">
          <Button onClick={handleContinue} disabled={selected.size === 0}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
