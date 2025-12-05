import { IconInfoCircle, IconPlus, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Topic } from '../../types/topic';
import { fetchPromptsForTopics } from '../../api/onboardingApi';
import { Spinner } from './common/Spinner';

interface PromptWithTopic {
  prompt: string;
  topic: string; // Topic name
}

export interface PromptWithTopic {
  prompt: string;
  topic: string; // Topic name
}

interface PromptConfigurationProps {
  selectedTopics: Topic[];
  selectedPrompts: PromptWithTopic[];
  onPromptsChange: (prompts: PromptWithTopic[]) => void;
}

interface TopicPrompt {
  topicId: string;
  prompt: string;
}

function isCustomPrompt(prompt: string, customPrompts: Record<string, string[]>): boolean {
  return Object.values(customPrompts).some(prompts => prompts.includes(prompt));
}

interface CustomPromptData {
  text: string;
  topicId: string;
  isCustom: boolean;
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
  const modalButtonRef = useRef<HTMLButtonElement>(null);

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
      const competitors = competitorsData ? JSON.parse(competitorsData) : [];

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
        competitors: competitors.map((c: any) => c.name || c.companyName || ''),
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

  const handleRemovePrompt = (prompt: string, topicName: string) => {
    onPromptsChange(selectedPrompts.filter(p => !(p.prompt === prompt && p.topic === topicName)));
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
              ref={modalButtonRef}
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

      {showCustomModal && (
        <div className="prompt-custom-modal-overlay" onClick={handleCloseCustomModal}>
          <div
            className="prompt-custom-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: modalButtonRef.current ? `${window.innerHeight - modalButtonRef.current.getBoundingClientRect().top + 8}px` : '50%',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="prompt-custom-modal-header">
              <h3>Add Custom Prompt</h3>
            </div>
            <div className="prompt-custom-modal-body">
              <div className="prompt-custom-form-group">
                <label className="prompt-custom-label">Select Topic</label>
                <select
                  className="prompt-custom-select"
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
              <div className="prompt-custom-form-group">
                <label className="prompt-custom-label">Custom Prompt</label>
                <input
                  type="text"
                  className="prompt-custom-modal-input"
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
            <div className="prompt-custom-modal-footer">
              <button
                className="prompt-custom-cancel-button"
                onClick={handleCloseCustomModal}
              >
                Cancel
              </button>
              <button
                className="prompt-custom-submit-button"
                onClick={handleAddCustomPrompt}
                disabled={!customPrompt.trim() || !selectedTopicForCustom}
              >
                Add Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
