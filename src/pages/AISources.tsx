import { useState, useMemo, useRef, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { IconTarget, IconDownload, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

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
}

const topicOptions = ['Innovation', 'Pricing', 'Technology', 'Trends', 'Sustainability', 'Product Comparison', 'Industry Analysis', 'Customer Success'];

const generateSourceData = (): SourceData[] => {
  const sources: SourceData[] = [];

  // Brand source
  sources.push({
    name: 'your-brand.com',
    url: 'https://your-brand.com',
    type: 'brand',
    mentionRate: 45,
    mentionChange: 8,
    soa: 2.8,
    soaChange: 0.4,
    sentiment: 0.88,
    sentimentChange: 0.15,
    citations: 28,
    topics: ['Innovation', 'Pricing', 'Technology']
  });

  // Editorial sources
  const editorialSources = [
    'techcrunch.com', 'forbes.com', 'wired.com', 'bloomberg.com', 'theverge.com',
    'cnet.com', 'arstechnica.com', 'engadget.com', 'technologyreview.com', 'venturebeat.com',
    'zdnet.com', 'businessinsider.com', 'fastcompany.com', 'inc.com', 'entrepreneur.com',
    'wsj.com', 'nytimes.com', 'reuters.com', 'apnews.com', 'bbc.com',
    'theguardian.com', 'washingtonpost.com', 'fortune.com', 'cnbc.com', 'marketwatch.com'
  ];

  editorialSources.forEach(domain => {
    sources.push({
      name: domain,
      url: `https://${domain}`,
      type: 'editorial',
      mentionRate: Math.floor(Math.random() * 35) + 5,
      mentionChange: Math.floor(Math.random() * 20) - 8,
      soa: parseFloat((Math.random() * 3 + 0.3).toFixed(1)),
      soaChange: parseFloat((Math.random() * 0.8 - 0.3).toFixed(1)),
      sentiment: parseFloat((Math.random() * 1.2 - 0.3).toFixed(2)),
      sentimentChange: parseFloat((Math.random() * 0.3 - 0.1).toFixed(2)),
      citations: Math.floor(Math.random() * 25) + 3,
      topics: topicOptions.slice(0, Math.floor(Math.random() * 3) + 1)
    });
  });

  // Corporate sources
  const corporateSources = [
    'microsoft.com', 'apple.com', 'google.com', 'salesforce.com', 'ibm.com',
    'oracle.com', 'sap.com', 'adobe.com', 'cisco.com', 'intel.com',
    'nvidia.com', 'aws.amazon.com', 'azure.microsoft.com', 'cloud.google.com', 'dell.com',
    'hp.com', 'lenovo.com', 'vmware.com', 'redhat.com', 'atlassian.com'
  ];

  corporateSources.forEach(domain => {
    sources.push({
      name: domain,
      url: `https://${domain}`,
      type: 'corporate',
      mentionRate: Math.floor(Math.random() * 30) + 3,
      mentionChange: Math.floor(Math.random() * 18) - 7,
      soa: parseFloat((Math.random() * 2.5 + 0.2).toFixed(1)),
      soaChange: parseFloat((Math.random() * 0.6 - 0.2).toFixed(1)),
      sentiment: parseFloat((Math.random() * 0.9 - 0.2).toFixed(2)),
      sentimentChange: parseFloat((Math.random() * 0.25 - 0.08).toFixed(2)),
      citations: Math.floor(Math.random() * 20) + 2,
      topics: topicOptions.slice(0, Math.floor(Math.random() * 3) + 1)
    });
  });

  // Reference sources
  const referenceSources = [
    'wikipedia.org', 'britannica.com', 'investopedia.com', 'dictionary.com', 'merriam-webster.com', 'oxfordreference.com'
  ];

  referenceSources.forEach(domain => {
    sources.push({
      name: domain,
      url: `https://${domain}`,
      type: 'reference',
      mentionRate: Math.floor(Math.random() * 25) + 5,
      mentionChange: Math.floor(Math.random() * 15) - 5,
      soa: parseFloat((Math.random() * 2.8 + 0.5).toFixed(1)),
      soaChange: parseFloat((Math.random() * 0.7 - 0.2).toFixed(1)),
      sentiment: parseFloat((Math.random() * 0.6 - 0.1).toFixed(2)),
      sentimentChange: parseFloat((Math.random() * 0.2 - 0.05).toFixed(2)),
      citations: Math.floor(Math.random() * 22) + 5,
      topics: topicOptions.slice(0, Math.floor(Math.random() * 2) + 1)
    });
  });

  // UGC sources
  const ugcSources = [
    'reddit.com', 'github.com', 'stackoverflow.com', 'medium.com', 'dev.to',
    'hackernews.com', 'producthunt.com', 'quora.com', 'discord.com', 'slack.com',
    'twitter.com', 'linkedin.com', 'youtube.com', 'substack.com', 'devto.com'
  ];

  ugcSources.forEach(domain => {
    sources.push({
      name: domain,
      url: `https://${domain}`,
      type: 'ugc',
      mentionRate: Math.floor(Math.random() * 28) + 2,
      mentionChange: Math.floor(Math.random() * 22) - 9,
      soa: parseFloat((Math.random() * 2.2 + 0.2).toFixed(1)),
      soaChange: parseFloat((Math.random() * 0.5 - 0.25).toFixed(1)),
      sentiment: parseFloat((Math.random() * 1.4 - 0.5).toFixed(2)),
      sentimentChange: parseFloat((Math.random() * 0.35 - 0.15).toFixed(2)),
      citations: Math.floor(Math.random() * 18) + 2,
      topics: topicOptions.slice(0, Math.floor(Math.random() * 3) + 1)
    });
  });

  // Institutional sources
  const institutionalSources = [
    'mit.edu', 'stanford.edu', 'harvard.edu', 'berkeley.edu', 'cmu.edu',
    'nih.gov', 'nsf.gov', 'nasa.gov', 'energy.gov', 'commerce.gov',
    'cambridge.org', 'oxford.ac.uk'
  ];

  institutionalSources.forEach(domain => {
    sources.push({
      name: domain,
      url: `https://${domain}`,
      type: 'institutional',
      mentionRate: Math.floor(Math.random() * 20) + 3,
      mentionChange: Math.floor(Math.random() * 12) - 4,
      soa: parseFloat((Math.random() * 2.5 + 0.3).toFixed(1)),
      soaChange: parseFloat((Math.random() * 0.5 - 0.15).toFixed(1)),
      sentiment: parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)),
      sentimentChange: parseFloat((Math.random() * 0.2 - 0.05).toFixed(2)),
      citations: Math.floor(Math.random() * 16) + 3,
      topics: topicOptions.slice(0, Math.floor(Math.random() * 2) + 1)
    });
  });

  // Fill remaining with more editorial and corporate
  const extraDomains = [
    { domain: 'protocol.com', type: 'editorial' as const },
    { domain: 'techradar.com', type: 'editorial' as const },
    { domain: 'digitaltrends.com', type: 'editorial' as const },
    { domain: 'pcmag.com', type: 'editorial' as const },
    { domain: 'gizmodo.com', type: 'editorial' as const },
    { domain: 'mashable.com', type: 'editorial' as const },
    { domain: 'shopify.com', type: 'corporate' as const },
    { domain: 'hubspot.com', type: 'corporate' as const },
    { domain: 'mailchimp.com', type: 'corporate' as const },
    { domain: 'slack.com', type: 'corporate' as const },
    { domain: 'zoom.us', type: 'corporate' as const },
    { domain: 'dropbox.com', type: 'corporate' as const },
    { domain: 'notion.so', type: 'corporate' as const },
    { domain: 'figma.com', type: 'corporate' as const },
    { domain: 'asana.com', type: 'corporate' as const },
    { domain: 'trello.com', type: 'corporate' as const },
    { domain: 'monday.com', type: 'corporate' as const },
    { domain: 'zendesk.com', type: 'corporate' as const },
    { domain: 'intercom.com', type: 'corporate' as const },
    { domain: 'stripe.com', type: 'corporate' as const }
  ];

  extraDomains.forEach(({ domain, type }) => {
    sources.push({
      name: domain,
      url: `https://${domain}`,
      type,
      mentionRate: Math.floor(Math.random() * 30) + 2,
      mentionChange: Math.floor(Math.random() * 20) - 8,
      soa: parseFloat((Math.random() * 2.8 + 0.2).toFixed(1)),
      soaChange: parseFloat((Math.random() * 0.6 - 0.25).toFixed(1)),
      sentiment: parseFloat((Math.random() * 1.1 - 0.3).toFixed(2)),
      sentimentChange: parseFloat((Math.random() * 0.3 - 0.12).toFixed(2)),
      citations: Math.floor(Math.random() * 20) + 2,
      topics: topicOptions.slice(0, Math.floor(Math.random() * 3) + 1)
    });
  });

  return sources.slice(0, 127);
};

