import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SourceTabs } from '../components/Sources/SourceTabs';
import { SourceCoverageHeatmap } from '../components/Sources/SourceCoverageHeatmap';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { IconDownload, IconX, IconChevronUp, IconChevronDown, IconAlertCircle, IconChartBar, IconArrowUpRight } from '@tabler/icons-react';
import { apiClient } from '../lib/apiClient';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

const sourceTypeColors: Record<string, string> = {
  'brand': '#00bcdc',
  'editorial': '#498cf9',
  'corporate': '#fa8a40',
  'reference': '#ac59fb',
  'ugc': '#f155a2',
  'institutional': '#0d7c96'
};

const sourceTypeLabels: Record<string, string> = {
  'brand': 'Your Brand',
  'editorial': 'Editorial',
  'corporate': 'Corporate',
  'reference': 'Reference',
  'ugc': 'User-Generated',
  'institutional': 'Institutional'
};

interface SourceData {
  name: string;
  url: string;
  type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
  mentionRate: number;
  mentionChange: number;
  soa: number;
  soaChange: number;
  sentiment: number;
  sentimentChange: number;
  citations: number;
  topics: string[];
  prompts: string[];
  pages: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface SourceAttributionResponse {
  sources: SourceData[];
  overallMentionRate: number;
  overallMentionChange: number;
  avgSentiment: number;
  avgSentimentChange: number;
  totalSources: number;
  dateRange: { start: string; end: string };
}

type SortField = 'name' | 'type' | 'mentionRate' | 'soa' | 'sentiment' | 'topics' | 'pages' | 'prompts';
type SortDirection = 'asc' | 'desc';

const getDateRangeForTimeRange = (timeRange: string) => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  const days = parseInt(timeRange) || 30;
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
};

