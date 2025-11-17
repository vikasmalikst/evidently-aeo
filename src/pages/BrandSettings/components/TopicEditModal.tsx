import { useState, useMemo } from 'react';
import { X, Plus, Info, ChevronLeft, Minus, BarChart3, Clock, TrendingUp as TrendingUpIcon, CheckCircle2 as CheckCircle2Icon } from 'lucide-react';
import { IconCheck } from '@tabler/icons-react';
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
  currentVersion?: number;
}

const MAX_TOPICS = 10;
const MIN_TOPICS = 5;

type ModalStep = 'selection' | 'review';
type SectionFilter = 'all' | 'trending' | 'recommended' | 'general';

// Transform topic to include section
interface TransformedTopic extends Topic {
  section: 'trending' | 'recommended' | 'general';
}

// Category colors
const categoryColors: Record<string, { bg: string; border: string }> = {
  awareness: { bg: 'rgba(25, 118, 210, 0.12)', border: '#1976D2' }, // Blue
  comparison: { bg: 'rgba(123, 31, 162, 0.12)', border: '#7B1FA2' }, // Purple
  purchase: { bg: 'rgba(56, 142, 60, 0.12)', border: '#388E3C' }, // Green
  support: { bg: 'rgba(245, 124, 0, 0.12)', border: '#F57C00' }, // Orange
  general: { bg: 'rgba(97, 97, 97, 0.12)', border: '#616161' }, // Gray
};

