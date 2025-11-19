import { useState, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { IconBrandOpenai } from '@tabler/icons-react';
import claudeLogoSrc from '../../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../../assets/Microsoft-Copilot-icon.svg';
import deepseekLogoSrc from '../../../assets/Deepseek-Logo-Icon.svg';
import geminiLogoSrc from '../../../assets/Google-Gemini-Icon.svg';
import grokLogoSrc from '../../../assets/Grok-icon.svg';
import mistralLogoSrc from '../../../assets/Mistral_AI_icon.svg';
import perplexityLogoSrc from '../../../assets/Perplexity-Simple-Icon.svg';
import type { Topic, SortColumn, SortState, TopicSource } from '../types';
import type { Competitor } from '../utils/competitorColors';
import { createCompetitorColorMap } from '../utils/competitorColors';
import { SourceDetailModal } from './SourceDetailModal';

// Source type colors matching the sources page
const sourceTypeColors: Record<string, string> = {
  'brand': '#00bcdc',
  'editorial': '#498cf9',
  'corporate': '#fa8a40',
  'reference': '#ac59fb',
  'ugc': '#f155a2',
  'institutional': '#0d7c96'
};

interface TopicsRankedTableProps {
  topics: Topic[];
  categories: string[];
  onRowClick?: (topic: Topic) => void;
  selectedTopics?: Set<string>;
  onSelectedTopicsChange?: (selectedTopics: Set<string>) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  competitors?: Competitor[];
  brandFavicon?: string;
  selectedModel?: string;
  aiModels?: Array<{ id: string; name: string; icon: string }>;
}

// Generate mock average industry SoA data for a topic (deterministic)
const getAvgIndustrySoA = (topic: Topic): { soA: number; trend: { direction: 'up' | 'down' | 'neutral'; delta: number } } => {
  // Use deterministic seed based on topic
  const seed = (topic.id.charCodeAt(0) * 13) % 100;
  const baseSoA = topic.soA * (0.7 + (seed / 100) * 0.6); // Industry SoA between 70% and 130% of brand SoA
  
  // Generate trend delta deterministically
  const trendSeed = (seed * 11) % 100;
  const delta = (trendSeed - 50) / 10; // Delta between -5.0 and 5.0
  
  let direction: 'up' | 'down' | 'neutral';
  if (delta > 0.1) {
    direction = 'up';
  } else if (delta < -0.1) {
    direction = 'down';
  } else {
    direction = 'neutral';
  }
  
  return {
    soA: Math.max(0, Math.min(5, baseSoA)),
    trend: {
      direction,
      delta: Math.abs(delta)
    }
  };
};

// Get SoA color based on scale
const getSoAColor = (soA: number): string => {
  if (soA >= 3.0) return '#00bcdc'; // Cyan - Strong Position
  if (soA >= 2.0) return '#0d7c96'; // Teal - Competitive
  if (soA >= 1.0) return '#f97316'; // Orange - Opportunity
  return '#1a1d29'; // Navy - Citation Gap
};

// Get SoA tooltip text
const getSoATooltip = (soA: number): string => {
  if (soA >= 3.0) return 'Strong Position (3.0x+)';
  if (soA >= 2.0) return 'Competitive (2.0-2.9x)';
  if (soA >= 1.0) return 'Opportunity (1.0-1.9x)';
  return 'Citation Gap (<1.0x)';
};

// Get trend icon and color
const getTrendDisplay = (direction: string) => {
  switch (direction) {
    case 'up':
      return {
        icon: TrendingUp,
        color: 'var(--success500)',
        symbol: '↑',
      };
    case 'down':
      return {
        icon: TrendingDown,
        color: 'var(--dataviz-4)',
        symbol: '↓',
      };
    default:
      return {
        icon: Minus,
        color: 'var(--primary300)',
        symbol: '→',
      };
  }
};

// Generate mock average competitor SoA data for a topic (deterministic)
const getAvgCompetitorSoA = (topic: Topic, numCompetitors: number): { soA: number; trend: { direction: 'up' | 'down' | 'neutral'; delta: number } } => {
  // Use deterministic seed based on topic and number of competitors
  const seed = (topic.id.charCodeAt(0) + numCompetitors * 19) % 100;
  const baseSoA = topic.soA * (0.65 + (seed / 100) * 0.7); // Competitor SoA between 65% and 135% of brand SoA
  
  // Generate trend delta deterministically
  const trendSeed = (seed * 13) % 100;
  const delta = (trendSeed - 50) / 10; // Delta between -5.0 and 5.0
  
  let direction: 'up' | 'down' | 'neutral';
  if (delta > 0.1) {
    direction = 'up';
  } else if (delta < -0.1) {
    direction = 'down';
  } else {
    direction = 'neutral';
  }
  
  return {
    soA: Math.max(0, Math.min(5, baseSoA)),
    trend: {
      direction,
      delta: Math.abs(delta)
    }
  };
};


export const TopicsRankedTable = ({ 
  topics, 
  onRowClick,
  selectedTopics: externalSelectedTopics,
  onSelectedTopicsChange,
  selectedCategory: externalSelectedCategory,
  onCategoryChange,
  brandFavicon,
  selectedModel,
  aiModels = []
}: TopicsRankedTableProps) => {

  // Get model info
  const modelInfo = useMemo(() => {
    if (!selectedModel || !aiModels.length) return null;
    return aiModels.find(m => m.id === selectedModel);
  }, [selectedModel, aiModels]);

  // Get model favicon component
  const getModelFavicon = () => {
    if (!selectedModel) return null;
    
    switch (selectedModel) {
      case 'chatgpt':
        return <IconBrandOpenai size={16} />;
      case 'claude':
        return <img src={claudeLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'gemini':
        return <img src={geminiLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'perplexity':
        return <img src={perplexityLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'copilot':
        return <img src={copilotLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'deepseek':
        return <img src={deepseekLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'mistral':
        return <img src={mistralLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      case 'grok':
        return <img src={grokLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />;
      default:
        return null;
    }
  };
  const [sortState, setSortState] = useState<SortState>({ column: 'soA', direction: 'desc' });
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<string>('all');
  
  const selectedCategory = externalSelectedCategory ?? internalSelectedCategory;
  
  // Use external selectedTopics if provided, otherwise use internal state
  const [internalSelectedTopics, setInternalSelectedTopics] = useState<Set<string>>(() => {
    // Default: all topics selected
    return new Set(topics.map(t => t.id));
  });

  const selectedTopics = externalSelectedTopics ?? internalSelectedTopics;

  const handleTopicToggle = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectedTopicsChange) {
      const newSet = new Set(selectedTopics);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      onSelectedTopicsChange(newSet);
    } else {
      setInternalSelectedTopics((prev: Set<string>) => {
        const newSet = new Set(prev);
        if (newSet.has(topicId)) {
          newSet.delete(topicId);
        } else {
          newSet.add(topicId);
        }
        return newSet;
      });
    }
  };
  const [selectedSource, setSelectedSource] = useState<TopicSource | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle sort
  const handleSort = useCallback((column: SortColumn) => {
    setSortState((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Filter and sort topics
  const filteredAndSortedTopics = useMemo(() => {
    let filtered = [...topics];

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortState.column) {
        case 'rank':
          aVal = a.rank;
          bVal = b.rank;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'soA':
          aVal = a.soA;
          bVal = b.soA;
          break;
        case 'trend':
          aVal = a.trend.delta;
          bVal = b.trend.delta;
          break;
        case 'volume':
          aVal = a.searchVolume ?? 0;
          bVal = b.searchVolume ?? 0;
          break;
        case 'sources':
          aVal = a.sources.length;
          bVal = b.sources.length;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortState.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortState.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [topics, selectedCategory, sortState]);

  const SortButton = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => {
    const isActive = sortState.column === column;
    return (
      <button
        onClick={() => handleSort(column)}
        className={`relative flex items-center gap-2 text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide hover:text-[var(--accent500)] transition-colors ${
          isActive ? 'text-[var(--accent500)]' : ''
        }`}
        aria-label={`Sort by ${column} ${isActive ? sortState.direction : 'ascending'}`}
      >
        {children}
        {isActive && (
          <span className="text-[var(--accent500)]">
            {sortState.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
        {isActive && (
          <span
            className="absolute bottom-[-12px] left-0 right-0 h-0.5 bg-[var(--accent500)]"
          ></span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white border border-[var(--primary200)] rounded-lg overflow-hidden">
      {/* Table View */}
      <div className="overflow-x-auto">
        <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative w-12">
                  <input
                    type="checkbox"
                    checked={filteredAndSortedTopics.length > 0 && filteredAndSortedTopics.every(t => selectedTopics.has(t.id))}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        const newSet = new Set(filteredAndSortedTopics.map(t => t.id));
                        if (onSelectedTopicsChange) {
                          onSelectedTopicsChange(newSet);
                        } else {
                          setInternalSelectedTopics(newSet);
                        }
                      } else {
                        const emptySet = new Set<string>();
                        if (onSelectedTopicsChange) {
                          onSelectedTopicsChange(emptySet);
                        } else {
                          setInternalSelectedTopics(emptySet);
                        }
                      }
                    }}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                  />
                </th>
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative">
                  <SortButton column="rank">Rank</SortButton>
                </th>
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative">
                  <SortButton column="name">Topic</SortButton>
                </th>
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative">
                  <div className="flex items-center gap-1.5">
                    {getModelFavicon()}
                    <span className="text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide">
                      Model
                    </span>
                  </div>
                </th>
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative">
                  <div className="flex items-center gap-1.5">
                    {brandFavicon && (
                      <img 
                        src={brandFavicon} 
                        alt="Brand" 
                        className="w-3 h-3 flex-shrink-0"
                        style={{ width: '12px', height: '12px' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <SortButton column="soA">SoA</SortButton>
                  </div>
                </th>
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative">
                  <span className="text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide">
                    Avg Industry SoA
                  </span>
                </th>
                <th className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 text-left relative">
                  <SortButton column="sources">Sources</SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTopics.map((topic) => {
                return (
                  <tr
                    key={topic.id}
                    onClick={() => onRowClick?.(topic)}
                    className="border-b border-[var(--border-default)] transition-colors cursor-pointer hover:bg-[var(--bg-secondary)]"
                    role="button"
                    tabIndex={0}
                    aria-label={`Topic: ${topic.name}, SoA: ${topic.soA.toFixed(2)}x, Rank: ${topic.rank}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick?.(topic);
                      }
                    }}
                  >
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4" onClick={handleTopicToggle.bind(null, topic.id)}>
                      <input
                        type="checkbox"
                        checked={selectedTopics.has(topic.id)}
                        onChange={() => {}}
                        onClick={handleTopicToggle.bind(null, topic.id)}
                        className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                      />
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4 text-xs sm:text-sm text-[var(--text-body)] text-center font-medium">
                      {topic.rank}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-medium text-[var(--text-headings)] break-words">{topic.name}</span>
                        <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-caption)] whitespace-nowrap">
                          {topic.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4">
                      <div className="flex items-center gap-1.5">
                        {getModelFavicon()}
                        {modelInfo && (
                          <span className="text-xs sm:text-sm text-[var(--text-body)]">
                            {modelInfo.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4">
                      {(() => {
                        const soAColor = getSoAColor(topic.soA);
                        return topic.soA > 0 ? (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: soAColor }}
                              title={getSoATooltip(topic.soA)}
                            ></span>
                            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap" style={{ color: soAColor }}>
                              {topic.soA.toFixed(2)}x
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs sm:text-sm text-[var(--text-caption)]" title="Share of Answer data not yet available">
                            —
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4 hidden sm:table-cell">
                      {(() => {
                        const trendDisplay = getTrendDisplay(topic.trend.direction);
                        const TrendIcon = trendDisplay.icon;
                        return (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <TrendIcon size={14} className="sm:w-4 sm:h-4" style={{ color: trendDisplay.color }} />
                            <span className="text-xs sm:text-sm font-medium whitespace-nowrap" style={{ color: trendDisplay.color }}>
                              {trendDisplay.symbol}
                              {Math.abs(topic.trend.delta).toFixed(1)}x
                            </span>
                            <div className="flex items-center gap-0.5">
                              {topic.trend.direction === 'up' && (
                                <ChevronUp size={14} className="text-[var(--success500)]" />
                              )}
                              {topic.trend.direction === 'down' && (
                                <ChevronDown size={14} className="text-[var(--dataviz-4)]" />
                              )}
                              {topic.trend.direction === 'neutral' && (
                                <Minus size={14} className="text-[var(--primary300)]" />
                              )}
                              <span 
                                className="text-[10px] sm:text-xs font-medium whitespace-nowrap"
                                style={{
                                  color: topic.trend.direction === 'up' 
                                    ? 'var(--success500)' 
                                    : topic.trend.direction === 'down' 
                                    ? 'var(--dataviz-4)' 
                                    : '#64748b' // neutral-700 equivalent
                                }}
                              >
                                {topic.trend.direction === 'up' ? '+' : topic.trend.direction === 'down' ? '-' : ''}{(topic.trend.delta * 20).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4">
                      {(() => {
                        const avgIndustrySoA = getAvgIndustrySoA(topic);
                        const avgSoAColor = getSoAColor(avgIndustrySoA.soA);
                        return (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: avgSoAColor }}
                              title={getSoATooltip(avgIndustrySoA.soA)}
                            ></span>
                            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap" style={{ color: avgSoAColor }}>
                              {avgIndustrySoA.soA.toFixed(2)}x
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4">
                      {topic.sources.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {topic.sources.slice(0, 2).map((source, idx) => {
                          // Extract domain from URL for favicon
                          const domain = source.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                          const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
                          const isBrand = source.type === 'brand';
                          
                          return (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSource(source);
                                setIsModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-colors"
                              style={{
                                padding: '3px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                backgroundColor: isBrand ? sourceTypeColors[source.type] : '#f4f4f6',
                                color: isBrand ? '#ffffff' : '#393e51',
                                cursor: 'pointer',
                                border: 'none',
                              }}
                              onMouseEnter={(e) => {
                                if (!isBrand) {
                                  e.currentTarget.style.backgroundColor = '#e8e9ed';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isBrand) {
                                  e.currentTarget.style.backgroundColor = '#f4f4f6';
                                }
                              }}
                              title={`${source.name} (${source.type})`}
                            >
                              <img
                                src={faviconUrl}
                                alt=""
                                className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0"
                                style={{ flexShrink: 0 }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <span className="truncate max-w-[60px] sm:max-w-[100px] text-[10px] sm:text-[11px]">{source.name}</span>
                            </button>
                          );
                        })}
                        {topic.sources.length > 2 && (
                          <span
                            className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded cursor-default"
                            style={{
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              backgroundColor: '#e8e9ed',
                              color: '#393e51',
                            }}
                          >
                            +{topic.sources.length - 2}
                          </span>
                        )}
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-[var(--text-caption)]" title="Source citation data not yet available">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {/* Source Detail Modal */}
      <SourceDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSource(null);
        }}
        source={selectedSource}
        pages={selectedSource?.pages}
      />
    </div>
  );
};

