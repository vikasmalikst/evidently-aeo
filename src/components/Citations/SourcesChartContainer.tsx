import { useState } from 'react';
import { ChartTypeSelector } from './ChartTypeSelector';
import { SourcesRacingChart } from './SourcesRacingChart';
import { SourcesDonutChart } from './SourcesDonutChart';
import { SourcesBarChart } from './SourcesBarChart';
import { SourcesLineChart } from './SourcesLineChart';

interface SourcesChartContainerProps {
  racingChartData: {
    timePoints: string[];
    sources: Array<{
      domain: string;
      type: string;
      data: number[];
      color: string;
    }>;
  };
  categories?: string[];
  onExport?: () => void;
}

export const SourcesChartContainer = ({ 
  racingChartData, 
  categories = [],
  onExport 
}: SourcesChartContainerProps) => {
  const [activeChart, setActiveChart] = useState<'donut' | 'racing' | 'bar' | 'line'>('racing');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [timeSeries, setTimeSeries] = useState('weekly');

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Default export behavior
      console.log('Exporting chart data...', { activeChart, selectedCategory, timeSeries });
    }
  };

  const renderChart = () => {
    switch (activeChart) {
      case 'donut':
        return <SourcesDonutChart racingChartData={racingChartData} />;
      case 'racing':
        return <SourcesRacingChart racingChartData={racingChartData} />;
      case 'bar':
        return <SourcesBarChart racingChartData={racingChartData} />;
      case 'line':
        return <SourcesLineChart racingChartData={racingChartData} />;
      default:
        return <SourcesRacingChart racingChartData={racingChartData} />;
    }
  };

  return (
    <div>
      <ChartTypeSelector
        activeChart={activeChart}
        onChartChange={setActiveChart}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        timeSeries={timeSeries}
        onTimeSeriesChange={setTimeSeries}
        onExport={handleExport}
      />
      {renderChart()}
    </div>
  );
};

