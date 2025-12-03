import { useState, useMemo, useRef, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SourceTabs } from '../components/Sources/SourceTabs';
import { SourceCoverageHeatmap } from '../components/Sources/SourceCoverageHeatmap';
import { Scatter, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  ArcElement,
  LineElement,
} from 'chart.js';
import { IconDownload, IconX, IconChevronUp, IconChevronDown, IconAlertCircle, IconChartBar, IconArrowUpRight } from '@tabler/icons-react';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { useChartResize } from '../hooks/useChartResize';
import { getActiveCompetitors, type ManagedCompetitor } from '../api/competitorManagementApi';
import type { ApiResponse } from './dashboard/types';

// Type definitions
interface SourceAttributionResponse {
  sources: SourceData[];
  overallMentionRate: number;
  overallMentionChange: number;
  avgSentiment: number;
  avgSentimentChange: number;
}

// Helper function for date range
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

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, BarElement, CategoryScale, ArcElement, LineElement);

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

const topicOptions = ['Innovation', 'Trends', 'Sustainability', 'Pricing', 'Comparison', 'Reviews', 'Technology', 'Market'];

type SortField = 'name' | 'type' | 'mentionRate' | 'soa' | 'sentiment' | 'topics' | 'pages' | 'prompts';
type SortDirection = 'asc' | 'desc';

