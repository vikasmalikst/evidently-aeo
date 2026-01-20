import { useEffect, useMemo, useState, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useAuthStore } from '../store/authStore';
import { useManualBrandDashboard } from '../manual-dashboard/useManualBrandDashboard';
import { apiClient } from '../lib/apiClient';
import { IconX } from '@tabler/icons-react';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

// Color palette
const COLORS = {
  brand: '#10B981',
  competitor: '#EF4444',
  contested: '#F59E0B',
  bgPrimary: '#ffffff',
  bgSecondary: '#f8fafc',
  textHeadings: '#1e293b',
  textBody: '#334155',
  gridLines: '#e2e8f0',
};

interface AuthState {
  isLoading: boolean;
}

interface Brand {
  id: string;
  name: string;
}

interface GraphKeywordData {
  keyword: string;
  sentiment: number;
  sentimentLabel: string;
  strength: number;
  narrative?: string;
  mentions: number;
  positiveVotes: number;
  negativeVotes: number;
  neutralVotes: number;
}

const DetailPanel = ({ keyword, onClose }: { keyword: GraphKeywordData; onClose: () => void }) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '400px',
      height: '100vh',
      backgroundColor: COLORS.bgPrimary,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      zIndex: 1000,
      padding: '24px',
      overflowY: 'auto',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', color: COLORS.textHeadings }}>
        {keyword.keyword}
      </h3>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <IconX size={20} />
      </button>
    </div>

    {/* Sentiment Badge */}
    <div style={{ marginBottom: '24px' }}>
      <span
        style={{
          display: 'inline-block',
          padding: '6px 14px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: '600',
          backgroundColor:
            keyword.sentimentLabel === 'POSITIVE'
              ? '#dcfce7'
              : keyword.sentimentLabel === 'NEGATIVE'
              ? '#fee2e2'
              : '#fef9c3',
          color:
            keyword.sentimentLabel === 'POSITIVE'
              ? '#16a34a'
              : keyword.sentimentLabel === 'NEGATIVE'
              ? '#dc2626'
              : '#ca8a04',
        }}
      >
        {keyword.sentimentLabel}
      </span>
    </div>

    {/* Score & Strength */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
      <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Sentiment Score</div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: keyword.sentiment >= 50 ? COLORS.brand : COLORS.competitor }}>
          {keyword.sentiment}
        </div>
      </div>
      <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Centrality (PageRank)</div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.textHeadings }}>
          {keyword.strength}
        </div>
      </div>
    </div>

    {/* Narrative */}
    {keyword.narrative && (
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '8px' }}>
          Narrative Cluster
        </h4>
        <span style={{
          display: 'inline-block',
          padding: '6px 12px',
          backgroundColor: '#e0e7ff',
          color: '#4f46e5',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          {keyword.narrative}
        </span>
      </div>
    )}

    <p style={{ fontSize: '13px', color: '#64748b', backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '8px' }}>
      <strong>How PageRank works:</strong> Keywords are ranked by their importance in the graph based on 
      how many connections they have and how important those connected nodes are. Higher strength = more central/important keyword.
    </p>
  </div>
);

