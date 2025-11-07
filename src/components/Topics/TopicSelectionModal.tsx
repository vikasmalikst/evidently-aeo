import { useState, useEffect } from 'react';
import { X, ArrowRight, TrendingUp, Sparkles, List, ChevronLeft } from 'lucide-react';
import type { Topic, TopicCategory } from '../../types/topic';
import { generateMockTopics } from '../../data/mockTopicsData';
import { WelcomeScreen } from './WelcomeScreen';
import { SelectionBar } from './SelectionBar';
import { TopicSection } from './TopicSection';
import { CustomTopicInput } from './CustomTopicInput';
import { SelectedTopicsSummary } from './SelectedTopicsSummary';

interface TopicSelectionModalProps {
  brandName: string;
  industry: string;
  onNext: (selectedTopics: Topic[]) => void;
  onBack: () => void;
  onClose: () => void;
}

const MAX_TOPICS = 10;
const MIN_TOPICS = 5;

export const TopicSelectionModal = ({
  brandName,
  industry,
  onNext,
  onBack,
  onClose,
}: TopicSelectionModalProps) => {
  console.log('TopicSelectionModal rendered with:', { brandName, industry });
  const [showWelcome, setShowWelcome] = useState(true);
  console.log('showWelcome initial state:', true);
  const [availableTopics, setAvailableTopics] = useState(() =>
    generateMockTopics(brandName, industry)
  );
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [customTopics, setCustomTopics] = useState<Topic[]>([]);
  const [activeAICategory, setActiveAICategory] = useState<TopicCategory>('awareness');
  const [qualityScore, setQualityScore] = useState(0);

  useEffect(() => {
    calculateQualityScore();
  }, [selectedTopics, customTopics]);

  const calculateQualityScore = () => {
    if (selectedTopics.size === 0) {
      setQualityScore(0);
      return;
    }

    const allTopics = [
      ...availableTopics.trending,
      ...availableTopics.aiGenerated.awareness,
      ...availableTopics.aiGenerated.comparison,
      ...availableTopics.aiGenerated.purchase,
      ...availableTopics.aiGenerated.support,
      ...availableTopics.preset,
      ...customTopics,
    ];

    const selected = allTopics.filter((t) => selectedTopics.has(t.id));

    let score = 0;
    const avgRelevance =
      selected.reduce((sum, t) => sum + t.relevance, 0) / selected.length;
    score += avgRelevance * 0.4;

    const sources = new Set(selected.map((t) => t.source));
    const diversityBonus = (sources.size / 4) * 30;
    score += diversityBonus;

    const countScore = Math.min((selectedTopics.size / MIN_TOPICS) * 30, 30);
    score += countScore;

    setQualityScore(Math.min(Math.round(score), 100));
  };

  const handleToggleTopic = (topicId: string) => {
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

  const handleRemoveTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopics);
    newSelected.delete(topicId);
    setSelectedTopics(newSelected);
  };

  const handleAddCustomTopic = (topicName: string) => {
    const customTopic: Topic = {
      id: `custom-${Date.now()}`,
      name: topicName,
      source: 'custom',
      relevance: 70,
    };

    setCustomTopics([...customTopics, customTopic]);
    const newSelected = new Set(selectedTopics);
    if (newSelected.size < MAX_TOPICS) {
      newSelected.add(customTopic.id);
      setSelectedTopics(newSelected);
    }
  };

  const handleNext = () => {
    const allTopics = [
      ...availableTopics.trending,
      ...availableTopics.aiGenerated.awareness,
      ...availableTopics.aiGenerated.comparison,
      ...availableTopics.aiGenerated.purchase,
      ...availableTopics.aiGenerated.support,
      ...availableTopics.preset,
      ...customTopics,
    ];

    const selected = allTopics.filter((t) => selectedTopics.has(t.id));
    onNext(selected);
  };

  const getSelectedTopicsList = (): Topic[] => {
    const allTopics = [
      ...availableTopics.trending,
      ...availableTopics.aiGenerated.awareness,
      ...availableTopics.aiGenerated.comparison,
      ...availableTopics.aiGenerated.purchase,
      ...availableTopics.aiGenerated.support,
      ...availableTopics.preset,
      ...customTopics,
    ];
    return allTopics.filter((t) => selectedTopics.has(t.id));
  };

  const isValid = selectedTopics.size >= MIN_TOPICS && selectedTopics.size <= MAX_TOPICS;

  const getQualityLabel = () => {
    if (qualityScore >= 80) return 'Excellent';
    if (qualityScore >= 60) return 'Good';
    if (qualityScore >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const getQualityClass = () => {
    if (qualityScore >= 80) return 'excellent';
    if (qualityScore >= 60) return 'good';
    if (qualityScore >= 40) return 'fair';
    return 'poor';
  };

  if (showWelcome) {
    console.log('Rendering WelcomeScreen');
    return (
      <div className="topic-modal-overlay">
        <div className="topic-modal-container" onClick={(e) => e.stopPropagation()}>
          <WelcomeScreen onGetStarted={() => {
            console.log('WelcomeScreen - Get Started clicked');
            setShowWelcome(false);
          }} />
        </div>
      </div>
    );
  }

  console.log('Rendering topic selection (not welcome)', {
    selectedCount: selectedTopics.size,
    qualityScore
  });

  return (
    <div className="topic-modal-overlay" onClick={onClose}>
      <div className="topic-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-progress-bar">
          <div className="onboarding-progress-fill" style={{ width: '66%' }}></div>
        </div>

        <div className="topic-modal-header">
          <button className="topic-modal-back" onClick={onBack} aria-label="Back">
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
          <div className="topic-modal-header-content">
            <div>
              <h2 className="topic-modal-title">Select Topics</h2>
              <div className="topic-count-inline">
                {selectedTopics.size}/{MAX_TOPICS} topics selected
              </div>
            </div>
            <div className="topic-modal-header-right">
              <span className="topic-modal-step-badge">2/3</span>
            </div>
          </div>
        </div>

        <div className="topic-modal-body">
          <div className="topic-quality-section">
            <div className="topic-quality-indicator-main">
              <span className="topic-quality-label">Selection Quality: {getQualityLabel()}</span>
              <div className="topic-quality-bar">
                <div
                  className={`topic-quality-fill ${getQualityClass()}`}
                  style={{ width: `${qualityScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="topic-sections-container">
            <TopicSection
              title="Trending Topics"
              description={`Popular topics for ${brandName} from Google AI Overviews`}
              icon={<TrendingUp size={24} />}
              topics={availableTopics.trending}
              selectedTopics={selectedTopics}
              maxTopics={MAX_TOPICS}
              onToggleTopic={handleToggleTopic}
              defaultOpen={true}
            />

            <TopicSection
              title="AI-Recommended Topics"
              description="Topics tailored to your brand and industry"
              icon={<Sparkles size={24} />}
              topics={availableTopics.aiGenerated[activeAICategory]}
              selectedTopics={selectedTopics}
              maxTopics={MAX_TOPICS}
              onToggleTopic={handleToggleTopic}
              showTabs={true}
              tabs={['awareness', 'comparison', 'purchase', 'support']}
              activeTab={activeAICategory}
              onTabChange={(tab) => setActiveAICategory(tab as TopicCategory)}
            />

            <TopicSection
              title="General Topics"
              description="Standard topics applicable to most brands"
              icon={<List size={24} />}
              topics={availableTopics.preset}
              selectedTopics={selectedTopics}
              maxTopics={MAX_TOPICS}
              onToggleTopic={handleToggleTopic}
            />

            <CustomTopicInput onAddCustomTopic={handleAddCustomTopic} />

            {customTopics.length > 0 && (
              <TopicSection
                title="Custom Topics"
                description="Topics you've added manually"
                icon={<List size={24} />}
                topics={customTopics}
                selectedTopics={selectedTopics}
                maxTopics={MAX_TOPICS}
                onToggleTopic={handleToggleTopic}
                defaultOpen={true}
              />
            )}
          </div>

          <SelectedTopicsSummary
            selectedTopics={getSelectedTopicsList()}
            onRemoveTopic={handleRemoveTopic}
          />
        </div>

        <div className="topic-modal-footer">
          <button
            className="topic-btn-primary topic-btn-full"
            onClick={handleNext}
            disabled={!isValid}
            type="button"
          >
            Next: Configure Prompts
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
