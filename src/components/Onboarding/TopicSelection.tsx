import { useState, useEffect } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Check, TrendingUp, Sparkles, List } from 'lucide-react';
import type { Topic } from '../../types/topic';
import { generateMockTopics } from '../../data/mockTopicsData';

interface TopicSelectionProps {
  brandName: string;
  industry: string;
  onContinue: (selectedTopics: Topic[]) => void;
  onBack: () => void;
}

const MAX_TOPICS = 10;
const MIN_TOPICS = 5;

export const TopicSelection = ({ brandName, industry, onContinue, onBack }: TopicSelectionProps) => {
  const [availableTopics] = useState(() => generateMockTopics(brandName, industry));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  const allTopicsList = [
    ...availableTopics.trending.slice(0, 6),
    ...availableTopics.aiGenerated.awareness.slice(0, 6),
    ...availableTopics.preset.slice(0, 6)
  ];

  const toggleTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      if (newSelected.size < MAX_TOPICS) {
        newSelected.add(topicId);
      }
    }
    setSelectedTopics(newSelected);
  };

  const handleContinue = () => {
    const selected = allTopicsList.filter(t => selectedTopics.has(t.id));
    onContinue(selected);
  };

  const isValid = selectedTopics.size >= MIN_TOPICS;

  return (
    <div className="onboarding-step">
      <div className="onboarding-step__content onboarding-step__content--wide">
        <div className="onboarding-hero">
          <div className="onboarding-hero__icon">
            <Sparkles size={48} />
          </div>
          <h1 className="onboarding-hero__title">
            Select Topics to Track
          </h1>
          <p className="onboarding-hero__subtitle">
            Choose {MIN_TOPICS}-{MAX_TOPICS} topics relevant to your brand
          </p>
        </div>

        <div className="onboarding-section-header">
          <div className="onboarding-selection-count">
            <span className="onboarding-selection-count__number">{selectedTopics.size}</span>
            <span className="onboarding-selection-count__text">of {MAX_TOPICS} selected</span>
          </div>
        </div>

        <div className="onboarding-topic-grid">
          {allTopicsList.map((topic) => {
            const isSelected = selectedTopics.has(topic.id);
            return (
              <Card
                key={topic.id}
                selected={isSelected}
                hoverable
                onClick={() => toggleTopic(topic.id)}
              >
                <div className="onboarding-topic-card">
                  <div className="onboarding-topic-card__checkbox">
                    {isSelected && <Check size={16} />}
                  </div>
                  <h3 className="onboarding-topic-card__name">{topic.name}</h3>
                  <div className="onboarding-topic-card__meta">
                    <span className="onboarding-topic-card__relevance">
                      {topic.relevance}% relevant
                    </span>
                  </div>
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
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
