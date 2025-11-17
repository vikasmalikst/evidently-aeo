import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import { PromptEntry, PromptTopic } from '../../types/prompts';

interface DateRangeOption {
  value: string;
  label: string;
}

interface PromptsListProps {
  topics: PromptTopic[];
  selectedPromptId: string | null;
  onPromptSelect: (prompt: PromptEntry) => void;
  dateRangeKey: string;
  dateRangeOptions: DateRangeOption[];
  onDateRangeChange: (range: string) => void;
  loading: boolean;
}

export const PromptsList = ({
  topics,
  selectedPromptId,
  onPromptSelect,
  dateRangeKey,
  dateRangeOptions,
  onDateRangeChange,
  loading
}: PromptsListProps) => {
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);

  useEffect(() => {
    if (topics.length === 0) {
      setExpandedTopics([]);
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

  const volumeFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }),
    []
  );

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((current) =>
      current.includes(topicId) ? current.filter((id) => id !== topicId) : [...current, topicId]
    );
  };

  const handlePromptClick = (prompt: PromptEntry) => {
    onPromptSelect(prompt);
  };

  const hasPrompts = topics.some((topic) => topic.prompts.length > 0);

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-headings)]">
          Prompts
        </h3>
        <div className="relative">
          <CalendarDays size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-caption)] pointer-events-none" />
          <select
            value={dateRangeKey}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="text-xs border border-[var(--border-default)] rounded pl-7 pr-2 py-1 text-[var(--text-body)] bg-white font-data appearance-none"
          >
            {dateRangeOptions.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-4 py-2">Prompt</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-2 py-2 w-20">Volume</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-2 py-2 w-32">Sentiment</th>
              <th className="text-center text-xs font-semibold text-[var(--text-caption)] px-4 py-2 w-32">Topic</th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 450px)' }}>
        {loading && (
          <div className="px-4 py-6 text-sm text-[var(--text-caption)] border-b border-[var(--border-default)]">
            Loading prompts…
          </div>
        )}

        {!loading && !hasPrompts && (
          <div className="px-4 py-6 text-sm text-[var(--text-caption)] border-b border-[var(--border-default)]">
            No prompts available for the selected filters.
          </div>
        )}

        {topics.map((topic) => {
          if (topic.prompts.length === 0) {
            return null;
          }

          const isExpanded = expandedTopics.includes(topic.id);

          return (
            <div key={topic.id} className="border-b border-[var(--border-default)] last:border-b-0">
              <button
                onClick={() => toggleTopic(topic.id)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-[var(--bg-secondary)] transition-colors text-left"
              >
                <div className="flex items-center gap-2">
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
                </div>
              </button>

              {isExpanded && (
                <div>
                  <table className="w-full">
                    <tbody>
                      {topic.prompts.map((prompt) => {
                        const isSelected = selectedPromptId === prompt.id;

                        return (
                          <tr
                            key={prompt.id}
                            onClick={() => handlePromptClick(prompt)}
                            className={`cursor-pointer border-t border-[var(--border-default)] transition-all ${
                              isSelected
                                ? 'bg-[var(--accent-light)]'
                                : 'hover:bg-[var(--bg-secondary)]'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm text-[var(--text-body)] font-data leading-snug">
                                {prompt.question}
                              </p>
                              {prompt.collectorTypes.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {prompt.collectorTypes.map((collector) => (
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
                            <td className="px-2 py-3 w-20 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-semibold font-data text-[var(--text-body)]">
                                  {volumeFormatter.format(prompt.volumePercentage)}%
                                </span>
                                <span className="text-[10px] text-[var(--text-caption)] font-medium">
                                  {prompt.volumeCount} responses
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-3 w-32 text-center">
                              <span className="text-sm font-medium text-[var(--text-caption)]">
                                {prompt.sentimentScore !== null ? `${prompt.sentimentScore.toFixed(1)}` : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 w-32 text-center">
                              <span className="text-xs text-[var(--text-caption)] font-data">
                                {topic.name}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