export const TopicEditModal = ({
  currentTopics,
  onSave,
  onCancel,
  changeImpact,
  brandName,
  industry,
  currentVersion,
}: TopicEditModalProps) => {
  const [step, setStep] = useState<ModalStep>('selection');
  const [baseAvailableTopics] = useState(() => generateMockTopics(brandName, industry));
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(
    new Set(currentTopics.map(t => t.id))
  );
  const [customTopics, setCustomTopics] = useState<Topic[]>(
    currentTopics.filter(t => t.source === 'custom')
  );
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<TopicCategory | 'general' | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTopicName, setCustomTopicName] = useState('');
  const [showInfoTip, setShowInfoTip] = useState(true);

  // Transform all topics to include section property
  const allTopics = useMemo<TransformedTopic[]>(() => {
    const topics: TransformedTopic[] = [];

    // Add trending topics
    baseAvailableTopics.trending.forEach(topic => {
      topics.push({
        ...topic,
        section: 'trending' as const,
        category: 'general' as TopicCategory,
      });
    });

    // Add recommended (AI-generated) topics
    Object.entries(baseAvailableTopics.aiGenerated).forEach(([category, categoryTopics]) => {
      categoryTopics.forEach(topic => {
        topics.push({
          ...topic,
          section: 'recommended' as const,
          category: category as TopicCategory,
        });
      });
    });

    // Add general (preset) topics
    baseAvailableTopics.preset.forEach(topic => {
      topics.push({
        ...topic,
        section: 'general' as const,
        category: 'general' as TopicCategory,
      });
    });

    // Add custom topics
    customTopics.forEach(topic => {
      topics.push({
        ...topic,
        section: 'general' as const,
        category: 'general' as TopicCategory,
      });
    });

    // Merge current topics that might not be in available topics
    currentTopics.forEach(topic => {
      if (!topics.find(t => t.id === topic.id)) {
        let section: 'trending' | 'recommended' | 'general' = 'general';
        if (topic.source === 'trending') section = 'trending';
        else if (topic.source === 'ai_generated') section = 'recommended';
        
        topics.push({
          ...topic,
          section,
          category: topic.category || 'general',
        });
      }
    });

    return topics;
  }, [baseAvailableTopics, customTopics, currentTopics]);

  // Filter topics based on section, category, and search
  const filteredTopics = useMemo(() => {
    return allTopics.filter(topic => {
      // Section filter
      if (sectionFilter !== 'all' && topic.section !== sectionFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== null) {
        if (categoryFilter === 'general' && topic.category !== 'general') {
          return false;
        }
        if (categoryFilter !== 'general' && topic.category !== categoryFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allTopics, sectionFilter, categoryFilter]);

  // Group filtered topics by section
  const topicsBySection = useMemo(() => {
    const grouped: Record<string, TransformedTopic[]> = {
      trending: [],
      recommended: [],
      general: [],
    };

    filteredTopics.forEach(topic => {
      grouped[topic.section].push(topic);
    });

    return grouped;
  }, [filteredTopics]);

  const proposedTopics = useMemo(() => {
    return allTopics.filter(t => selectedTopicIds.has(t.id));
  }, [allTopics, selectedTopicIds]);

  const handleToggleTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopicIds);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      if (newSelected.size < MAX_TOPICS) {
        newSelected.add(topicId);
      }
    }
    setSelectedTopicIds(newSelected);
  };

  const handleRemoveTopic = (topicId: string) => {
    const newSelected = new Set(selectedTopicIds);
    newSelected.delete(topicId);
    setSelectedTopicIds(newSelected);
  };

  const handleAddCustomTopic = (topicName: string) => {
    const customTopic: Topic = {
      id: `custom-${Date.now()}`,
      name: topicName,
      source: 'custom',
      relevance: 70,
      category: 'general',
    };
    setCustomTopics([...customTopics, customTopic]);
    const newSelected = new Set(selectedTopicIds);
    if (newSelected.size < MAX_TOPICS) {
      newSelected.add(customTopic.id);
      setSelectedTopicIds(newSelected);
    }
    setCustomTopicName('');
    setShowCustomInput(false);
  };

  const handleCategoryClick = (category: TopicCategory | 'general') => {
    if (categoryFilter === category) {
      setCategoryFilter(null);
    } else {
      setCategoryFilter(category);
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
      newPromptCount: added.length * 8,
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

  // Progress bar color based on selection count
  const getProgressColor = () => {
    const count = selectedTopicIds.size;
    if (count <= 5) return '#10B981'; // Green
    if (count <= 8) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  };

  const getCategoryDisplayName = (category: string) => {
    return category.toLowerCase();
  };

  if (step === 'review') {
    const estimatedAnalysisTime = Math.ceil(proposedTopics.length * 2);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-8">
        <div className="bg-white rounded-lg max-w-7xl w-full max-h-[calc(100vh-4rem)] flex flex-col" style={{ boxShadow: 'var(--shadow-xl)' }}>
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
            <h2 className="text-xl font-semibold text-[#1A1D29]" style={{ fontFamily: 'Sora, sans-serif' }}>
              Review Changes
            </h2>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={20} className="text-[var(--text-body)]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-[#1A1D29] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
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
                          <p className="text-sm font-semibold text-[#1A1D29] mb-3" style={{ fontFamily: 'Sora, sans-serif' }}>
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
                          <p className="text-sm font-semibold text-[#1A1D29] mb-3" style={{ fontFamily: 'Sora, sans-serif' }}>
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

              <div>
                <h3 className="text-base font-semibold text-[#1A1D29] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                  Impact on Your Analysis
                </h3>

                <div className="space-y-3 p-4 bg-[var(--accent-light)] border border-[var(--accent-primary)]/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                      <BarChart3 size={16} className="text-[var(--accent-primary)]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1A1D29]">
                        {reviewChangeImpact?.newPromptCount || 0} new search queries will be generated
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-[var(--accent-primary)]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1A1D29]">
                        Next analysis will take approximately {estimatedAnalysisTime} minutes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                      <TrendingUpIcon size={16} className="text-[var(--accent-primary)]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1A1D29]">
                        Visibility score will recalculate based on new topics. Current configuration version will move from {currentVersion ?? 'current'} - you will see this indicated in visibility score data.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--success500)]/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2Icon size={16} className="text-[var(--success500)]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--success500)]">
                        Past analyses are not affected (data preserved)
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-body)] leading-relaxed mt-3" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    Once confirmed, these changes affect all future analyses. You can always revert to a previous configuration anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-6 border-t border-[var(--border-default)]">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium text-[#1A1D29]"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-[#00BCDC] text-white rounded-lg hover:bg-[#00A8C5] transition-colors text-sm font-medium"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              Confirm Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-8">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[calc(100vh-4rem)] flex flex-col relative" style={{ boxShadow: 'var(--shadow-xl)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 className="text-xl font-semibold text-[#1A1D29]" style={{ fontFamily: 'Sora, sans-serif' }}>
            Edit Topics
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={20} className="text-[var(--text-body)]" />
          </button>
        </div>

        {/* Currently Tracking and Progress - Moved to Top */}
        <div className="border-b border-[var(--border-default)]">
          {/* Progress Bar */}
          <div className="px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#616161]" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {selectedTopicIds.size} / {MAX_TOPICS} topics selected
              </span>
              <span className="text-sm font-medium" style={{ color: getProgressColor(), fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {selectedTopicIds.size >= MAX_TOPICS ? 'Maximum reached' : `${MAX_TOPICS - selectedTopicIds.size} remaining`}
              </span>
            </div>
            <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${(selectedTopicIds.size / MAX_TOPICS) * 100}%`,
                  backgroundColor: getProgressColor(),
                }}
              />
            </div>
          </div>

          {/* Currently Tracking */}
          {proposedTopics.length > 0 && (
            <div className="px-6 py-4 bg-[#F9F9F9] border-t border-[var(--border-default)]">
              <h3 className="text-sm font-semibold text-[#1A1D29] mb-3" style={{ fontFamily: 'Sora, sans-serif' }}>
                Currently Tracking
              </h3>
              <div className="flex flex-wrap gap-2">
                {proposedTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleRemoveTopic(topic.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors group border"
                    style={{ 
                      fontFamily: 'IBM Plex Sans, sans-serif',
                      backgroundColor: '#E0F7FA', // Teal 100
                      borderColor: '#00BCDC', // Brand teal
                      color: '#1A1D29' // Neutral 900
                    }}
                  >
                    {topic.name}
                    <X size={14} className="text-[#EF4444] opacity-70 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab Bar - Fixed */}
        <div className="flex items-center bg-white border-b border-[var(--border-default)] sticky top-0 z-10">
          <div className="flex items-center gap-0 px-6">
            {(['all', 'trending', 'recommended', 'general'] as SectionFilter[]).map((section) => {
              const isActive = sectionFilter === section;
              return (
                <button
                  key={section}
                  onClick={() => setSectionFilter(section)}
                  className={`
                    px-4 py-3
                    text-sm font-medium
                    border-b-2
                    transition-all duration-200
                    whitespace-nowrap
                    ${
                      isActive
                        ? 'text-[#00BCDC] border-[#00BCDC]'
                        : 'text-[#6c7289] border-transparent hover:text-[#212534]'
                    }
                  `}
                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                >
                  {section === 'all' ? 'All Topics' : section.charAt(0).toUpperCase() + section.slice(1)}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          {/* Add Topic Button */}
          <div className="px-6">
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#00BCDC] border border-[#00BCDC] rounded-lg hover:bg-[#00BCDC]/10 transition-colors"
                style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
              >
                <Plus size={16} />
                Add Topic
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter custom topic..."
                  value={customTopicName}
                  onChange={(e) => setCustomTopicName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customTopicName.trim()) {
                      e.preventDefault();
                      handleAddCustomTopic(customTopicName.trim());
                    } else if (e.key === 'Escape') {
                      setCustomTopicName('');
                      setShowCustomInput(false);
                    }
                  }}
                  className="px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00BCDC] focus:border-transparent"
                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                  autoFocus
                />
                <button
                  onClick={() => customTopicName.trim() && handleAddCustomTopic(customTopicName.trim())}
                  disabled={!customTopicName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#00BCDC] rounded-lg hover:bg-[#00A8C5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setCustomTopicName('');
                    setShowCustomInput(false);
                  }}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                >
                  <X size={16} className="text-[var(--text-body)]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Topic Selection */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTopics.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#616161]" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                No topics match your filters. Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Trending Section */}
              {topicsBySection.trending.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-[#1A1D29] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                    Trending ({topicsBySection.trending.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {topicsBySection.trending.map((topic) => {
                      const isSelected = selectedTopicIds.has(topic.id);
                      const isDisabled = !isSelected && selectedTopicIds.size >= MAX_TOPICS;
                      const category = topic.category || 'general';
                      const colors = categoryColors[category] || categoryColors.general;

                      return (
                        <button
                          key={topic.id}
                          onClick={() => !isDisabled && handleToggleTopic(topic.id)}
                          disabled={isDisabled}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            isSelected
                              ? 'bg-[#00BCDC]/10 border-[#00BCDC] ring-2 ring-[#00BCDC]/20'
                              : 'bg-white border-[var(--border-default)] hover:border-[#00BCDC]/50 hover:shadow-sm'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#00BCDC] border-[#00BCDC]'
                              : 'border-[var(--border-default)]'
                          }`}>
                            {isSelected && <IconCheck size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1D29] truncate" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                              {topic.name}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryClick(category);
                            }}
                            className="flex-shrink-0 px-2 py-1 rounded-full text-[10.2px] font-medium transition-colors hover:opacity-80 border text-[var(--text-body)]"
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              fontFamily: 'IBM Plex Sans, sans-serif',
                            }}
                          >
                            {getCategoryDisplayName(category)}
                          </button>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommended Section */}
              {topicsBySection.recommended.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-[#1A1D29] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                    Recommended ({topicsBySection.recommended.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {topicsBySection.recommended.map((topic) => {
                      const isSelected = selectedTopicIds.has(topic.id);
                      const isDisabled = !isSelected && selectedTopicIds.size >= MAX_TOPICS;
                      const category = topic.category || 'general';
                      const colors = categoryColors[category] || categoryColors.general;

                      return (
                        <button
                          key={topic.id}
                          onClick={() => !isDisabled && handleToggleTopic(topic.id)}
                          disabled={isDisabled}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            isSelected
                              ? 'bg-[#00BCDC]/10 border-[#00BCDC] ring-2 ring-[#00BCDC]/20'
                              : 'bg-white border-[var(--border-default)] hover:border-[#00BCDC]/50 hover:shadow-sm'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#00BCDC] border-[#00BCDC]'
                              : 'border-[var(--border-default)]'
                          }`}>
                            {isSelected && <IconCheck size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1D29] truncate" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                              {topic.name}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryClick(category);
                            }}
                            className="flex-shrink-0 px-2 py-1 rounded-full text-[10.2px] font-medium transition-colors hover:opacity-80 border text-[var(--text-body)]"
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              fontFamily: 'IBM Plex Sans, sans-serif',
                            }}
                          >
                            {getCategoryDisplayName(category)}
                          </button>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* General Section */}
              {topicsBySection.general.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-[#1A1D29] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
                    General ({topicsBySection.general.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {topicsBySection.general.map((topic) => {
                      const isSelected = selectedTopicIds.has(topic.id);
                      const isDisabled = !isSelected && selectedTopicIds.size >= MAX_TOPICS;
                      const category = topic.category || 'general';
                      const colors = categoryColors[category] || categoryColors.general;

                      return (
                        <button
                          key={topic.id}
                          onClick={() => !isDisabled && handleToggleTopic(topic.id)}
                          disabled={isDisabled}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            isSelected
                              ? 'bg-[#00BCDC]/10 border-[#00BCDC] ring-2 ring-[#00BCDC]/20'
                              : 'bg-white border-[var(--border-default)] hover:border-[#00BCDC]/50 hover:shadow-sm'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#00BCDC] border-[#00BCDC]'
                              : 'border-[var(--border-default)]'
                          }`}>
                            {isSelected && <IconCheck size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1D29] truncate" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                              {topic.name}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryClick(category);
                            }}
                            className="flex-shrink-0 px-2 py-1 rounded-full text-[10.2px] font-medium transition-colors hover:opacity-80 border text-[var(--text-body)]"
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              fontFamily: 'IBM Plex Sans, sans-serif',
                            }}
                          >
                            {getCategoryDisplayName(category)}
                          </button>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[var(--border-default)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium text-[#1A1D29]"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={handleReviewChanges}
            disabled={!hasChanges || !isValid}
            className="px-6 py-2 bg-[#00BCDC] text-white rounded-lg hover:bg-[#00A8C5] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          >
            Review Changes
          </button>
        </div>

        {/* Floating Info Tip */}
        {showInfoTip && (
          <div className="absolute bottom-6 right-6 bg-[#1A1D29] text-white p-4 rounded-lg shadow-xl max-w-xs">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h4 className="font-semibold text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>
                  How to Use Filters
                </h4>
              </div>
              <button
                onClick={() => setShowInfoTip(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-white/90 leading-relaxed" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Use section buttons to filter by Trending, Recommended, or General topics. Click category pills on topics to filter by search intent (Awareness, Comparison, Purchase, Support).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
