import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import { KpiToggle } from '../../components/Visibility/KpiToggle';
import { Layout } from '../../components/Layout/Layout';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { CompactMetricsPods } from './components/CompactMetricsPods';
import { TopicsRankedTable } from './components/TopicsRankedTable';
import { TopicAnalysisMultiView } from './components/TopicAnalysisMultiView';
import { TopicDetailModal } from './components/TopicDetailModal';
import { DateRangePicker } from '../../components/DateRangePicker/DateRangePicker';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { getActiveCompetitors, type ManagedCompetitor } from '../../api/competitorManagementApi';
import { formatDateWithYear } from '../../utils/dateFormatting';
import type { Competitor } from './utils/competitorColors';
import type { TopicsAnalysisData, Topic } from './types';
import type { PodId } from './components/CompactMetricsPods';

type TopicsMetricType = 'share' | 'visibility' | 'sentiment';

interface TopicsAnalysisPageProps {
  data: TopicsAnalysisData;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onTopicClick?: (topic: Topic) => void;
  onFiltersChange?: (filters: { startDate?: string; endDate?: string; collectorType?: string; country?: string; competitors?: string[] }) => void;
  availableModels?: string[]; // Available models from backend
  currentCollectorType?: string; // Current collector type from parent (to sync UI with API request)
  currentStartDate?: string;
  currentEndDate?: string;
  competitors?: ManagedCompetitor[]; // Competitors passed from parent
  selectedCompetitors?: Set<string>; // Selected competitors passed from parent
  onCompetitorToggle?: (competitorName: string) => void;
  onSelectAllCompetitors?: () => void;
  onDeselectAllCompetitors?: () => void;
  isLoadingCompetitors?: boolean; // Loading state for competitors
}

// Loading skeleton component
const LoadingSkeleton = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Compact Metrics Pods Skeleton */}
      <div className="flex flex-wrap gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white border border-[var(--primary200)] rounded-lg w-full sm:w-[220px] md:w-[240px] min-w-[140px] sm:min-w-[220px] md:min-w-[240px] h-[150px] md:h-[160px]"></div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white border border-[var(--primary200)] rounded-lg p-6 h-96"></div>
    </div>
  );
};

// Empty state component
const EmptyState = () => {
  return (
    <div className="bg-white border border-[var(--primary200)] rounded-lg p-12 text-center">
      <p className="text-lg font-medium text-[var(--text-headings)] mb-2">No topics tracked yet</p>
      <p className="text-sm text-[var(--text-caption)]">Set up your first analysis to get started.</p>
    </div>
  );
};

