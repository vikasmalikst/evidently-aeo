import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { getLLMIcon } from './LLMIcons';

interface Model {
  id: string;
  name: string;
  score: number;
  shareOfSearch: number;
  shareOfSearchChange?: number;
  topTopic: string;
  change?: number;
  referenceCount: number;
}

interface VisibilityTableProps {
  activeTab: string;
  models: Model[];
  selectedModels: string[];
  onModelToggle: (modelId: string) => void;
  loading?: boolean;
}

export const VisibilityTable = ({
  activeTab,
  models = [],
  selectedModels = [],
  onModelToggle,
  loading = false
}: VisibilityTableProps) => {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState<{ key: keyof Model; direction: 'asc' | 'desc' }>({
    key: 'score',
    direction: 'desc'
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sortedModels = [...models].sort((a, b) => {
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
      <div className="overflow-y-auto flex-1">
        <table className="w-full border-collapse text-sm bg-white">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] w-[50px] text-center">
                <input type="checkbox" disabled />
              </th>
              <th className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] min-w-[200px]">
                {activeTab === 'brand' ? 'LLM Model' : 'Brand'}
              </th>
              <th
                className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--table-row-hover-bg)] transition-colors min-w-[200px]"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center gap-2">
                  Visibility
                  <span className="text-xs text-[var(--text-caption)] min-w-[12px]">
                    {sortConfig.key === 'score' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </span>
                </div>
              </th>
              <th
                className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)] cursor-pointer hover:bg-[var(--table-row-hover-bg)] transition-colors min-w-[200px]"
                onClick={() => handleSort('shareOfSearch')}
              >
                <div className="flex items-center gap-2">
                  Share of Search
                  <span className="text-xs text-[var(--text-caption)] min-w-[12px]">
                    {sortConfig.key === 'shareOfSearch' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </span>
                </div>
              </th>
              <th className="px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-body)] font-semibold text-left border-b border-[var(--border-default)]">
                Top Topic
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((model) => {
              const selected = isSelected(model.id);
              const hasChange = model.change !== undefined && model.change !== 0;
              const isUp = hasChange && model.change > 0;
              const hasShareChange = model.shareOfSearchChange !== undefined && model.shareOfSearchChange !== 0;
              const isShareUp = hasShareChange && model.shareOfSearchChange > 0;
              const expanded = expandedRow === model.id;

              return (
                <>
                  <tr
                    key={model.id}
                    className="transition-colors cursor-pointer"
                    onClick={() => handleRowClick(model.id)}
                  >
                    <td className="px-3 py-3 border-b border-[var(--border-default)] text-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onModelToggle(model.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)]">
                      <div className="flex items-center gap-3">
                        {getLLMIcon(model.name)}
                        <span className="text-[var(--text-body)] font-semibold">{model.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-body)]">
                          {model.score}%
                        </span>
                        {hasChange && (
                          <span
                            className={`inline-flex items-center gap-0.5 font-semibold text-xs ${
                              isUp ? 'text-[var(--status-up)]' : 'text-[var(--status-down)]'
                            }`}
                          >
                            {isUp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {Math.abs(model.change)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-body)]">
                          {model.shareOfSearch}%
                        </span>
                        {hasShareChange && (
                          <span
                            className={`inline-flex items-center gap-0.5 font-semibold text-xs ${
                              isShareUp ? 'text-[var(--status-up)]' : 'text-[var(--status-down)]'
                            }`}
                          >
                            {isShareUp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {Math.abs(model.shareOfSearchChange)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--border-default)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/topics');
                        }}
                        className="text-sm text-[var(--text-caption)] font-medium hover:text-[var(--accent-primary)] hover:underline transition-colors"
                      >
                        {model.topTopic}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-[var(--bg-secondary)]">
                      <td colSpan={5} className="px-4 py-4 border-b border-[var(--border-default)]">
                        <div className="grid grid-cols-3 gap-4 ml-12">
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-caption)] uppercase mb-2">
                              Top Queries
                            </h4>
                            <ul className="space-y-1 text-sm text-[var(--text-body)]">
                              <li>• How to use {model.name}?</li>
                              <li>• {model.name} pricing</li>
                              <li>• Best practices for {model.name}</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-caption)] uppercase mb-2">
                              Citation Breakdown
                            </h4>
                            <ul className="space-y-1 text-sm text-[var(--text-body)]">
                              <li>Direct: {model.referenceCount} refs</li>
                              <li>Indirect: {Math.floor(model.referenceCount * 0.6)} refs</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-caption)] uppercase mb-2">
                              Sentiment
                            </h4>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[var(--status-up)] h-2 rounded" style={{ width: '70%' }}></div>
                              <span className="text-sm font-semibold text-[var(--text-body)]">Positive</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
