import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { VisibilityTabs } from '../components/Visibility/VisibilityTabs';
import { ChartControls } from '../components/Visibility/ChartControls';
import { VisibilityChart } from '../components/Visibility/VisibilityChart';
import { VisibilityTable } from '../components/Visibility/VisibilityTable';
import '../styles/visibility.css';

interface ModelData {
  id: string;
  name: string;
  score: number;
  shareOfSearch: number;
  shareOfSearchChange?: number;
  topTopic: string;
  change?: number;
  referenceCount: number;
  data: number[];
}

const brandModels: ModelData[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    score: 87,
    shareOfSearch: 92,
    shareOfSearchChange: 3,
    topTopic: 'AI Assistants',
    change: 5,
    referenceCount: 342,
    data: [65, 68, 72, 75, 80, 85, 87]
  },
  {
    id: 'claude',
    name: 'Claude',
    score: 82,
    shareOfSearch: 88,
    shareOfSearchChange: 4,
    topTopic: 'Large Language Models',
    change: 3,
    referenceCount: 298,
    data: [60, 63, 67, 70, 75, 80, 82]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    score: 78,
    shareOfSearch: 85,
    shareOfSearchChange: -1,
    topTopic: 'AI Search',
    change: -2,
    referenceCount: 267,
    data: [70, 72, 71, 73, 75, 77, 78]
  },
  {
    id: 'google-search',
    name: 'Google AI Search',
    score: 75,
    shareOfSearch: 80,
    shareOfSearchChange: 2,
    topTopic: 'Search Results',
    change: 1,
    referenceCount: 245,
    data: [72, 73, 74, 74, 75, 75, 75]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    score: 72,
    shareOfSearch: 78,
    shareOfSearchChange: 5,
    topTopic: 'Research Tools',
    change: 4,
    referenceCount: 223,
    data: [55, 58, 62, 65, 68, 70, 72]
  },
  {
    id: 'grok',
    name: 'Grok',
    score: 68,
    shareOfSearch: 70,
    shareOfSearchChange: 0,
    topTopic: 'Real-time Info',
    change: 0,
    referenceCount: 198,
    data: [65, 65, 66, 66, 67, 68, 68]
  },
  {
    id: 'copilot',
    name: 'MS Copilot',
    score: 65,
    shareOfSearch: 68,
    topTopic: 'Code Generation',
    change: -1,
    referenceCount: 178,
    data: [68, 68, 67, 66, 65, 65, 65]
  }
];

const competitorBrands: ModelData[] = [
  {
    id: 'competitor1',
    name: 'OpenAI',
    score: 89,
    shareOfSearch: 95,
    topTopic: 'AI Leadership',
    change: 2,
    referenceCount: 356,
    data: [85, 86, 87, 88, 88, 89, 89]
  },
  {
    id: 'competitor2',
    name: 'Google DeepMind',
    score: 84,
    shareOfSearch: 90,
    topTopic: 'AI Research',
    change: -1,
    referenceCount: 312,
    data: [86, 86, 85, 85, 84, 84, 84]
  },
  {
    id: 'competitor3',
    name: 'Meta AI',
    score: 76,
    shareOfSearch: 82,
    topTopic: 'Large Models',
    change: 3,
    referenceCount: 267,
    data: [70, 71, 72, 73, 74, 75, 76]
  }
];

export const SearchVisibility = () => {
  const [activeTab, setActiveTab] = useState<'brand' | 'competitive'>('brand');
  const [timeframe, setTimeframe] = useState('weekly');
  const [chartType, setChartType] = useState('line');
  const [region, setRegion] = useState('us');
  const [stacked, setStacked] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loading] = useState(false);

  const currentModels = activeTab === 'brand' ? brandModels : competitorBrands;

  useEffect(() => {
    const defaultSelected = currentModels.slice(0, 5).map((m) => m.id);
    setSelectedModels(defaultSelected);
  }, [activeTab]);

  const handleModelToggle = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: currentModels.map((model) => ({
      id: model.id,
      label: model.name,
      data: model.data
    }))
  };

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden bg-[#f4f4f6]">
        <div className="flex-shrink-0 bg-white border-b border-[#dcdfe5]">
          <div className="px-8 pt-8 pb-0">
            <h1 className="text-3xl font-bold text-[#1a1d29] mb-2">
              Answer Engine Visibility
            </h1>
            <p className="text-base text-[#6c7289] max-w-2xl mb-6">
              Monitor your brand's presence across AI answer engines including ChatGPT, Claude,
              Gemini, and Perplexity. Track visibility trends and compare your performance
              against competitors.
            </p>
          </div>
          <VisibilityTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="flex flex-col flex-1 gap-4 overflow-hidden p-4">
          <div className="flex flex-col flex-[0_0_60%] bg-white rounded-lg overflow-hidden shadow-sm">
            <ChartControls
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartType={chartType}
              onChartTypeChange={setChartType}
              region={region}
              onRegionChange={setRegion}
              stacked={stacked}
              onStackedChange={setStacked}
            />

            <VisibilityChart
              data={chartData}
              chartType={chartType}
              timeframe={timeframe}
              selectedModels={selectedModels}
              loading={loading}
              activeTab={activeTab}
            />
          </div>

          <div className="flex flex-col flex-1 bg-white rounded-lg overflow-hidden shadow-sm">
            <VisibilityTable
              activeTab={activeTab}
              models={currentModels}
              selectedModels={selectedModels}
              onModelToggle={handleModelToggle}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};
