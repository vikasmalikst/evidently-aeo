import { useEffect, useMemo, useState, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { IconX, IconTarget, IconFilter, IconTrendingUp } from '@tabler/icons-react';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/apiClient';
import { ApiResponse } from '../types';
import { useChartResize } from '../hooks/useChartResize';

// Design tokens
const COLORS = {
  brand: '#06c686',
  contested: '#f9db43',
  competitor: '#f94343',
  trending: '#498cf9',
  unclaimed: '#c6c9d2',
  bgPrimary: '#ffffff',
  bgSecondary: '#f4f4f6',
  textHeadings: '#1a1d29',
  textBody: '#212534',
  accentPrimary: '#00bcdc',
  gridLines: '#e8e9ed',
};

const LLM_PROVIDERS = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Bing Copilot', 'Grok'];

interface KeywordData {
  keyword: string;
  searchVolume: number;
  ownership: number;
  mentions: number;
  categories: ('brand' | 'competitor' | 'trending')[];
  llmProviders: string[];
  previousPosition?: {
    searchVolume: number;
    ownership: number;
  };
  sourceDetail: {
    brandMentions: number;
    competitorMentions: number;
    trendingMentions: number;
  };
}

// API payload shape from backend
interface KeywordAnalyticsItem {
  keyword: string;
  mentions: number;
  volume: number;
  brandPositions: number;
  competitorPositions: number;
  sources: string[];
}
interface KeywordAnalyticsPayload {
  keywords: KeywordAnalyticsItem[];
  startDate?: string;
  endDate?: string;
}

const getKeywordColor = (keyword: KeywordData): string => {
  if (keyword.categories.includes('brand')) return COLORS.brand;
  if (keyword.categories.includes('contested')) return COLORS.contested;
  if (keyword.categories.includes('competitor')) return COLORS.competitor;
  if (keyword.categories.includes('trending')) return COLORS.trending;
  return COLORS.unclaimed;
};

const getQuadrant = (keyword: KeywordData): string => {
  const highVolume = keyword.searchVolume > 10000;
  const highOwnership = keyword.ownership > 50;

  if (highOwnership && highVolume) return 'Golden Keywords';
  if (!highOwnership && highVolume) return 'Opportunity Zone';
  if (highOwnership && !highVolume) return 'Niche Dominance';
  return 'Low Priority';
};

const formatCount = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
};

interface DetailPanelProps {
  keyword: KeywordData;
  onClose: () => void;
}

