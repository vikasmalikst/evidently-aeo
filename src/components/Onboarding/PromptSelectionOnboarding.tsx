import { useState, useEffect } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Check, MessageSquare } from 'lucide-react';
import type { Topic } from '../../types/topic';
import { mockPromptSelectionData } from '../../data/mockPromptSelectionData';

interface PromptSelectionOnboardingProps {
  selectedTopics: Topic[];
  onContinue: (selectedPrompts: any[]) => void;
  onBack: () => void;
}

const MAX_PROMPTS = 20;
const MIN_PROMPTS = 5;

export const PromptSelectionOnboarding = ({ selectedTopics, onContinue, onBack }: PromptSelectionOnboardingProps) => {
  const [topics] = useState(mockPromptSelectionData);
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const preselected = topics
      .slice(0, 3)
      .flatMap(t => t.prompts.filter(p => p.preselected).map(p => p.id));
    setSelectedPrompts(new Set(preselected));
  }, [topics]);

  const allPrompts = topics.flatMap(topic =>
    topic.prompts.map(prompt => ({
      ...prompt,
      topicName: topic.name
    }))
  ).slice(0, 24);

  const togglePrompt = (promptId: string) => {
    const newSelected = new Set(selectedPrompts);
    if (newSelected.has(promptId)) {
      newSelected.delete(promptId);
    } else {
      if (newSelected.size < MAX_PROMPTS) {
        newSelected.add(promptId);
      }
    }
    setSelectedPrompts(newSelected);
  };

  const handleContinue = () => {
    const selected = allPrompts.filter(p => selectedPrompts.has(p.id));
    onContinue(selected);
  };

  const isValid = selectedPrompts.size >= MIN_PROMPTS;

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__content onboarding-step__content--wide">
        <div className="onboarding-hero">
          <div className="onboarding-hero__icon">
            <MessageSquare size={48} />
          </div>
          <h1 className="onboarding-hero__title">
            Select Prompts to Monitor
          </h1>
          <p className="onboarding-hero__subtitle">
            Choose {MIN_PROMPTS}-{MAX_PROMPTS} prompts to track across AI platforms
          </p>
        </div>

        <div className="onboarding-section-header">
          <div className="onboarding-selection-count">
            <span className="onboarding-selection-count__number">{selectedPrompts.size}</span>
            <span className="onboarding-selection-count__text">of {MAX_PROMPTS} selected</span>
          </div>
        </div>

        <div className="onboarding-prompt-grid">
          {allPrompts.map((prompt) => {
            const isSelected = selectedPrompts.has(prompt.id);
            return (
              <Card
                key={prompt.id}
                selected={isSelected}
                hoverable
                onClick={() => togglePrompt(prompt.id)}
              >
                <div className="onboarding-prompt-card">
                  <div className="onboarding-prompt-card__checkbox">
                    {isSelected && <Check size={16} />}
                  </div>
                  <div className="onboarding-prompt-card__header">
                    <span className="onboarding-prompt-card__topic">{prompt.topicName}</span>
                    <span className="onboarding-prompt-card__confidence">{prompt.confidence}%</span>
                  </div>
                  <p className="onboarding-prompt-card__text">{prompt.prompt}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="onboarding-actions">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={!isValid}>
            Complete Setup
          </Button>
        </div>
      </div>
    </div>
  );
};
