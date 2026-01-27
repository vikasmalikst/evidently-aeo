import React, { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { ManagedCompetitor } from '../../api/competitorManagementApi';
import { PromptEntry, PromptTopic } from '../../types/prompts';
import { SafeLogo } from '../Onboarding/common/SafeLogo';
import { getLLMIcon } from '../Visibility/LLMIcons';

interface PromptsListProps {
  topics: PromptTopic[];
  selectedPromptId: string | null;
  onPromptSelect: (prompt: PromptEntry) => void;
  loading: boolean;
  selectedLLMs: string[];
  competitors: ManagedCompetitor[];
  selectedCompetitors: Set<string>;
  metricType: 'visibility' | 'sentiment' | 'mentions' | 'position' | 'share';
  brandLogo?: string;
  brandName?: string;
  brandDomain?: string;
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
  selectedLLMs,
  competitors,
  selectedCompetitors,
  metricType,
  brandLogo,
  brandName,
  brandDomain
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

  const activeCompetitors = useMemo(() => {
    return competitors.filter(c => selectedCompetitors.has(c.name.toLowerCase()));
  }, [competitors, selectedCompetitors]);

  const getMetricLabel = (type: string) => {
    switch (type) {
      case 'visibility': return 'Visibility Score';
      case 'sentiment': return 'Sentiment';
      case 'mentions': return 'Mentions';
      case 'position': return 'Avg Position';
      case 'share': return 'Share of Answers';
      default: return type;
    }
  };

  const formatMetricValue = (value: number | null | undefined, type: string) => {
    if (value === null || value === undefined) return '—';
    switch (type) {
      case 'visibility': return value.toFixed(1);
      case 'sentiment':
      case 'mentions':
      case 'position': return Math.round(value).toString();
      case 'share': return `${value.toFixed(1)}%`;
      default: return value.toString();
    }
  };

  const getBrandValue = (item: PromptTopic | PromptEntry, type: string) => {
    switch (type) {
      case 'visibility': return item.visibilityScore;
      case 'sentiment': return item.sentimentScore;
      case 'mentions': return item.mentions;
      case 'position': return item.averagePosition;
      case 'share': return item.soaScore;
      default: return null;
    }
  };

  const getCompetitorValue = (item: PromptTopic | PromptEntry, compKey: string, type: string) => {
    switch (type) {
      case 'visibility': return item.competitorVisibilityMap?.[compKey];
      case 'sentiment': return item.competitorSentimentMap?.[compKey];
      case 'mentions': return item.competitorMentionsMap?.[compKey];
      case 'position': return item.competitorPositionMap?.[compKey];
      case 'share': return item.competitorSoaMap?.[compKey];
      default: return null;
    }
  };

  const metricLabel = getMetricLabel(metricType);

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center bg-white h-[45px]">
        {/* Fixed part matching Prompt column */}
        <div className="w-[300px] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--text-headings)]">
            Prompts
          </h3>
        </div>

        {/* Dynamic center part - centering the badge in the remaining space (data columns) */}
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] whitespace-nowrap flex items-center gap-2 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
              {metricLabel} across
            </span>
            <div className="flex -space-x-1">
              {(selectedLLMs.length > 0 ? selectedLLMs : topics[0]?.prompts[0]?.collectorTypes || []).map((llm, idx) => (
                <div
                  key={llm}
                  className="w-5 h-5 rounded-full bg-white border border-gray-100 flex items-center justify-center overflow-hidden shadow-sm"
                  style={{ zIndex: 10 - idx }}
                  title={llm}
                >
                  <div className="scale-[0.6]">
                    {getLLMIcon(llm)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Loader part */}
        <div className="w-8 flex justify-end">
          {loading && hasPrompts && (
            <Loader2
              size={18}
              className="animate-spin text-[#00bcdc]"
              aria-label="Loading metrics"
              style={{ filter: 'brightness(1.2)' }}
            />
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="overflow-auto scrollbar-thin scrollbar-thumb-gray-200"
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
          <table className="w-full table-fixed min-w-[600px] border-separate border-spacing-0">
            <thead className="sticky top-0 z-30 bg-[var(--bg-secondary)] shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
              <tr>
                <th className="sticky left-0 z-40 bg-[var(--bg-secondary)] text-left text-xs font-semibold text-[var(--text-caption)] px-4 py-2 w-[300px] shadow-[1px_0_0_0_#e4e7ec]">Prompt</th>
                <th className="sticky left-[300px] z-40 bg-[var(--bg-secondary)] text-center px-2 py-2 w-28 shadow-[1px_0_0_0_#e4e7ec]">
                  <div className="flex justify-center" title={brandName || 'Brand'}>
                    <SafeLogo
                      src={brandLogo}
                      domain={brandDomain}
                      alt={brandName || 'Brand'}
                      size={24}
                      className="w-6 h-6 rounded shadow-sm object-contain bg-white p-0.5 border border-gray-100"
                    />
                  </div>
                </th>
                {activeCompetitors.map(comp => (
                  <th key={comp.id} className="text-center px-2 py-2 w-28 border-l border-[var(--border-default)] bg-[var(--bg-secondary)]">
                    <div className="flex justify-center" title={comp.name}>
                      <SafeLogo
                        src={comp.logo}
                        domain={comp.url || comp.domain}
                        alt={comp.name}
                        size={24}
                        className="w-6 h-6 rounded shadow-sm object-contain bg-white p-0.5 border border-gray-100"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topicsWithPrompts.map((topic) => {
                const isExpanded = expandedTopics.includes(topic.id);
                const visibleCount = Math.min(visiblePromptCounts[topic.id] ?? INITIAL_PROMPTS_PER_TOPIC, topic.prompts.length);
                const promptsToRender = isExpanded ? topic.prompts.slice(0, visibleCount) : [];
                const canLoadMore = isExpanded && visibleCount < topic.prompts.length;

                return (
                  <Fragment key={topic.id}>
                    <tr className="border-b border-[var(--border-default)] bg-blue-50">
                      <td className="sticky left-0 z-20 bg-blue-50 px-4 py-2 w-[300px]">
                        <button
                          onClick={() => toggleTopic(topic.id)}
                          className="w-full flex items-center gap-2 hover:bg-blue-100 transition-colors text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-[var(--text-caption)]" />
                          ) : (
                            <ChevronRight size={16} className="text-[var(--text-caption)]" />
                          )}
                          <span className="text-sm font-semibold text-[var(--text-headings)] truncate">
                            {topic.name}
                          </span>
                          <span className="text-xs text-[var(--text-caption)]">
                            ({topic.promptCount})
                          </span>
                        </button>
                      </td>
                      <td className="sticky left-[300px] z-20 bg-blue-50 px-2 py-2 w-28 text-center shadow-[1px_0_0_0_#93c5fd]">
                        <span className="text-sm font-bold font-data text-[var(--text-body)]">
                          {formatMetricValue(getBrandValue(topic, metricType), metricType)}
                        </span>
                      </td>
                      {activeCompetitors.map(comp => {
                        const compKey = comp.name.toLowerCase().trim();
                        const score = getCompetitorValue(topic, compKey, metricType);
                        return (
                          <td key={comp.id} className="px-2 py-2 w-28 text-center border-l border-blue-100 bg-blue-50">
                            <span className="text-sm font-bold font-data text-[var(--text-body)]">
                              {formatMetricValue(score, metricType)}
                            </span>
                          </td>
                        );
                      })}
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
                          className={`cursor-pointer border-b border-[var(--border-default)] transition-all ${isSelected
                            ? 'bg-[var(--accent-light)]'
                            : 'hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                          <td className={`sticky left-0 z-20 px-4 py-3 w-[300px] ${isSelected ? 'bg-[#f0f9ff]' : 'bg-white group-hover:bg-[#f9fafb]'
                            }`}>
                            <p className="text-sm text-[var(--text-body)] font-data leading-snug">
                              {prompt.question}
                            </p>
                          </td>
                          <td className={`sticky left-[300px] z-20 px-2 py-3 w-28 text-center shadow-[1px_0_0_0_#e4e7ec] ${isSelected ? 'bg-[#f0f9ff]' : 'bg-white group-hover:bg-[#f9fafb]'}`}>
                            <span className="text-sm font-normal font-data text-[var(--text-body)]">
                              {formatMetricValue(getBrandValue(prompt, metricType), metricType)}
                            </span>
                          </td>
                          {activeCompetitors.map(comp => {
                            const compKey = comp.name.toLowerCase().trim();
                            const score = getCompetitorValue(prompt, compKey, metricType);
                            return (
                              <td key={comp.id} className={`px-2 py-3 w-28 text-center border-l border-[var(--border-default)] ${isSelected ? 'bg-[#f0f9ff]' : 'bg-white group-hover:bg-[#f9fafb]'}`}>
                                <span className="text-sm font-normal font-data text-[var(--text-body)]">
                                  {formatMetricValue(score, metricType)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {canLoadMore && (
                      <tr key={`${topic.id}:load-more`} className="border-b border-[var(--border-default)]">
                        <td colSpan={2 + activeCompetitors.length} className="px-4 py-3 text-center bg-white">
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
    </div >
  );
});
