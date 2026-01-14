import { useState, useEffect } from 'react';
import { ArrowRight, TrendingUp, Sparkles, List, ChevronLeft } from 'lucide-react';
import type { Topic, TopicCategory } from '../../types/topic';
import { fetchTopicsForBrand } from '../../api/onboardingApi';
import { TopicSection } from './TopicSection';
import { CustomTopicInput } from './CustomTopicInput';
import { SelectedTopicsSummary } from './SelectedTopicsSummary';
import { StepIndicator } from '../Onboarding/StepIndicator';
import { Spinner } from '../Onboarding/common/Spinner';
import { OnboardingTooltip } from '../Onboarding/common/OnboardingTooltip';
import evidentlyLogo from '../../assets/logo.png';
import { SetupLayout } from '../../pages/SetupLayout';

interface TopicSelectionModalProps {
  brandName: string;
  industry: string;
  onNext: (selectedTopics: Topic[]) => void;
  onBack: () => void;
  onClose: () => void;
  mode?: 'modal' | 'fullscreen';
}

const MAX_TOPICS = 10;
const MIN_TOPICS = 5;

export const TopicSelectionModal = ({
  brandName,
  industry,
  onNext,
  onBack,
  onClose,
  mode = 'modal',
}: TopicSelectionModalProps) => {
  const [availableTopics, setAvailableTopics] = useState<{
    trending: Topic[];
    aiGenerated: {
      awareness: Topic[];
      comparison: Topic[];
      purchase: Topic[];
      support: Topic[];
    };
    preset: Topic[];
  }>({
    trending: [],
    aiGenerated: { awareness: [], comparison: [], purchase: [], support: [] },
    preset: []
  });
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [customTopics, setCustomTopics] = useState<Topic[]>([]);
  const [activeAICategory, setActiveAICategory] = useState<Exclude<TopicCategory, 'general'>>('awareness');
  const [qualityScore, setQualityScore] = useState(0);

  useEffect(() => {
    calculateQualityScore();
  }, [selectedTopics, customTopics]);

  useEffect(() => {
    fetchTopicsFromAPI();
  }, [brandName, industry]);

  const fetchTopicsFromAPI = async () => {
    setIsLoadingTopics(true);
    setTopicsError(null);
    try {
      // Get competitors from localStorage
      const competitorsData = localStorage.getItem('onboarding_competitors');
      const competitors = competitorsData ? JSON.parse(competitorsData) : [];
      
      console.log('🔍 Fetching topics for:', brandName, industry);
      
      // Get brand data to pass website_url if available
      const brandData = localStorage.getItem('onboarding_brand');
      const brand = brandData ? JSON.parse(brandData) : {};
      
      // During onboarding, brand hasn't been created yet, so don't pass brand_id
      // brand_id should only be used after brand creation is complete
      const response = await fetchTopicsForBrand({
        brand_name: brandName,
        industry,
        competitors: competitors.map((c: any) => c.name || c.companyName || ''),
        locale: 'en-US',
        country: 'US',
        // Don't pass brand_id during onboarding - it may be stale from previous sessions
        brand_id: undefined,
        website_url: brand.website || brand.domain || undefined
      });
      
      if (response.success && response.data) {
        // Ensure all required properties exist with default empty arrays
        const topicsData = {
          trending: Array.isArray(response.data.trending) ? response.data.trending : [],
          aiGenerated: {
            awareness: Array.isArray(response.data.aiGenerated?.awareness) ? response.data.aiGenerated.awareness : [],
            comparison: Array.isArray(response.data.aiGenerated?.comparison) ? response.data.aiGenerated.comparison : [],
            purchase: Array.isArray(response.data.aiGenerated?.purchase) ? response.data.aiGenerated.purchase : [],
            support: Array.isArray(response.data.aiGenerated?.support) ? response.data.aiGenerated.support : []
          },
          preset: Array.isArray(response.data.preset) ? response.data.preset : []
        };
        
        setAvailableTopics(topicsData);
        setTopicsError(null);
        console.log('✅ Loaded topics:', {
          trending: topicsData.trending.length,
          awareness: topicsData.aiGenerated.awareness.length,
          comparison: topicsData.aiGenerated.comparison.length,
          purchase: topicsData.aiGenerated.purchase.length,
          support: topicsData.aiGenerated.support.length,
          preset: topicsData.preset.length
        });
      } else {
        const errorMsg = response.error || 'Failed to load recommended topics';
        console.error('Failed to fetch topics:', errorMsg);
        setTopicsError(errorMsg);
        // Keep empty state - user can still add custom topics
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load recommended topics';
      console.error('Failed to fetch topics:', error);
      setTopicsError(errorMsg);
      // Keep empty state - user can still add custom topics
    } finally {
      setIsLoadingTopics(false);
    }
  };

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

  const body = (
    <>
      {/* Contextual Tooltip - shows immediately on page load */}
      <OnboardingTooltip
        storageKey="topics-selection"
        title="Selecting Topics"
      >
        <p className="mb-2">
          Choose <strong>5-10 topics</strong> that matter most to your brand. These define what questions we'll track.
        </p>
        <p>
          💡 Need more? You can always add or modify topics later from the <strong>Configuration</strong> page in Settings.
        </p>
      </OnboardingTooltip>

      {isLoadingTopics ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Spinner size="large" message="Loading topics from AI..." />
        </div>
      ) : (
        <>

          {topicsError && (
            <div style={{ 
              padding: '12px 16px', 
              marginBottom: '16px', 
              backgroundColor: '#fef3c7', 
              border: '1px solid #fbbf24', 
              borderRadius: '8px',
              color: '#92400e',
              fontSize: '14px'
            }}>
              ⚠️ {topicsError}. You can still add custom topics below.
            </div>
          )}
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
              onTabChange={(tab) => setActiveAICategory(tab as Exclude<TopicCategory, 'general'>)}
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
        </>
      )}
    </>
  );

  if (mode === 'fullscreen') {
    return (
      <SetupLayout currentStep="topics" title="Select Topics" onBack={onBack}>
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-600">
            {selectedTopics.size}/{MAX_TOPICS} topics selected
          </div>
        </div>

        {body}

        <div className="mt-8 pt-8 border-t border-gray-200 flex items-center justify-between">
          <button
            className="px-8 py-3 border border-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-50 transition-all"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="px-8 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            onClick={handleNext}
            disabled={!isValid}
            type="button"
          >
            Next: Configure Prompts
          </button>
        </div>
      </SetupLayout>
    );
  }

  return (
    <div className="topic-modal-overlay">
      <img src={evidentlyLogo} alt="EvidentlyAEO" className="topic-overlay-logo" />
      <div className="topic-modal-container" onClick={(e) => e.stopPropagation()}>
        <StepIndicator currentStep="topics" />
        
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
          </div>
        </div>

        <div className="topic-modal-body">
          {body}
        </div>

        <div className="topic-modal-footer">
          <div className="onboarding-button-wrapper" style={{ marginLeft: 'auto' }}>
            <button
              className="onboarding-button-primary"
              onClick={handleNext}
              disabled={!isValid}
              type="button"
            >
              Next: Configure Prompts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
