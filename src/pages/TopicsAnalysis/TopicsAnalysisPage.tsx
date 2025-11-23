import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { IconBrandOpenai } from '@tabler/icons-react';
import claudeLogoSrc from '../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../assets/Grok-icon.svg';
import perplexityLogoSrc from '../../assets/Perplexity-Simple-Icon.svg';
import { Layout } from '../../components/Layout/Layout';
import { CompactMetricsPods } from './components/CompactMetricsPods';
import { TopicsRankedTable } from './components/TopicsRankedTable';
import { TopicAnalysisMultiView } from './components/TopicAnalysisMultiView';
import { TopicDetailModal } from './components/TopicDetailModal';
import { ChartTitle } from './components/ChartTitle';
import { CountryFlag } from '../../components/CountryFlag';
import DatePickerMultiView from '../../components/DatePicker/DatePickerMultiView';
import { TopicsDataStatusBanner } from './components/TopicsDataStatusBanner';
import { useManualBrandDashboard } from '../../manual-dashboard';
import type { TopicsAnalysisData, Topic } from './types';
import type { PodId } from './components/CompactMetricsPods';

interface TopicsAnalysisPageProps {
  data: TopicsAnalysisData;
  isLoading?: boolean;
  onTopicClick?: (topic: Topic) => void;
  onCategoryFilter?: (categoryId: string) => void;
  onFiltersChange?: (filters: { startDate?: string; endDate?: string; collectorType?: string; country?: string }) => void;
  availableModels?: string[]; // Available models from backend
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

// Error state component
const ErrorState = ({ onRetry }: { onRetry?: () => void }) => {
  return (
    <div className="bg-white border border-[var(--primary200)] rounded-lg p-12 text-center">
      <p className="text-lg font-medium text-[var(--text-error)] mb-2">Unable to load topics</p>
      <p className="text-sm text-[var(--text-caption)] mb-4">There was an error loading your topic data.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-[var(--accent500)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export const TopicsAnalysisPage = ({
  data,
  isLoading = false,
  onTopicClick,
  onCategoryFilter,
  onFiltersChange,
  availableModels: backendAvailableModels = [],
}: TopicsAnalysisPageProps) => {
  const { selectedBrand, brands } = useManualBrandDashboard();
  
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

  // Manage country/region state
  const [selectedCountry, setSelectedCountry] = useState<string>('us');

  // AI Models configuration (matching account configuration)
  const AI_MODELS = [
    { id: 'chatgpt', name: 'ChatGPT', icon: 'openai' },
    { id: 'claude', name: 'Claude', icon: 'claude' },
    { id: 'gemini', name: 'Google Gemini', icon: 'gemini' },
    { id: 'perplexity', name: 'Perplexity', icon: 'perplexity' },
    { id: 'copilot', name: 'Microsoft Copilot', icon: 'copilot' },
    { id: 'google_aio', name: 'Google AIO', icon: 'google_aio' },
    { id: 'grok', name: 'Grok', icon: 'grok' },
  ];
  
  // Mock selected models (in real app, get from account/brand configuration)
  const [selectedModels, setSelectedModels] = useState<string[]>(['chatgpt', 'claude', 'perplexity']);
  // Default to empty string (All Models) - will show all models in data
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  // Use available models from backend (from collector_results.collector_type)
  const availableModels = useMemo(() => {
    if (backendAvailableModels && backendAvailableModels.length > 0) {
      return backendAvailableModels.map(m => m.toLowerCase());
    }
    // Fallback: extract from topics' availableModels if backend doesn't provide
    const modelSet = new Set<string>();
    data.topics.forEach(topic => {
      if ((topic as any).availableModels && Array.isArray((topic as any).availableModels)) {
        (topic as any).availableModels.forEach((m: string) => {
          modelSet.add(m.toLowerCase());
        });
      }
    });
    // Final fallback to default selected models
    if (modelSet.size === 0) {
      return selectedModels;
    }
    return Array.from(modelSet);
  }, [backendAvailableModels, data.topics, selectedModels]);

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
  const brandFavicon = selectedBrand?.domain 
    ? `https://www.google.com/s2/favicons?domain=${selectedBrand.domain}&sz=12`
    : undefined;

  // Helper function to format dates
  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };

  // Generate date ranges based on period type
  const dateRanges = useMemo(() => {
    const today = new Date();
    const ranges: Array<{ value: string; label: string }> = [];

    if (datePeriodType === 'daily') {
      // Daily shortcuts: last 7 days, last 30 days, last 60 days
      const dailyOptions = [
        { days: 7, label: 'Last 7 days' },
        { days: 30, label: 'Last 30 days' },
        { days: 60, label: 'Last 60 days' },
      ];

      dailyOptions.forEach(({ days, label }) => {
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (days - 1));
        ranges.push({
          value: `daily-last-${days}-days`,
          label: `${label} (${formatDate(startDate)} - ${formatDate(endDate)})`
        });
      });
    } else if (datePeriodType === 'weekly') {
      // Weekly shortcuts: last 4 weeks, last 8 weeks, last 12 weeks
      const weeklyOptions = [
        { weeks: 4, label: 'Last 4 weeks' },
        { weeks: 8, label: 'Last 8 weeks' },
        { weeks: 12, label: 'Last 12 weeks' },
      ];

      weeklyOptions.forEach(({ weeks, label }) => {
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (weeks * 7 - 1));
        ranges.push({
          value: `weekly-last-${weeks}-weeks`,
          label: `${label} (${formatDate(startDate)} - ${formatDate(endDate)})`
        });
      });
    } else if (datePeriodType === 'monthly') {
      // Monthly shortcuts: last month, last 3 months, last 6 months, last 12 months
      const monthlyOptions = [
        { months: 1, label: 'Last month' },
        { months: 3, label: 'Last 3 months' },
        { months: 6, label: 'Last 6 months' },
        { months: 12, label: 'Last 12 months' },
      ];

      monthlyOptions.forEach(({ months, label }) => {
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setMonth(today.getMonth() - months);
        startDate.setDate(1); // Start of the month
        ranges.push({
          value: `monthly-last-${months}-months`,
          label: `${label} (${formatDate(startDate)} - ${formatDate(endDate)})`
        });
      });
    }

    return ranges;
  }, [datePeriodType]);

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
  
  // Helper to calculate actual date range for API
  const getDateRangeForAPI = useMemo(() => {
    const today = new Date();
    let start: Date;
    let end: Date = today;
    
    if (datePeriodType === 'daily') {
      const daysDiff = Math.floor((today.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
      start = new Date(today);
      start.setDate(today.getDate() - daysDiff);
    } else if (datePeriodType === 'weekly') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      start = weekStart;
      end = new Date(weekStart);
      end.setDate(weekStart.getDate() + 6);
    } else {
      // Monthly
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, [selectedDate, datePeriodType]);
  
  // Track initial values ONCE - only set on first render
  const initialValuesRef = useRef<{
    selectedModel: string;
    selectedCountry: string;
    selectedDate: number;
    datePeriodType: 'daily' | 'weekly' | 'monthly';
  } | null>(null);
  const hasMounted = useRef(false);
  const lastSentFilters = useRef<string>('');
  
  // Set initial values only once on first render
  if (initialValuesRef.current === null) {
    initialValuesRef.current = {
      selectedModel: selectedModel,
      selectedCountry: selectedCountry,
      selectedDate: selectedDate.getTime(),
      datePeriodType: datePeriodType
    };
  }
  
  // Mark component as mounted after first render
  useEffect(() => {
    hasMounted.current = true;
    console.log('🚀 Initial mount complete - no filters sent (backend will use default: last 30 days)');
  }, []); // Only run once on mount
  
  // Only send filters when user explicitly changes them, NOT on initial mount
  useEffect(() => {
    if (!onFiltersChange || !hasMounted.current || !initialValuesRef.current) {
      return; // Skip until component has fully mounted and initial values are set
    }
    
    // Check if any filter value has actually changed from initial values
    const initial = initialValuesRef.current;
    const hasChanged = 
      initial.selectedModel !== selectedModel ||
      initial.selectedCountry !== selectedCountry ||
      initial.selectedDate !== selectedDate.getTime() ||
      initial.datePeriodType !== datePeriodType;
    
    if (!hasChanged) {
      return; // No changes detected, skip sending filters
    }
    
    // After mount and changes detected, send filters
    // Calculate date range inside effect
    const today = new Date();
    let start: Date;
    let end: Date = today;
    
    if (datePeriodType === 'daily') {
      const daysDiff = Math.floor((today.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24));
      start = new Date(today);
      start.setDate(today.getDate() - daysDiff);
    } else if (datePeriodType === 'weekly') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
      start = weekStart;
      end = new Date(weekStart);
      end.setDate(weekStart.getDate() + 6);
    } else {
      // Monthly
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    }
    
    // Send filters when user changes them
    const newFilters = {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      collectorType: selectedModel && selectedModel !== '' ? selectedModel : undefined,
      country: selectedCountry && selectedCountry !== '' ? selectedCountry : undefined
    };
    
    // Create a stable key to avoid sending duplicate filters
    const filterKey = JSON.stringify(newFilters);
    if (filterKey === lastSentFilters.current) {
      return; // Skip if filters haven't actually changed
    }
    lastSentFilters.current = filterKey;
    
    console.log('🔍 Sending filters (user changed):', newFilters);
    onFiltersChange(newFilters);
  }, [selectedModel, selectedCountry, selectedDate, datePeriodType, onFiltersChange]);

  // Handle view change from DatePickerMultiView
  const handleViewChange = (view: 'daily' | 'weekly' | 'monthly') => {
    setDatePeriodType(view);
  };

  // Country options (sorted alphabetically)
  const countryOptions = [
    { value: 'canada', label: 'Canada' },
    { value: 'china', label: 'China' },
    { value: 'india', label: 'India' },
    { value: 'japan', label: 'Japan' },
    { value: 'south-korea', label: 'South Korea' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'us', label: 'United States' }
  ];

  // Region options (sorted alphabetically)
  const regionOptions = [
    { value: 'emea', label: 'EMEA' },
    { value: 'latam', label: 'LATAM' },
    { value: 'south-america', label: 'South America' },
    { value: 'southeast-asia', label: 'Southeast Asia' }
  ];

  // Combined options for the dropdown
  const allCountryRegionOptions = [...countryOptions, ...regionOptions];

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

  if (!data || data.topics.length === 0) {
    return (
      <Layout>
        <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <EmptyState />
        </div>
      </Layout>
    );
  }

  // Check if we have real data or mock data
  const hasRealData = data.topics.some(t => t.soA > 0 || t.sources.length > 0);
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

        {/* Status Banner */}
        {data.topics.length > 0 && (
          <TopicsDataStatusBanner hasRealData={hasRealData} topicCount={data.topics.length} />
        )}

        {/* Section 1: Compact Metrics Pods */}
        <div style={{ marginBottom: '24px' }}>
          <CompactMetricsPods
            portfolio={data.portfolio}
            performance={data.performance}
            onPodClick={(podId: PodId) => {
              // Handle pod clicks - could filter table or scroll to section
              if (podId === 'gaps') {
                // Filter table to show gaps
                console.log('Filter to gaps');
              } else if (podId === 'momentum') {
                // Scroll to or highlight trending topic
                console.log('Highlight trending topic:', data.performance.weeklyGainer.topic);
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
              country={selectedCountry}
              dateRange={currentDateRangeLabel}
              baseTitle="Topics Share of Answer"
              countryOptions={[...countryOptions, ...regionOptions]}
              selectedModel={selectedModel}
              aiModels={AI_MODELS}
            />

            {/* Right: Dropdowns (Country/Region, Date, Models, Competitors) - left to right order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Country Dropdown */}
              <div style={{ position: 'relative', minWidth: '180px' }}>
                <div style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 1
                }}>
                  <CountryFlag 
                    countryCode={selectedCountry} 
                    className="w-4 h-4"
                    style={{ display: 'block' }}
                  />
                </div>
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    // State change will trigger useEffect which sends filters
                  }}
                  style={{
                    padding: '8px 12px 8px 36px',
                    fontSize: '13px',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    color: '#212534',
                    backgroundColor: '#ffffff',
                    border: '1px solid #dcdfe5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    width: '100%',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                >
                  <optgroup label="Countries">
                    {countryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Regions">
                    {regionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

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
                          onDateSelect={handleDateSelect}
                          onViewChange={handleViewChange}
                          onApply={handleDateRangeApply}
                          onClose={() => setShowDatePicker(false)}
                          initialDate={selectedDate}
                          initialView={datePeriodType}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* AI Model Selector */}
              <div style={{ position: 'relative', minWidth: '160px' }}>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    // State change will trigger useEffect which sends filters
                  }}
                  style={{
                    padding: '8px 12px 8px 36px',
                    fontSize: '13px',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    color: '#212534',
                    backgroundColor: '#ffffff',
                    border: '1px solid #dcdfe5',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    width: '100%',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                >
                  <option value="">All Models</option>
                  {AI_MODELS.filter(model => availableModels.includes(model.id) || selectedModels.includes(model.id)).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <div style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 1
                }}>
                  {selectedModel === 'chatgpt' && <IconBrandOpenai size={16} />}
                  {selectedModel === 'claude' && (
                    <img src={claudeLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />
                  )}
                  {selectedModel === 'gemini' && (
                    <img src={geminiLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />
                  )}
                  {selectedModel === 'perplexity' && (
                    <img src={perplexityLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />
                  )}
                  {selectedModel === 'copilot' && (
                    <img src={copilotLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />
                  )}
                  {selectedModel === 'google_aio' && (
                    <img src={googleAioLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />
                  )}
                  {selectedModel === 'grok' && (
                    <img src={grokLogoSrc} alt="" style={{ width: '16px', height: '16px' }} />
                  )}
                </div>
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
            selectedCountry={selectedCountry}
            competitors={competitors}
            selectedCompetitor="all"
            brandFavicon={brandFavicon}
            onExport={() => {
              // Export functionality - can be implemented later
              console.log('Export chart data...', { chartType: 'racing-bar', selectedCategory, selectedDateRange, selectedCountry });
            }}
          />
        </div>

        {/* Section 3: Topics Ranked Table */}
        <div style={{ marginBottom: '24px' }}>
          <TopicsRankedTable
            topics={data.topics}
            categories={uniqueCategories}
            onRowClick={handleTopicClick}
            selectedTopics={selectedTopics}
            onSelectedTopicsChange={setSelectedTopics}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            competitors={competitors}
            brandFavicon={brandFavicon}
            selectedModel={selectedModel}
            aiModels={AI_MODELS}
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