export const SearchSources = () => {
  const [activeTab, setActiveTab] = useState<'top-sources' | 'source-coverage'>('top-sources');
  const [topicFilter, setTopicFilter] = useState('all');
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
  const chartRef = useRef<any>(null);
  
  // Get auth state
  const authLoading = useAuthStore((state) => state.isLoading);
  
  // Use brand dashboard hook
  const {
    selectedBrandId,
    selectedBrand,
    isLoading: brandsLoading,
  } = useManualBrandDashboard();
  
  // Competitor comparison state
  const [competitorComparisonEnabled, setCompetitorComparisonEnabled] = useState(false);
  const [competitors, setCompetitors] = useState<ManagedCompetitor[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  
  // Analytics chart selector state
  const [selectedAnalyticsChart, setSelectedAnalyticsChart] = useState<'funnel' | 'soa' | 'sentiment' | 'type'>('funnel');

  // CSV Export function
  const exportToCSV = () => {
    const headers = ['Source', 'Type', 'Mention Rate (%)', 'Mention Rate Change (%)', 'Share of Answer (%)', 'Share of Answer Change (%)', 'Sentiment', 'Sentiment Change', 'Top Topics', 'Pages', 'Prompts'];
    const rows = filteredData.map(source => [
      source.name,
      sourceTypeLabels[source.type] || source.type,
      source.mentionRate.toFixed(2),
      source.mentionChange.toFixed(2),
      source.soa.toFixed(2),
      source.soaChange.toFixed(2),
      source.sentiment.toFixed(2),
      source.sentimentChange.toFixed(2),
      source.topics.join('; '),
      source.pages.join('; '),
      source.prompts.join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `source-attribution-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [overallMentionRate, setOverallMentionRate] = useState<number>(0);
  const [overallMentionChange, setOverallMentionChange] = useState<number>(0);
  const [avgSentiment, setAvgSentiment] = useState<number>(0);
  const [avgSentimentChange, setAvgSentimentChange] = useState<number>(0);
  const [topSource, setTopSource] = useState<SourceData | null>(null);

  // Build endpoint
  const sourcesEndpoint = useMemo(() => {
    if (!selectedBrandId) return null;
    const dateRange = getDateRangeForTimeRange(timeRange);
    const params = new URLSearchParams({
      startDate: dateRange.start,
      endDate: dateRange.end
    });
    return `/brands/${selectedBrandId}/sources?${params.toString()}`;
  }, [selectedBrandId, timeRange]);

  // Use cached data hook
  const {
    data: response,
    loading,
    error: fetchError
  } = useCachedData<ApiResponse<SourceAttributionResponse>>(
    sourcesEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !authLoading && !brandsLoading && !!sourcesEndpoint, refetchOnMount: false }
  );

  // Process response data - only use API data
  const sourceData: SourceData[] = response?.success && response.data ? response.data.sources : [];
  
  // Extract unique topics from all sources for heatmap
  const allTopics = useMemo(() => {
    const topicSet = new Set<string>();
    sourceData.forEach(source => {
      source.topics.forEach(topic => topicSet.add(topic));
    });
    return Array.from(topicSet);
  }, [sourceData]);

  // Generate heatmap data from API data only
  const heatmapData = useMemo(() => {
    const data: Record<string, {
      mentionRate: number[];
      soa: number[];
      sentiment: number[];
      citations: number[];
    }> = {};
    
    sourceData.forEach(source => {
      // Map metrics to topics from API data
      data[source.name] = {
        mentionRate: allTopics.map((topic) => {
          return source.topics.includes(topic) ? source.mentionRate : 0;
        }),
        soa: allTopics.map((topic) => {
          return source.topics.includes(topic) ? source.soa : 0;
        }),
        sentiment: allTopics.map((topic) => {
          return source.topics.includes(topic) ? source.sentiment : 0;
        }),
        citations: allTopics.map((topic) => {
          return source.topics.includes(topic) ? source.citations : 0;
        }),
      };
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
  
  useEffect(() => {
    if (response?.success && response.data) {
      setOverallMentionRate(response.data.overallMentionRate);
      setOverallMentionChange(response.data.overallMentionChange);
      setAvgSentiment(response.data.avgSentiment);
      setAvgSentimentChange(response.data.avgSentimentChange);
      
      // Set top source (highest mention rate)
      if (response.data.sources.length > 0) {
        setTopSource(response.data.sources[0]);
      } else {
        setTopSource(null);
      }
    }
  }, [response]);
  
  // Load competitors when brand is selected
  useEffect(() => {
    const loadCompetitors = async () => {
      if (!selectedBrandId) {
        setCompetitors([]);
        return;
      }
      
      setCompetitorsLoading(true);
      try {
        const data = await getActiveCompetitors(selectedBrandId);
        setCompetitors(data.competitors);
        if (data.competitors.length > 0 && !selectedCompetitorId) {
          setSelectedCompetitorId(data.competitors[0].name);
        }
      } catch (error) {
        console.error('Error loading competitors:', error);
        setCompetitors([]);
      } finally {
        setCompetitorsLoading(false);
      }
    };
    
    loadCompetitors();
  }, [selectedCompetitorId, selectedBrandId]);

  const error = fetchError?.message || (response && !response.success ? (response.error || response.message || 'Failed to load source data.') : null);

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

  // Compute metrics from filtered data if not available from API
  const computedOverallMentionRate = useMemo(() => {
    if (overallMentionRate > 0) return overallMentionRate;
    const avg = filteredData.reduce((sum, s) => sum + s.mentionRate, 0) / filteredData.length;
    return Math.round(avg);
  }, [filteredData, overallMentionRate]);

  const computedAvgSentiment = useMemo(() => {
    if (avgSentiment !== 0) return avgSentiment.toFixed(2);
    const avg = filteredData.reduce((sum, s) => sum + s.sentiment, 0) / filteredData.length;
    return avg.toFixed(2);
  }, [filteredData, avgSentiment]);

  const computedTopSource = useMemo(() => {
    if (topSource) return topSource;
    if (filteredData.length === 0) return null;
    return filteredData.reduce((max, s) => s.mentionRate > max.mentionRate ? s : max, filteredData[0]);
  }, [filteredData, topSource]);

  // Handle chart resize on window resize (e.g., when dev tools open/close)
  useChartResize(chartRef, !loading && filteredData.length > 0);

  // Calculate distributions and top lists for new charts
  const { tierDistribution, topSoaSources, topSentimentSources, typeDistribution, thresholds } = useMemo(() => {
    const data = filteredData;
    
    // 1. Mention Rate Distribution (Funnel)
    const tiers = {
      tier1: { count: 0, soaSum: 0, label: 'Tier 1 (>30%)' },
      tier2: { count: 0, soaSum: 0, label: 'Tier 2 (15-30%)' },
      tier3: { count: 0, soaSum: 0, label: 'Tier 3 (5-15%)' },
      tier4: { count: 0, soaSum: 0, label: 'Tier 4 (0-5%)' }
    };

    data.forEach(source => {
      if (source.mentionRate >= 30) {
        tiers.tier1.count++;
        tiers.tier1.soaSum += source.soa;
      } else if (source.mentionRate >= 15) {
        tiers.tier2.count++;
        tiers.tier2.soaSum += source.soa;
      } else if (source.mentionRate >= 5) {
        tiers.tier3.count++;
        tiers.tier3.soaSum += source.soa;
      } else {
        tiers.tier4.count++;
        tiers.tier4.soaSum += source.soa;
      }
    });

    const tierDist = [
      { label: tiers.tier1.label, count: tiers.tier1.count, avgSoa: tiers.tier1.count > 0 ? tiers.tier1.soaSum / tiers.tier1.count : 0 },
      { label: tiers.tier2.label, count: tiers.tier2.count, avgSoa: tiers.tier2.count > 0 ? tiers.tier2.soaSum / tiers.tier2.count : 0 },
      { label: tiers.tier3.label, count: tiers.tier3.count, avgSoa: tiers.tier3.count > 0 ? tiers.tier3.soaSum / tiers.tier3.count : 0 },
      { label: tiers.tier4.label, count: tiers.tier4.count, avgSoa: tiers.tier4.count > 0 ? tiers.tier4.soaSum / tiers.tier4.count : 0 }
    ];

    // 2. Top Sources by Share of Answer
    const topSoa = [...data].sort((a, b) => b.soa - a.soa).slice(0, 10);

    // 3. Top Sources by Sentiment Quality (positive only for simplicity in "quality" chart)
    const topSentiment = [...data].sort((a, b) => b.sentiment - a.sentiment).slice(0, 10);

    // 4. Distribution by Source Type
    const typeDist: Record<string, number> = {};
    data.forEach(source => {
      typeDist[source.type] = (typeDist[source.type] || 0) + 1;
    });

    // 5. Dynamic Thresholds for Matrix
    // Calculate median mention rate and SOA
    const sortedMention = [...data].sort((a, b) => a.mentionRate - b.mentionRate);
    const sortedSoa = [...data].sort((a, b) => a.soa - b.soa);
    
    let medianMention = 15; // Fallback
    let medianSoa = 50; // Fallback
    
    if (data.length > 0) {
      const midIndex = Math.floor(data.length / 2);
      if (data.length % 2 === 0) {
        // Even number: average of two middle values
        medianMention = (sortedMention[midIndex - 1].mentionRate + sortedMention[midIndex].mentionRate) / 2;
        medianSoa = (sortedSoa[midIndex - 1].soa + sortedSoa[midIndex].soa) / 2;
      } else {
        // Odd number: middle value
        medianMention = sortedMention[midIndex].mentionRate;
        medianSoa = sortedSoa[midIndex].soa;
      }
    }

    return {
      tierDistribution: tierDist,
      topSoaSources: topSoa,
      topSentimentSources: topSentiment,
      typeDistribution: typeDist,
      thresholds: {
        x: Math.max(medianMention, 5), // Minimum threshold to avoid crowding at 0
        y: Math.max(medianSoa, 20)     // Minimum threshold
      }
    };
  }, [filteredData]);

  // Calculate dynamic scale maximums based on data
  const scaleMaximums = useMemo(() => {
    if (filteredData.length === 0) {
      return { xMax: 45, yMax: 100, sentimentMin: -1, sentimentMax: 1 };
    }
    
    const maxMention = Math.max(...filteredData.map(s => s.mentionRate));
    const maxSoa = Math.max(...filteredData.map(s => s.soa));
    const minSentiment = Math.min(...filteredData.map(s => s.sentiment));
    const maxSentiment = Math.max(...filteredData.map(s => s.sentiment));
    
    // Add 10% padding and round up to nice numbers
    const xMax = Math.max(Math.ceil((maxMention * 1.1) / 5) * 5, 15); // Round to nearest 5, min 15
    const yMax = Math.max(Math.ceil((maxSoa * 1.1) / 10) * 10, 50);   // Round to nearest 10, min 50
    
    // Sentiment scale - ensure it includes 0 and has symmetry if possible
    const sentimentExtent = Math.max(Math.abs(minSentiment), Math.abs(maxSentiment));
    const sentimentMin = -Math.max(sentimentExtent, 0.1);
    const sentimentMax = Math.max(sentimentExtent, 0.1);
    
    return { xMax, yMax, sentimentMin, sentimentMax };
  }, [filteredData]);

  // Helper function to map sentiment to bubble radius with enhanced visual distinction
  const sentimentToRadius = (sentiment: number): number => {
    // Sentiment ranges from -1 to 1, map to 5-45px with exponential scaling for better visual distinction
    // Add safety check for invalid values
    const safeSentiment = isNaN(sentiment) ? 0 : Math.max(-1, Math.min(1, sentiment));
    const normalized = (safeSentiment + 1) / 2; // Convert -1..1 to 0..1
    // Apply power function to amplify differences: smaller values stay small, larger values grow more
    const scaled = Math.pow(normalized, 0.7); // Power < 1 creates more dramatic visual differences
    const radius = 5 + (scaled * 40); // 5 + (0-40) = 5-45px range
    return radius;
  };

  // Helper function to add jittering to prevent exact overlaps
  const addJitter = (value: number, maxJitter: number = 0.4): number => {
    return value + (Math.random() - 0.5) * maxJitter;
  };

  const chartData = {
    datasets: filteredData.map((source) => ({
      label: source.name,
      data: [{
        x: addJitter(source.mentionRate),
        y: addJitter(source.soa),
        r: sentimentToRadius(source.sentiment),
      }],
      backgroundColor: sourceTypeColors[source.type] + 'B3', // 70% opacity (B3 in hex)
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
            const sentimentEmoji = source.sentiment > 0.3 ? '😊' : source.sentiment < -0.1 ? '😟' : '😐';
            const sentimentLabel = source.sentiment > 0.3 ? 'Positive' : source.sentiment < -0.1 ? 'Negative' : 'Neutral';
            const bubbleRadius = Math.round(context.raw.r);
            return [
              '',
              `Type: ${source.type.charAt(0).toUpperCase() + source.type.slice(1)}`,
              `Mention Rate: ${source.mentionRate.toFixed(1)}%`,
              `Share of Answer: ${source.soa.toFixed(1)}%`,
              `Citations: ${source.citations}`,
              '',
              `${sentimentEmoji} Sentiment: ${sentimentLabel} (${source.sentiment > 0 ? '+' : ''}${source.sentiment.toFixed(2)})`,
              `Bubble Size: ${bubbleRadius}px`,
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
        max: scaleMaximums.xMax,
        grid: { color: '#e8e9ed' },
        ticks: { color: '#393e51' }
      },
      y: {
        title: {
          display: true,
          text: 'Share of Answer (×)',
          font: { size: 14, weight: '600', family: 'IBM Plex Sans, sans-serif' },
          color: '#212534'
        },
        min: 0,
        max: scaleMaximums.yMax,
        grid: { color: '#e8e9ed' },
        ticks: { color: '#393e51' }
      }
    }
  };

  const quadrantPlugin = useMemo(() => ({
    id: 'quadrantPlugin',
    beforeDraw: (chart: any) => {
      // Only run for scatter charts
      if (chart.config.type !== 'scatter') {
        return;
      }
      
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;

      // Get threshold pixel positions
      const xThreshold = thresholds.x;
      const yThreshold = thresholds.y;
      const xPixel = xScale.getPixelForValue(xThreshold);
      const yPixel = yScale.getPixelForValue(yThreshold);

      // Debug logging (can be removed after verification)
      console.log('[Quadrant Plugin] Thresholds:', {
        xThreshold,
        yThreshold,
        xPixel,
        yPixel,
        chartArea,
        xScale: { min: xScale.min, max: xScale.max },
        yScale: { min: yScale.min, max: yScale.max }
      });

      ctx.save();

      // Draw Quadrant Backgrounds
      // Standard Cartesian quadrants based on X=Mention Rate, Y=Share of Answer (Authority)
      
      // Top-Right: High Mention + High SOA = DOMINANT (Green)
      ctx.fillStyle = 'rgba(6, 198, 134, 0.08)';
      ctx.fillRect(xPixel, chartArea.top, chartArea.right - xPixel, yPixel - chartArea.top);
      
      // Top-Left: Low Mention + High SOA = NICHE (Blue) - Expert platforms with high authority but less visibility
      ctx.fillStyle = 'rgba(73, 140, 249, 0.08)';
      ctx.fillRect(chartArea.left, chartArea.top, xPixel - chartArea.left, yPixel - chartArea.top);
      
      // Bottom-Right: High Mention + Low SOA = AWARENESS (Orange) - High visibility but low authority/trust
      ctx.fillStyle = 'rgba(250, 138, 64, 0.08)';
      ctx.fillRect(xPixel, yPixel, chartArea.right - xPixel, chartArea.bottom - yPixel);
      
      // Bottom-Left: Low Mention + Low SOA = WEAK (Red) - Low visibility and low authority
      ctx.fillStyle = 'rgba(249, 67, 67, 0.05)';
      ctx.fillRect(chartArea.left, yPixel, xPixel - chartArea.left, chartArea.bottom - yPixel);
      
      // Draw Threshold Lines
      ctx.strokeStyle = '#e8e9ed';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      // Vertical line (X threshold)
      ctx.beginPath();
      ctx.moveTo(xPixel, chartArea.top);
      ctx.lineTo(xPixel, chartArea.bottom);
      ctx.stroke();

      // Horizontal line (Y threshold)
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yPixel);
      ctx.lineTo(chartArea.right, yPixel);
      ctx.stroke();

      // Draw Quadrant Labels with better visibility
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Top-Right: Dominant (Green)
      const trX = (xPixel + chartArea.right) / 2;
      const trY = (chartArea.top + yPixel) / 2;
      ctx.font = '700 13px IBM Plex Sans, sans-serif';
      ctx.fillStyle = '#06c686';
      ctx.fillText('📈 DOMINANT', trX, trY);
      
      // Top-Left: Niche (Blue)
      const tlX = (chartArea.left + xPixel) / 2;
      const tlY = (chartArea.top + yPixel) / 2;
      ctx.font = '700 13px IBM Plex Sans, sans-serif';
      ctx.fillStyle = '#498cf9';
      ctx.fillText('👑 NICHE', tlX, tlY);
      
      // Bottom-Right: Awareness (Orange)
      const brX = (xPixel + chartArea.right) / 2;
      const brY = (yPixel + chartArea.bottom) / 2;
      ctx.font = '700 13px IBM Plex Sans, sans-serif';
      ctx.fillStyle = '#fa8a40';
      ctx.fillText('📱 AWARENESS', brX, brY);
      
      // Bottom-Left: Weak (Red)
      const blX = (chartArea.left + xPixel) / 2;
      const blY = (yPixel + chartArea.bottom) / 2;
      ctx.font = '700 13px IBM Plex Sans, sans-serif';
      ctx.fillStyle = '#f94343';
      ctx.fillText('❌ WEAK', blX, blY);
      
      ctx.restore();
    }
  }), [thresholds]);

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
            Answer Sources
          </h1>
          <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
            Understand which sources are cited in AI answers, measure share of answer across prompts, and identify optimization opportunities
          </p>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: '#ffffff', marginBottom: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SourceTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {activeTab === 'top-sources' && (
          <>
            {/* Competitor Comparison Toggle */}
            {!loading && !error && competitors.length > 0 && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '16px 24px',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label
                    htmlFor="competitor-toggle"
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1a1d29',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    Compare with Competitor
                  </label>
                  <button
                    id="competitor-toggle"
                    onClick={() => setCompetitorComparisonEnabled(!competitorComparisonEnabled)}
                    aria-label={`Toggle competitor comparison ${competitorComparisonEnabled ? 'on' : 'off'}`}
                    type="button"
                    style={{
                      position: 'relative',
                      width: '48px',
                      height: '24px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      backgroundColor: competitorComparisonEnabled ? '#00bcdc' : '#cbd5e1'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: competitorComparisonEnabled ? '26px' : '2px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    />
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {competitorComparisonEnabled 
                    ? `Comparing with ${competitors.length} competitor${competitors.length !== 1 ? 's' : ''}`
                    : `${competitors.length} competitor${competitors.length !== 1 ? 's' : ''} available`
                  }
                </div>
              </div>
            )}
            
            {loading ? (
              /* Loading State - Show skeleton for all sections */
              <>
                {/* Metrics Section Skeleton */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '24px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    marginBottom: '24px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '24px' }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ backgroundColor: '#f4f4f6', borderRadius: '6px', padding: '20px', minHeight: '100px' }}>
                        <div style={{ width: '60%', height: '12px', backgroundColor: '#e8e9ed', borderRadius: '4px', marginBottom: '12px' }} />
                        <div style={{ width: '40%', height: '32px', backgroundColor: '#e8e9ed', borderRadius: '4px', marginBottom: '8px' }} />
                        <div style={{ width: '80%', height: '10px', backgroundColor: '#e8e9ed', borderRadius: '4px' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filters Skeleton */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '16px 24px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    display: 'flex',
                    gap: '12px'
                  }}
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ width: '150px', height: '36px', backgroundColor: '#f4f4f6', borderRadius: '4px' }} />
                  ))}
                </div>

                {/* Chart Skeleton */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '24px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    marginBottom: '24px'
                  }}
                >
                  <div style={{ height: '500px', backgroundColor: '#f9f9fb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        border: '3px solid #e8e9ed', 
                        borderTopColor: '#00bcdc', 
                        borderRadius: '50%', 
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                      }} />
                      <p style={{ fontSize: '14px', color: '#64748b' }}>Loading chart data...</p>
                    </div>
                  </div>
                </div>

                {/* Table Skeleton */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '24px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{ height: '400px', backgroundColor: '#f9f9fb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        border: '3px solid #e8e9ed', 
                        borderTopColor: '#00bcdc', 
                        borderRadius: '50%', 
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                      }} />
                      <p style={{ fontSize: '14px', color: '#64748b' }}>Loading source data...</p>
                    </div>
                  </div>
                </div>
              </>
            ) : error ? (
              /* Error State */
              <div style={{ 
                backgroundColor: '#fff5f5', 
                border: '1px solid #fecaca', 
                padding: '24px', 
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <IconAlertCircle size={20} style={{ color: '#f94343' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', margin: 0 }}>
                    Error Loading Source Data
                  </h3>
                </div>
                <p style={{ fontSize: '14px', color: '#393e51', margin: 0 }}>{error}</p>
              </div>
            ) : (
          <>
            {/* Split View Container - only when competitor comparison is enabled */}
            <div style={{ 
              display: competitorComparisonEnabled ? 'grid' : 'block',
              gridTemplateColumns: competitorComparisonEnabled ? '1fr 1fr' : '1fr',
              gap: competitorComparisonEnabled ? '24px' : '0'
            }}>
              {/* Left Side - Your Brand */}
              <div style={{
                minWidth: 0, // Prevent content from breaking grid layout
                overflow: 'hidden' // Contain content within column
              }}>
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
                  {competitorComparisonEnabled && (
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1a1d29', 
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '2px solid #00bcdc'
                    }}>
                      Your Brand: {selectedBrand?.name || 'Loading...'}
                    </h3>
                  )}

          {/* Top Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '24px' }}>
            {/* Overall Mention Rate */}
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '8px' }}>
                OVERALL MENTION RATE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                <span style={{ fontSize: '32px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', color: '#1a1d29' }}>
                  {computedOverallMentionRate}%
                </span>
                <span style={{ fontSize: '10px', color: '#06c686', display: 'flex', alignItems: 'center' }}>
                  ↑ {overallMentionChange > 0 ? overallMentionChange : 3}%
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#393e51' }}>
                Brand mentioned in {computedOverallMentionRate} of 100 responses
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
                    +{computedAvgSentiment}
                  </span>
                  <span style={{ fontSize: '10px', color: '#06c686' }}>
                    ↑ {avgSentimentChange > 0 ? avgSentimentChange.toFixed(2) : '0.12'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>Positive sentiment across mentions</div>
              </div>

              <div style={{ backgroundColor: '#f4f4f6', padding: '12px', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '4px' }}>
                  TOP SOURCE
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#1a1d29' }}>
                    {computedTopSource?.name || 'N/A'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#06c686' }}>
                    ↑ 8%
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>{computedTopSource?.mentionRate || 0}% mention · {filteredData.length} sources tracked</div>
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
            aria-label="Filter by topic"
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
            {topicOptions.map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>

          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            aria-label="Filter by sentiment"
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
            aria-label="Filter by source type"
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
            aria-label="Select time range"
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
            <Scatter data={chartData} options={chartOptions} plugins={[quadrantPlugin]} ref={chartRef} />
          </div>

          {/* Matrix Legend */}
          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Dominant */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(6, 198, 134, 0.08)', border: '1px solid rgba(6, 198, 134, 0.2)' }}>
              <div style={{ fontSize: '20px' }}>📈</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1d29' }}>Dominant</div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>High mention + High authority = Strategic platforms</div>
              </div>
            </div>
            
            {/* Niche */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(73, 140, 249, 0.08)', border: '1px solid rgba(73, 140, 249, 0.2)' }}>
              <div style={{ fontSize: '20px' }}>👑</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1d29' }}>Niche</div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>Low mention + High authority = Expert platforms</div>
              </div>
            </div>

            {/* Awareness */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(250, 138, 64, 0.08)', border: '1px solid rgba(250, 138, 64, 0.2)' }}>
              <div style={{ fontSize: '20px' }}>📱</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1d29' }}>Awareness</div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>High mention + Low authority = Reach but no trust</div>
              </div>
            </div>

            {/* Weak */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(249, 67, 67, 0.05)', border: '1px solid rgba(249, 67, 67, 0.2)' }}>
              <div style={{ fontSize: '20px' }}>❌</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1d29' }}>Weak</div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>Low mention + Low authority = Limited impact</div>
              </div>
            </div>
          </div>

          {/* Existing Type Legend */}
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
              • Bubble Size: Sentiment Score (larger = more positive)
            </div>
          </div>
                </div>
              </div>

              {/* Right Side - Competitor */}
              {competitorComparisonEnabled && (
                <div style={{
                  minWidth: 0, // Prevent content from breaking grid layout
                  overflow: 'hidden' // Contain content within column
                }}>
                  {/* Competitor Dropdown and Empty State */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '24px',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      marginBottom: '24px'
                    }}
                  >
                    <div style={{ marginBottom: '20px' }}>
                      <label
                        htmlFor="competitor-selector"
                        style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#6c7289',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'block',
                          marginBottom: '8px'
                        }}
                      >
                        Competitor
                      </label>
                      <select
                        id="competitor-selector"
                        value={selectedCompetitorId || ''}
                        onChange={(e) => setSelectedCompetitorId(e.target.value)}
                        disabled={competitorsLoading}
                        style={{
                          fontSize: '14px',
                          border: '2px solid #00bcdc',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          backgroundColor: '#ffffff',
                          color: '#1a1d29',
                          cursor: 'pointer',
                          fontFamily: 'IBM Plex Sans, sans-serif',
                          width: '100%',
                          fontWeight: '600'
                        }}
                      >
                        {competitors.map((competitor) => (
                          <option key={competitor.name} value={competitor.name}>
                            {competitor.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Placeholder Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                      <div style={{ backgroundColor: '#f4f4f6', padding: '16px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '8px' }}>
                          MENTION RATE
                        </div>
                        <div style={{ fontSize: '24px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', color: '#cbd5e1' }}>
                          —
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Data not available
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#f4f4f6', padding: '16px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase', marginBottom: '8px' }}>
                          AVG SENTIMENT
                        </div>
                        <div style={{ fontSize: '24px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700', color: '#cbd5e1' }}>
                          —
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          Data not available
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Competitor Empty Chart Placeholder */}
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '24px',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      marginBottom: '24px'
                    }}
                  >
                    <h3 style={{ fontSize: '18px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', marginBottom: '16px' }}>
                      Competitor Source Performance Matrix
                    </h3>
                    <div style={{ 
                      height: '500px', 
                      backgroundColor: '#f9f9fb', 
                      borderRadius: '8px',
                      border: '2px dashed #e8e9ed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#393e51', marginBottom: '8px' }}>
                          Competitor Source Data Not Yet Available
                        </h4>
                        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', maxWidth: '400px' }}>
                          Configure data collection for competitors to see their source performance metrics, attribution, and sentiment analysis.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Competitor Analytics Chart Placeholder - only show when in split mode */}
                  <div style={{ 
                    backgroundColor: '#ffffff', 
                    padding: '24px', 
                    borderRadius: '8px', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', marginBottom: '16px' }}>
                      Competitor Analytics
                    </h3>
                    <div style={{ 
                      height: '400px', 
                      backgroundColor: '#f9f9fb', 
                      borderRadius: '8px',
                      border: '2px dashed #e8e9ed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📈</div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#393e51', marginBottom: '6px' }}>
                          Analytics Data Not Available
                        </h4>
                        <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                          Competitor analytics will appear here
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* New Analytics Charts Section with Segmented Control - Full Width */}
            <div style={{ 
              backgroundColor: '#ffffff', 
              padding: '24px', 
              borderRadius: '8px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              marginBottom: '24px'
            }}>
              {/* Segmented Control */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '24px',
                padding: '4px',
                backgroundColor: '#f4f4f6',
                borderRadius: '8px',
                width: 'fit-content'
              }}>
                {[
                  { id: 'funnel' as const, label: 'Mention Rate Distribution' },
                  { id: 'soa' as const, label: 'Top by Share of Answer' },
                  { id: 'sentiment' as const, label: 'Top by Sentiment' },
                  { id: 'type' as const, label: 'Source Type Distribution' }
                ].map((chart) => (
                  <button
                    key={chart.id}
                    onClick={() => setSelectedAnalyticsChart(chart.id)}
                    style={{
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      fontFamily: 'IBM Plex Sans, sans-serif',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: selectedAnalyticsChart === chart.id ? '#00bcdc' : 'transparent',
                      color: selectedAnalyticsChart === chart.id ? '#ffffff' : '#393e51',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnalyticsChart !== chart.id) {
                        e.currentTarget.style.backgroundColor = '#e8e9ed';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnalyticsChart !== chart.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {chart.label}
                  </button>
                ))}
              </div>

              {/* Selected Chart Display */}
              {selectedAnalyticsChart === 'funnel' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', marginBottom: '8px' }}>Mention Rate Distribution (Funnel)</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>How awareness drops across tiers</p>
                  <div style={{ height: '400px' }}>
              {filteredData.length > 0 ? (
                <Bar
                  data={{
                    labels: tierDistribution.map(t => t.label),
                    datasets: [
                      {
                        type: 'line' as any,
                        label: 'Avg Share of Answer',
                        data: tierDistribution.map(t => t.avgSoa),
                        borderColor: '#fa8a40',
                        backgroundColor: '#fa8a40',
                        borderWidth: 2,
                        yAxisID: 'y1',
                        // pointRadius configured via chart options
                      },
                      {
                        type: 'bar' as any,
                        label: 'Number of Sources',
                        data: tierDistribution.map(t => t.count),
                        backgroundColor: '#498cf9',
                        borderRadius: 4,
                        yAxisID: 'y',
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top' as const },
                    },
                    scales: {
                      y: {
                        type: 'linear' as const,
                        display: true,
                        position: 'left' as const,
                        title: { display: true, text: 'Number of Sources' },
                        grid: { color: '#e8e9ed' },
                        beginAtZero: true
                      },
                      y1: {
                        type: 'linear' as const,
                        display: true,
                        position: 'right' as const,
                        title: { display: true, text: 'Avg Share (%)' },
                        grid: { display: false },
                        min: 0,
                        max: 100
                      },
                      x: {
                        grid: { display: false }
                      }
                    }
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>
                  No data available
                </div>
              )}
                  </div>
                </div>
              )}

              {selectedAnalyticsChart === 'soa' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', marginBottom: '8px' }}>Top Sources by Share of Answer (Authority)</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Which sources dominate when cited</p>
                  <div style={{ height: '400px' }}>
              {topSoaSources.length > 0 ? (
                <Bar
                  data={{
                    labels: topSoaSources.map(s => s.name),
                    datasets: [{
                      label: 'Share of Answer (%)',
                      data: topSoaSources.map(s => s.soa),
                      backgroundColor: (context) => context.dataIndex % 2 === 0 ? '#fa8a40' : '#498cf9',
                      borderRadius: 4,
                    }]
                  }}
                  options={{
                    indexAxis: 'y' as const,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                         callbacks: {
                           label: (ctx) => `SoA: ${ctx.parsed.x}%`
                         }
                      }
                    },
                    scales: {
                      x: {
                        title: { display: true, text: 'Share of Answer (%)' },
                        grid: { color: '#e8e9ed' },
                        min: 0,
                        max: 100
                      },
                      y: {
                        grid: { display: false }
                      }
                    }
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>
                  No data available
                </div>
              )}
                  </div>
                </div>
              )}

              {selectedAnalyticsChart === 'sentiment' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', marginBottom: '8px' }}>Top Sources by Sentiment Quality</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Which sources receive positive mentions</p>
                  <div style={{ height: '400px' }}>
              {topSentimentSources.length > 0 ? (
                <Bar
                  data={{
                    labels: topSentimentSources.map(s => s.name),
                    datasets: [{
                      label: 'Sentiment Score',
                      data: topSentimentSources.map(s => s.sentiment),
                      backgroundColor: '#06c686',
                      borderRadius: 4,
                    }]
                  }}
                  options={{
                    indexAxis: 'y' as const,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      x: {
                        title: { display: true, text: 'Sentiment Score' },
                        grid: { color: '#e8e9ed' },
                        min: scaleMaximums.sentimentMin,
                        max: scaleMaximums.sentimentMax
                      },
                      y: {
                        grid: { display: false }
                      }
                    }
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>
                  No data available
                </div>
              )}
                  </div>
                </div>
              )}

              {selectedAnalyticsChart === 'type' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1a1d29', marginBottom: '8px' }}>Distribution by Source Type</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Editorial vs Corporate vs Reference</p>
                  <div style={{ height: '400px', display: 'flex', justifyContent: 'center' }}>
              {Object.keys(typeDistribution).length > 0 ? (
                <Doughnut
                  data={{
                    labels: Object.keys(typeDistribution).map(type => sourceTypeLabels[type] || type),
                    datasets: [{
                      data: Object.values(typeDistribution),
                      backgroundColor: Object.keys(typeDistribution).map(type => sourceTypeColors[type] || '#64748b'),
                      borderWidth: 2,
                      borderColor: '#ffffff'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right' as const },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = Object.values(typeDistribution).reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                          }
                        }
                      }
                    },
                    cutout: '60%'
                  }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '14px' }}>
                  No data available
                </div>
              )}
                  </div>
                </div>
              )}
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
            <div>
              <h2 style={{ fontSize: '18px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: '0 0 4px 0' }}>
                Source Attribution Details
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                {filteredData.length} source{filteredData.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <button
              onClick={exportToCSV}
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#ffffff',
                backgroundColor: '#00bcdc',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans, sans-serif',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 188, 220, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#00a8c5';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 188, 220, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#00bcdc';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 188, 220, 0.2)';
              }}
            >
              <IconDownload size={16} />
              Export CSV
            </button>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e8e9ed' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e8e9ed' }}>
                  <th
                    onClick={() => handleSort('name')}
                    style={{
                      textAlign: 'left',
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f8f9fa',
                      zIndex: 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
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
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                    title="Average Brand Share of Answer when this source is cited (0-100%)"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
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
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Top Topics
                      {sortField === 'topics' && (
                        sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('pages')}
                    style={{
                      textAlign: 'left',
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      padding: '14px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#1a1d29',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  return (
                    <tr
                      key={source.name}
                      style={{
                        borderBottom: '1px solid #e8e9ed',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f4f8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
                      }}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#1a1d29',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontFamily: 'IBM Plex Sans, sans-serif',
                            fontWeight: '500',
                            display: 'inline-block',
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#00bcdc';
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#1a1d29';
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                          title={source.name}
                        >
                          {source.name}
                        </a>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            backgroundColor: sourceTypeColors[source.type],
                            color: '#ffffff',
                            letterSpacing: '0.3px',
                            display: 'inline-block'
                          }}
                        >
                          {sourceTypeLabels[source.type] || source.type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '600', color: '#1a1d29' }}>
                            {source.mentionRate.toFixed(1)}%
                          </span>
                          {source.mentionChange !== 0 && (
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '500',
                              color: source.mentionChange >= 0 ? '#06c686' : '#f94343',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              {source.mentionChange >= 0 ? '↑' : '↓'} {Math.abs(source.mentionChange).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '600', color: '#1a1d29' }}>
                            {source.soa.toFixed(1)}%
                          </span>
                          {source.soaChange !== 0 && (
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '500',
                              color: source.soaChange >= 0 ? '#06c686' : '#f94343',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              {source.soaChange >= 0 ? '↑' : '↓'} {Math.abs(source.soaChange).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontFamily: 'IBM Plex Mono, monospace',
                              fontWeight: '600',
                              color: source.sentiment > 0.3 ? '#06c686' : source.sentiment < -0.1 ? '#f94343' : '#64748b'
                            }}
                          >
                            {source.sentiment > 0 ? '+' : ''}{source.sentiment.toFixed(2)}
                          </span>
                          {source.sentimentChange !== 0 && (
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: '500',
                              color: source.sentimentChange >= 0 ? '#06c686' : '#f94343',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              {source.sentimentChange >= 0 ? '↑' : '↓'} {Math.abs(source.sentimentChange).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        {source.topics.length > 0 ? (
                          <div
                            style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', position: 'relative', maxWidth: '250px' }}
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
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  backgroundColor: '#e0f2fe',
                                  color: '#0369a1',
                                  cursor: 'default',
                                  border: '1px solid #bae6fd'
                                }}
                              >
                                {topic}
                              </span>
                            ))}
                            {source.topics.length > 2 && (
                              <span
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  backgroundColor: '#f1f5f9',
                                  color: '#64748b',
                                  cursor: 'default',
                                  border: '1px solid #e2e8f0'
                                }}
                                title={source.topics.slice(2).join(', ')}
                              >
                                +{source.topics.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#cbd5e1' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px', maxWidth: '250px' }}>
                        {source.pages.length > 0 ? (
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#00bcdc',
                              cursor: 'pointer',
                              fontWeight: '500',
                              display: 'inline-block',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => {
                              setModalType('pages');
                              setModalData(source.pages);
                              setModalTitle(`Pages citing ${source.name}`);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                            title={source.pages[0]}
                          >
                            {source.pages[0]}
                            {source.pages.length > 1 && (
                              <span style={{ color: '#64748b', marginLeft: '4px' }}>
                                +{source.pages.length - 1} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#cbd5e1' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px', maxWidth: '300px' }}>
                        {source.prompts.length > 0 ? (
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#00bcdc',
                              cursor: 'pointer',
                              fontWeight: '500',
                              display: 'inline-block',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => {
                              setModalType('prompts');
                              setModalData(source.prompts);
                              setModalTitle(`Prompts citing ${source.name}`);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                            title={source.prompts[0]}
                          >
                            {source.prompts[0]}
                            {source.prompts.length > 1 && (
                              <span style={{ color: '#64748b', marginLeft: '4px' }}>
                                +{source.prompts.length - 1} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#cbd5e1' }}>—</span>
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
          </>
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
                  aria-label="Close modal"
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
            topics={allTopics.length > 0 ? allTopics : topicOptions}
            data={heatmapData}
          />
        )}
      </div>
    </Layout>
  );
};
