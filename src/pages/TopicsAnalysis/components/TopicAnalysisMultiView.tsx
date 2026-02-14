import { useState, useMemo, useCallback } from 'react';
import { Download } from 'lucide-react';
import { HelpButton } from '../../../components/common/HelpButton';
import { TopicsRacingBarChart } from './TopicsRacingBarChart';
import { TopicsBarChart } from './TopicsBarChart';
import { TopicsAreaChart } from './TopicsAreaChart';
import { TopicsChartTypeSelector } from './TopicsChartTypeSelector';
import { CompetitorFilter } from './CompetitorFilter';
import { TopicDetailModal } from './TopicDetailModal';
import type { Topic } from '../types';
import type { Competitor } from '../utils/competitorColors';
import type { ManagedCompetitor } from '../../../api/competitorManagementApi';

export type ChartType = 'racing-bar' | 'bar' | 'line';
export type TopicsMetricType = 'share' | 'visibility' | 'sentiment' | 'brandPresence';

interface TopicAnalysisMultiViewProps {
  topics: Topic[];
  isLoading?: boolean;
  onTopicClick?: (topic: Topic) => void;
  defaultChartType?: ChartType;
  metricType?: TopicsMetricType;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  selectedDateRange?: string;
  selectedCountry?: string;
  competitors?: Competitor[];
  managedCompetitors?: ManagedCompetitor[];
  selectedCompetitors?: Set<string>;
  onCompetitorToggle?: (competitorName: string) => void;
  onSelectAllCompetitors?: () => void;
  onDeselectAllCompetitors?: () => void;
  selectedCompetitor?: string; // Legacy prop, kept for backward compatibility
  brandFavicon?: string;
  brandName?: string;
  isLoadingCompetitors?: boolean; // Loading state for competitor data
  onExport?: () => void;
  onHelpClick?: (key: string) => void;
}

export const TopicAnalysisMultiView = ({
  topics,
  isLoading = false,
  onTopicClick,
  defaultChartType = 'racing-bar',
  metricType = 'share',
  categories: _categories = [],
  selectedCategory: externalSelectedCategory,
  onCategoryChange: _onCategoryChange,
  selectedDateRange: _selectedDateRange,
  selectedCountry: _selectedCountry,
  competitors = [],
  managedCompetitors = [],
  selectedCompetitors = new Set(),
  onCompetitorToggle,
  onSelectAllCompetitors,
  onDeselectAllCompetitors,
  selectedCompetitor = '', // Legacy prop
  brandFavicon,
  brandName,
  isLoadingCompetitors = false,
  onExport,
  onHelpClick,
}: TopicAnalysisMultiViewProps) => {
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [internalSelectedCategory] = useState<string>('all');

  const selectedCategory = externalSelectedCategory ?? internalSelectedCategory;
  void _onCategoryChange;

  const getMetricValue = useCallback((topic: Topic): number => {
    if (metricType === 'visibility') {
      return Math.max(0, Math.min(100, topic.currentVisibility ?? 0));
    }
    if (metricType === 'sentiment') {
      return Math.max(0, Math.min(100, topic.currentSentiment ?? 0));
    }
    if (metricType === 'brandPresence') {
      return Math.max(0, Math.min(100, topic.currentBrandPresence ?? 0));
    }
    // share
    return Math.max(0, Math.min(100, topic.currentSoA ?? (topic.soA * 20)));
  }, [metricType]);

  // Prepare topics data - ensure current values are present (no limit, show all selected topics)
  // Also filter by category if one is selected
  const preparedTopics = useMemo(() => {
    let filtered = [...topics];

    // Apply category filter if one is selected
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(topic => topic.category === selectedCategory);
    }

    return filtered
      .map(topic => ({
        ...topic,
        // Keep SoA for share view; charts will use metricType to pick the right number.
        currentSoA: topic.currentSoA ?? (topic.soA * 20),
      }))
      .sort((a, b) => getMetricValue(b) - getMetricValue(a));
  }, [topics, selectedCategory, getMetricValue]);

  const handleChartTypeChange = useCallback((type: ChartType) => {
    setChartType(type);
  }, []);

  const handleTopicClick = useCallback((topic: Topic) => {
    setSelectedTopic(topic);
    setIsModalOpen(true);
    onTopicClick?.(topic);
  }, [onTopicClick]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTopic(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm">
        <div className="p-6">
          <div className="h-[600px] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4"></div>
              <p className="text-sm text-[var(--text-caption)]">Loading chart data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!preparedTopics || preparedTopics.length === 0) {
    return (
      <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm">
        <div className="p-6">
          <div className="h-[600px] flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-[var(--text-headings)] mb-2">
                Select topics to visualize
              </p>
              <p className="text-sm text-[var(--text-caption)]">
                Use the checkboxes in the table below to select topics and view them in the chart
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Map chart type from selector format to component format
  const mapChartType = (type: 'racing' | 'bar' | 'line'): ChartType => {
    if (type === 'racing') return 'racing-bar';
    return type;
  };

  const mapChartTypeReverse = (type: ChartType): 'racing' | 'bar' | 'line' => {
    if (type === 'racing-bar') return 'racing';
    return type;
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm">
      {/* Chart Type Selector and Controls */}
      <div className="p-4 border-b border-[var(--border-default)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <TopicsChartTypeSelector
            activeChart={mapChartTypeReverse(chartType)}
            onChartChange={(type) => handleChartTypeChange(mapChartType(type))}
          />
          {/* Always show competitor filter if handlers are available (competitors may be loading) */}
          {onCompetitorToggle && onSelectAllCompetitors && onDeselectAllCompetitors && (
            <CompetitorFilter
              competitors={managedCompetitors}
              selectedCompetitors={selectedCompetitors}
              onCompetitorToggle={onCompetitorToggle}
              onSelectAll={onSelectAllCompetitors}
              onDeselectAll={onDeselectAllCompetitors}
              isLoading={isLoadingCompetitors}
            />
          )}
        </div>

        {/* Export Control */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {onHelpClick && (
            <HelpButton
              onClick={() => onHelpClick('topics-chart-guide')}
              className="p-2 flex-shrink-0"
              size={18}
              label="Chart Guide"
            />
          )}
        </div>
      </div>

      {/* Chart Container with Fade Transition */}
      <div className="relative" style={{ minHeight: '600px' }}>
        <div
          key={chartType}
          className="transition-opacity duration-200"
          style={{
            opacity: 1,
            position: 'relative',
          }}
        >
          {chartType === 'racing-bar' && (
            <TopicsRacingBarChart
              topics={preparedTopics}
              onBarClick={handleTopicClick}
              competitors={competitors}
              brandFavicon={brandFavicon}
              brandName={brandName}
              managedCompetitors={managedCompetitors}
              selectedCompetitors={selectedCompetitors}
              metricType={metricType}
            />
          )}
          {chartType === 'bar' && (
            <TopicsBarChart
              topics={preparedTopics}
              onBarClick={handleTopicClick}
              competitors={competitors}
              selectedCompetitor={selectedCompetitor}
              managedCompetitors={managedCompetitors}
              selectedCompetitors={selectedCompetitors}
              metricType={metricType}
            />
          )}
          {chartType === 'line' && (
            <TopicsAreaChart
              topics={preparedTopics}
              onBarClick={handleTopicClick}
              metricType={metricType}
            />
          )}
        </div>
      </div>

      {/* Topic Detail Modal */}
      <TopicDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        topic={selectedTopic}
        metricType={metricType}
      />
    </div>
  );
};

