import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { getLLMIcon } from './LLMIcons';
import { SafeLogo } from '../Onboarding/common/SafeLogo';

interface Model {
  id: string;
  name: string;
  score: number;
  shareOfSearch: number;
  shareOfSearchChange?: number;
  sentiment?: number | null;
  topTopic: string;
  change?: number;
  referenceCount: number;
  brandPresencePercentage: number;
  topTopics?: Array<{
    topic: string;
    occurrences: number;
    share: number;
    visibility: number;
    mentions: number;
  }>;
  isBrand?: boolean;
  logo?: string;
  domain?: string;
}

interface VisibilityTableProps {
  activeTab: string;
  models: Model[];
  selectedModels: string[];
  onModelToggle: (modelId: string) => void;
  loading?: boolean;
}

export const VisibilityTable = memo(({
  activeTab,
  models = [],
  selectedModels = [],
  onModelToggle
}: VisibilityTableProps) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<{ key: keyof Model; direction: 'asc' | 'desc' }>({
    key: 'score',
    direction: 'desc'
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sortedModels = [...models].sort((a, b) => {
    // Keep brand row at top for competitive view
    if (activeTab === 'competitive') {
      if (a.isBrand && !b.isBrand) return -1;
      if (!a.isBrand && b.isBrand) return 1;
    }

    const key = sortConfig.key;
    const aVal = a[key] || 0;
    const bVal = b[key] || 0;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
    }

    return 0;
  });

  const handleSort = (key: keyof Model) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const isSelected = (modelId: string) => selectedModels.includes(modelId);

  const handleRowClick = (modelId: string) => {
    setExpandedRow(expandedRow === modelId ? null : modelId);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden border border-[var(--border-default)] rounded-b-lg">
      <div className="overflow-auto flex-1">
        <table className="w-full border-collapse text-sm bg-white">
          <thead className="sticky top-0 z-10 w-fit">
            <tr>
              <th className="px-3 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold border-b border-[var(--border-default)] w-[50px] text-center whitespace-nowrap">
                <input type="checkbox" disabled />
              </th>
              <th className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] min-w-[200px] whitespace-nowrap">
                {activeTab === 'brand' ? 'LLM Model' : 'Brand'}
              </th>
              <th
                className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--table-row-hover-bg)] transition-colors min-w-[200px] whitespace-nowrap"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center gap-2">
                  Visibility Score
                  <span className="text-xs text-[var(--text-caption)] min-w-[12px]">
                    {sortConfig.key === 'score' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </span>
                </div>
              </th>
              <th
                className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--table-row-hover-bg)] transition-colors min-w-[200px] whitespace-nowrap"
                onClick={() => handleSort('shareOfSearch')}
              >
                <div className="flex items-center gap-2">
                  {activeTab === 'competitive' ? 'Share of Answers' : 'Share of Answers'}
                  <span className="text-xs text-[var(--text-caption)] min-w-[12px]">
                    {sortConfig.key === 'shareOfSearch' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </span>
                </div>
              </th>
              <th
                className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--table-row-hover-bg)] transition-colors min-w-[150px] whitespace-nowrap"
                onClick={() => handleSort('brandPresencePercentage')}
              >
                <div className="flex items-center gap-2">
                  Brand Presence
                  <span className="text-xs text-[var(--text-caption)] min-w-[12px]">
                    {sortConfig.key === 'brandPresencePercentage' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </span>
                </div>
              </th>
              <th
                className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--table-row-hover-bg)] transition-colors min-w-[150px] whitespace-nowrap"
                onClick={() => handleSort('sentiment')}
              >
                <div className="flex items-center gap-2">
                  Sentiment Score
                  <span className="text-xs text-[var(--text-caption)] min-w-[12px]">
                    {sortConfig.key === 'sentiment' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </span>
                </div>
              </th>
              <th className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] whitespace-nowrap">
                Top Topic
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((model) => {
              const selected = isSelected(model.id);
              const hasChange = model.change !== undefined && model.change !== 0;
              const isUp = hasChange && (model.change ?? 0) > 0;
              const expanded = expandedRow === model.id;

              return (
                <React.Fragment key={model.id}>
                  <tr
                    className={`transition-colors cursor-pointer ${model.isBrand ? 'bg-[#f0f9ff] hover:bg-[#e0f2fe]' : ''
                      }`}
                    onClick={() => handleRowClick(model.id)}
                  >
                    <td className="px-3 py-3 border-b border-[var(--border-default)] text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onModelToggle(model.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)] whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {activeTab === 'brand' ? getLLMIcon(model.name) : (
                          <div className="flex-shrink-0 w-6 h-6">
                            <SafeLogo
                              src={model.logo}
                              domain={model.domain}
                              alt={model.name}
                              size={24}
                              className="w-6 h-6 rounded object-contain"
                            />
                          </div>
                        )}
                        <span className={`text-[var(--text-body)] font-semibold ${model.isBrand ? 'text-[#0d7c96]' : ''}`}>
                          {model.name}
                          {model.isBrand && <span className="ml-2 text-xs text-[#0d7c96] font-normal">(Your Brand)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-body)]">
                          {model.score}
                        </span>
                        {hasChange && (
                          <span
                            className={`inline-flex items-center gap-0.5 font-semibold text-xs ${isUp ? 'text-[var(--status-up)]' : 'text-[var(--status-down)]'
                              }`}
                          >
                            {isUp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {Math.abs(model.change ?? 0)} pts
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-body)]">
                          {model.shareOfSearch}%
                        </span>
                        {model.shareOfSearchChange !== undefined && model.shareOfSearchChange !== 0 && (
                          <span
                            className={`inline-flex items-center gap-0.5 font-semibold text-xs ${model.shareOfSearchChange > 0 ? 'text-[var(--status-up)]' : 'text-[var(--status-down)]'
                              }`}
                          >
                            {model.shareOfSearchChange > 0 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {Math.abs(model.shareOfSearchChange)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)] whitespace-nowrap">
                      <span className="text-sm font-semibold text-[var(--text-body)]">
                        {model.brandPresencePercentage > 0 ? `${model.brandPresencePercentage}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)] whitespace-nowrap">
                      {model.sentiment !== null && model.sentiment !== undefined ? (
                        <span className="text-sm font-semibold text-[var(--text-body)]">
                          {model.sentiment.toFixed(1).replace(/\.0$/, '')}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--text-caption)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)] whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/topics');
                        }}
                        className="text-sm text-[var(--text-caption)] font-medium hover:text-[var(--accent-primary)] hover:underline transition-colors"
                      >
                        {model.topTopic || '—'}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-[var(--bg-secondary)]">
                      <td colSpan={7} className="px-4 py-4 border-b border-[var(--border-default)]">
                        <div className="grid grid-cols-3 gap-4 ml-12">
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-caption)] uppercase mb-2">
                              Top Topics
                            </h4>
                            {model.topTopics && model.topTopics.length > 0 ? (
                              <ul className="space-y-1 text-sm text-[var(--text-body)]">
                                {model.topTopics.slice(0, 5).map((topic) => (
                                  <li key={topic.topic} className="flex flex-col">
                                    <span>• {topic.topic}</span>
                                    <span className="text-[11px] text-[var(--text-caption)]">
                                      {topic.share}% share · {topic.visibility}% visibility · {topic.occurrences}{' '}
                                      {topic.occurrences === 1 ? 'occurrence' : 'occurrences'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-[var(--text-caption)]">No topic insights yet.</p>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-caption)] uppercase mb-2">
                              Brand Presence Runs
                            </h4>
                            <p className="text-sm text-[var(--text-body)]">
                              Appeared in <span className="font-semibold">{model.referenceCount}</span>{' '}
                              {model.referenceCount === 1 ? 'collection' : 'collections'} with brand presence.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-caption)] uppercase mb-2">
                              Trend
                            </h4>
                            <p className="text-sm text-[var(--text-body)]">
                              Visibility change:{' '}
                              <span
                                className={`font-semibold ${model.change && model.change > 0
                                  ? 'text-[var(--status-up)]'
                                  : model.change && model.change < 0
                                    ? 'text-[var(--status-down)]'
                                    : ''
                                  }`}
                              >
                                {model.change ? `${model.change > 0 ? '+' : ''}${model.change} pts` : 'Stable'}
                              </span>
                            </p>
                            <p className="text-sm text-[var(--text-body)] mt-1">
                              {activeTab === 'competitive' ? 'Share of Answers' : 'Share of Answers'} change:{' '}
                              <span
                                className={`font-semibold ${model.shareOfSearchChange && model.shareOfSearchChange > 0
                                  ? 'text-[var(--status-up)]'
                                  : model.shareOfSearchChange && model.shareOfSearchChange < 0
                                    ? 'text-[var(--status-down)]'
                                    : ''
                                  }`}
                              >
                                {model.shareOfSearchChange
                                  ? `${model.shareOfSearchChange > 0 ? '+' : ''}${model.shareOfSearchChange}%`
                                  : 'Stable'}
                              </span>
                            </p>
                            {model.sentiment !== null && model.sentiment !== undefined && (
                              <p className="text-sm text-[var(--text-body)] mt-1">
                                Sentiment Score:{' '}
                                <span className="font-semibold">
                                  {model.sentiment.toFixed(1).replace(/\.0$/, '')}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
