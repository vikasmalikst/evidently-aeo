import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { RefreshCw } from 'lucide-react';
import { KeyMetricsCards } from '../components/Sources/KeyMetricsCards';
import { MentionRateChart } from '../components/Sources/MentionRateChart';
import { CompetitorComparisonChart } from '../components/Sources/CompetitorComparisonChart';
import { AvgPositionChart } from '../components/Sources/AvgPositionChart';
import { SourceBreakdownTable } from '../components/Sources/SourceBreakdownTable';
import { InsightsPanel } from '../components/Sources/InsightsPanel';
import { mockSourcesData } from '../data/mockSourcesData';

export const AISources = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(mockSourcesData);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setData(mockSourcesData);
      setLoading(false);
    }, 500);
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-secondary)] rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-[var(--bg-secondary)] rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">AI Sources</h1>
            <p className="text-[var(--text-caption)]">
              Track your brand presence across different AI search engines
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            <RefreshCw size={18} />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>

        <KeyMetricsCards sources={data.sources} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MentionRateChart sources={data.sources} />
          <AvgPositionChart sources={data.sources} />
        </div>

        <div className="mb-6">
          <CompetitorComparisonChart sources={data.sources} />
        </div>

        <div className="mb-6">
          <SourceBreakdownTable sources={data.sources} />
        </div>

        <InsightsPanel insights={data.insights} />
      </div>
    </Layout>
  );
};
