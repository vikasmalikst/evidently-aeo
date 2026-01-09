import { IconInfoCircle, IconPlus, IconChevronDown, IconChevronUp, IconX, IconCheck } from '@tabler/icons-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Topic } from '../../types/topic';
import type { OnboardingCompetitor } from '../../types/onboarding';
import { fetchPromptsForTopics } from '../../api/onboardingApi';
import { Spinner } from './common/Spinner';

export interface PromptWithTopic {
  prompt: string;
  topic: string; // Topic name
}

interface PromptConfigurationProps {
  selectedTopics: Topic[];
  selectedPrompts: PromptWithTopic[];
  onPromptsChange: (prompts: PromptWithTopic[]) => void;
}

function isCustomPrompt(prompt: string, customPrompts: Record<string, string[]>): boolean {
  return Object.values(customPrompts).some(prompts => prompts.includes(prompt));
}

export const PromptConfiguration = ({ selectedTopics, selectedPrompts, onPromptsChange }: PromptConfigurationProps) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTopicForCustom, setSelectedTopicForCustom] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set([selectedTopics[0]?.id]));
  const [customPromptsByTopic, setCustomPromptsByTopic] = useState<Record<string, string[]>>({});
  const [promptsByTopic, setPromptsByTopic] = useState<Record<string, string[]>>({});
  const [loadingTopics, setLoadingTopics] = useState<Set<string>>(new Set());
  const topicRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Inline custom prompt state
  const [inlineInputTopicId, setInlineInputTopicId] = useState<string | null>(null);
  const [inlineInputText, setInlineInputText] = useState('');

  const prefetchTopicPrompts = useCallback(async (topicIds: string[]) => {
    const topicsToFetch = topicIds.filter(
      (topicId) => !promptsByTopic[topicId] && !loadingTopics.has(topicId)
    );

    if (topicsToFetch.length === 0) {
      return;
    }

    setLoadingTopics((prev) => {
      const next = new Set(prev);
      topicsToFetch.forEach((id) => next.add(id));
      return next;
    });

    try {
      const brandData = localStorage.getItem('onboarding_brand');
      const competitorsData = localStorage.getItem('onboarding_competitors');
      const brand = brandData ? JSON.parse(brandData) : {};
      const competitors: Array<Partial<OnboardingCompetitor> & { companyName?: string }> = competitorsData
        ? JSON.parse(competitorsData)
        : [];

      const topicsPayload = selectedTopics.filter((topic) => topicsToFetch.includes(topic.id));
      if (topicsPayload.length === 0) {
        return;
      }

      console.log(
        '🔁 Prefetching prompts for topics:',
        topicsPayload.map((topic) => topic.name)
      );

      const response = await fetchPromptsForTopics({
        brand_name: brand.companyName || brand.name || 'Brand',
        industry: brand.industry || 'General',
        competitors: competitors.map((c) => c.name || c.companyName || ''),
        topics: topicsPayload.map((topic) => topic.name),
        locale: 'en-US',
        country: 'US',
        brand_id: undefined,
        website_url: brand.website || brand.domain || undefined
      });

      setPromptsByTopic((prev) => {
        const updated = { ...prev };
        topicsPayload.forEach((topic) => {
          updated[topic.id] = updated[topic.id] || [];
        });

        if (response.success && response.data) {
          response.data.forEach(({ topic, prompts }) => {
            const topicMatch = topicsPayload.find((t) => t.name === topic);
            if (topicMatch) {
              updated[topicMatch.id] = prompts || [];
            }
          });
          console.log(
            `✅ Prefetched prompts for ${response.data.length} topics`
          );
        } else {
          console.warn(
            '⚠️ No prompts returned for topics:',
            topicsPayload.map((topic) => topic.name)
          );
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to fetch prompts in batch:', error);
      setPromptsByTopic((prev) => {
        const updated = { ...prev };
        topicsToFetch.forEach((topicId) => {
          updated[topicId] = updated[topicId] || [];
        });
        return updated;
      });
    } finally {
      setLoadingTopics((prev) => {
        const next = new Set(prev);
        topicsToFetch.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [loadingTopics, promptsByTopic, selectedTopics]);

  useEffect(() => {
    if (selectedTopics.length === 0) {
      return;
    }
    prefetchTopicPrompts(selectedTopics.map((topic) => topic.id));
  }, [prefetchTopicPrompts, selectedTopics]);

  const toggleTopic = async (topicId: string) => {
    const isCurrentlyExpanded = expandedTopics.has(topicId);
    
    // Expand/collapse
    const newExpanded = new Set(expandedTopics);
    if (isCurrentlyExpanded) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
      
      // Ensure prompts exist if not already prefetched
      if (!promptsByTopic[topicId]) {
        await prefetchTopicPrompts([topicId]);
      }
    }
    setExpandedTopics(newExpanded);
  };

  const scrollToTopic = (topicId: string) => {
    const element = topicRefs.current[topicId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!expandedTopics.has(topicId)) {
        toggleTopic(topicId);
      }
    }
  };

  const handleTogglePrompt = (prompt: string, topicName: string) => {
    const promptWithTopic: PromptWithTopic = { prompt, topic: topicName };
    const isSelected = selectedPrompts.some(p => p.prompt === prompt && p.topic === topicName);
    
    if (isSelected) {
      onPromptsChange(selectedPrompts.filter(p => !(p.prompt === prompt && p.topic === topicName)));
    } else {
      onPromptsChange([...selectedPrompts, promptWithTopic]);
    }
  };

  const handleAddCustomPrompt = () => {
    const promptText = customPrompt.trim();
    const selectedTopic = selectedTopics.find(t => t.id === selectedTopicForCustom);
    
    if (promptText && selectedTopicForCustom && selectedTopic && 
        !selectedPrompts.some(p => p.prompt === promptText && p.topic === selectedTopic.name)) {
      const updatedCustomPrompts = {
        ...customPromptsByTopic,
        [selectedTopicForCustom]: [...(customPromptsByTopic[selectedTopicForCustom] || []), promptText]
      };
      setCustomPromptsByTopic(updatedCustomPrompts);
      onPromptsChange([...selectedPrompts, { prompt: promptText, topic: selectedTopic.name }]);
      setCustomPrompt('');
      setSelectedTopicForCustom('');
      setShowCustomModal(false);
    }
  };

  const handleOpenCustomModal = () => {
    setShowCustomModal(true);
    setSelectedTopicForCustom(selectedTopics[0]?.id || '');
  };

  const handleCloseCustomModal = () => {
    setShowCustomModal(false);
    setCustomPrompt('');
    setSelectedTopicForCustom('');
  };

  const handleStartInlineAdd = (topicId: string) => {
    if (!expandedTopics.has(topicId)) {
      toggleTopic(topicId);
    }
    setInlineInputTopicId(topicId);
    setInlineInputText('');
  };

  const handleSaveInlineAdd = () => {
    if (!inlineInputTopicId || !inlineInputText.trim()) return;

    const topic = selectedTopics.find(t => t.id === inlineInputTopicId);
    if (!topic) return;

    const promptText = inlineInputText.trim();
    
    // Add to custom prompts if not exists
    if (!selectedPrompts.some(p => p.prompt === promptText && p.topic === topic.name)) {
      setCustomPromptsByTopic(prev => ({
        ...prev,
        [inlineInputTopicId]: [...(prev[inlineInputTopicId] || []), promptText]
      }));
      onPromptsChange([...selectedPrompts, { prompt: promptText, topic: topic.name }]);
    }

    setInlineInputTopicId(null);
    setInlineInputText('');
  };

  const handleCancelInlineAdd = () => {
    setInlineInputTopicId(null);
    setInlineInputText('');
  };

  const getSelectedCountForTopic = (topic: Topic): number => {
    return selectedPrompts.filter(p => p.topic === topic.name).length;
  };

  return (
    <div className="prompt-configuration">
      <div className="prompt-instruction">
        <IconInfoCircle size={20} className="instruction-icon" />
        <p>
          Select search queries for each topic to track your brand's visibility across AI platforms.
          Choose prompts that are relevant to your selected topics.
        </p>
      </div>

      <div className="prompt-header-row">
        <div className="prompt-topic-pills">
          {selectedTopics.map((topic) => {
            const selectedCount = getSelectedCountForTopic(topic);
            return (
              <button
                key={topic.id}
                className="prompt-topic-pill"
                onClick={() => scrollToTopic(topic.id)}
              >
                {topic.name}
                {selectedCount > 0 && (
                  <span className="prompt-pill-badge">{selectedCount}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="prompt-header-right">
          <div className="prompt-header-right-content">
            <button
              className="onboarding-button-primary"
              onClick={handleOpenCustomModal}
            >
              <IconPlus size={18} />
              Add Custom Prompt
            </button>
            <div className="prompt-counter">
              <strong>{selectedPrompts.length}</strong> prompts selected
            </div>
          </div>
        </div>
      </div>

      {showCustomModal && (
        <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-900">Add Custom Prompt</div>
            <button
              type="button"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900"
              onClick={handleCloseCustomModal}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                value={selectedTopicForCustom}
                onChange={(e) => setSelectedTopicForCustom(e.target.value)}
              >
                {selectedTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                placeholder="Enter your custom search query..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomPrompt();
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              className="px-4 py-2 border border-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-white transition-all"
              onClick={handleCloseCustomModal}
              type="button"
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
              onClick={handleAddCustomPrompt}
              disabled={!customPrompt.trim() || !selectedTopicForCustom}
              type="button"
            >
              Add Prompt
            </button>
          </div>
        </div>
      )}

      <div className="prompt-topics-accordion">
        {selectedTopics.map((topic) => {
          const isExpanded = expandedTopics.has(topic.id);
          const apiPrompts = promptsByTopic[topic.id] || [];
          const customPrompts = customPromptsByTopic[topic.id] || [];
          const topicPrompts = [...apiPrompts, ...customPrompts];
          const isLoading = loadingTopics.has(topic.id);
          const selectedCount = getSelectedCountForTopic(topic);

          return (
            <div
              key={topic.id}
              className="prompt-topic-section"
              ref={(el) => (topicRefs.current[topic.id] = el)}
            >
              <button
                className="prompt-topic-header"
                onClick={() => toggleTopic(topic.id)}
                aria-expanded={isExpanded}
                disabled={isLoading}
              >
                <div className="prompt-topic-header-left">
                  <span className="prompt-topic-name">{topic.name}</span>
                  {selectedCount > 0 && !isLoading && (
                    <span className="prompt-topic-badge">{selectedCount} selected</span>
                  )}
                  {isLoading && (
                    <span className="prompt-topic-loading-badge" style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      color: '#00bcdc',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      <span className="onboarding-spinner onboarding-spinner--small" style={{ 
                        width: '12px', 
                        height: '12px',
                        borderWidth: '2px'
                      }} />
                      Generating...
                    </span>
                  )}
                </div>
                <div className="prompt-topic-header-right">
                  <button
                    className="prompt-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartInlineAdd(topic.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      marginRight: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--accent500)',
                    }}
                    title="Add custom prompt for this topic"
                  >
                    <IconPlus size={18} />
                  </button>
                  {isLoading ? (
                    <span className="onboarding-spinner onboarding-spinner--small" style={{ 
                      width: '16px', 
                      height: '16px',
                      borderWidth: '2px'
                    }} />
                  ) : isExpanded ? (
                    <IconChevronUp size={20} />
                  ) : (
                    <IconChevronDown size={20} />
                  )}
                </div>
              </button>

              {isExpanded && isLoading && (
                <div className="prompt-topic-loading" style={{ 
                  padding: '32px 20px', 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <Spinner size="medium" message="Your prompts are being generated" />
                </div>
              )}
              
              {isExpanded && !isLoading && (
                <div className="prompt-topic-content">
                  {inlineInputTopicId === topic.id && (
                    <div className="prompt-custom-input-wrapper" style={{ marginBottom: '16px' }}>
                      <input
                        type="text"
                        className="prompt-custom-input"
                        placeholder="Enter custom prompt..."
                        value={inlineInputText}
                        onChange={(e) => setInlineInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveInlineAdd();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelInlineAdd();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveInlineAdd}
                        disabled={!inlineInputText.trim()}
                        className="prompt-add-button"
                        style={{ padding: '8px 12px' }}
                        title="Save prompt"
                      >
                        <IconCheck size={18} />
                      </button>
                      <button
                        onClick={handleCancelInlineAdd}
                        className="prompt-add-button"
                        style={{ 
                          padding: '8px 12px', 
                          background: 'var(--bg-secondary)', 
                          color: 'var(--text-body)', 
                          border: '1px solid var(--border-default)', 
                          boxShadow: 'none' 
                        }}
                        title="Cancel"
                      >
                        <IconX size={18} />
                      </button>
                    </div>
                  )}

                  {topicPrompts.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      No prompts available for this topic. Try adding a custom prompt.
                    </div>
                  ) : (
                    <div className="prompt-list">
                      {topicPrompts.map((prompt) => {
                        const isSelected = selectedPrompts.some(p => p.prompt === prompt && p.topic === topic.name);
                        const isCustom = isCustomPrompt(prompt, customPromptsByTopic);
                        return (
                          <label key={prompt} className="prompt-checkbox-item">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTogglePrompt(prompt, topic.name)}
                              className="prompt-checkbox"
                            />
                            <span className="prompt-label">
                              {prompt}
                              {isCustom && <span className="prompt-custom-badge">Custom</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
