import { useState } from 'react';
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import { IconMoodSadSquint, IconMoodSad, IconMoodEmpty, IconMoodSmile, IconMoodHappy } from '@tabler/icons-react';
import { Topic, Prompt } from '../../data/mockPromptsData';

interface PromptsListProps {
  topics: Topic[];
  selectedPromptId: number | null;
  onPromptSelect: (prompt: Prompt) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const getSentimentIcon = (sentiment: number) => {
  if (sentiment <= 1) return <IconMoodSadSquint size={18} className="text-[#f94343]" />;
  if (sentiment <= 2) return <IconMoodSad size={18} className="text-[#fa8a40]" />;
  if (sentiment <= 3) return <IconMoodEmpty size={18} className="text-[#f9db43]" />;
  if (sentiment <= 4) return <IconMoodSmile size={18} className="text-[#06c686]" />;
  return <IconMoodHappy size={18} className="text-[#06c686]" />;
};

const getSentimentLabel = (sentiment: number) => {
  if (sentiment <= 1) return 'Very Negative';
  if (sentiment <= 2) return 'Negative';
  if (sentiment <= 3) return 'Neutral';
  if (sentiment <= 4) return 'Positive';
  return 'Very Positive';
};

const getWeeklyDateRanges = () => {
  const ranges = [];
  const today = new Date('2025-11-01');

  for (let i = 0; i < 8; i++) {
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - (i * 7));
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);

    const formatDate = (date: Date) => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${month}/${day}`;
    };

    ranges.push({
      value: `week-${i}`,
      label: `${formatDate(startDate)} - ${formatDate(endDate)}`
    });
  }

  return ranges;
};

export const PromptsList = ({ topics, selectedPromptId, onPromptSelect, dateRange, onDateRangeChange }: PromptsListProps) => {
  const [expandedTopics, setExpandedTopics] = useState<number[]>([1]);
  const weeklyRanges = getWeeklyDateRanges();

  const toggleTopic = (topicId: number) => {
    if (expandedTopics.includes(topicId)) {
      setExpandedTopics(expandedTopics.filter(id => id !== topicId));
    } else {
      setExpandedTopics([...expandedTopics, topicId]);
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-headings)]">
          Prompts
        </h3>
        <div className="relative">
          <CalendarDays size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-caption)] pointer-events-none" />
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="text-xs border border-[var(--border-default)] rounded pl-7 pr-2 py-1 text-[var(--text-body)] bg-white font-data appearance-none"
          >
            {weeklyRanges.map((range) => (
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
        {topics.map((topic) => {
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
                    ({topic.prompts.length})
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
                            onClick={() => onPromptSelect(prompt)}
                            className={`cursor-pointer border-t border-[var(--border-default)] transition-all ${
                              isSelected
                                ? 'bg-[var(--accent-light)]'
                                : 'hover:bg-[var(--bg-secondary)]'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm line-clamp-2 text-[var(--text-body)] font-data">
                                {prompt.text}
                              </p>
                            </td>
                            <td className="px-2 py-3 w-20 text-center">
                              <span className="text-sm font-data text-[var(--text-body)]">
                                {prompt.volume}%
                              </span>
                            </td>
                            <td className="px-2 py-3 w-32">
                              <div className="flex items-center justify-center gap-2">
                                {getSentimentIcon(prompt.sentiment)}
                                <span className="text-xs text-[var(--text-caption)] whitespace-nowrap font-data">
                                  {getSentimentLabel(prompt.sentiment)}
                                </span>
                              </div>
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
