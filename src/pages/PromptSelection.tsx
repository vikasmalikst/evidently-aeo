import { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { ReadinessScale } from '../components/PromptSelection/ReadinessScale';
import { TopicFilterBar } from '../components/PromptSelection/TopicFilterBar';
import { TopicGroup } from '../components/PromptSelection/TopicGroup';
import { ActionBar } from '../components/PromptSelection/ActionBar';
import { mockPromptSelectionData } from '../data/mockPromptSelectionData';

const MAX_PROMPTS = 40;

export const PromptSelection = () => {
  const [topics] = useState(mockPromptSelectionData);
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());
  const [readinessScore, setReadinessScore] = useState(0);
  const [readinessStatus, setReadinessStatus] = useState('Incomplete');

  useEffect(() => {
    const preselected = topics.flatMap(t =>
      t.prompts.filter(p => p.preselected).map(p => p.id)
    );
    setSelectedPrompts(new Set(preselected));
  }, [topics]);

  useEffect(() => {
    calculateReadiness();
  }, [selectedPrompts, topics]);

  const calculateReadiness = () => {
    const topicsWithSelections = topics.filter(t =>
      t.prompts.some(p => selectedPrompts.has(p.id))
    ).length;
    const topicsCovered = (topicsWithSelections / topics.length) * 50;

    const promptsSelected = Math.min(selectedPrompts.size / 20, 1) * 30;

    const selectedPromptsList = topics.flatMap(t =>
      t.prompts.filter(p => selectedPrompts.has(p.id))
    );
    const avgConfidence = selectedPromptsList.length > 0
      ? selectedPromptsList.reduce((sum, p) => sum + p.confidence, 0) / selectedPromptsList.length
      : 0;
    const confidenceScore = (avgConfidence / 100) * 20;

    const total = Math.round(topicsCovered + promptsSelected + confidenceScore);
    setReadinessScore(total);

    if (total < 30) {
      setReadinessStatus('Incomplete');
    } else if (total < 60) {
      setReadinessStatus(selectedPrompts.size >= 5 ? 'Adequate' : 'Incomplete');
    } else if (total < 85) {
      setReadinessStatus(selectedPrompts.size >= 8 && topicsWithSelections === topics.length ? 'Strong' : 'Adequate');
    } else {
      setReadinessStatus(selectedPrompts.size >= 12 && topicsWithSelections === topics.length ? 'Optimal' : 'Strong');
    }
  };

  const handleTogglePrompt = (promptId: string) => {
    setSelectedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        if (newSet.size >= MAX_PROMPTS) {
          alert(`You can select up to ${MAX_PROMPTS} prompts maximum.`);
          return prev;
        }
        newSet.add(promptId);
      }
      return newSet;
    });
  };

  const handleFilterClick = (topicId: string) => {
    const element = document.getElementById(`topic-${topicId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAddCustomPrompt = (topicId: string) => {
    alert(`Add custom prompt feature for topic ${topicId} - to be implemented`);
  };

  const handleAnalyze = () => {
    alert(`Starting analysis with ${selectedPrompts.size} queries`);
  };

  return (
    <Layout>
      <div className="prompt-selection-page">
        <div className="prompt-selection-header">
          <div className="prompt-selection-header-content">
            <h1>Evidently — Select Prompts</h1>
            <p>Choose up to 40 queries for AI analysis</p>
          </div>
        </div>

        <div className="prompt-selection-readiness">
          <ReadinessScale percentage={readinessScore} status={readinessStatus} />
        </div>

        <TopicFilterBar
          topics={topics.map(t => ({ id: t.id, name: t.name, icon: t.icon }))}
          onFilterClick={handleFilterClick}
        />

        <div className="prompt-selection-content">
          {topics.map((topic) => (
            <TopicGroup
              key={topic.id}
              topic={topic}
              selectedPrompts={selectedPrompts}
              onTogglePrompt={handleTogglePrompt}
              onAddCustomPrompt={handleAddCustomPrompt}
            />
          ))}
        </div>

        <ActionBar
          selectedCount={selectedPrompts.size}
          maxCount={MAX_PROMPTS}
          onAnalyze={handleAnalyze}
        />
      </div>
    </Layout>
  );
};
