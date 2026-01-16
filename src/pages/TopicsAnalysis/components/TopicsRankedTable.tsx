import { useState, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Topic, SortColumn, SortState } from '../types';
import type { ManagedCompetitor } from '../../../api/competitorManagementApi';

interface TopicsRankedTableProps {
  topics: Topic[];
  categories: string[];
  onRowClick?: (topic: Topic) => void;
  selectedTopics?: Set<string>;
  onSelectedTopicsChange?: (selectedTopics: Set<string>) => void;
  selectedCategory?: string;
  brandFavicon?: string;
  metricType?: 'share' | 'visibility' | 'sentiment';
  competitors?: ManagedCompetitor[];
  selectedCompetitors?: Set<string>;
}

// Get competitor average SOA for a topic (from backend data)
const getAvgCompetitorSoA = (topic: Topic): number => {
  // Use real competitor data if available
  if (topic.industryAvgSoA !== null && topic.industryAvgSoA !== undefined && topic.industryAvgSoA > 0) {
    return topic.industryAvgSoA;
  }

  // Fallback: return 0 if no competitor data
  return 0;
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


export const TopicsRankedTable = ({
  topics,
  onRowClick,
  selectedTopics: externalSelectedTopics,
  onSelectedTopicsChange,
  selectedCategory: externalSelectedCategory,
  brandFavicon,
  metricType = 'share',
  competitors = [],
  selectedCompetitors = new Set(),
}: TopicsRankedTableProps) => {

  // Model functions removed - topics are now distinct, not grouped by model
  // Model filtering happens via the filter dropdown, not per-row
  const [sortState, setSortState] = useState<SortState>({ column: 'soA', direction: 'desc' });
  const [internalSelectedCategory] = useState<string>('all');

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
          if (metricType === 'visibility') {
            aVal = a.currentVisibility ?? 0;
            bVal = b.currentVisibility ?? 0;
          } else if (metricType === 'sentiment') {
            aVal = a.currentSentiment ?? 0;
            bVal = b.currentSentiment ?? 0;
          } else {
            aVal = a.soA;
            bVal = b.soA;
          }
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
  }, [topics, selectedCategory, sortState, metricType]);

  const metricHeaderLabel = metricType === 'share' ? 'SoA' : metricType === 'visibility' ? 'Visibility' : 'Sentiment';
  const metricTooltipLabel =
    metricType === 'share' ? 'Share of Answer' : metricType === 'visibility' ? 'Visibility Score' : 'Sentiment Score';


  const formatMetricValue = (topic: Topic): string => {
    if (metricType === 'visibility') return topic.currentVisibility !== null && topic.currentVisibility !== undefined ? topic.currentVisibility.toFixed(1) : '—';
    if (metricType === 'sentiment') return topic.currentSentiment !== null && topic.currentSentiment !== undefined ? topic.currentSentiment.toFixed(1) : '—';
    const value = (topic.currentSoA || topic.soA * 20) as number;
    return value > 0 ? value.toFixed(1) + '%' : '—';
  };

  const SortButton = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => {
    const isActive = sortState.column === column;
    return (
      <button
        onClick={() => handleSort(column)}
        className={`relative flex items-center gap-2 text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide hover:text-[var(--accent500)] transition-colors ${isActive ? 'text-[var(--accent500)]' : ''
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

  // Helper to get heatmap style for a cell based on SoA value
  const getHeatmapStyle = (soA: number, isCompetitor: boolean = false) => {
    // Normalize SoA: Brand SoA comes in as 0-5 scale, Competitor SoA comes in as 0-100 scale then converted to 0-5
    // But wait, the table code converts everything to 0-100 for display

    // Let's standardise on the 0-5 scale for color logic matching getSoAColor
    // If it's > 5, assume it's a percentage and divide by 20 ?? 
    // Actually, existing getSoAColor usage implies topic.soA is 0-5 scale.
    // Competitor values in map are numbers. Let's see how they are used:
    // "color = getSoAColor(val / 20)" implies val is 0-100.

    // So the input `soA` to this function should be on 0-5 scale for consistency with getSoAColor

    let backgroundColor = 'transparent';
    let color = 'inherit';

    // Logic matches getSoAColor but uses opacity for background
    if (soA >= 3.0) {
      backgroundColor = 'rgba(0, 188, 220, 0.15)'; // Cyan
      color = '#007a8e'; // Darker cyan for text
    } else if (soA >= 2.0) {
      backgroundColor = 'rgba(13, 124, 150, 0.15)'; // Teal
      color = '#095c70';
    } else if (soA >= 1.0) {
      backgroundColor = 'rgba(249, 115, 22, 0.15)'; // Orange
      color = '#c25409';
    } else {
      // For very low values, maybe just a very light grey or stick to the scheme?
      // The "Gap" color #1a1d29 is dark.
      backgroundColor = 'rgba(26, 29, 41, 0.05)'; // Navy/Grey
      color = '#1a1d29';
    }

    return { backgroundColor, color };
  };

  return (
    <div className="bg-white border border-[var(--primary200)] rounded-lg overflow-hidden shadow-sm">
      {/* Table View */}
      <div className="overflow-x-auto relative">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-[var(--border-default)] bg-[var(--bg-secondary)]">
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left w-12 sticky left-0 z-20 bg-[var(--bg-secondary)]">
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
                  className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] cursor-pointer"
                />
              </th>
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[60px]">
                <SortButton column="rank">Rank</SortButton>
              </th>
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[200px] sticky left-12 z-20 bg-[var(--bg-secondary)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                <SortButton column="name">Topic</SortButton>
              </th>
              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[100px]">
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
                  <SortButton column="soA">{metricHeaderLabel}</SortButton>
                </div>
              </th>

              {/* Dynamic Competitor Columns */}
              {competitors.filter(c => selectedCompetitors.size === 0 || selectedCompetitors.has(c.name.toLowerCase())).map((competitor) => (
                <th key={competitor.id} className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[140px]">
                  <div className="flex items-center gap-2">
                    {competitor.logo && (
                      <img
                        src={competitor.logo}
                        alt={competitor.name}
                        className="w-4 h-4 object-contain rounded-sm"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-xs font-semibold text-[var(--text-headings)] uppercase tracking-wide whitespace-nowrap">
                      {competitor.name}
                    </span>
                  </div>
                </th>
              ))}

              <th className="px-3 sm:px-4 lg:px-5 py-3 text-left relative min-w-[150px] sticky right-0 z-20 bg-[var(--bg-secondary)] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                <SortButton column="sources">Top Sources</SortButton>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {filteredAndSortedTopics.length === 0 ? (
              <tr>
                <td colSpan={5 + (competitors.filter(c => selectedCompetitors.size === 0 || selectedCompetitors.has(c.name.toLowerCase())).length)} className="px-3 sm:px-4 lg:px-5 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-headings)]">
                      No topics found for selected filters
                    </p>
                    <p className="text-xs text-[var(--text-caption)]">
                      Try adjusting your date range or LLM model filters to see more results
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedTopics.map((topic) => {
                return (
                  <tr
                    key={topic.id}
                    onClick={() => onRowClick?.(topic)}
                    className="transition-colors cursor-pointer hover:bg-[var(--bg-secondary)]/50 group"
                    role="button"
                    tabIndex={0}
                    aria-label={`Topic: ${topic.name}, ${metricTooltipLabel}: ${formatMetricValue(topic)}, Rank: ${topic.rank}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick?.(topic);
                      }
                    }}
                  >
                    <td className="px-3 sm:px-4 lg:px-5 py-4 sticky left-0 z-10 bg-white group-hover:bg-[var(--bg-secondary)]/50 transition-colors" onClick={handleTopicToggle.bind(null, topic.id)}>
                      <input
                        type="checkbox"
                        checked={selectedTopics.has(topic.id)}
                        onChange={() => { }}
                        onClick={handleTopicToggle.bind(null, topic.id)}
                        className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)] cursor-pointer"
                      />
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4">
                      <span className="text-sm font-semibold text-[var(--text-body)]">
                        {topic.rank}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 lg:px-5 py-4 sticky left-12 z-10 bg-white group-hover:bg-[var(--bg-secondary)]/50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2 flex-wrap min-w-[200px]">
                        <span className="text-sm font-medium text-[var(--text-headings)] break-words">{topic.name}</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-[var(--bg-secondary)] text-[var(--text-caption)] whitespace-nowrap">
                          {topic.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-1 sm:px-2 py-4">
                      {/* Reduced padding to allow background to look like a cell fill if we style the div, or style the TD? 
                          Let's style the inner div to be a pill/block
                       */}
                      {metricType === 'share' ? (
                        (() => {
                          const soAScale = topic.soA; // 0-5 scale
                          const heatmapStyle = getHeatmapStyle(soAScale);

                          return topic.soA > 0 ? (
                            <div className="flex items-center justify-center py-2 px-3 rounded-md" style={heatmapStyle}>
                              <span className="text-sm font-bold whitespace-nowrap">
                                {(topic.currentSoA || topic.soA * 20).toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-2 px-3 rounded-md">
                              <span className="text-sm text-[var(--text-caption)]" title="Share of Answer data not yet available">
                                —
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-sm font-semibold whitespace-nowrap px-4" title={metricTooltipLabel}>
                          {formatMetricValue(topic)}
                        </span>
                      )}
                    </td>

                    {/* Dynamic Competitor Cells */}
                    {competitors.filter(c => selectedCompetitors.size === 0 || selectedCompetitors.has(c.name.toLowerCase())).map((competitor) => {
                      const compKey = competitor.name.toLowerCase();
                      let rawValue: number | undefined;
                      let displayValue = '—';
                      let heatmapStyle = {};

                      if (metricType === 'share') {
                        // SoA
                        const val = topic.competitorSoAMap?.[compKey];
                        if (val !== undefined) {
                          rawValue = val;
                          displayValue = `${val.toFixed(1)}%`;
                          // Convert 0-100 to 0-5 scale for color logic
                          heatmapStyle = getHeatmapStyle(val / 20, true);
                        }
                      } else if (metricType === 'visibility') {
                        // Visibility
                        const val = topic.competitorVisibilityMap?.[compKey];
                        if (val !== undefined) {
                          rawValue = val;
                          displayValue = val.toFixed(1);
                        }
                      } else {
                        // Sentiment
                        const val = topic.competitorSentimentMap?.[compKey];
                        if (val !== undefined) {
                          rawValue = val;
                          displayValue = val.toFixed(1);
                        }
                      }

                      return (
                        <td key={competitor.id} className="px-1 sm:px-2 py-4">
                          {rawValue !== undefined ? (
                            metricType === 'share' ? (
                              <div className="flex items-center justify-center py-2 px-3 rounded-md" style={heatmapStyle}>
                                <span
                                  className="text-sm font-bold whitespace-nowrap"
                                >
                                  {displayValue}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold whitespace-nowrap px-4">
                                {displayValue}
                              </span>
                            )
                          ) : (
                            <div className="flex items-center justify-center py-2 px-3">
                              <span className="text-sm text-[var(--text-caption)]">—</span>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 sm:px-4 lg:px-5 py-4 sticky right-0 z-10 bg-white group-hover:bg-[var(--bg-secondary)]/50 transition-colors shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {topic.sources.length > 0 ? (() => {
                        // Get only the first (top) source
                        const topSource = topic.sources[0];
                        // Extract domain from URL or use name if it's already a domain
                        let domain = topSource.name;
                        if (topSource.url) {
                          try {
                            const url = new URL(topSource.url);
                            domain = url.hostname.replace(/^www\./, '');
                          } catch {
                            domain = topSource.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
                          }
                        }

                        // Generate favicon URL for the domain
                        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;

                        return (
                          <div className="flex items-center gap-2">
                            <img
                              src={faviconUrl}
                              alt=""
                              className="w-4 h-4 flex-shrink-0"
                              onError={(e) => {
                                // Hide favicon if it fails to load
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <span className="text-sm text-[var(--text-body)] font-medium truncate max-w-[120px]" title={domain}>
                              {domain}
                            </span>
                          </div>
                        );
                      })() : (
                        <span className="text-sm text-[var(--text-caption)]" title="Source citation data not yet available">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

