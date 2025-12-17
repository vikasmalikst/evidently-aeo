/**
 * Recommendations V2 Page
 * 
 * Clean, expandable table UI for displaying strategic recommendations.
 * Each row shows key data and expands to reveal detailed insights.
 */

import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { useManualBrandDashboard } from '../manual-dashboard';
import { generateRecommendations, fetchRecommendations, Recommendation } from '../api/recommendationsApi';
import { IconSparkles, IconChevronRight, IconChevronDown, IconTrendingUp, IconTrendingDown, IconMinus, IconAlertCircle } from '@tabler/icons-react';
import { RecommendationContentModal } from './Recommendations/components/RecommendationContentModal';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const formatInt = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '—';
  return String(Math.round(num));
};

const sanitizeMetricText = (text: string, rec: Recommendation): string => {
  const replaceMetric = (input: string, labelRegex: RegExp, replacement: string) => {
    // Replace the first numeric token after a metric label (optionally followed by %)
    return input.replace(
      new RegExp(`(${labelRegex.source}[^0-9]{0,25})(\\d+(?:\\.\\d+)?)\\s*%?`, 'ig'),
      `$1${replacement}`
    );
  };

  let out = text;
  out = replaceMetric(out, /visibility/, formatInt(rec.visibilityScore));
  out = replaceMetric(out, /soa/, formatInt(rec.soa));
  out = replaceMetric(out, /sentiment/, formatInt(rec.sentiment));
  return out;
};

const LevelBadge = ({ 
  level, 
  type 
}: { 
  level: 'High' | 'Medium' | 'Low'; 
  type: 'effort' | 'priority' 
}) => {
  const colors = {
    High: type === 'priority' 
      ? 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]' 
      : 'bg-[#fed7aa] text-[#9a3412] border-[#fdba74]',
    Medium: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    Low: type === 'priority'
      ? 'bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]'
      : 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors[level]}`}>
      {level}
    </span>
  );
};

const FocusAreaBadge = ({ area }: { area: 'visibility' | 'soa' | 'sentiment' }) => {
  const config = {
    visibility: { label: 'Visibility', color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]' },
    soa: { label: 'SOA', color: 'bg-[#e9d5ff] text-[#6b21a8] border-[#d8b4fe]' },
    sentiment: { label: 'Sentiment', color: 'bg-[#ccfbf1] text-[#134e4a] border-[#99f6e4]' }
  };

  const { label, color } = config[area];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}>
      {label}
    </span>
  );
};

const ConfidenceBar = ({ value }: { value: number }) => {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-[#06c686]';
    if (v >= 60) return 'bg-[#00bcdc]';
    return 'bg-[#f59e0b]';
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-[#e8e9ed] rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(value)} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[11px] text-[#64748b] font-medium">{value}%</span>
    </div>
  );
};

const TrendIndicator = ({ direction, changePercent }: { direction: 'up' | 'down' | 'stable'; changePercent: number }) => {
  if (direction === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#64748b]">
        <IconMinus size={12} />
        <span>Stable</span>
      </span>
    );
  }
  
  const isPositive = direction === 'up';
  const color = isPositive ? 'text-[#06c686]' : 'text-[#ef4444]';
  const Icon = isPositive ? IconTrendingUp : IconTrendingDown;
  
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${color}`}>
      <Icon size={12} />
      <span>{Math.round(Math.abs(changePercent))}%</span>
    </span>
  );
};

