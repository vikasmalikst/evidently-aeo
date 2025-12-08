import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { getLLMIcon } from '../../components/Visibility/LLMIcons';
import { Layout } from '../../components/Layout/Layout';
import { CompactMetricsPods } from './components/CompactMetricsPods';
import { TopicsRankedTable } from './components/TopicsRankedTable';
import { TopicAnalysisMultiView } from './components/TopicAnalysisMultiView';
import { TopicDetailModal } from './components/TopicDetailModal';
import { ChartTitle } from './components/ChartTitle';
import DatePickerMultiView from '../../components/DatePicker/DatePickerMultiView';
import { useManualBrandDashboard } from '../../manual-dashboard';
import type { TopicsAnalysisData, Topic } from './types';
import type { PodId } from './components/CompactMetricsPods';

interface TopicsAnalysisPageProps {
  data: TopicsAnalysisData;
  isLoading?: boolean;
  onTopicClick?: (topic: Topic) => void;
  onFiltersChange?: (filters: { startDate?: string; endDate?: string; collectorType?: string; country?: string }) => void;
  availableModels?: string[]; // Available models from backend
  currentCollectorType?: string; // Current collector type from parent (to sync UI with API request)
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
  onTopicClick,
  onFiltersChange,
  availableModels: backendAvailableModels = [],
  currentCollectorType,
}: TopicsAnalysisPageProps) => {
  const { selectedBrand } = useManualBrandDashboard();
  
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

  // Manage date period type state (daily, weekly, monthly)
  const [datePeriodType, setDatePeriodType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Manage date range state - now using Date object from DatePickerMultiView
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Default to 8 weeks ago from today
    const date = new Date();
    date.setDate(date.getDate() - 56); // 8 weeks ago
    return date;
  });
  
  // Show/hide date picker modal
  const [showDatePicker, setShowDatePicker] = useState(false);


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

  // Sync from parent collectorType to selectedModels (multi-select)
  useEffect(() => {
    if (currentCollectorType === undefined) return;
    if (!currentCollectorType) {
      setSelectedModels([]);
      return;
    }
    const incoming = currentCollectorType.split(',').map((m) => m.trim()).filter(Boolean);
    setSelectedModels((prev) => {
      if (prev.length === incoming.length && prev.every((v, i) => v === incoming[i])) {
        return prev;
      }
      return incoming;
    });
  }, [currentCollectorType]);
  
  // Mock competitors (in real app, get from brand configuration)
  const competitorsList = [
    { id: 'competitor-1', name: 'Competitor 1', favicon: 'https://logo.clearbit.com/competitor1.com' },
    { id: 'competitor-2', name: 'Competitor 2', favicon: 'https://logo.clearbit.com/competitor2.com' },
    { id: 'competitor-3', name: 'Competitor 3', favicon: 'https://logo.clearbit.com/competitor3.com' },
    { id: 'competitor-4', name: 'Competitor 4', favicon: 'https://logo.clearbit.com/competitor4.com' },
    { id: 'competitor-5', name: 'Competitor 5', favicon: 'https://logo.clearbit.com/competitor5.com' },
  ];
  const [competitors] = useState(competitorsList);
  
  // Get brand favicon from selected brand, or use undefined if not available
  // In real app, get from brand configuration
  const brandFavicon = (selectedBrand as any)?.domain 
    ? `https://www.google.com/s2/favicons?domain=${(selectedBrand as any).domain}&sz=12`
    : undefined;

  // Helper function to format dates
  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };

  // Convert selected date to date range format for compatibility
  const selectedDateRange = useMemo(() => {
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (datePeriodType === 'daily') {
      if (daysDiff <= 7) return 'daily-last-7-days';
      if (daysDiff <= 30) return 'daily-last-30-days';
      return 'daily-last-60-days';
    } else if (datePeriodType === 'weekly') {
      const weeks = Math.ceil(daysDiff / 7);
      if (weeks <= 4) return 'weekly-last-4-weeks';
      if (weeks <= 8) return 'weekly-last-8-weeks';
      return 'weekly-last-12-weeks';
    } else {
      const months = Math.floor(daysDiff / 30);
      if (months <= 1) return 'monthly-last-1-months';
      if (months <= 3) return 'monthly-last-3-months';
      if (months <= 6) return 'monthly-last-6-months';
      return 'monthly-last-12-months';
    }
  }, [selectedDate, datePeriodType]);

  // Get current date range label for subtitle
  const currentDateRangeLabel = useMemo(() => {
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (datePeriodType === 'daily') {
      const endDate = new Date(today);
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - daysDiff);
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else if (datePeriodType === 'weekly') {
      // Find the week containing selectedDate
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    } else {
      // For monthly, show the month range
      const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      return `${formatDate(monthStart)} - ${formatDate(monthEnd)}`;
    }
  }, [selectedDate, datePeriodType]);

  // Handle date selection from DatePickerMultiView
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    // State change will trigger useEffect which sends filters
  };

  // Handle apply button from DatePickerMultiView
  const handleDateRangeApply = (startDate: Date, endDate: Date | null) => {
    if (endDate) {
      setSelectedDate(endDate);
    } else {
      setSelectedDate(startDate);
    }
    setShowDatePicker(false);
    // Mark that filters have been changed so useEffect will trigger
    // The useEffect will handle sending the filters after state updates
  };
  
  // (Date range helper removed - not used)
  
  const lastSentFilters = useRef<string>('');
  const primaryModel = selectedModels[0] ?? '';
  const selectedModel = primaryModel; // backward compatibility for downstream props

  // Send LLM filters when chips change
  useEffect(() => {
    if (!onFiltersChange) return;
    const collectorType = selectedModels.join(',');
    const filterKey = collectorType;
    if (filterKey === lastSentFilters.current) return;
    lastSentFilters.current = filterKey;
    onFiltersChange({
      collectorType: collectorType || undefined,
    });
    console.log('🔍 Sending LLM filters (user changed):', collectorType);
  }, [selectedModels, onFiltersChange]);

  // Handle view change from DatePickerMultiView
  const handleViewChange = (view: 'daily' | 'weekly' | 'monthly') => {
    setDatePeriodType(view);
  };


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

  // Check if we have real data - show empty state only if no data at all (not just filtered results)
  // Allow showing the page even with empty topics so filters can still work
  const hasAnyData = data && data.topics && data.topics.length > 0;
  
  // Only show true empty state if we've never loaded any data
  // If topics array is empty but we have filters, show a filtered empty state message instead
  if (!data) {
    return (
      <Layout>
        <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <EmptyState />
        </div>
      </Layout>
    );
  }
  
  // If topics array is empty, show filtered empty state (allows users to change filters)
  if (!hasAnyData) {
    return (
      <Layout>
        <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm">
            <div className="p-12 text-center">
              <p className="text-lg font-medium text-[var(--text-headings)] mb-2">
                No topics found for selected filters
              </p>
              <p className="text-sm text-[var(--text-caption)] mb-4">
                Try adjusting your LLM model or date range filters to see more results.
              </p>
              {/* Still show filters so users can adjust them */}
              <div className="mt-8 bg-white border border-[var(--border-default)] rounded-lg p-6">
                <h2 className="text-lg font-semibold text-[var(--text-headings)] mb-4">Adjust Filters</h2>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {/* Model Filter */}
                  {availableModels.length > 0 && (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
                        LLM Model
                      </label>
                      <div className="flex flex-wrap items-center justify-center gap-2">
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
                                  prev.includes(model)
                                    ? prev.filter((m) => m !== model)
                                    : [...prev, model]
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
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if we have real data - only show if we have actual SOA or source data
  // Don't show anything if all data is null/empty
  const brandName = selectedBrand?.name || 'Your Brand';

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
            marginBottom: '24px'
          }}
        >
          <h1 style={{ fontSize: '28px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: '0 0 8px 0' }}>
            Topics Analysis {brandName && `— ${brandName}`}
          </h1>
          <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
            Monitor your brand's presence across AI search engines by topic
          </p>
        </div>


        {/* Section 1: Compact Metrics Pods */}
        <div style={{ marginBottom: '24px', gap: '24px' }}>
          <CompactMetricsPods
            portfolio={data.portfolio}
            performance={data.performance}
            topics={data.topics}
            onPodClick={(podId: PodId) => {
              // Handle pod clicks - could filter table or scroll to section
              if (podId === 'gaps') {
                // Filter table to show gaps
                console.log('Filter to gaps');
              } else if (podId === 'momentum') {
                console.log('View Avg SOA change vs previous period');
              }
            }}
          />
        </div>

        {/* Section 2: Chart Header with Title and Filters */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '20px 24px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            {/* Left: Heading and Subtitle */}
            <ChartTitle
              category={selectedCategory}
              dateRange={currentDateRangeLabel}
              baseTitle="Topics Share of Answer"
              selectedModel={selectedModel}
              aiModels={[]}
            />

            {/* Right: Dropdowns (Date, Models, Competitors) - left to right order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Date Picker Button */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    color: '#212534',
                    backgroundColor: '#ffffff',
                    border: '1px solid #dcdfe5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    minWidth: '200px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{currentDateRangeLabel || 'Select date range'}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4H10V10H2V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 2V4M8 2V4M2 4H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {/* Date Picker Modal */}
                {showDatePicker && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        zIndex: 9998,
                      }}
                      onClick={() => setShowDatePicker(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        zIndex: 9999,
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        width: '700px',
                        maxHeight: '80vh',
                        minHeight: '500px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '16px 20px 20px 20px',
                          flex: 1,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                        }}
                      >
                        <DatePickerMultiView
                          {...({
                            onDateSelect: handleDateSelect,
                            onViewChange: handleViewChange,
                            onApply: handleDateRangeApply,
                            onClose: () => setShowDatePicker(false),
                            initialDate: selectedDate,
                            initialView: datePeriodType,
                          } as any)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

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
                          prev.includes(model)
                            ? prev.filter((m) => m !== model)
                            : [...prev, model]
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
          </div>

          {/* Multi-View Chart */}
          <TopicAnalysisMultiView
            topics={selectedTopicsData}
            isLoading={isLoading}
            onTopicClick={handleTopicClick}
            defaultChartType="racing-bar"
            categories={uniqueCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedDateRange={selectedDateRange}
            competitors={competitors}
            selectedCompetitor="all"
            brandFavicon={brandFavicon}
            onExport={() => {
              // Export functionality - can be implemented later
              console.log('Export chart data...', { chartType: 'racing-bar', selectedCategory, selectedDateRange });
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
              competitors,
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
      />
    </Layout>
  );
};

// Export default with mock data for development/testing
export default TopicsAnalysisPage;