export const AISources = () => {
  const [sourceData] = useState<SourceData[]>(generateSourceData());
  const [topicFilter, setTopicFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30');

  const filteredData = useMemo(() => {
    return sourceData.filter(source => {
      if (topicFilter !== 'all' && !source.topics.includes(topicFilter)) return false;
      if (sentimentFilter === 'positive' && source.sentiment <= 0.3) return false;
      if (sentimentFilter === 'neutral' && (source.sentiment < -0.1 || source.sentiment > 0.3)) return false;
      if (sentimentFilter === 'negative' && source.sentiment >= -0.1) return false;
      if (typeFilter !== 'all' && source.type !== typeFilter) return false;
      return true;
    });
  }, [sourceData, topicFilter, sentimentFilter, typeFilter]);

  const overallMentionRate = useMemo(() => {
    const avg = filteredData.reduce((sum, s) => sum + s.mentionRate, 0) / filteredData.length;
    return Math.round(avg);
  }, [filteredData]);

  const avgSentiment = useMemo(() => {
    const avg = filteredData.reduce((sum, s) => sum + s.sentiment, 0) / filteredData.length;
    return avg.toFixed(2);
  }, [filteredData]);

  const topSource = useMemo(() => {
    return filteredData.reduce((max, s) => s.mentionRate > max.mentionRate ? s : max, filteredData[0]);
  }, [filteredData]);

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
              `Share of Answer: ${source.soa}×`,
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
        max: 50,
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
        max: 3.5,
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

      const xMid = xScale.getPixelForValue(25);
      const yMid = yScale.getPixelForValue(1.75);

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
          <h1 style={{ fontSize: '28px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: '0 0 8px 0' }}>
            AI Sources
          </h1>
          <p style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', margin: 0 }}>
            Understand which AI sources cite your brand, measure share of answer across prompts, and identify optimization opportunities
          </p>

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
                <span style={{ fontSize: '13px', color: '#06c686', display: 'flex', alignItems: 'center' }}>
                  <IconTrendingUp size={16} style={{ marginRight: '2px' }} /> 3%
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#393e51' }}>
                Brand mentioned in {overallMentionRate} of 100 responses
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
                    {avgSentiment}
                  </span>
                  <span style={{ fontSize: '11px', color: '#06c686' }}>
                    <IconTrendingUp size={12} style={{ display: 'inline', marginRight: '2px' }} /> 0.12
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
                    {topSource?.name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#06c686' }}>
                    <IconTrendingUp size={12} style={{ display: 'inline', marginRight: '2px' }} /> 8%
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#393e51' }}>{topSource?.mentionRate}% mention · {filteredData.length} sources tracked</div>
              </div>
            </div>

            {/* Priority Action Card */}
            <div
              style={{
                backgroundColor: '#f0fbfd',
                borderLeft: '4px solid #06b6d4',
                padding: '16px',
                borderRadius: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🎯</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1d29' }}>Priority Action</span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    backgroundColor: '#f94343',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '700',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  HIGH
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#212534', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                wikipedia.org: 18% SoA but only 4% brand mention rate.
              </p>
              <div style={{ fontSize: '11px', color: '#393e51', marginBottom: '12px' }}>
                📊 23 prompts | 📈 +4.2% W_SoA
              </div>
              <button
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#0d7c96',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Update Wikipedia
              </button>
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
            {topicOptions.map(topic => (
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
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Source
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Type
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Mention Rate
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Share of Answer
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Sentiment
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Top Topics
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '11px', fontWeight: '600', color: '#393e51', textTransform: 'uppercase' }}>
                    Prompts
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
                            {source.mentionChange >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                            {Math.abs(source.mentionChange)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontFamily: 'IBM Plex Mono, monospace', color: '#212534' }}>
                            {source.soa}×
                          </span>
                          <span style={{ fontSize: '10px', color: source.soaChange >= 0 ? '#06c686' : '#f94343' }}>
                            {source.soaChange >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                            {Math.abs(source.soaChange)}
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
                            {source.sentimentChange >= 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                            {Math.abs(source.sentimentChange).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {source.topics.slice(0, 2).map(topic => (
                            <span
                              key={topic}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                backgroundColor: '#f4f4f6',
                                color: '#393e51'
                              }}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '13px', color: '#393e51' }}>
                        {source.citations} prompts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};