const DetailPanel = ({ keyword, onClose }: DetailPanelProps) => (
  <div
    style={{
      position: 'fixed',
      right: 0,
      top: 0,
      height: '100vh',
      width: '420px',
      backgroundColor: COLORS.bgPrimary,
      borderLeft: `1px solid ${COLORS.gridLines}`,
      boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      zIndex: 1000,
      overflowY: 'auto',
    }}
  >
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: COLORS.textHeadings, margin: 0 }}>
          {keyword.keyword}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textBody,
            padding: '4px',
          }}
        >
          <IconX size={20} />
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Quadrant</div>
        <div
          style={{
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: `${getKeywordColor(keyword)}20`,
            color: getKeywordColor(keyword),
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          {getQuadrant(keyword)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Search Volume</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.textHeadings }}>
            {(keyword.searchVolume / 1000).toFixed(1)}k
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Ownership</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.textHeadings }}>
            {keyword.ownership}%
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Total Mentions</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.textHeadings }}>
            {keyword.mentions}
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>LLM Sources</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.textHeadings }}>
            {keyword.llmProviders.length}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '12px' }}>
          LLM Sources
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {keyword.llmProviders.map((provider) => (
            <span
              key={provider}
              style={{
                padding: '4px 10px',
                backgroundColor: COLORS.bgSecondary,
                borderRadius: '4px',
                fontSize: '12px',
                color: COLORS.textBody,
              }}
            >
              {provider}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '12px' }}>
          Mention Breakdown
        </div>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Brand Mentions</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.brand }}>
              {keyword.sourceDetail.brandMentions}
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: COLORS.bgSecondary, borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: COLORS.brand,
                width: `${(keyword.sourceDetail.brandMentions / keyword.mentions) * 100}%`,
              }}
            />
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Competitor Mentions</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.competitor }}>
              {keyword.sourceDetail.competitorMentions}
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: COLORS.bgSecondary, borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: COLORS.competitor,
                width: `${(keyword.sourceDetail.competitorMentions / keyword.mentions) * 100}%`,
              }}
            />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Trending Mentions</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.trending }}>
              {keyword.sourceDetail.trendingMentions}
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: COLORS.bgSecondary, borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: COLORS.trending,
                width: `${(keyword.sourceDetail.trendingMentions / keyword.mentions) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '12px' }}>
          Categories
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {keyword.categories.map((category) => (
            <span
              key={category}
              style={{
                padding: '4px 10px',
                backgroundColor: `${category === 'brand' ? COLORS.brand : category === 'competitor' ? COLORS.competitor : COLORS.trending}20`,
                color: category === 'brand' ? COLORS.brand : category === 'competitor' ? COLORS.competitor : COLORS.trending,
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {keyword.previousPosition && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f0f9ff',
            border: `1px solid #bae6fd`,
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>
            Position Change
          </div>
          <div style={{ fontSize: '12px', color: '#0c4a6e' }}>
            Volume: {keyword.previousPosition.searchVolume} → {keyword.searchVolume}
            ({keyword.searchVolume > keyword.previousPosition.searchVolume ? '+' : ''}
            {keyword.searchVolume - keyword.previousPosition.searchVolume})
          </div>
          <div style={{ fontSize: '12px', color: '#0c4a6e' }}>
            Ownership: {keyword.previousPosition.ownership}% → {keyword.ownership}%
            ({keyword.ownership > keyword.previousPosition.ownership ? '+' : ''}
            {keyword.ownership - keyword.previousPosition.ownership}%)
          </div>
        </div>
      )}
    </div>
  </div>
);

