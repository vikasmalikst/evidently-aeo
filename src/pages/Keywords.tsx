import { useEffect, useMemo, useState, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Scatter, Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { IconX, IconTarget } from '@tabler/icons-react';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);
import { useManualBrandDashboard } from '../manual-dashboard';
import { useAuthStore } from '../store/authStore';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { apiClient } from '../lib/apiClient';
import { useChartResize } from '../hooks/useChartResize';
import { getLLMIcon } from '../components/Visibility/LLMIcons';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

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
const LLM_PROVIDER_TO_COLLECTOR_TYPE: Record<string, string> = {
  'ChatGPT': 'chatgpt',
  'Claude': 'claude',
  'Gemini': 'gemini',
  'Perplexity': 'perplexity',
  'Bing Copilot': 'copilot',
  'Grok': 'grok',
};

interface KeywordData {
  keyword: string;
  searchVolume: number;
  ownership: number;
  mentions: number;
  categories: ('brand' | 'competitor' | 'trending' | 'contested')[];
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

interface SentimentKeywordData {
    topic: string;
    sentiment: number;
    strength: number;
    narrative: string;
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

type SortKey = 'keyword' | 'searchVolume' | 'ownership';

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

interface SentimentKeywordData {
    keyword: string;
    sentiment: number;
    sentimentLabel: string;
    mentions: number;
    citationDomains?: string[];
    citationCategories?: { category: string; count: number }[];
}

const SentimentDetailPanel = ({ keyword, onClose }: { keyword: SentimentKeywordData; onClose: () => void }) => (
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
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Sentiment Label</div>
        <div
          style={{
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: keyword.sentimentLabel === 'POSITIVE' ? '#dcfce7' : keyword.sentimentLabel === 'NEGATIVE' ? '#fee2e2' : '#fef9c3',
            color: keyword.sentimentLabel === 'POSITIVE' ? '#16a34a' : keyword.sentimentLabel === 'NEGATIVE' ? '#dc2626' : '#ca8a04',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          {keyword.sentimentLabel}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Sentiment Score</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: keyword.sentiment >= 50 ? COLORS.brand : COLORS.competitor }}>
            {keyword.sentiment}
          </div>
        </div>
        <div style={{ backgroundColor: COLORS.bgSecondary, borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Mentions</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.textHeadings }}>
            {keyword.mentions}
          </div>
        </div>
      </div>

      {/* Citation Information */}
      {(keyword.citationDomains?.length || keyword.citationCategories?.length) ? (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '12px' }}>
            Citation Sources
          </h4>
          {keyword.citationCategories && keyword.citationCategories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {keyword.citationCategories.map(({ category, count }) => (
                <span key={category} style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#f1f5f9',
                  fontSize: '12px',
                  color: '#475569'
                }}>
                  {category} ({count})
                </span>
              ))}
            </div>
          )}
          {keyword.citationDomains && keyword.citationDomains.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>Top Domains</div>
              <div style={{ fontSize: '12px', color: COLORS.textBody }}>
                {keyword.citationDomains.join(', ')}
              </div>
            </div>
          )}
        </div>
      ) : null}

       <p style={{ fontSize: '13px', color: '#64748b' }}>
          Sentiment score is derived from the overall brand sentiment in responses where this keyword appeared. Higher score = more positive.
      </p>
    </div>
  </div>
);