export const TopicsAnalysisPage = ({
  data,
  isLoading = false,
  isRefreshing = false,
  onTopicClick,
  onFiltersChange,
  availableModels: backendAvailableModels = [],
  currentCollectorType,
  currentStartDate,
  currentEndDate,
  competitors: externalCompetitors,
  selectedCompetitors: externalSelectedCompetitors,
  onCompetitorToggle: externalOnCompetitorToggle,
  onSelectAllCompetitors: externalOnSelectAllCompetitors,
  onDeselectAllCompetitors: externalOnDeselectAllCompetitors,
  isLoadingCompetitors: externalIsLoadingCompetitors = false,
}: TopicsAnalysisPageProps) => {
  const { selectedBrand, selectedBrandId } = useManualBrandDashboard();
  const [metricType, setMetricType] = useState<TopicsMetricType>('share');

  // Extract unique categories from topics
  const uniqueCategories = useMemo(() => {
    const cats = new Set(data.topics.map((t) => t.category));
    return Array.from(cats).sort();
  }, [data.topics]);

  // Manage selected topics state (shared between chart and table)
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(() => {
    // Default: all topics selected
    return new Set(data.topics.map(t => t.id));
  });

  // Manage selected category state (shared between chart and table)
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const defaultEnd = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultStart = useMemo(() => {
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  }, []);

  // Track if user is actively changing dates to prevent parent override
  const isUserChangingDates = useRef(false);
  const isInitialMount = useRef(true);
  
  // Initialize with props if available, otherwise use defaults
  const [startDate, setStartDate] = useState<string>(() => {
    const initial = currentStartDate || defaultStart;
    return initial;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const initial = currentEndDate || defaultEnd;
    return initial;
  });

  // Sync from parent props on mount and when they change (but not if user is actively changing)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // On initial mount, always sync from parent if available
      if (currentStartDate && currentStartDate !== startDate) {
        setStartDate(currentStartDate);
      }
      if (currentEndDate && currentEndDate !== endDate) {
        setEndDate(currentEndDate);
      }
    } else if (!isUserChangingDates.current) {
      // After mount, only sync if not user-initiated
      if (currentStartDate && currentStartDate !== startDate) {
        setStartDate(currentStartDate);
      }
      if (currentEndDate && currentEndDate !== endDate) {
        setEndDate(currentEndDate);
      }
    }
  }, [currentStartDate, currentEndDate]); // Sync when parent props change

  // Handlers that update local state immediately and trigger filter update
  // DateRangePicker already handles date adjustment logic, so we just update state
  const handleStartDateChange = useCallback((date: string) => {
    if (!date) return;
    isUserChangingDates.current = true;
    setStartDate(date);
    // Reset flag after debounce completes to allow parent sync
    setTimeout(() => {
      isUserChangingDates.current = false;
    }, 600); // Slightly longer than debounce (300ms) to ensure it completes
  }, [endDate]);

  const handleEndDateChange = useCallback((date: string) => {
    if (!date) return;
    isUserChangingDates.current = true;
    setEndDate(date);
    // Reset flag after debounce completes to allow parent sync
    setTimeout(() => {
      isUserChangingDates.current = false;
    }, 600); // Slightly longer than debounce (300ms) to ensure it completes
  }, [startDate]);


  // LLM filters - multi-select chip UI replaces dropdown
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [persistedModels, setPersistedModels] = useState<string[]>([]);

  // Use available models from backend (from collector_results.collector_type)
  // These are the actual LLM models available in the data, persisted to keep chips stable
  const baseModels = useMemo(() => {
    if (backendAvailableModels && backendAvailableModels.length > 0) {
      return backendAvailableModels;
    }
    const modelSet = new Set<string>();
    data.topics.forEach(topic => {
      if ((topic as any).availableModels && Array.isArray((topic as any).availableModels)) {
        (topic as any).availableModels.forEach((m: string) => modelSet.add(m));
      }
    });
    return Array.from(modelSet);
  }, [backendAvailableModels, data.topics]);

  // Persist models seen, but only update when changed to avoid render loops
  useEffect(() => {
    if (baseModels.length === 0) return;
    setPersistedModels((prev) => {
      const merged = new Set<string>([...prev, ...baseModels]);
      const next = Array.from(merged);
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) {
        return prev; // no change
      }
      return next;
    });
  }, [baseModels]);

  const availableModels = useMemo(() => {
    if (persistedModels.length > 0) return persistedModels;
    return baseModels;
  }, [persistedModels, baseModels]);

  const normalizedModels = useMemo(() => Array.from(new Set(selectedModels)).sort(), [selectedModels]);

  // Sync from parent collectorType to selectedModels (multi-select)
  useEffect(() => {
    if (currentCollectorType === undefined) return;
    if (!currentCollectorType) {
      setSelectedModels([]);
      return;
    }
    const incoming = Array.from(new Set(currentCollectorType.split(',').map((m) => m.trim()).filter(Boolean))).sort();
    setSelectedModels((prev) => {
      if (prev.length === incoming.length && prev.every((v, i) => v === incoming[i])) {
        return prev;
      }
      return incoming;
    });
  }, [currentCollectorType]);

  // Use competitors from parent if provided, otherwise fetch locally (fallback)
  const [internalCompetitors, setInternalCompetitors] = useState<ManagedCompetitor[]>([]);
  const [internalSelectedCompetitors, setInternalSelectedCompetitors] = useState<Set<string>>(new Set());
  const [internalIsLoadingCompetitors, setInternalIsLoadingCompetitors] = useState(false);

  // Use external competitors if provided, otherwise use internal state
  const competitors = externalCompetitors ?? internalCompetitors;
  const selectedCompetitors = externalSelectedCompetitors ?? internalSelectedCompetitors;
  // Combine loading states - if parent is loading or we're loading internally
  const isLoadingCompetitors = externalIsLoadingCompetitors || internalIsLoadingCompetitors;

  // Normalize competitors for chart components that expect required IDs
  const normalizedCompetitors = useMemo<Competitor[]>(() => {
    return competitors.map((competitor, index) => ({
      id: competitor.id ?? competitor.name ?? `competitor-${index}`,
      name: competitor.name,
      favicon: competitor.logo,
    }));
  }, [competitors]);

  // Only fetch competitors if not provided by parent
  useEffect(() => {
    if (externalCompetitors !== undefined) {
      // Parent is providing competitors, don't fetch
      return;
    }

    const fetchCompetitors = async () => {
      if (!selectedBrandId) {
        setInternalCompetitors([]);
        setInternalSelectedCompetitors(new Set());
        return;
      }

      setInternalIsLoadingCompetitors(true);
      try {
        const data = await getActiveCompetitors(selectedBrandId);
        setInternalCompetitors(data.competitors || []);
        // Default: select all competitors (show average)
        setInternalSelectedCompetitors(new Set(data.competitors.map(c => c.name.toLowerCase())));
      } catch (error) {
        console.error('Error fetching competitors:', error);
        setInternalCompetitors([]);
        setInternalSelectedCompetitors(new Set());
      } finally {
        setInternalIsLoadingCompetitors(false);
      }
    };

    fetchCompetitors();
  }, [selectedBrandId, externalCompetitors]);

  const internalHandleCompetitorToggle = useCallback((competitorName: string) => {
    setInternalSelectedCompetitors((prev) => {
      const allCompetitorKeys = new Set(internalCompetitors.map(c => c.name.toLowerCase()));
      const isAllSelected = prev.size === internalCompetitors.length && 
        internalCompetitors.every(c => prev.has(c.name.toLowerCase()));
      
      const key = competitorName.toLowerCase();
      let newSet: Set<string>;
      
      if (isAllSelected) {
        newSet = new Set([key]);
      } else {
        newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
          if (newSet.size === 0) {
            newSet = allCompetitorKeys;
          }
        } else {
          newSet.add(key);
        }
      }
      
      onFiltersChange?.({
        competitors: Array.from(newSet),
      });
      return newSet;
    });
  }, [internalCompetitors, onFiltersChange]);

  const internalHandleSelectAllCompetitors = useCallback(() => {
    const allSelected = new Set(internalCompetitors.map(c => c.name.toLowerCase()));
    setInternalSelectedCompetitors(allSelected);
    onFiltersChange?.({
      competitors: Array.from(allSelected),
    });
  }, [internalCompetitors, onFiltersChange]);

  const internalHandleDeselectAllCompetitors = useCallback(() => {
    const allSelected = new Set(internalCompetitors.map(c => c.name.toLowerCase()));
    setInternalSelectedCompetitors(allSelected);
    onFiltersChange?.({
      competitors: Array.from(allSelected),
    });
  }, [internalCompetitors, onFiltersChange]);

  const handleCompetitorToggle = externalOnCompetitorToggle ?? internalHandleCompetitorToggle;
  const handleSelectAllCompetitors = externalOnSelectAllCompetitors ?? internalHandleSelectAllCompetitors;
  const handleDeselectAllCompetitors = externalOnDeselectAllCompetitors ?? internalHandleDeselectAllCompetitors;
  
  // Get brand favicon from selected brand, or use undefined if not available
  // In real app, get from brand configuration
  const brandFavicon = (selectedBrand as any)?.domain 
    ? `https://www.google.com/s2/favicons?domain=${(selectedBrand as any).domain}&sz=12`
    : undefined;

  const lastSentFilters = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const primaryModel = selectedModels[0] ?? '';
  const selectedModel = primaryModel; // backward compatibility for downstream props

  const formatDateLabel = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    // Use shared utility function for consistent timezone handling
    return formatDateWithYear(dateStr);
  }, []);

  const dateRangeLabel = useMemo(() => {
    if (!startDate || !endDate) return 'Select date range';
    const label = `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
    return label;
  }, [startDate, endDate, formatDateLabel]);

  const selectedDateRange = useMemo(() => {
    if (!startDate || !endDate) return undefined;
    return `${startDate}:${endDate}`;
  }, [startDate, endDate]);

  // Debounced filter update - prevents multiple rapid API calls
  useEffect(() => {
    if (!onFiltersChange) return;
    
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    const collectorType = normalizedModels.join(',');
    const filterKey = `${startDate || ''}|${endDate || ''}|${collectorType}`;
    
    // If filter key hasn't changed, don't send
    if (filterKey === lastSentFilters.current) return;
    
    // Debounce the filter update by 300ms to batch rapid changes
    debounceTimerRef.current = setTimeout(() => {
      lastSentFilters.current = filterKey;
      onFiltersChange({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        collectorType: collectorType || undefined,
      });
    }, 300);
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [normalizedModels, startDate, endDate, onFiltersChange]);

  // Update selected topics when topics data changes
  useEffect(() => {
    setSelectedTopics(prev => {
      // Keep existing selections if they still exist, add new topics
      const newSet = new Set<string>();
      prev.forEach(id => {
        if (data.topics.some(t => t.id === id)) {
          newSet.add(id);
        }
      });
      // Add any new topics that weren't previously selected
      data.topics.forEach(topic => {
        if (!newSet.has(topic.id)) {
          newSet.add(topic.id);
        }
      });
      return newSet;
    });
  }, [data.topics]);

  // Modal state for topic detail
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle topic row click - opens the modal
  const handleTopicClick = useCallback((topic: Topic) => {
    setSelectedTopic(topic);
    setIsModalOpen(true);
    onTopicClick?.(topic);
  }, [onTopicClick]);

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTopic(null);
  }, []);

  // Filter topics based on selection for chart
  const selectedTopicsData = useMemo(() => {
    return data.topics.filter(topic => selectedTopics.has(topic.id));
  }, [data.topics, selectedTopics]);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <LoadingSkeleton />
        </div>
      </Layout>
    );
  }

  // Always show the page structure, even with empty data
  // Components will handle their own empty states
  
  // Only show true empty state if we've never loaded any data at all
  if (!data) {
    return (
      <Layout>
        <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <EmptyState />
        </div>
      </Layout>
    );
  }
  
  // If no data, still show the full page structure with empty charts/tables
  // Don't show the "No topics found" empty state - let components handle their own empty states

  // Check if we have real data - only show if we have actual SOA or source data
  // Don't show anything if all data is null/empty
  const brandName = selectedBrand?.name || 'Your Brand';
  const chartBaseTitle = metricType === 'share'
    ? 'Topics Share of Answer'
    : metricType === 'visibility'
      ? 'Topics Visibility Score'
      : 'Topics Sentiment Score';

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        {/* Page Header */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            marginBottom: '24px',
            position: 'relative',
            minHeight: '80px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', flex: 1 }}>
              {selectedBrand && (
                <SafeLogo
                  src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                  domain={selectedBrand.homepage_url || undefined}
                  alt={selectedBrand.name}
                  size={48}
                  className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-[#1a1d29] tracking-tight m-0 mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                  Topics Analysis {brandName && `— ${brandName}`}
                </h1>
                <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
                  Monitor your brand's presence across AI search engines by topic
                </p>
              </div>
            </div>
            <div style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: '-24px', paddingBottom: '24px' }}>
              <DateRangePicker
                key={`${startDate}-${endDate}`}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                showComparisonInfo={false}
                className="flex-shrink-0"
              />
            </div>
          </div>
        </div>


        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <KpiToggle
            metricType={metricType}
            onChange={(value) => setMetricType(value as TopicsMetricType)}
            allowedMetricTypes={['share', 'visibility', 'sentiment']}
          />
          
          {/* LLM Selector/Filter Icons - aligned to the right */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedModels([])}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                selectedModels.length === 0
                  ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48]'
                  : 'bg-white border-[#e4e7ec] text-[#6c7289] hover:border-[#cfd4e3]'
              }`}
            >
              All
            </button>
            {availableModels.map((model) => {
              const isActive = selectedModels.includes(model);
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() =>
                    setSelectedModels((prev) =>
                      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
                    )
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48] shadow-sm'
                      : 'bg-white border-[#e4e7ec] text-[#1a1d29] hover:border-[#cfd4e3]'
                  }`}
                  title={model}
                  aria-label={`Filter by ${model}`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white">
                    {getLLMIcon(model)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 1: Compact Metrics Pods */}
        <div style={{ marginBottom: '24px', gap: '24px' }}>
          <CompactMetricsPods
            portfolio={data.portfolio}
            performance={data.performance}
            topics={data.topics}
            metricType={metricType}
            onPodClick={(podId: PodId) => {
              void podId;
            }}
          />
        </div>

        {/* Section 2: Multi-View Chart */}
        <div style={{ marginBottom: '24px' }}>
          {/* Multi-View Chart */}
          <TopicAnalysisMultiView
            topics={selectedTopicsData}
            isLoading={isLoading}
            onTopicClick={handleTopicClick}
            defaultChartType="racing-bar"
            metricType={metricType}
            categories={uniqueCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedDateRange={selectedDateRange}
            competitors={normalizedCompetitors}
            managedCompetitors={competitors}
            selectedCompetitors={selectedCompetitors}
            onCompetitorToggle={handleCompetitorToggle}
            onSelectAllCompetitors={handleSelectAllCompetitors}
            onDeselectAllCompetitors={handleDeselectAllCompetitors}
            selectedCompetitor={selectedCompetitors.size === normalizedCompetitors.length ? "all" : Array.from(selectedCompetitors)[0] || "all"}
            brandFavicon={brandFavicon}
            isLoadingCompetitors={isLoadingCompetitors || isLoading || isRefreshing}
            onExport={() => {
              // Export functionality - can be implemented later
            }}
          />
        </div>

        {/* Section 3: Topics Ranked Table */}
        <div style={{ marginBottom: '24px' }}>
          <TopicsRankedTable
            {...({
              topics: data.topics,
              categories: uniqueCategories,
              onRowClick: handleTopicClick,
              selectedTopics,
              onSelectedTopicsChange: setSelectedTopics,
              selectedCategory,
              metricType,
              competitors,
              selectedCompetitors,
              brandFavicon,
              selectedModel,
              aiModels: [],
            } as any)}
          />
        </div>
      </div>

      {/* Topic Detail Modal */}
      <TopicDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        topic={selectedTopic}
        metricType={metricType}
      />
    </Layout>
  );
};

// Export default with mock data for development/testing
export default TopicsAnalysisPage;