export const SearchSources = () => {
  const [activeTab, setActiveTab] = useState<'top-sources' | 'source-coverage'>('top-sources');
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState('all');

  const authLoading = useAuthStore((state) => state.isLoading);
  const {
    brands,
    selectedBrandId,
    selectedBrand,
    isLoading: brandsLoading,
    selectBrand
  } = useManualBrandDashboard();

  // Extract unique topics from all sources for heatmap
  const allTopics = useMemo(() => {
    const topicSet = new Set<string>();
    sourceData.forEach(source => {
      source.topics.forEach(topic => topicSet.add(topic));
    });
    return Array.from(topicSet);
  }, [sourceData]);

  // Generate heatmap data from real source data
  const heatmapData = useMemo(() => {
    const data: Record<string, number[]> = {};
    sourceData.forEach(source => {
      data[source.name] = allTopics.map((topic) => {
        // If source has this topic, use its mention rate, otherwise 0
        return source.topics.includes(topic) ? source.mentionRate : 0;
      });
    });
    return data;
  }, [sourceData, allTopics]);

  const heatmapSources = useMemo(() => {
    return sourceData.map(s => ({
      name: s.name,
      type: s.type,
      url: s.url
    }));
  }, [sourceData]);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30');
  const [hoveredTopics, setHoveredTopics] = useState<string[] | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [modalType, setModalType] = useState<'prompts' | 'pages' | null>(null);
  const [modalData, setModalData] = useState<string[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [sortField, setSortField] = useState<SortField>('mentionRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [overallMentionRate, setOverallMentionRate] = useState<number>(0);
  const [overallMentionChange, setOverallMentionChange] = useState<number>(0);
  const [avgSentiment, setAvgSentiment] = useState<number>(0);
  const [avgSentimentChange, setAvgSentimentChange] = useState<number>(0);
  const [topSource, setTopSource] = useState<SourceData | null>(null);

  // Fetch source data from API
  useEffect(() => {
    if (authLoading || brandsLoading || !selectedBrandId) {
      return;
    }

    let cancelled = false;

    const fetchSourceData = async () => {
      setLoading(true);
      setError(null);

      try {
        const dateRange = getDateRangeForTimeRange(timeRange);
        const params = new URLSearchParams({
          startDate: dateRange.start,
          endDate: dateRange.end
        });

        const endpoint = `/brands/${selectedBrandId}/sources?${params.toString()}`;
        console.log('[SearchSources] Fetching source data from:', endpoint);
        
        const response = await apiClient.request<ApiResponse<SourceAttributionResponse>>(endpoint);

        console.log('[SearchSources] API Response:', response);

        if (!response.success || !response.data) {
          const errorMsg = response.error || response.message || 'Failed to load source data.';
          console.error('[SearchSources] API Error:', errorMsg);
          throw new Error(errorMsg);
        }

        if (!cancelled) {
          console.log('[SearchSources] Received sources:', response.data.sources.length);
          setSourceData(response.data.sources);
          setOverallMentionRate(response.data.overallMentionRate);
          setOverallMentionChange(response.data.overallMentionChange);
          setAvgSentiment(response.data.avgSentiment);
          setAvgSentimentChange(response.data.avgSentimentChange);
          
          // Set top source (highest mention rate)
          if (response.data.sources.length > 0) {
            setTopSource(response.data.sources[0]);
            console.log('[SearchSources] Top source:', response.data.sources[0]);
          } else {
            console.warn('[SearchSources] No sources returned from API');
            setTopSource(null);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load source data.';
        console.error('[SearchSources] Error fetching source data:', err);
        if (!cancelled) {
          setError(message);
          setSourceData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSourceData();

    return () => {
      cancelled = true;
    };
  }, [authLoading, brandsLoading, selectedBrandId, timeRange]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredData = useMemo(() => {
    const filtered = sourceData.filter(source => {
      if (topicFilter !== 'all' && !source.topics.includes(topicFilter)) return false;
      if (sentimentFilter === 'positive' && source.sentiment <= 0.3) return false;
      if (sentimentFilter === 'neutral' && (source.sentiment < -0.1 || source.sentiment > 0.3)) return false;
      if (sentimentFilter === 'negative' && source.sentiment >= -0.1) return false;
      if (typeFilter !== 'all' && source.type !== typeFilter) return false;
      return true;
    });

    // Sort the filtered data
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'mentionRate':
          aValue = a.mentionRate;
          bValue = b.mentionRate;
          break;
        case 'soa':
          aValue = a.soa;
          bValue = b.soa;
          break;
        case 'sentiment':
          aValue = a.sentiment;
          bValue = b.sentiment;
          break;
        case 'topics':
          aValue = a.topics.length;
          bValue = b.topics.length;
          break;
        case 'pages':
          aValue = a.pages.length;
          bValue = b.pages.length;
          break;
        case 'prompts':
          aValue = a.prompts.length;
          bValue = b.prompts.length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sourceData, topicFilter, sentimentFilter, typeFilter, sortField, sortDirection]);

  const chartData = {
    datasets: filteredData.map(source => ({
      label: source.name,
      data: [{
        x: source.mentionRate,
        y: source.soa,
        r: Math.sqrt(source.citations) * 3.5,
      }],
      backgroundColor: sourceTypeColors[source.type] + '99',
      borderColor: sourceTypeColors[source.type],
      borderWidth: 2,
      sourceData: source,
    }))
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(26, 29, 41, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (context: any) => context[0].dataset.label,
          label: (context: any) => {
            const source = context.dataset.sourceData;
            const sentimentEmoji = source.sentiment > 0.5 ? '😊' : source.sentiment < 0 ? '😟' : '😐';
            const sentimentLabel = source.sentiment > 0.5 ? 'Positive' : source.sentiment < 0 ? 'Negative' : 'Neutral';
            return [
              '',
              `Type: ${source.type.charAt(0).toUpperCase() + source.type.slice(1)}`,
              `Mention Rate: ${source.mentionRate}%`,
              `Share of Answer: ${source.soa}%`,
              `Citations: ${source.citations}`,
              '',
              `${sentimentEmoji} Sentiment: ${sentimentLabel} (${source.sentiment > 0 ? '+' : ''}${source.sentiment})`,
              '',
              `🔗 ${source.url}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Brand Mention Rate (%)',
          font: { size: 14, weight: '600', family: 'IBM Plex Sans, sans-serif' },
          color: '#212534'
        },
        min: 0,
        max: 45,
        grid: { color: '#e8e9ed' },
        ticks: { color: '#393e51' }
      },
      y: {
        title: {
          display: true,
          text: 'Share of Answer (%)',
          font: { size: 14, weight: '600', family: 'IBM Plex Sans, sans-serif' },
          color: '#212534'
        },
        min: 0,
        max: 100,
        grid: { color: '#e8e9ed' },
        ticks: { color: '#393e51' }
      }
    }
  };

  const quadrantPlugin = {
    id: 'quadrantPlugin',
    beforeDraw: (chart: any) => {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;

      const xMid = xScale.getPixelForValue(22.5);
      const yMid = yScale.getPixelForValue(50);

      ctx.save();
      ctx.strokeStyle = '#e8e9ed';
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

      ctx.font = '600 11px IBM Plex Sans, sans-serif';
      ctx.textAlign = 'center';

      ctx.fillStyle = '#06c686';
      ctx.fillText('HIGH VALUE ZONE', (xMid + chartArea.right) / 2, chartArea.top + 20);

      ctx.fillStyle = '#f94343';
      ctx.fillText('UNDERPERFORMING', (chartArea.left + xMid) / 2, chartArea.bottom - 10);
    }
  };

  ChartJS.register(quadrantPlugin);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: '0 0 8px 0' }}>
                Answer Sources
              </h1>
              <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
                Understand which sources are cited in AI answers, measure share of answer across prompts, and identify optimization opportunities
              </p>
            </div>
            {brands.length > 1 && selectedBrandId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  htmlFor="brand-selector"
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6c7289',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Brand
                </label>
                <select
                  id="brand-selector"
                  value={selectedBrandId}
                  onChange={(event) => selectBrand(event.target.value)}
                  style={{
                    fontSize: '13px',
                    border: '1px solid #dcdfe5',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                    color: '#1a1d29',
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    minWidth: '150px'
                  }}
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {selectedBrand && (
            <p style={{ fontSize: '12px', color: '#8b90a7', margin: '0 0 24px 0' }}>
              Viewing data for <span style={{ fontWeight: '500', color: '#1a1d29' }}>{selectedBrand.name}</span>
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: '#ffffff', marginBottom: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SourceTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {activeTab === 'top-sources' && (
          <>
            {/* Metrics Section */}
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                marginBottom: '24px'
              }}
            >

          {/* Top Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '24px' }}>
            {/* Overall Mention Rate */}
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '8px' }}>
                OVERALL MENTION RATE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                <span style={{ fontSize: '32px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', color: '#1a1d29' }}>
                  {overallMentionRate}%
                </span>
                {overallMentionChange !== 0 && (
                  <span style={{ fontSize: '10px', color: overallMentionChange >= 0 ? '#06c686' : '#f94343', display: 'flex', alignItems: 'center' }}>
                    {overallMentionChange >= 0 ? '↑' : '↓'} {Math.abs(overallMentionChange)}%
                </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#393e51' }}>
                Brand mentioned in {Math.round(overallMentionRate)}% of responses
              </div>
            </div>

            {/* Avg Sentiment & Top Source */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: '#f4f4f6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '4px' }}>
                  AVG SENTIMENT SCORE
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '20px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', color: '#1a1d29' }}>
                    {avgSentiment > 0 ? '+' : ''}{avgSentiment.toFixed(2)}
                  </span>
                  {avgSentimentChange !== 0 && (
                    <span style={{ fontSize: '10px', color: avgSentimentChange >= 0 ? '#06c686' : '#f94343' }}>
                      {avgSentimentChange >= 0 ? '↑' : '↓'} {Math.abs(avgSentimentChange).toFixed(2)}
                  </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>Positive sentiment across mentions</div>
              </div>

              <div style={{ backgroundColor: '#f4f4f6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '4px' }}>
                  TOP SOURCE
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#1a1d29' }}>
                    {topSource?.name || 'N/A'}
                  </span>
                  {topSource && topSource.mentionChange !== 0 && (
                    <span style={{ fontSize: '10px', color: topSource.mentionChange >= 0 ? '#06c686' : '#f94343' }}>
                      {topSource.mentionChange >= 0 ? '↑' : '↓'} {Math.abs(topSource.mentionChange)}%
                  </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>
                  {topSource?.mentionRate || 0}% mention · {filteredData.length} sources tracked
                </div>
              </div>
            </div>

            {/* Insights & Actions */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '8px' }}>
                INSIGHTS & ACTIONS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* High Priority Alert */}
                <div
                  style={{
                    backgroundColor: '#fff5f5',
                    border: '1px solid #fecaca',
                    padding: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '10px'
                  }}
                >
                  <IconAlertCircle size={16} style={{ color: '#f94343', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#1a1d29', marginBottom: '4px' }}>
                      High-Impact Opportunity
                    </div>
                    <div style={{ fontSize: '11px', color: '#393e51', lineHeight: '1.5' }}>
                      wikipedia.org has 18% SoA but only 4% brand mention
                    </div>
                  </div>
                </div>

                {/* Action Item */}
                <div
                  style={{
                    backgroundColor: '#f4f4f6',
                    padding: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <IconChartBar size={14} style={{ color: '#00bcdc', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#393e51' }}>Used as a source in 23 prompts</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#393e51' }}>18% SoA</span>
                    <IconArrowUpRight size={12} style={{ color: '#06c686', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#06c686' }}>+4.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

            {/* Filter Bar */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '16px 24px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            style={{
              border: '1px solid #dcdfe5',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              color: '#212534',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Topics</option>
            {allTopics.map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>

          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            style={{
              border: '1px solid #dcdfe5',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              color: '#212534',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive Only</option>
            <option value="neutral">Neutral Only</option>
            <option value="negative">Negative Only</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              border: '1px solid #dcdfe5',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              color: '#212534',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Types</option>
            {Object.entries(sourceTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              border: '1px solid #dcdfe5',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'IBM Plex Sans, sans-serif',
              color: '#212534',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>

        {/* Bubble Chart */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: 0 }}>
              Source Performance Matrix
            </h2>
            <a
              href="#"
              style={{
                fontSize: '13px',
                color: '#00bcdc',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Export data <IconDownload size={14} />
            </a>
          </div>

          <p style={{ fontSize: '13px', color: '#393e51', marginBottom: '16px' }}>
            Sources in the top-right quadrant (high mention rate + high share of answer) are your highest-value targets. Colors indicate source type.
          </p>

          <div style={{ height: '500px', position: 'relative' }}>
            <Scatter data={chartData} options={chartOptions} />
          </div>

          {/* Legend */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            {Object.entries(sourceTypeLabels).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: sourceTypeColors[key]
                  }}
                />
                <span style={{ fontSize: '12px', color: '#393e51' }}>{label}</span>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
              • Bubble Size: Total Citations
            </div>
          </div>
        </div>

        {/* Source Attribution Table */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: 0 }}>
              Source Attribution Details
            </h2>
            <a
              href="#"
              style={{
                fontSize: '13px',
                color: '#00bcdc',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Export CSV <IconDownload size={14} />
            </a>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f4f4f6', borderBottom: '2px solid #e8e9ed' }}>
                  <th
                    onClick={() => handleSort('name')}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Source
                      {sortField === 'name' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('type')}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Type
                      {sortField === 'type' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('mentionRate')}
                    style={{
                      textAlign: 'right',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      Mention Rate
                      {sortField === 'mentionRate' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('soa')}
                    style={{
                      textAlign: 'right',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      Share of Answer
                      {sortField === 'soa' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('sentiment')}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Sentiment
                      {sortField === 'sentiment' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('topics')}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Top Categories
                      {sortField === 'topics' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('pages')}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Pages
                      {sortField === 'pages' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('prompts')}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#393e51',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Prompts
                      {sortField === 'prompts' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((source, idx) => {
                  const sentimentEmoji = source.sentiment > 0.5 ? '😊' : source.sentiment < 0 ? '😟' : '😐';
                  return (
                    <tr
                      key={source.name}
                      style={{
                        borderBottom: '1px solid #e8e9ed',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9f9fb'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f4f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f9f9fb';
                      }}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#00bcdc',
                            textDecoration: 'none',
                            fontSize: '13px',
                            fontFamily: 'IBM Plex Sans, sans-serif'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {source.name}
                        </a>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            backgroundColor: sourceTypeColors[source.type],
                            color: '#ffffff'
                          }}
                        >
                          {source.type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontFamily: 'IBM Plex Mono, monospace', color: '#212534' }}>
                            {source.mentionRate}%
                          </span>
                          <span style={{ fontSize: '10px', color: source.mentionChange >= 0 ? '#06c686' : '#f94343' }}>
                            {source.mentionChange >= 0 ? '↑' : '↓'} {Math.abs(source.mentionChange)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontFamily: 'IBM Plex Mono, monospace', color: '#212534' }}>
                            {source.soa}%
                          </span>
                          <span style={{ fontSize: '10px', color: source.soaChange >= 0 ? '#06c686' : '#f94343' }}>
                            {source.soaChange >= 0 ? '↑' : '↓'} {Math.abs(source.soaChange).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>{sentimentEmoji}</span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontFamily: 'IBM Plex Mono, monospace',
                              color: source.sentiment > 0.3 ? '#06c686' : source.sentiment < 0 ? '#f94343' : '#393e51'
                            }}
                          >
                            {source.sentiment > 0 ? '+' : ''}{source.sentiment.toFixed(2)}
                          </span>
                          <span style={{ fontSize: '10px', color: source.sentimentChange >= 0 ? '#06c686' : '#f94343' }}>
                            {source.sentimentChange >= 0 ? '↑' : '↓'} {Math.abs(source.sentimentChange).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div
                          style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', position: 'relative' }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipPosition({ x: rect.left, y: rect.top });
                            setHoveredTopics(source.topics);
                          }}
                          onMouseLeave={() => setHoveredTopics(null)}
                        >
                          {source.topics.slice(0, 2).map(topic => (
                            <span
                              key={topic}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                backgroundColor: '#f4f4f6',
                                color: '#393e51',
                                cursor: 'default'
                              }}
                            >
                              {topic}
                            </span>
                          ))}
                          {source.topics.length > 2 && (
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                backgroundColor: '#e8e9ed',
                                color: '#393e51',
                                cursor: 'default'
                              }}
                            >
                              +{source.topics.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#00bcdc',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          onClick={() => {
                            setModalType('pages');
                            setModalData(source.pages);
                            setModalTitle(`Pages citing ${source.name}`);
                          }}
                        >
                          {source.pages.slice(0, 1).join(', ')}
                          {source.pages.length > 1 && ` +${source.pages.length - 1} more`}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        {source.prompts.length > 0 ? (
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#00bcdc',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            onClick={() => {
                              setModalType('prompts');
                              setModalData(source.prompts);
                              setModalTitle(`Prompts citing ${source.name}`);
                            }}
                          >
                            {source.prompts.slice(0, 1).join(', ')}
                            {source.prompts.length > 1 && ` +${source.prompts.length - 1} more`}
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#8b90a7' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Topics Tooltip */}
        {hoveredTopics && (
          <div
            style={{
              position: 'fixed',
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y - 10}px`,
              transform: 'translateY(-100%)',
              backgroundColor: 'rgba(26, 29, 41, 0.95)',
              color: '#ffffff',
              padding: '12px 16px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              maxWidth: '300px',
              pointerEvents: 'none'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', color: '#a0a5b8' }}>
              All Topics
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {hoveredTopics.map((topic, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: '#ffffff'
                  }}
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Modal for Prompts/Pages */}
        {modalType && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '24px'
            }}
            onClick={() => setModalType(null)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '24px',
                  borderBottom: '1px solid #e8e9ed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <h3 style={{ fontSize: '18px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: 0 }}>
                  {modalTitle}
                </h3>
                <button
                  onClick={() => setModalType(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#393e51'
                  }}
                >
                  <IconX size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div
                style={{
                  padding: '24px',
                  overflowY: 'auto',
                  flex: 1
                }}
              >
                <div style={{ fontSize: '12px', color: '#393e51', marginBottom: '16px' }}>
                  {modalType === 'prompts' ? `${modalData.length} prompts` : `${modalData.length} pages`}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {modalData.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '16px',
                        backgroundColor: '#f9f9fb',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        color: '#212534',
                        lineHeight: '1.6',
                        border: '1px solid #e8e9ed'
                      }}
                    >
                      {modalType === 'prompts' && (
                        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                          <span style={{ fontSize: '11px', color: '#393e51', fontWeight: '600', minWidth: '20px' }}>
                            {idx + 1}.
                          </span>
                          <span>{item}</span>
                        </div>
                      )}
                      {modalType === 'pages' && (
                        <div style={{ fontWeight: '500' }}>{item}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #e8e9ed',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  onClick={() => setModalType(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#00bcdc',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Sans, sans-serif'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {activeTab === 'source-coverage' && (
          <SourceCoverageHeatmap
            sources={heatmapSources}
            topics={allTopics.length > 0 ? allTopics : ['No topics available']}
            data={heatmapData}
          />
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ 
            backgroundColor: '#ffffff', 
            padding: '48px', 
            borderRadius: '8px', 
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              border: '3px solid #e8e9ed', 
              borderTopColor: '#00bcdc', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ fontSize: '14px', color: '#393e51' }}>Loading source data...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div style={{ 
            backgroundColor: '#fff5f5', 
            border: '1px solid #fecaca', 
            padding: '24px', 
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <IconAlertCircle size={20} style={{ color: '#f94343' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', margin: 0 }}>
                Error Loading Source Data
              </h3>
            </div>
            <p style={{ fontSize: '14px', color: '#393e51', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sourceData.length === 0 && (
          <div style={{ 
            backgroundColor: '#ffffff', 
            padding: '48px', 
            borderRadius: '8px', 
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '16px', color: '#393e51', margin: 0 }}>
              No source data available for the selected time range.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};
