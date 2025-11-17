import { IconInfoCircle, IconPlus, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState, useRef } from 'react';
import type { Topic } from '../../types/topic';
import { fetchPromptsForTopics } from '../../api/onboardingApi';

interface PromptConfigurationProps {
  selectedTopics: Topic[];
  selectedPrompts: string[];
  onPromptsChange: (prompts: string[]) => void;
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

  const toggleTopic = async (topicId: string) => {
    const isCurrentlyExpanded = expandedTopics.has(topicId);
    
    // Expand/collapse
    const newExpanded = new Set(expandedTopics);
    if (isCurrentlyExpanded) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
      
      // Load prompts if not already loaded
      if (!promptsByTopic[topicId] && !loadingTopics.has(topicId)) {
        const newLoading = new Set(loadingTopics);
        newLoading.add(topicId);
        setLoadingTopics(newLoading);
        await fetchPromptsForTopic(topicId);
        setLoadingTopics(prev => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      }
    }
    setExpandedTopics(newExpanded);
  };

  const fetchPromptsForTopic = async (topicId: string) => {
    try {
      const topic = selectedTopics.find(t => t.id === topicId);
      if (!topic) return;
      
      // Get fresh brand data from localStorage (should be current onboarding session)
      const brandData = localStorage.getItem('onboarding_brand');
      const competitorsData = localStorage.getItem('onboarding_competitors');
      const brand = brandData ? JSON.parse(brandData) : {};
      const competitors = competitorsData ? JSON.parse(competitorsData) : [];
      
      // Don't use brand_id during onboarding - brand hasn't been created yet
      // brand_id from localStorage may be stale from previous sessions
      
      console.log('🔍 Fetching prompts for topic:', topic.name, 'for brand:', brand.companyName || brand.name);
      
      const response = await fetchPromptsForTopics({
        brand_name: brand.companyName || brand.name || 'Brand',
        industry: brand.industry || 'General',
        competitors: competitors.map((c: any) => c.name || c.companyName || ''),
        topics: [topic.name],
        locale: 'en-US',
        country: 'US',
        // Don't pass brand_id during onboarding - it may be stale
        brand_id: undefined,
        website_url: brand.website || brand.domain || undefined
      });
      
      if (response.success && response.data && response.data[0]) {
        const prompts = response.data[0].prompts || [];
        setPromptsByTopic(prev => ({
          ...prev,
          [topicId]: prompts
        }));
        console.log(`✅ Loaded ${prompts.length} prompts for "${topic.name}"`);
      } else {
        // Fallback to empty array
        setPromptsByTopic(prev => ({ ...prev, [topicId]: [] }));
        console.warn('No prompts returned for topic:', topic.name);
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
      // Fallback to empty array
      setPromptsByTopic(prev => ({ ...prev, [topicId]: [] }));
    }
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

  const handleTogglePrompt = (prompt: string) => {
    if (selectedPrompts.includes(prompt)) {
      onPromptsChange(selectedPrompts.filter(p => p !== prompt));
    } else {
      onPromptsChange([...selectedPrompts, prompt]);
    }
  };

  const handleAddCustomPrompt = () => {
    if (customPrompt.trim() && selectedTopicForCustom && !selectedPrompts.includes(customPrompt.trim())) {
      const updatedCustomPrompts = {
        ...customPromptsByTopic,
        [selectedTopicForCustom]: [...(customPromptsByTopic[selectedTopicForCustom] || []), customPrompt.trim()]
      };
      setCustomPromptsByTopic(updatedCustomPrompts);
      onPromptsChange([...selectedPrompts, customPrompt.trim()]);
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

  const handleRemovePrompt = (prompt: string) => {
    onPromptsChange(selectedPrompts.filter(p => p !== prompt));
  };

  const getSelectedCountForTopic = (topic: Topic): number => {
    const apiPrompts = promptsByTopic[topic.id] || [];
    const customPrompts = customPromptsByTopic[topic.id] || [];
    const allPrompts = [...apiPrompts, ...customPrompts];
    return allPrompts.filter(p => selectedPrompts.includes(p)).length;
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
              >
                <div className="prompt-topic-header-left">
                  <span className="prompt-topic-name">{topic.name}</span>
                  {selectedCount > 0 && (
                    <span className="prompt-topic-badge">{selectedCount} selected</span>
                  )}
                </div>
                <div className="prompt-topic-header-right">
                  {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                </div>
              </button>

              {isExpanded && isLoading && (
                <div className="prompt-topic-loading" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading prompts...
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
                        const isSelected = selectedPrompts.includes(prompt);
                        const isCustom = isCustomPrompt(prompt, customPromptsByTopic);
                        return (
                          <label key={prompt} className="prompt-checkbox-item">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTogglePrompt(prompt)}
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