const CategoryBadge = ({ category }: { category: Recommendation['citationCategory'] }) => {
  const config = {
    'Priority Partnerships': { label: 'Priority', color: 'bg-[#06c686] text-white' },
    'Reputation Management': { label: 'Reputation', color: 'bg-[#ef4444] text-white' },
    'Growth Opportunities': { label: 'Growth', color: 'bg-[#0ea5e9] text-white' },
    'Monitor': { label: 'Monitor', color: 'bg-[#94a3b8] text-white' },
    'Uncategorized': { label: 'Uncategorized', color: 'bg-[#94a3b8] text-white' }
  };

  const safeCategory = category || 'Uncategorized';
  const { label, color } = config[safeCategory] || { label: safeCategory, color: 'bg-[#94a3b8] text-white' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
};

// ============================================================================
// EXPANDABLE ROW COMPONENT
// ============================================================================

interface RecommendationRowProps {
  recommendation: Recommendation;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerateContent: (rec: Recommendation) => void;
}

const RecommendationRow = ({ recommendation, index, isExpanded, onToggle, onGenerateContent }: RecommendationRowProps) => {
  const rec = recommendation;

  return (
    <>
      {/* Collapsed Row */}
      <tr
        className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'} border-b border-[#e8e9ed] hover:bg-[#f1f5f9] transition-colors cursor-pointer`}
        onClick={onToggle}
      >
        {/* Expand/Collapse Icon */}
        <td className="px-4 py-4 w-10">
          <div className="flex items-center justify-center">
            {isExpanded ? (
              <IconChevronDown size={18} className="text-[#64748b]" />
            ) : (
              <IconChevronRight size={18} className="text-[#64748b]" />
            )}
          </div>
        </td>

        {/* Category Badge */}
        <td className="px-4 py-4 w-[120px]">
          <CategoryBadge category={rec.citationCategory} />
        </td>

        {/* Action (truncated) */}
        <td className="px-4 py-4 min-w-[400px]">
          <p className="text-[13px] text-[#1a1d29] font-medium leading-snug" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {rec.action}
          </p>
        </td>

        {/* Key Metrics */}
        <td className="px-4 py-4 w-[200px]">
          <div className="space-y-1.5">
            <div className="text-[12px] text-[#64748b]">
              Impact Score: <span className="font-semibold text-[#1a1d29]">{formatInt(rec.impactScore)}</span>
            </div>
            <div className="text-[12px] text-[#64748b]">
              Visibility: <span className="font-semibold text-[#1a1d29]">{formatInt(rec.visibilityScore)}</span>
            </div>
            <div className="text-[12px] text-[#64748b]">
              Citations: <span className="font-semibold text-[#1a1d29]">{formatInt(rec.citationCount)}</span>
            </div>
            <div className="text-[12px] text-[#64748b]">
              Boost: <span className="font-semibold text-[#06c686]">{rec.expectedBoost}</span>
            </div>
            <LevelBadge level={rec.effort} type="effort" />
          </div>
        </td>

        {/* Priority & Confidence */}
        <td className="px-4 py-4 w-[150px]">
          <div className="space-y-2">
            <LevelBadge level={rec.priority} type="priority" />
            <ConfidenceBar value={rec.confidence} />
          </div>
        </td>

        {/* Timeline */}
        <td className="px-4 py-4 w-[100px]">
          <span className="text-[12px] text-[#64748b]">{rec.timeline}</span>
        </td>

        {/* Focus Area */}
        <td className="px-4 py-4 w-[100px]">
          <FocusAreaBadge area={rec.focusArea} />
        </td>
      </tr>

      {/* Expanded Row */}
      {isExpanded && (
        <tr className="bg-[#f8fafc]">
          <td colSpan={7} className="px-6 py-6 border-b border-[#e2e8f0]">
            <div className="space-y-6">
              {/* Full Action Text */}
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Action</h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateContent(rec);
                    }}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#0ea5e9] text-white hover:bg-[#0d8cc7] transition-colors"
                    title="Generate a short content draft for this recommendation"
                  >
                    Generate Content
                  </button>
                </div>
                <p className="text-[13px] text-[#1a1d29] leading-relaxed">{rec.action}</p>
              </div>

              {/* Reason & Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Reason</h4>
                  <p className="text-[13px] text-[#1a1d29] leading-relaxed">{sanitizeMetricText(rec.reason, rec)}</p>
                </div>
                <div>
                  <h4 className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Explanation</h4>
                  <p className="text-[13px] text-[#64748b] leading-relaxed">{sanitizeMetricText(rec.explanation, rec)}</p>
                </div>
              </div>

              {/* Source & Metrics Details */}
              <div className="border-t border-[#e2e8f0] pt-4">
                <h4 className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-3">Source & Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Citation Source</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{rec.citationSource}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Impact Score</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{formatInt(rec.impactScore)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Mention Rate</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{formatInt(rec.mentionRate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Citations</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{formatInt(rec.citationCount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">SOA</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{formatInt(rec.soa)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Sentiment</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{formatInt(rec.sentiment)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Visibility</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{formatInt(rec.visibilityScore)}</p>
                  </div>
                  {rec.trend && (
                    <div>
                      <p className="text-[11px] text-[#64748b] mb-1">Trend</p>
                      <TrendIndicator direction={rec.trend.direction} changePercent={rec.trend.changePercent} />
                    </div>
                  )}
                </div>
              </div>

              {/* Focus Areas */}
              <div className="border-t border-[#e2e8f0] pt-4">
                <h4 className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-3">Focus Areas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Focus Sources</p>
                    <p className="text-[13px] text-[#1a1d29]">{rec.focusSources}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Content Focus</p>
                    <p className="text-[13px] text-[#1a1d29]">{rec.contentFocus}</p>
                  </div>
                </div>
              </div>

              {/* Strategic Context */}
              <div className="border-t border-[#e2e8f0] pt-4">
                <h4 className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-3">Strategic Context</h4>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">KPI Targeted</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{rec.kpi}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Expected Boost</p>
                    <p className="text-[13px] font-semibold text-[#06c686]">{rec.expectedBoost}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Effort</p>
                    <LevelBadge level={rec.effort} type="effort" />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#64748b] mb-1">Timeline</p>
                    <p className="text-[13px] font-medium text-[#1a1d29]">{rec.timeline}</p>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ============================================================================
// CATEGORY FILTER TABS
// ============================================================================

interface CategoryFilterTabsProps {
  selectedCategory: string | 'all';
  onSelect: (category: string | 'all') => void;
  counts: Record<string, number>;
}

const CategoryFilterTabs = ({ selectedCategory, onSelect, counts }: CategoryFilterTabsProps) => {
  const categories = [
    { key: 'all', label: 'All', color: '#64748b' },
    { key: 'Priority Partnerships', label: 'Priority Partnerships', color: '#06c686' },
    { key: 'Reputation Management', label: 'Reputation Management', color: '#ef4444' },
    { key: 'Growth Opportunities', label: 'Growth Opportunities', color: '#0ea5e9' },
    { key: 'Monitor', label: 'Monitor', color: '#94a3b8' },
    { key: 'Uncategorized', label: 'Uncategorized', color: '#94a3b8' }
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.key;
        const count = cat.key === 'all' 
          ? Object.values(counts).reduce((sum, c) => sum + c, 0)
          : counts[cat.key] || 0;

        return (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              isActive
                ? 'bg-[#0ea5e9] text-white shadow-sm'
                : 'bg-white text-[#64748b] border border-[#e8e9ed] hover:bg-[#f8fafc]'
            }`}
          >
            {cat.label}
            {count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                isActive ? 'bg-white/20' : 'bg-[#f1f5f9] text-[#475569]'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const RecommendationsV2 = () => {
  // Brand selection hook
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand
  } = useManualBrandDashboard();

  // Local state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedFocusArea, setSelectedFocusArea] = useState<'all' | Recommendation['focusArea']>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'impact' | 'effort' | 'priority' | 'timeline'>('impact');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [contentModalRec, setContentModalRec] = useState<Recommendation | null>(null);

  // Load recommendations from database on mount and when brand changes
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!selectedBrandId) {
        // Clear stale UI when brand is not selected/available
        setRecommendations([]);
        setGeneratedAt(null);
        setExpandedRows(new Set());
        setSelectedCategory('all');
        setSelectedFocusArea('all');
        setSearchQuery('');
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      // Clear previous brand's data immediately to avoid showing stale results
      setRecommendations([]);
      setGeneratedAt(null);
      setExpandedRows(new Set());
      setSelectedCategory('all');
      setSelectedFocusArea('all');
      setSearchQuery('');
      setError(null);
      try {
        console.log('📥 [RecommendationsV2] Loading recommendations from database for brand:', selectedBrandId);
        const response = await fetchRecommendations({ brandId: selectedBrandId });

        if (response.success && response.data) {
          const loadedRecommendations = response.data.recommendations || [];
          setRecommendations(loadedRecommendations);
          setGeneratedAt(response.data.generatedAt || null);
          console.log(`✅ [RecommendationsV2] Loaded ${loadedRecommendations.length} recommendations from database`);
        } else {
          setRecommendations([]);
          setGeneratedAt(null);
        }
      } catch (error) {
        console.error('❌ [RecommendationsV2] Error loading recommendations:', error);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [selectedBrandId]);

  // Avoid “wrong row expanded” when sorting/filtering changes
  useEffect(() => {
    setExpandedRows(new Set());
  }, [selectedCategory, selectedFocusArea, searchQuery, sortBy, sortDirection]);

  // Toggle row expansion
  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recommendations.forEach(rec => {
      const cat = rec.citationCategory || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [recommendations]);

  // Filter and sort recommendations
  const filteredAndSortedRecommendations = useMemo(() => {
    let filtered = recommendations;

    // Filter by category
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'Uncategorized') {
        filtered = filtered.filter((rec) => !rec.citationCategory);
      } else {
        filtered = filtered.filter(rec => rec.citationCategory === selectedCategory);
      }
    }

    // Filter by focus area
    if (selectedFocusArea !== 'all') {
      filtered = filtered.filter((rec) => rec.focusArea === selectedFocusArea);
    }

    // Search across key text fields
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((rec) => {
        const haystack = [
          rec.action,
          rec.reason,
          rec.explanation,
          rec.citationSource,
          rec.focusSources,
          rec.contentFocus,
          rec.kpi,
          rec.timeline,
          rec.expectedBoost,
          rec.citationCategory
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'impact') {
        // Base: ascending; direction applied below
        comparison = (a.calculatedScore || 0) - (b.calculatedScore || 0);
      } else if (sortBy === 'effort') {
        const effortOrder = { Low: 0, Medium: 1, High: 2 };
        comparison = effortOrder[a.effort] - effortOrder[b.effort];
        if (comparison === 0) {
          comparison = (a.calculatedScore || 0) - (b.calculatedScore || 0);
        }
      } else if (sortBy === 'priority') {
        const priorityOrder = { High: 0, Medium: 1, Low: 2 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (comparison === 0) {
          comparison = (a.calculatedScore || 0) - (b.calculatedScore || 0);
        }
      } else if (sortBy === 'timeline') {
        // Simple comparison - could be enhanced with date parsing
        comparison = a.timeline.localeCompare(b.timeline);
      }

      // Apply direction (desc means reverse the ascending comparison)
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [recommendations, selectedCategory, selectedFocusArea, searchQuery, sortBy, sortDirection]);

  // Handle generate recommendations
  const handleGenerate = async () => {
    if (!selectedBrandId) {
      setError('Please select a brand first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateRecommendations({ brandId: selectedBrandId });

      if (response.success && response.data) {
        const newRecommendations = response.data.recommendations || [];
        setRecommendations(newRecommendations);
        setGeneratedAt(response.data.generatedAt || new Date().toISOString());
        
        // Reload from database after a delay to ensure persistence
        setTimeout(async () => {
          try {
            const reloadResponse = await fetchRecommendations({ brandId: selectedBrandId });
            if (reloadResponse.success && reloadResponse.data) {
              setRecommendations(reloadResponse.data.recommendations || []);
              setGeneratedAt(reloadResponse.data.generatedAt || new Date().toISOString());
            }
          } catch (reloadError) {
            console.error('Error reloading from database:', reloadError);
          }
        }, 1000);
      } else {
        setError(response.error || 'Failed to generate recommendations');
      }
    } catch (err) {
      console.error('Error generating recommendations:', err);
      setError('Failed to generate recommendations. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle sort
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Loading state
  if (brandsLoading || isLoading) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full border-2 border-t-transparent border-[#00bcdc] animate-spin mb-4" />
            <p className="text-[14px] text-[#64748b]">
              {brandsLoading ? 'Loading brands...' : 'Loading recommendations...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state for brands
  if (brandsError || brands.length === 0) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 text-[#ef4444] mb-4">
              <IconAlertCircle size={20} />
              <p className="text-[14px] font-medium">Unable to load brands</p>
            </div>
            <p className="text-[13px] text-[#64748b]">
              {brandsError || 'No brands found. Please complete brand onboarding first.'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        <RecommendationContentModal
          isOpen={contentModalOpen}
          onClose={() => {
            setContentModalOpen(false);
            setContentModalRec(null);
          }}
          recommendation={contentModalRec}
        />
        {/* Header */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-[24px] font-bold text-[#1a1d29] mb-1">Strategic Recommendations</h1>
              <p className="text-[13px] text-[#64748b]">
                Data-driven actions to improve brand visibility, SOA, and sentiment
              </p>
            </div>
            <div className="flex items-center gap-3">
              {brands && brands.length > 1 && (
                <select
                  value={selectedBrandId || ''}
                  onChange={(e) => selectBrand(e.target.value)}
                  className="px-3 py-2 border border-[#e8e9ed] rounded-md text-[13px] text-[#1a1d29] bg-white focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] focus:border-transparent"
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedBrandId}
                className="px-4 py-2 bg-[#0ea5e9] text-white rounded-md text-[13px] font-medium hover:bg-[#0d8cc7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <IconSparkles size={16} />
                    Generate Recommendations
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Lightweight brand context when only one brand exists */}
          {brands.length === 1 && selectedBrand && (
            <div className="text-[12px] text-[#64748b]">
              Brand: <span className="font-medium text-[#1a1d29]">{selectedBrand.name}</span>
            </div>
          )}

          {/* Category Filters */}
          <div className="mb-4">
            <CategoryFilterTabs
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              counts={categoryCounts}
            />
          </div>

          {/* Search & Focus Area Filters */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <div className="flex-1">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recommendations (action, source, KPI, etc.)"
                className="w-full px-3 py-2 border border-[#e8e9ed] rounded-md text-[13px] text-[#1a1d29] bg-white focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#64748b]">Focus:</span>
              <select
                value={selectedFocusArea}
                onChange={(e) => setSelectedFocusArea(e.target.value as any)}
                className="px-3 py-2 border border-[#e8e9ed] rounded-md text-[13px] text-[#1a1d29] bg-white focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="visibility">Visibility</option>
                <option value="soa">SOA</option>
                <option value="sentiment">Sentiment</option>
              </select>
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2 text-[12px] text-[#64748b]">
            <span>Sort by:</span>
            <button
              onClick={() => handleSort('impact')}
              className={`px-2 py-1 rounded ${sortBy === 'impact' ? 'bg-[#f1f5f9] text-[#1a1d29] font-medium' : 'hover:bg-[#f8fafc]'}`}
            >
              Impact {sortBy === 'impact' && (sortDirection === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('effort')}
              className={`px-2 py-1 rounded ${sortBy === 'effort' ? 'bg-[#f1f5f9] text-[#1a1d29] font-medium' : 'hover:bg-[#f8fafc]'}`}
            >
              Effort {sortBy === 'effort' && (sortDirection === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('priority')}
              className={`px-2 py-1 rounded ${sortBy === 'priority' ? 'bg-[#f1f5f9] text-[#1a1d29] font-medium' : 'hover:bg-[#f8fafc]'}`}
            >
              Priority {sortBy === 'priority' && (sortDirection === 'desc' ? '↓' : '↑')}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 mb-6 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-[#ef4444] flex-shrink-0" />
            <p className="text-[13px] text-[#991b1b]">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm overflow-hidden">
          {filteredAndSortedRecommendations.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[14px] text-[#64748b] mb-2">
                {searchQuery.trim() || selectedCategory !== 'all' || selectedFocusArea !== 'all'
                  ? 'No matching recommendations. Try clearing filters or adjusting your search.'
                  : 'No recommendations generated yet. Click "Generate Recommendations" to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b-2 border-[#e2e8f0]">
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider w-10"></th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider w-[120px]">Category</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider min-w-[400px]">Action</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider w-[200px]">Key Metrics</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider w-[150px]">Priority & Confidence</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider w-[100px]">Timeline</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider w-[100px]">Focus Area</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedRecommendations.map((rec, index) => (
                    <RecommendationRow
                      key={rec.id || index}
                      recommendation={rec}
                      index={index}
                      isExpanded={expandedRows.has(index)}
                      onToggle={() => toggleRow(index)}
                      onGenerateContent={(r) => {
                        setContentModalRec(r);
                        setContentModalOpen(true);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        {generatedAt && filteredAndSortedRecommendations.length > 0 && (
          <div className="mt-4 text-center text-[12px] text-[#94a3b8]">
            Last generated: {new Date(generatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </Layout>
  );
};
