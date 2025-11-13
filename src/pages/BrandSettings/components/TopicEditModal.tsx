import { useState, useMemo } from 'react';
import { X, TrendingUp, Sparkles, List, ChevronLeft, Plus, Minus, BarChart3, Clock, TrendingUp as TrendingUpIcon, CheckCircle2 } from 'lucide-react';
import { TopicSection } from '../../../components/Topics/TopicSection';
import { CustomTopicInput } from '../../../components/Topics/CustomTopicInput';
import { generateMockTopics } from '../../../data/mockTopicsData';
import type { Topic, TopicCategory } from '../../../types/topic';
import type { TopicChangeImpact } from '../types';

interface TopicEditModalProps {
  currentTopics: Topic[];
  onSave: (topics: Topic[]) => void;
  onCancel: () => void;
  changeImpact: TopicChangeImpact | null;
  brandName: string;
  industry: string;
}

const MAX_TOPICS = 10;
const MIN_TOPICS = 5;

type ModalStep = 'selection' | 'review';

export const TopicEditModal = ({
  currentTopics,
  onSave,
  onCancel,
  changeImpact,
  brandName,
  industry,
}: TopicEditModalProps) => {
  const [step, setStep] = useState<ModalStep>('selection');
  const [availableTopics] = useState(() => generateMockTopics(brandName, industry));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    new Set(currentTopics.map(t => t.id))
  );
  const [customTopics, setCustomTopics] = useState<Topic[]>(
    currentTopics.filter(t => t.source === 'custom')
  );
  const [activeAICategory, setActiveAICategory] = useState<TopicCategory>('awareness');

  const proposedTopics = useMemo(() => {
    const allTopics = [
      ...availableTopics.trending,
      ...availableTopics.aiGenerated.awareness,
      ...availableTopics.aiGenerated.comparison,
      ...availableTopics.aiGenerated.purchase,
      ...availableTopics.aiGenerated.support,
      ...availableTopics.preset,
      ...customTopics,
    ];
    return allTopics.filter(t => selectedTopics.has(t.id));
  }, [availableTopics, selectedTopics, customTopics]);

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

  const hasChanges = useMemo(() => {
    const currentIds = new Set(currentTopics.map(t => t.id));
    const proposedIds = new Set(proposedTopics.map(t => t.id));
    if (currentIds.size !== proposedIds.size) return true;
    for (const id of currentIds) {
      if (!proposedIds.has(id)) return true;
    }
    return false;
  }, [currentTopics, proposedTopics]);

  const isValid = proposedTopics.length >= MIN_TOPICS && proposedTopics.length <= MAX_TOPICS;

  // Calculate change impact for review step
  const reviewChangeImpact = useMemo<TopicChangeImpact | null>(() => {
    if (!hasChanges) return null;

    const currentIds = new Set(currentTopics.map(t => t.id));
    const proposedIds = new Set(proposedTopics.map(t => t.id));

    const added = proposedTopics.filter(t => !currentIds.has(t.id));
    const removed = currentTopics.filter(t => !proposedIds.has(t.id));

    return {
      added,
      removed,
      newPromptCount: added.length * 8, // Estimate: ~8 prompts per topic
      isSignificant: Math.abs(added.length - removed.length) >= 3,
    };
  }, [currentTopics, proposedTopics, hasChanges]);

  const handleReviewChanges = () => {
    if (isValid && hasChanges) {
      setStep('review');
    }
  };

  const handleConfirm = () => {
    if (isValid && hasChanges) {
      onSave(proposedTopics);
    }
  };

  const handleBack = () => {
    setStep('selection');
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'trending':
        return { bg: 'rgba(252, 235, 150, 0.3)', text: '#927f20' };
      case 'ai_generated':
        return { bg: 'rgba(51, 201, 227, 0.2)', text: '#005a69' };
      case 'preset':
        return { bg: 'rgba(107, 114, 137, 0.2)', text: '#52576d' };
      case 'custom':
        return { bg: 'rgba(172, 89, 251, 0.2)', text: '#54079c' };
      default:
        return { bg: 'rgba(107, 114, 137, 0.2)', text: '#52576d' };
    }
  };

  // Estimate analysis time (rough calculation: ~2 minutes per topic)
  const estimatedAnalysisTime = Math.ceil(proposedTopics.length * 2);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] flex flex-col" style={{ boxShadow: 'var(--shadow-xl)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 className="text-xl font-semibold text-[var(--text-headings)]">
            {step === 'selection' ? 'Edit Topics' : 'Review Changes'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={20} className="text-[var(--text-body)]" />
          </button>
        </div>

        {step === 'selection' ? (
          <>
            {/* Before/After Comparison */}
            <div className="grid grid-cols-2 gap-4 p-6 border-b border-[var(--border-default)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-caption)] uppercase mb-3">
                  Current Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {currentTopics.map((topic) => {
                    const colors = getSourceBadgeColor(topic.source);
                    return (
                      <div
                        key={topic.id}
                        className="px-3 py-1.5 rounded-lg text-sm opacity-60"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {topic.name}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-caption)] uppercase mb-3">
                  Proposed Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {proposedTopics.map((topic) => {
                    const colors = getSourceBadgeColor(topic.source);
                    return (
                      <div
                        key={topic.id}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {topic.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Topic Selection */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <p className="text-sm text-[var(--text-caption)]">
                  Select up to {MAX_TOPICS} topics. Currently {proposedTopics.length}/{MAX_TOPICS} selected.
                </p>
              </div>

              <div className="space-y-4">
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-[var(--border-default)]">
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium text-[var(--text-headings)]"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewChanges}
                disabled={!hasChanges || !isValid}
                className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review Changes
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Review Step: What Will Change */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Changes Summary */}
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-headings)] mb-4">
                    What Will Change
                  </h3>

                  <div className="space-y-3">
                    {reviewChangeImpact && reviewChangeImpact.added.length > 0 && (
                      <div className="p-4 bg-[var(--success500)]/10 border border-[var(--success500)]/30 rounded-lg">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--success500)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Plus size={16} className="text-[var(--success500)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-headings)] mb-3">
                              Adding {reviewChangeImpact.added.length} topic{reviewChangeImpact.added.length !== 1 ? 's' : ''}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {reviewChangeImpact.added.map((topic) => (
                                <span
                                  key={topic.id}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--success500)] text-white"
                                >
                                  {topic.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {reviewChangeImpact && reviewChangeImpact.removed.length > 0 && (
                      <div className="p-4 bg-[var(--text-error)]/10 border border-[var(--text-error)]/30 rounded-lg">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--text-error)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Minus size={16} className="text-[var(--text-error)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-headings)] mb-3">
                              Removing {reviewChangeImpact.removed.length} topic{reviewChangeImpact.removed.length !== 1 ? 's' : ''}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {reviewChangeImpact.removed.map((topic) => (
                                <span
                                  key={topic.id}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--text-error)] text-white"
                                >
                                  {topic.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Impact on Your Analysis */}
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-headings)] mb-4">
                    Impact on Your Analysis
                  </h3>

                  <div className="space-y-3 p-4 bg-[var(--accent-light)] border border-[var(--accent-primary)]/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                        <BarChart3 size={16} className="text-[var(--accent-primary)]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-headings)]">
                          {reviewChangeImpact?.newPromptCount || 0} new search queries will be generated
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                        <Clock size={16} className="text-[var(--accent-primary)]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-headings)]">
                          Next analysis will take approximately {estimatedAnalysisTime} minutes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUpIcon size={16} className="text-[var(--accent-primary)]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-headings)]">
                          Visibility score will recalculate based on new topics
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--success500)]/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 size={16} className="text-[var(--success500)]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--success500)]">
                          Past analyses are not affected (data preserved)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reassurance Text */}
                <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
                  <p className="text-sm text-[var(--text-body)] leading-relaxed">
                    Once confirmed, these changes affect all future analyses. You can always revert to a previous configuration anytime.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-[var(--border-default)]">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium text-[var(--text-headings)]"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium"
              >
                Confirm Changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