export const Keywords = () => {
  const authLoading = useAuthStore((state) => state.isLoading);
  const { selectedBrandId, brands, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
  const [loading, setLoading] = useState(false);
  const [keywordData, setKeywordData] = useState<KeywordData[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | null>(null);
  const [showMovement, setShowMovement] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [llmFilter, setLlmFilter] = useState<string>('all');
  const [quadrantFilter, setQuadrantFilter] = useState<string>('all');
  const chartRef = useRef<any>(null);

  // Fetch real keyword analytics
  useEffect(() => {
    const fetchKeywords = async () => {
      if (authLoading || brandsLoading || !selectedBrandId) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        // optional: add date range later
        const endpoint = `/brands/${selectedBrandId}/keywords?${params.toString()}`;
        const response = await apiClient.request<ApiResponse<KeywordAnalyticsPayload>>(endpoint);
        if (response.success && response.data) {
          const items = response.data.keywords || [];
          // Map to visualization model
          const maxVolume = items.reduce((m, x) => Math.max(m, x.volume), 1);
          const mapped: KeywordData[] = items.map((it) => {
            // Ownership is average brand share across all brand positions (where competitor_name is null)
            const ownership = it.volume > 0 ? Math.round((it.brandPositions / it.volume) * 100) : 0;
            const searchVolume = it.volume; // volume = positions where competitor_name is null (brand positions only)
            const categories: ('brand' | 'competitor' | 'trending')[] = [];
            if (ownership > 60) categories.push('brand');
            if (ownership > 30 && ownership < 70) categories.push('contested');
            if (ownership < 40) categories.push('competitor');
            if (it.volume >= Math.max(5, Math.ceil(0.75 * maxVolume))) categories.push('trending');
            const trendingMentions = Math.max(0, it.volume - it.brandPositions - it.competitorPositions);
            return {
              keyword: it.keyword,
              searchVolume,
              ownership,
              mentions: it.mentions,
              categories,
              llmProviders: it.sources || [],
              sourceDetail: {
                brandMentions: it.brandPositions,
                competitorMentions: it.competitorPositions,
                trendingMentions
              }
            };
          });
          setKeywordData(mapped);
        } else {
          setKeywordData([]);
        }
      } catch (e) {
        console.error('Failed to load keyword analytics', e);
        setKeywordData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchKeywords();
  }, [authLoading, brandsLoading, selectedBrandId]);

  const filteredData = useMemo(() => {
    return keywordData.filter((kw) => {
      if (categoryFilter !== 'all' && !kw.categories.includes(categoryFilter as any)) return false;
      if (llmFilter !== 'all' && !kw.llmProviders.includes(llmFilter)) return false;
      if (quadrantFilter !== 'all' && getQuadrant(kw) !== quadrantFilter) return false;
      return true;
    });
  }, [keywordData, categoryFilter, llmFilter, quadrantFilter]);

  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, !loading && filteredData.length > 0);

  const chartData = {
    datasets: filteredData.map((kw) => {
      const datasets: any[] = [{
        label: kw.keyword,
        data: [{
          x: kw.searchVolume,
          y: kw.ownership,
          r: Math.sqrt(kw.mentions) * 1.5,
        }],
        backgroundColor: `${getKeywordColor(kw)}cc`,
        borderColor: getKeywordColor(kw),
        borderWidth: 2,
      }];

      if (showMovement && kw.previousPosition) {
        datasets.push({
          label: `${kw.keyword} (previous)`,
          data: [{
            x: kw.previousPosition.searchVolume,
            y: kw.previousPosition.ownership,
            r: Math.sqrt(kw.mentions) * 1.5,
          }],
          backgroundColor: 'transparent',
          borderColor: getKeywordColor(kw),
          borderWidth: 2,
          borderDash: [5, 5],
        });
      }

      return datasets;
    }).flat(),
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: COLORS.bgPrimary,
        titleColor: COLORS.textHeadings,
        bodyColor: COLORS.textBody,
        borderColor: COLORS.gridLines,
        borderWidth: 1,
        padding: 12,
        callbacks: {
          title: (items: any[]) => {
            const datasetLabel = items[0].dataset.label;
            return datasetLabel.replace(' (previous)', '');
          },
          label: (context: any) => {
            const kw = filteredData.find(k => k.keyword === context.dataset.label || k.keyword === context.dataset.label.replace(' (previous)', ''));
            if (!kw) return '';
            return [
              `Ownership: ${kw.ownership}%`,
              `Positions (volume): ${kw.searchVolume.toLocaleString()}`,
              `Responses: ${kw.mentions.toLocaleString()}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Positions (Volume)',
          font: { size: 13, weight: '600' },
          color: COLORS.textBody,
        },
        grid: { color: COLORS.gridLines },
        ticks: {
          color: '#64748b',
          callback: (value: number) => `${value}`,
        },
        min: 0,
        // dynamic max from data
        max: Math.max(10, Math.ceil((filteredData.reduce((m, k) => Math.max(m, k.searchVolume), 0) || 10) * 1.1)),
      },
      y: {
        title: {
          display: true,
          text: 'Brand Ownership %',
          font: { size: 13, weight: '600' },
          color: COLORS.textBody,
        },
        grid: { color: COLORS.gridLines },
        ticks: {
          color: '#64748b',
          callback: (value: number) => `${value}%`,
        },
        min: 0,
        max: 100,
      },
    },
    onClick: (event: any, elements: any[]) => {
      if (elements.length > 0) {
        const datasetIndex = elements[0].datasetIndex;
        const dataset = chartData.datasets[datasetIndex];
        const keywordLabel = dataset.label.replace(' (previous)', '');
        const keyword = filteredData.find(k => k.keyword === keywordLabel);
        if (keyword) setSelectedKeyword(keyword);
      }
    },
  };

  const quadrantPlugin = {
    id: 'quadrantPlugin',
    beforeDraw: (chart: any) => {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;

      const xMid = xScale.getPixelForValue(10000);
      const yMid = yScale.getPixelForValue(50);

      ctx.save();
      ctx.strokeStyle = COLORS.gridLines;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      ctx.beginPath();
      ctx.moveTo(xMid, chartArea.top);
      ctx.lineTo(xMid, chartArea.bottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(chartArea.left, yMid);
      ctx.lineTo(chartArea.right, yMid);
      ctx.stroke();

      ctx.restore();

      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';

      ctx.fillText('Golden Keywords', (xMid + chartArea.right) / 2, chartArea.top + 20);
      ctx.fillText('Niche Dominance', (chartArea.left + xMid) / 2, chartArea.top + 20);
      ctx.fillText('Opportunity Zone', (xMid + chartArea.right) / 2, chartArea.bottom - 10);
      ctx.fillText('Low Priority', (chartArea.left + xMid) / 2, chartArea.bottom - 10);
    },
  };

  ChartJS.register(quadrantPlugin);

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <IconTarget size={28} color={COLORS.accentPrimary} />
            <h1 style={{ fontSize: '28px', fontWeight: '600', color: COLORS.textHeadings, margin: 0 }}>
              Keyword Strategic Matrix
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Analyze keyword positioning across search volume and brand ownership to identify strategic opportunities
          </p>
        </div>

        <div
          style={{
            backgroundColor: COLORS.bgPrimary,
            border: `1px solid ${COLORS.gridLines}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            {brands.length > 1 && selectedBrandId && (
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Brand
                </label>
                <select
                  value={selectedBrandId}
                  onChange={(e) => selectBrand(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${COLORS.gridLines}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    backgroundColor: COLORS.bgPrimary,
                    color: COLORS.textBody,
                    cursor: 'pointer',
                  }}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${COLORS.gridLines}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  backgroundColor: COLORS.bgPrimary,
                  color: COLORS.textBody,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Categories</option>
                <option value="brand">Brand</option>
                <option value="competitor">Competitor</option>
                <option value="trending">Trending</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                LLM Source
              </label>
              <select
                value={llmFilter}
                onChange={(e) => setLlmFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${COLORS.gridLines}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  backgroundColor: COLORS.bgPrimary,
                  color: COLORS.textBody,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Sources</option>
                {LLM_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Quadrant
              </label>
              <select
                value={quadrantFilter}
                onChange={(e) => setQuadrantFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${COLORS.gridLines}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  backgroundColor: COLORS.bgPrimary,
                  color: COLORS.textBody,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Quadrants</option>
                <option value="Golden Keywords">Golden Keywords</option>
                <option value="Opportunity Zone">Opportunity Zone</option>
                <option value="Niche Dominance">Niche Dominance</option>
                <option value="Low Priority">Low Priority</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                &nbsp;
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showMovement}
                  onChange={(e) => setShowMovement(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: COLORS.textBody }}>
                  Show change over last period
                </span>
              </label>
            </div>
          </div>

          <div style={{ height: '600px', position: 'relative' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-caption)]">
                Loading keywords…
              </div>
            ) : (
              <Scatter data={chartData} options={options} ref={chartRef} />
            )}
          </div>
        </div>

        <div
          style={{
            backgroundColor: COLORS.bgPrimary,
            border: `1px solid ${COLORS.gridLines}`,
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '16px' }}>
            Keyword Details
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLORS.gridLines}` }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    Keyword
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    Volume
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    Ownership
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    LLM Sources
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((kw, idx) => (
                  <tr
                    key={kw.keyword}
                    onClick={() => setSelectedKeyword(kw)}
                    style={{
                      backgroundColor: idx % 2 === 0 ? COLORS.bgPrimary : COLORS.bgSecondary,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e6f7f1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = idx % 2 === 0 ? COLORS.bgPrimary : COLORS.bgSecondary;
                    }}
                  >
                    <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textBody, fontWeight: '500' }}>
                      {kw.keyword}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textBody, textAlign: 'right' }}>
                      {formatCount(kw.searchVolume)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textBody, textAlign: 'right', fontWeight: '600' }}>
                      {kw.ownership}%
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                      {kw.llmProviders.length > 0 ? kw.llmProviders.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedKeyword && (
          <DetailPanel keyword={selectedKeyword} onClose={() => setSelectedKeyword(null)} />
        )}
      </div>
    </Layout>
  );
};
