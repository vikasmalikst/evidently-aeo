import React, { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { PromptEntry, PromptTopic } from '../../types/prompts';

interface PromptsListProps {
  topics: PromptTopic[];
  selectedPromptId: string | null;
  onPromptSelect: (prompt: PromptEntry) => void;
  loading: boolean;
  selectedLLMs: string[];
}

class PromptsListErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 py-6 text-sm text-[var(--text-caption)] border-b border-[var(--border-default)]">
          Something went wrong while rendering prompts.
        </div>
      );
    }

    return this.props.children;
  }
}

const INITIAL_PROMPTS_PER_TOPIC = 150;
const PROMPT_PAGE_SIZE = 150;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 320;

export const PromptsList = memo(({
  topics,
  selectedPromptId,
  onPromptSelect,
  loading,
  selectedLLMs
}: PromptsListProps) => {
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);
  const [visiblePromptCounts, setVisiblePromptCounts] = useState<Record<string, number>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (topics.length === 0) {
      setExpandedTopics([]);
      setVisiblePromptCounts({});
      return;
    }

    setExpandedTopics((current) => {
      const valid = current.filter((topicId) => topics.some((topic) => topic.id === topicId));
      if (valid.length > 0) {
        return valid;
      }
      return [topics[0].id];
    });
  }, [topics]);

  useEffect(() => {
    setVisiblePromptCounts((current) => {
      const next: Record<string, number> = {};
      for (const topic of topics) {
        if (!topic.prompts || topic.prompts.length === 0) continue;
        const existing = current[topic.id];
        if (typeof existing === 'number' && existing > 0) {
          next[topic.id] = Math.min(existing, topic.prompts.length);
          continue;
        }
        next[topic.id] = Math.min(INITIAL_PROMPTS_PER_TOPIC, topic.prompts.length);
      }
      return next;
    });
  }, [topics]);

  const toggleTopic = useCallback((topicId: string) => {
    setExpandedTopics((current) =>
      current.includes(topicId) ? current.filter((id) => id !== topicId) : [...current, topicId]
    );
    setVisiblePromptCounts((current) => {
      if (typeof current[topicId] === 'number') {
        return current;
      }
      const topic = topics.find((t) => t.id === topicId);
      if (!topic || topic.prompts.length === 0) {
        return current;
      }
      return {
        ...current,
        [topicId]: Math.min(INITIAL_PROMPTS_PER_TOPIC, topic.prompts.length)
      };
    });
  }, [topics]);

  const handlePromptClick = useCallback((prompt: PromptEntry) => {
    onPromptSelect(prompt);
  }, [onPromptSelect]);

  const topicsWithPrompts = useMemo(
    () => topics.filter((topic) => topic.prompts.length > 0),
    [topics]
  );
  const hasPrompts = topicsWithPrompts.length > 0;

  const selectedLLMSet = useMemo(() => new Set(selectedLLMs), [selectedLLMs]);

  const handleLoadMoreForTopic = useCallback((topicId: string, max: number) => {
    setVisiblePromptCounts((current) => {
      const existing = current[topicId] ?? 0;
      const next = Math.min(existing + PROMPT_PAGE_SIZE, max);
      if (next === existing) {
        return current;
      }
      return { ...current, [topicId]: next };
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) {
      return;
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      if (container.scrollTop + container.clientHeight < container.scrollHeight - LOAD_MORE_SCROLL_THRESHOLD_PX) {
        return;
      }

      const expanded = new Set(expandedTopics);
      if (expanded.size === 0) return;

      setVisiblePromptCounts((current) => {
        let changed = false;
        const next: Record<string, number> = { ...current };
        for (const topic of topicsWithPrompts) {
          if (!expanded.has(topic.id)) continue;
          const existing = current[topic.id] ?? 0;
          const proposed = Math.min(existing + PROMPT_PAGE_SIZE, topic.prompts.length);
          if (proposed !== existing) {
            next[topic.id] = proposed;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
  }, [expandedTopics, topicsWithPrompts]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-[var(--border-default)] relative">
        <h3 className="text-sm font-semibold text-[var(--text-headings)]">
          Prompts
        </h3>
        {loading && hasPrompts && (
          <Loader2 
            size={18} 
            className="absolute top-3 right-[calc(0.5rem+64px)] animate-spin text-[#00bcdc]" 
            aria-label="Loading metrics"
            style={{ filter: 'brightness(1.2)' }}
          />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-4 py-2">Prompt</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-2 py-2 w-28">Visibility Score</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-2 py-2 w-32">Sentiment</th>
            </tr>
          </thead>
        </table>
      </div>

      <div
        ref={scrollContainerRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 450px)' }}
        onScroll={handleScroll}
      >
        {loading && !hasPrompts && (
          <div className="px-4 py-6 text-sm text-[var(--text-caption)] border-b border-[var(--border-default)]">
            Loading prompts…
          </div>
        )}

        {!loading && !hasPrompts && (
          <div className="px-4 py-6 text-sm text-[var(--text-caption)] border-b border-[var(--border-default)]">
            No prompts available for the selected filters.
          </div>
        )}

        <PromptsListErrorBoundary>
          <table className="w-full">
            <tbody>
              {topicsWithPrompts.map((topic) => {
                const isExpanded = expandedTopics.includes(topic.id);
                const visibleCount = Math.min(visiblePromptCounts[topic.id] ?? INITIAL_PROMPTS_PER_TOPIC, topic.prompts.length);
                const promptsToRender = isExpanded ? topic.prompts.slice(0, visibleCount) : [];
                const canLoadMore = isExpanded && visibleCount < topic.prompts.length;

                return (
                  <Fragment key={topic.id}>
                    <tr className="border-b border-[var(--border-default)] bg-blue-50">
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleTopic(topic.id)}
                          className="w-full flex items-center gap-2 hover:bg-blue-100 transition-colors text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-[var(--text-caption)]" />
                          ) : (
                            <ChevronRight size={16} className="text-[var(--text-caption)]" />
                          )}
                          <span className="text-sm font-semibold text-[var(--text-headings)]">
                            {topic.name}
                          </span>
                          <span className="text-xs text-[var(--text-caption)]">
                            ({topic.promptCount})
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-2 w-24 text-center">
                        <span className="text-sm font-semibold font-data text-[var(--text-body)]">
                          {topic.visibilityScore !== null ? `${topic.visibilityScore.toFixed(1)}` : '—'}
                        </span>
                      </td>
                      <td className="px-2 py-2 w-32 text-center">
                        <span className="text-sm font-medium text-[var(--text-caption)]">
                          {topic.sentimentScore !== null ? `${Math.round(topic.sentimentScore)}` : '—'}
                        </span>
                      </td>
                    </tr>

                    {promptsToRender.map((prompt) => {
                      const isSelected = selectedPromptId === prompt.id;
                      const collectorsToShow =
                        selectedLLMSet.size > 0
                          ? prompt.collectorTypes.filter((collector) => selectedLLMSet.has(collector))
                          : prompt.collectorTypes;

                      return (
                        <tr
                          key={prompt.id}
                          onClick={() => handlePromptClick(prompt)}
                          className={`cursor-pointer border-b border-[var(--border-default)] transition-all ${
                            isSelected
                              ? 'bg-[var(--accent-light)]'
                              : 'hover:bg-[var(--bg-secondary)]'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm text-[var(--text-body)] font-data leading-snug">
                              {prompt.question}
                            </p>
                            {collectorsToShow.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {collectorsToShow.map((collector) => (
                                  <span
                                    key={collector}
                                    className="inline-flex items-center px-2 py-[2px] rounded-full bg-[var(--bg-secondary)] text-[10px] font-semibold text-[var(--text-caption)]"
                                  >
                                    {collector}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3 w-24 text-center">
                            <span className="text-sm font-semibold font-data text-[var(--text-body)]">
                              {prompt.visibilityScore !== null ? `${prompt.visibilityScore.toFixed(1)}` : '—'}
                            </span>
                          </td>
                          <td className="px-2 py-3 w-32 text-center">
                            <span className="text-sm font-medium text-[var(--text-caption)]">
                              {prompt.sentimentScore !== null ? `${Math.round(prompt.sentimentScore)}` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {canLoadMore && (
                      <tr key={`${topic.id}:load-more`} className="border-b border-[var(--border-default)]">
                        <td colSpan={3} className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleLoadMoreForTopic(topic.id, topic.prompts.length)}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-[var(--border-default)] text-xs font-semibold text-[var(--text-caption)] hover:bg-[var(--bg-secondary)] transition-colors"
                          >
                            Load more
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </PromptsListErrorBoundary>
      </div>
    </div>
  );
});