export const SentimentLandscape2 = () => {
  const authLoading = useAuthStore((state: AuthState) => state.isLoading);
  const { selectedBrandId, brands, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GraphKeywordData[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<GraphKeywordData | null>(null);
  const chartRef = useRef<any>(null);

  // Fetch graph-based keyword data
  useEffect(() => {
    const fetchData = async () => {
      if (authLoading || brandsLoading || !selectedBrandId) return;
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          brandId: selectedBrandId,
          limit: '30',
          source: selectedSource
        });
        
        const result = await apiClient.get<any>(
          `/recommendations-v3/analyze/keyword-mapping-graph?${queryParams.toString()}`
        );
        if (result.success) {
          setData(result.data || []);
          if (result.sources) {
            setAvailableSources(result.sources);
          }
        } else {
          console.error('API Error:', result.error);
          setData([]);
        }
      } catch (error) {
        console.error('Error fetching graph keyword data:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBrandId, selectedSource, authLoading, brandsLoading]);

  // Chart data - X: Sentiment, Y: Strength (PageRank centrality)
  const chartData = {
    datasets: data.map((kw) => ({
      label: kw.keyword,
      data: [{
        x: kw.sentiment,
        y: kw.strength,
        r: Math.min(20, 8 + kw.strength / 5)
      }],
      backgroundColor: kw.sentimentLabel === 'POSITIVE' ? COLORS.brand : kw.sentimentLabel === 'NEGATIVE' ? COLORS.competitor : COLORS.contested,
      borderColor: '#fff',
      borderWidth: 1
    }))
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: COLORS.bgPrimary,
        titleColor: COLORS.textHeadings,
        bodyColor: COLORS.textBody,
        borderColor: COLORS.gridLines,
        borderWidth: 1,
        padding: 12,
        callbacks: {
          title: (items: any[]) => items[0].dataset.label,
          label: (context: any) => {
            const kw = data.find(k => k.keyword === context.dataset.label);
            if (!kw) return '';
            return [
              `Sentiment: ${kw.sentimentLabel} (${kw.sentiment})`,
              `Centrality: ${kw.strength}`,
              kw.narrative || ''
            ].filter(Boolean);
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Sentiment Score (0-100)',
          font: { size: 13, weight: '600' },
          color: COLORS.textBody,
        },
        grid: { color: COLORS.gridLines },
        min: 0,
        max: 100,
      },
      y: {
        title: {
          display: true,
          text: 'Centrality / Importance (PageRank)',
          font: { size: 13, weight: '600' },
          color: COLORS.textBody,
        },
        grid: { color: COLORS.gridLines },
        min: 0,
        max: 100,
      }
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0) {
        const datasetIndex = elements[0].datasetIndex;
        const dataset = chartData.datasets[datasetIndex];
        const kw = data.find(k => k.keyword === dataset.label);
        if (kw) setSelectedKeyword(kw);
      }
    }
  };

  if (authLoading || brandsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: COLORS.textHeadings, marginBottom: '8px' }}>
            Sentiment Graph (PageRank Analysis)
          </h1>
          <p style={{ fontSize: '15px', color: COLORS.textBody }}>
            Top keywords ranked by <strong>PageRank centrality</strong>. X-axis = Sentiment, Y-axis = Importance in the brand graph.
          </p>
        </div>

        <div style={{ marginBottom: '24px', display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: COLORS.textHeadings, display: 'block', marginBottom: '8px' }}>
              Brand
            </label>
            <select
              value={selectedBrandId || ''}
              onChange={(e) => {
                selectBrand(e.target.value);
                setSelectedSource(''); // Reset source when brand changes
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.gridLines}`,
                fontSize: '14px',
                minWidth: '200px'
              }}
            >
              {brands.map((brand: Brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: COLORS.textHeadings, display: 'block', marginBottom: '8px' }}>
              Source / Domain
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: `1px solid ${COLORS.gridLines}`,
                fontSize: '14px',
                minWidth: '200px'
              }}
            >
              <option value="">All Sources</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Methodology Explanation */}
        <div style={{ 
          marginBottom: '32px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '12px', 
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: COLORS.textHeadings, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ backgroundColor: '#e0e7ff', padding: '4px', borderRadius: '4px', color: '#4f46e5' }}>ℹ️</span> 
            How to read this chart
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div>
              <div style={{ fontWeight: '600', color: COLORS.textHeadings, marginBottom: '4px' }}>Sentiment Score (X-Axis)</div>
              <p style={{ fontSize: '13px', color: COLORS.textBody, margin: 0 }}>
                Calculated based on <strong>graph proximity</strong>. A score of 100 means the keyword is exclusively connected to POSITIVE concepts in the conversation network. It is not a simple average, but a measure of semantic alignment.
              </p>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: COLORS.textHeadings, marginBottom: '4px' }}>Centrality / Strength (Y-Axis)</div>
              <p style={{ fontSize: '13px', color: COLORS.textBody, margin: 0 }}>
                Derived using <strong>PageRank</strong>. A higher score means the keyword is a "hub" that connects many topics or appears in highly influential contexts. These are the most important themes driving the brand perception.
              </p>
            </div>
            <div>
              <div style={{ fontWeight: '600', color: COLORS.textHeadings, marginBottom: '4px' }}>Narrative Clusters</div>
              <p style={{ fontSize: '13px', color: COLORS.textBody, margin: 0 }}>
                Keywords are grouped into <strong>Narratives</strong> (shown in tooltips & table) using community detection algorithms, revealing distinct story arcs or discussion topics.
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div
          style={{
            backgroundColor: COLORS.bgPrimary,
            border: `1px solid ${COLORS.gridLines}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <div style={{ height: '500px', position: 'relative' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-caption)]">
                Building graph and running PageRank…
              </div>
            ) : data.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                No keyword data found. Make sure there are LLM responses with extracted keywords.
              </div>
            ) : (
              <Bubble data={chartData} options={options} ref={chartRef} />
            )}
          </div>
          
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '13px', color: COLORS.textBody }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.brand }}></span>
              Positive Sentiment
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.contested }}></span>
              Neutral Sentiment
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.competitor }}></span>
              Negative Sentiment
            </span>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            backgroundColor: COLORS.bgPrimary,
            border: `1px solid ${COLORS.gridLines}`,
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '16px' }}>
            Top Keywords by PageRank Centrality
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.gridLines}` }}>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Keyword</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Sentiment</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Score</th>
                <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Centrality</th>
                <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Narrative</th>
              </tr>
            </thead>
            <tbody>
              {data.map((kw, idx) => (
                <tr
                  key={kw.keyword}
                  onClick={() => setSelectedKeyword(kw)}
                  style={{
                    backgroundColor: idx % 2 === 0 ? COLORS.bgPrimary : COLORS.bgSecondary,
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textBody, fontWeight: '500' }}>{kw.keyword}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: kw.sentimentLabel === 'POSITIVE' ? '#dcfce7' : kw.sentimentLabel === 'NEGATIVE' ? '#fee2e2' : '#fef9c3',
                      color: kw.sentimentLabel === 'POSITIVE' ? '#16a34a' : kw.sentimentLabel === 'NEGATIVE' ? '#dc2626' : '#ca8a04',
                    }}>
                      {kw.sentimentLabel}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: kw.sentiment >= 50 ? COLORS.brand : COLORS.competitor, textAlign: 'center', fontWeight: '600' }}>{kw.sentiment}</td>
                  <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textHeadings, textAlign: 'center', fontWeight: '700' }}>{kw.strength}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>{kw.narrative || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedKeyword && <DetailPanel keyword={selectedKeyword} onClose={() => setSelectedKeyword(null)} />}
      </div>
    </Layout>
  );
};

export default SentimentLandscape2;
