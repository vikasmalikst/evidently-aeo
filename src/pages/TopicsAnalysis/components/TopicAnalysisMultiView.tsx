import { useState, useMemo, useCallback } from 'react';
import { Download } from 'lucide-react';
import { TopicsRacingBarChart } from './TopicsRacingBarChart';
import { TopicsBarChart } from './TopicsBarChart';
import { TopicsLineChart } from './TopicsLineChart';
import { TopicsChartTypeSelector } from './TopicsChartTypeSelector';
import { TopicDetailModal } from './TopicDetailModal';
import type { Topic } from '../types';

export type ChartType = 'racing-bar' | 'bar' | 'line';

interface TopicAnalysisMultiViewProps {
  topics: Topic[];
  isLoading?: boolean;
  onTopicClick?: (topic: Topic) => void;
  defaultChartType?: ChartType;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  selectedDateRange?: string;
  selectedCountry?: string;
  onExport?: () => void;
}

export const TopicAnalysisMultiView = ({
  topics,
  isLoading = false,
  onTopicClick,
  defaultChartType = 'racing-bar',
  categories = [],
  selectedCategory: externalSelectedCategory,
  onCategoryChange,
  selectedDateRange,
  selectedCountry,
  onExport,
}: TopicAnalysisMultiViewProps) => {
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<string>('all');
  
  const selectedCategory = externalSelectedCategory ?? internalSelectedCategory;
  
  const handleCategoryChange = useCallback((category: string) => {
    if (onCategoryChange) {
      onCategoryChange(category);
    } else {
      setInternalSelectedCategory(category);
    }
  }, [onCategoryChange]);

  // Prepare topics data - ensure currentSoA is set (no limit, show all selected topics)
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
        currentSoA: topic.currentSoA ?? (topic.soA * 20), // Convert 0-5x to 0-100%
      }))
      .sort((a, b) => (b.currentSoA ?? 0) - (a.currentSoA ?? 0));
  }, [topics, selectedCategory]);

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
        <TopicsChartTypeSelector
          activeChart={mapChartTypeReverse(chartType)}
          onChartChange={(type) => handleChartTypeChange(mapChartType(type))}
        />
        
        {/* Export Control */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-full transition-all duration-200 bg-transparent text-[#6c7289] hover:text-[#212534] flex-shrink-0"
              title="Export"
              aria-label="Export data"
            >
              <Download size={18} />
            </button>
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
            />
          )}
          {chartType === 'bar' && (
            <TopicsBarChart
              topics={preparedTopics}
              onBarClick={handleTopicClick}
            />
          )}
          {chartType === 'line' && (
            <TopicsLineChart
              topics={preparedTopics}
              onBarClick={handleTopicClick}
              selectedDateRange={selectedDateRange}
            />
          )}
        </div>
      </div>

      {/* Topic Detail Modal */}
      <TopicDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        topic={selectedTopic}
      />
    </div>
  );
};