export const Keywords = () => {
  const authLoading = useAuthStore((state) => state.isLoading);
  const { selectedBrandId, selectedBrand, brands, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'market' | 'sentiment'>('market');
  const [keywordData, setKeywordData] = useState<KeywordData[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentKeywordData[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | SentimentKeywordData | null>(null);
  const [showMovement, setShowMovement] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedLlms, setSelectedLlms] = useState<string[]>([]);
  const [quadrantFilter, setQuadrantFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const chartRef = useRef<any>(null);
  // Domain filter for sentiment view
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [domainSearch, setDomainSearch] = useState<string>('');
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);

  // Fetch real keyword analytics
  useEffect(() => {
    const fetchKeywords = async () => {
      if (authLoading || brandsLoading || !selectedBrandId) return;
      setLoading(true);
      setKeywordData([]);
      try {
        const params = new URLSearchParams();
        if (selectedLlms.length > 0) {
          const collectorTypes = selectedLlms
            .map((llm) => LLM_PROVIDER_TO_COLLECTOR_TYPE[llm] || llm)
            .filter((t) => t.trim().length > 0);
          if (collectorTypes.length > 0) {
            params.set('collectorTypes', collectorTypes.join(','));
          }
        }
        // optional: add date range later
        const endpoint = `/brands/${selectedBrandId}/keywords?${params.toString()}`;
        const response = await apiClient.request<ApiResponse<KeywordAnalyticsPayload>>(endpoint);
        if (response.success && response.data) {
          const items = response.data.keywords || [];
          // Map to visualization model
          const maxVolume = items.reduce((m: number, x: KeywordAnalyticsItem) => Math.max(m, x.volume), 1);
          const mapped: KeywordData[] = items.map((it: KeywordAnalyticsItem) => {
            // Ownership is average brand share across all brand positions (where competitor_name is null)
            const ownership = it.volume > 0 ? Math.round((it.brandPositions / it.volume) * 100) : 0;
            const searchVolume = it.volume; // volume = positions where competitor_name is null (brand positions only)
            const categories: ('brand' | 'competitor' | 'trending' | 'contested')[] = [];
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
    
    if (viewMode === 'market') {
        fetchKeywords();
    } else {
        const fetchSentiment = async () => {
            if (authLoading || brandsLoading || !selectedBrandId) return;
            setLoading(true);
            try {
                const response = await apiClient.request<ApiResponse<SentimentKeywordData[]>>(`/recommendations-v3/analyze/keyword-mapping?brandId=${selectedBrandId}`);
                if (response.success && response.data) {
                    setSentimentData(response.data);
                } else {
                    setSentimentData([]);
                }
            } catch (e) {
                console.error('Failed to load sentiment mapping', e);
            } finally {
                setLoading(false);
            }
        };
        fetchSentiment();
    }
  }, [authLoading, brandsLoading, selectedBrandId, selectedLlms, viewMode]);

  const filteredData = useMemo(() => {
    return keywordData.filter((kw) => {
      if (categoryFilter !== 'all' && !kw.categories.includes(categoryFilter as any)) return false;
      if (selectedLlms.length > 0) {
        const matchesSelectedLlm = selectedLlms.some((selected) => {
          const selectedCompact = selected.toLowerCase().replace(/[\s_-]/g, '');
          return kw.llmProviders.some((provider) => {
            const providerCompact = provider.toLowerCase().replace(/[\s_-]/g, '');
            return providerCompact === selectedCompact || providerCompact.includes(selectedCompact) || selectedCompact.includes(providerCompact);
          });
        });
        if (!matchesSelectedLlm) return false;
      }
      if (quadrantFilter !== 'all' && getQuadrant(kw) !== quadrantFilter) return false;
      return true;
    });
  }, [keywordData, categoryFilter, selectedLlms, quadrantFilter]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const directionFactor = sortDirection === 'asc' ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      if (sortKey === 'keyword') {
        return a.keyword.localeCompare(b.keyword, undefined, { sensitivity: 'base' }) * directionFactor;
      }
      return (a[sortKey] - b[sortKey]) * directionFactor;
    });
  }, [filteredData, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'keyword' ? 'asc' : 'desc');
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return (
      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  // Compute all unique domains from sentiment data
  const allDomains = useMemo(() => {
    const domains = new Set<string>();
    sentimentData.forEach(kw => {
      kw.citationDomains?.forEach(d => domains.add(d));
    });
    return Array.from(domains).sort();
  }, [sentimentData]);

  // Filter domains for search
  const filteredDomains = useMemo(() => {
    if (!domainSearch) return allDomains;
    const search = domainSearch.toLowerCase();
    return allDomains.filter(d => d.toLowerCase().includes(search));
  }, [allDomains, domainSearch]);

  // Filter sentiment data by selected domain
  const filteredSentimentData = useMemo(() => {
    if (domainFilter === 'all') return sentimentData;
    return sentimentData.filter(kw => 
      kw.citationDomains?.includes(domainFilter)
    );
  }, [sentimentData, domainFilter]);

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

  const sentimentChartData = {
    datasets: sentimentData.map((kw) => ({
        label: kw.keyword,
        data: [{
            x: kw.sentiment,
            y: kw.mentions,
            // Bubble size: base 8, up to 20 based on mentions
            r: Math.min(7, 8 + kw.mentions * 2)
        }],
        // Color based on sentiment label
        backgroundColor: kw.sentimentLabel === 'POSITIVE' ? COLORS.brand : kw.sentimentLabel === 'NEGATIVE' ? COLORS.competitor : COLORS.contested,
        borderColor: '#fff',
        borderWidth: 1
    }))
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
            if (viewMode === 'market') {
              const kw = filteredData.find(k => k.keyword === context.dataset.label || k.keyword === context.dataset.label.replace(' (previous)', ''));
              if (!kw) return '';
              return [
                `Ownership: ${kw.ownership}%`,
                `Positions (volume): ${kw.searchVolume.toLocaleString()}`,
                `Responses: ${kw.mentions.toLocaleString()}`,
              ];
            } else {
              // Sentiment View
              const kw = sentimentData.find(s => s.keyword === context.dataset.label);
              if (!kw) return '';
              return [
                `Sentiment: ${kw.sentimentLabel}`,
                `Score: ${kw.sentiment}`,
                `Mentions: ${kw.mentions}`,
              ];
            }
          },
        },
      },
    },
    scales: {
      x: viewMode === 'market' ? {
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
      } : {
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
      y: viewMode === 'market' ? {
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
      } : {
        title: {
            display: true,
            text: 'Mentions',
            font: { size: 13, weight: '600' },
            color: COLORS.textBody,
        },
        grid: { color: COLORS.gridLines },
        min: 0
      },
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements.length > 0) {
        const datasetIndex = elements[0].datasetIndex;
        if (viewMode === 'market') {
          const dataset = chartData.datasets[datasetIndex];
          const keywordLabel = dataset.label.replace(' (previous)', '');
          const keyword = filteredData.find(k => k.keyword === keywordLabel);
          if (keyword) setSelectedKeyword(keyword);
        } else {
          const dataset = sentimentChartData.datasets[datasetIndex];
          const keywordLabel = dataset.label;
          const kw = sentimentData.find(s => s.keyword === keywordLabel);
          if (kw) setSelectedKeyword(kw);
        }
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

      if (viewMode === 'market') {
          // Logic for market view (midpoint dynamic or 50)
          const xMid = xScale.getPixelForValue(10000); // Or calculate dynamic mid
          const yMid = yScale.getPixelForValue(50);
          
          ctx.beginPath();
          ctx.moveTo(xMid, chartArea.top);
          ctx.lineTo(xMid, chartArea.bottom);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(chartArea.left, yMid);
          ctx.lineTo(chartArea.right, yMid);
          ctx.stroke();
          
           ctx.fillText('Golden Keywords', (xMid + chartArea.right) / 2, chartArea.top + 20);
           ctx.fillText('Niche Dominance', (chartArea.left + xMid) / 2, chartArea.top + 20);
           ctx.fillText('Opportunity Zone', (xMid + chartArea.right) / 2, chartArea.bottom - 10);
           ctx.fillText('Low Priority', (chartArea.left + xMid) / 2, chartArea.bottom - 10);
      } else {
          // Sentiment View: Cross at 0, 0? Or 0 Sentiment?
          // X Axis is Sentiment (-100 to 100). Mid is 0.
          // Y Axis is Strength. Mid is ??? Let's say 50% of max.
          const xMid = xScale.getPixelForValue(0);
          const yMax = yScale.max || 100;
          const yMid = yScale.getPixelForValue(yMax / 2);

          ctx.beginPath();
          ctx.moveTo(xMid, chartArea.top);
          ctx.lineTo(xMid, chartArea.bottom);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(chartArea.left, yMid);
          ctx.lineTo(chartArea.right, yMid);
          ctx.stroke();

           ctx.fillText('Brand Strongholds', (xMid + chartArea.right) / 2, chartArea.top + 20);
           ctx.fillText('Critical Risks', (chartArea.left + xMid) / 2, chartArea.top + 20);
           ctx.fillText('Potential Growth', (xMid + chartArea.right) / 2, chartArea.bottom - 10);
           ctx.fillText('Nuisance / Ignored', (chartArea.left + xMid) / 2, chartArea.bottom - 10);
      }
    },
  };

  ChartJS.register(quadrantPlugin);

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '8px' }}>
            {selectedBrand && (
              <SafeLogo
                src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                domain={selectedBrand.homepage_url || undefined}
                alt={selectedBrand.name}
                size={48}
                className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
              />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <IconTarget size={28} color={COLORS.accentPrimary} />
                <h1 style={{ fontSize: '28px', fontWeight: '600', color: COLORS.textHeadings, margin: 0 }}>
                  {viewMode === 'market' ? 'Keyword Strategic Matrix' : 'Sentiment Landscape'}
                </h1>
              </div>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                {viewMode === 'market' ? 'Analyze keyword positioning across search volume and brand ownership' : 'Map keywords by Sentiment and Importance to identify Risks and Strongholds'}
              </p>
              
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setViewMode('market')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: viewMode === 'market' ? COLORS.accentPrimary : '#fff',
                        color: viewMode === 'market' ? '#fff' : COLORS.textBody,
                        border: '1px solid #e2e8f0',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                  >
                    Market Position
                  </button>
                    <button 
                    onClick={() => setViewMode('sentiment')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: viewMode === 'sentiment' ? COLORS.accentPrimary : '#fff',
                        color: viewMode === 'sentiment' ? '#fff' : COLORS.textBody,
                        border: '1px solid #e2e8f0',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                  >
                    Sentiment Landscape
                  </button>
              </div>
            </div>
          </div>
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
            ) : viewMode === 'market' ? (
              <Scatter 
                data={chartData} 
                options={options} 
                ref={chartRef} 
              />
            ) : (
              <Bubble 
                data={sentimentChartData} 
                options={options} 
                ref={chartRef} 
              />
            )}
          </div>
          {/* Color Legend for Sentiment View */}
          {viewMode === 'sentiment' && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '13px', color: COLORS.textBody }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.brand, display: 'inline-block' }}></span>
                Positive Sentiment
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.contested, display: 'inline-block' }}></span>
                Neutral
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.competitor, display: 'inline-block' }}></span>
                Negative Sentiment
              </span>
            </div>
          )}
        </div>

        {viewMode === 'market' && (
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedLlms([])}
                style={{
                  padding: '6px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: `1px solid ${selectedLlms.length === 0 ? COLORS.brand : COLORS.gridLines}`,
                  backgroundColor: selectedLlms.length === 0 ? '#e6f7f1' : COLORS.bgPrimary,
                  color: selectedLlms.length === 0 ? '#027a48' : '#64748b',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title="All Models"
                aria-label="Show all models"
              >
                All
              </button>
              {LLM_PROVIDERS.map((llm) => {
                const isActive = selectedLlms.includes(llm);
                return (
                  <button
                    key={llm}
                    type="button"
                    onClick={() => {
                      setSelectedLlms((prev) => {
                        const currentlyActive = prev.includes(llm);
                        if (currentlyActive) return prev.filter((m) => m !== llm);
                        return [...prev, llm];
                      });
                    }}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '999px',
                      border: `1px solid ${isActive ? COLORS.brand : COLORS.gridLines}`,
                      backgroundColor: isActive ? '#e6f7f1' : COLORS.bgPrimary,
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={llm}
                    aria-label={`Filter by ${llm}`}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                      {getLLMIcon(llm)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${COLORS.gridLines}` }}>
                  <th
                    onClick={() => handleSort('keyword')}
                    style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span>
                      Keyword
                      {getSortIndicator('keyword')}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('searchVolume')}
                    style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span>
                      Volume
                      {getSortIndicator('searchVolume')}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort('ownership')}
                    style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span>
                      Brand Association
                      {getSortIndicator('ownership')}
                    </span>
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    LLM Sources
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((kw, idx) => (
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
        )}

        {/* Sentiment Table */}
        {viewMode === 'sentiment' && (
             <div
            style={{
                backgroundColor: COLORS.bgPrimary,
                border: `1px solid ${COLORS.gridLines}`,
                borderRadius: '12px',
                padding: '24px',
                overflowX: 'auto'
            }}
            >
             <h2 style={{ fontSize: '18px', fontWeight: '600', color: COLORS.textHeadings, marginBottom: '16px' }}>
                Keyword Sentiment Analysis
            </h2>
            
            {/* Domain Filter Dropdown */}
            <div style={{ marginBottom: '16px', position: 'relative', maxWidth: '300px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', display: 'block' }}>
                Filter by Source/Domain
              </label>
              <div 
                onClick={() => setShowDomainDropdown(!showDomainDropdown)}
                style={{
                  padding: '10px 12px',
                  border: `1px solid ${COLORS.gridLines}`,
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '14px',
                  color: COLORS.textBody
                }}
              >
                <span>{domainFilter === 'all' ? 'All Sources' : domainFilter}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>{showDomainDropdown ? '▲' : '▼'}</span>
              </div>
              
              {showDomainDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#fff',
                  border: `1px solid ${COLORS.gridLines}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  maxHeight: '300px',
                  overflow: 'hidden'
                }}>
                  {/* Search Input */}
                  <div style={{ padding: '8px', borderBottom: `1px solid ${COLORS.gridLines}` }}>
                    <input
                      type="text"
                      placeholder="Search domains..."
                      value={domainSearch}
                      onChange={(e) => setDomainSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: `1px solid ${COLORS.gridLines}`,
                        borderRadius: '6px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  
                  {/* Options List */}
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    <div
                      onClick={() => { setDomainFilter('all'); setShowDomainDropdown(false); setDomainSearch(''); }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        backgroundColor: domainFilter === 'all' ? '#f0f9ff' : 'transparent',
                        fontSize: '13px',
                        color: COLORS.textBody,
                        borderBottom: `1px solid ${COLORS.gridLines}`
                      }}
                    >
                      All Sources ({sentimentData.length} keywords)
                    </div>
                    {filteredDomains.map(domain => {
                      const count = sentimentData.filter(kw => kw.citationDomains?.includes(domain)).length;
                      return (
                        <div
                          key={domain}
                          onClick={() => { setDomainFilter(domain); setShowDomainDropdown(false); setDomainSearch(''); }}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            backgroundColor: domainFilter === domain ? '#f0f9ff' : 'transparent',
                            fontSize: '13px',
                            color: COLORS.textBody,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = domainFilter === domain ? '#f0f9ff' : 'transparent'}
                        >
                          <span>{domain}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{count}</span>
                        </div>
                      );
                    })}
                    {filteredDomains.length === 0 && (
                      <div style={{ padding: '12px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                        No domains found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                <tr style={{ borderBottom: `2px solid ${COLORS.gridLines}` }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Keyword</th>
                    <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Sentiment</th>
                    <th style={{ textAlign: 'center', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Score</th>
                    <th style={{ textAlign: 'right', padding: '12px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Mentions</th>
                </tr>
                </thead>
                <tbody>
                {filteredSentimentData.map((kw, idx) => (
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
                    <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textBody, textAlign: 'right' }}>{kw.mentions}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        )}


        {selectedKeyword && viewMode === 'market' && 'ownership' in selectedKeyword && (
          <DetailPanel keyword={selectedKeyword as KeywordData} onClose={() => setSelectedKeyword(null)} />
        )}
        {selectedKeyword && viewMode === 'sentiment' && 'sentimentLabel' in selectedKeyword && (
            <SentimentDetailPanel keyword={selectedKeyword as SentimentKeywordData} onClose={() => setSelectedKeyword(null)} />
        )}
      </div>
    </Layout>
  );
};
