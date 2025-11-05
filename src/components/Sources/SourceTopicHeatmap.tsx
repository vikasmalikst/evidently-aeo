import { useState, useMemo } from 'react';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

interface HeatmapData {
  [source: string]: number[];
}

interface SourceInfo {
  name: string;
  type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
}

const topics = [
  'Innovation',
  'Trends',
  'Sustainability',
  'Pricing',
  'Comparison',
  'Reviews',
  'Technology',
  'Market'
];

const sources: SourceInfo[] = [
  { name: 'your-brand.com', type: 'brand' },
  { name: 'techcrunch.com', type: 'editorial' },
  { name: 'forbes.com', type: 'editorial' },
  { name: 'wired.com', type: 'editorial' },
  { name: 'bloomberg.com', type: 'editorial' },
  { name: 'theverge.com', type: 'editorial' },
  { name: 'microsoft.com', type: 'corporate' },
  { name: 'apple.com', type: 'corporate' },
  { name: 'google.com', type: 'corporate' },
  { name: 'wikipedia.org', type: 'reference' },
  { name: 'britannica.com', type: 'reference' },
  { name: 'reddit.com', type: 'ugc' },
  { name: 'github.com', type: 'ugc' },
  { name: 'stackoverflow.com', type: 'ugc' },
  { name: 'mit.edu', type: 'institutional' },
  { name: 'stanford.edu', type: 'institutional' },
  { name: 'medium.com', type: 'editorial' },
  { name: 'mashable.com', type: 'editorial' },
  { name: 'engadget.com', type: 'editorial' },
  { name: 'salesforce.com', type: 'corporate' }
];

const generateHeatmapData = (): HeatmapData => {
  const data: HeatmapData = {};

  sources.forEach(source => {
    data[source.name] = topics.map((topic) => {
      let baseRate = Math.random() * 40;

      if (source.type === 'brand') baseRate = Math.random() * 15 + 30;
      if (source.type === 'editorial') baseRate += 10;
      if (source.type === 'corporate') {
        if (topic === 'Innovation' || topic === 'Technology') baseRate += 15;
      }
      if (source.type === 'reference') baseRate = Math.max(2, baseRate - 15);

      return Math.min(45, Math.max(0, Math.round(baseRate)));
    });
  });

  return data;
};

export const SourceTopicHeatmap = () => {
  const [heatmapData] = useState<HeatmapData>(generateHeatmapData());

  const getCellColor = (value: number) => {
    const intensity = value / 45;
    // Using blue color scheme from dataviz-1 (#498cf9)
    const hue = 215;
    const saturation = 85 + (intensity * 10);
    const lightness = 96 - (intensity * 50);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const getCellTextColor = (value: number) => {
    const intensity = value / 45;
    return intensity > 0.5 ? '#ffffff' : '#212534';
  };

  return (
    <div>
      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f4f4f6', padding: '16px', borderRadius: '6px', borderLeft: '4px solid #00bcdc' }}>
          <div style={{ fontSize: '12px', color: '#393e51', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '500' }}>
            Highest Coverage Source
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1d29', fontFamily: 'IBM Plex Mono, monospace' }}>
            your-brand.com
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: '#06c686' }}>
            <IconTrendingUp size={12} />
            <span>8%</span>
          </div>
          <div style={{ fontSize: '11px', color: '#393e51', marginTop: '4px' }}>
            45% avg mention rate across topics
          </div>
        </div>

        <div style={{ background: '#f4f4f6', padding: '16px', borderRadius: '6px', borderLeft: '4px solid #00bcdc' }}>
          <div style={{ fontSize: '12px', color: '#393e51', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '500' }}>
            Top Topic
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1d29', fontFamily: 'IBM Plex Mono, monospace' }}>
            Innovation
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: '#06c686' }}>
            <IconTrendingUp size={12} />
            <span>5%</span>
          </div>
          <div style={{ fontSize: '11px', color: '#393e51', marginTop: '4px' }}>
            38% avg mention rate across sources
          </div>
        </div>

        <div style={{ background: '#f4f4f6', padding: '16px', borderRadius: '6px', borderLeft: '4px solid #00bcdc' }}>
          <div style={{ fontSize: '12px', color: '#393e51', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '500' }}>
            Coverage Gaps
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1d29', fontFamily: 'IBM Plex Mono, monospace' }}>
            18
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: '#f94343' }}>
            <IconTrendingDown size={12} />
            <span>3</span>
          </div>
          <div style={{ fontSize: '11px', color: '#393e51', marginTop: '4px' }}>
            Source-topic pairs with &lt;5% mention
          </div>
        </div>

        <div style={{ background: '#f4f4f6', padding: '16px', borderRadius: '6px', borderLeft: '4px solid #00bcdc' }}>
          <div style={{ fontSize: '12px', color: '#393e51', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '500' }}>
            High-Value Pairs
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1d29', fontFamily: 'IBM Plex Mono, monospace' }}>
            12
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: '#06c686' }}>
            <IconTrendingUp size={12} />
            <span>4</span>
          </div>
          <div style={{ fontSize: '11px', color: '#393e51', marginTop: '4px' }}>
            Pairs with &gt;35% mention rate
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Metric:</span>
          <select style={{ padding: '8px 12px', border: '1px solid #dcdfe5', borderRadius: '4px', background: '#ffffff', color: '#212534', fontSize: '13px', cursor: 'pointer' }}>
            <option value="mentionRate">Brand Mention Rate (%)</option>
            <option value="soa">Share of Answer (×)</option>
            <option value="sentiment">Avg Sentiment Score</option>
            <option value="citations">Total Citations</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Sort Sources:</span>
          <select style={{ padding: '8px 12px', border: '1px solid #dcdfe5', borderRadius: '4px', background: '#ffffff', color: '#212534', fontSize: '13px', cursor: 'pointer' }}>
            <option value="total">Total Coverage (High to Low)</option>
            <option value="name">Alphabetical</option>
            <option value="type">By Source Type</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Filter Source Type:</span>
          <select style={{ padding: '8px 12px', border: '1px solid #dcdfe5', borderRadius: '4px', background: '#ffffff', color: '#212534', fontSize: '13px', cursor: 'pointer' }}>
            <option value="all">All Types</option>
            <option value="brand">Your Brand</option>
            <option value="editorial">Editorial</option>
            <option value="corporate">Corporate</option>
            <option value="reference">Reference</option>
          </select>
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '700px', border: '1px solid #e8e9ed', borderRadius: '6px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `180px repeat(${topics.length}, 140px)`,
            gap: '2px',
            minWidth: 'max-content',
            background: '#e8e9ed',
            padding: '2px'
          }}
        >
          {/* Corner cell */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              fontSize: '11px',
              fontWeight: '600',
              color: '#ffffff',
              background: '#1a1d29',
              position: 'sticky',
              top: 0,
              left: 0,
              zIndex: 20
            }}
          >
            Source / Topic
          </div>

          {/* Header row (topics) */}
          {topics.map((topic) => (
            <div
              key={topic}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#ffffff',
                background: '#1a1d29',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {topic}
            </div>
          ))}

          {/* Data rows */}
          {sources.map((source) => (
            <>
              {/* Row header (source name) */}
              <div
                key={`${source.name}-header`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#212534',
                  background: '#e8e9ed',
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  borderRight: '2px solid #dcdfe5'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: '700' }}>{source.name}</span>
                  <span style={{ fontSize: '10px', color: '#393e51', fontWeight: '400', textTransform: 'capitalize' }}>
                    {source.type}
                  </span>
                </div>
              </div>

              {/* Data cells */}
              {heatmapData[source.name].map((value, idx) => (
                <div
                  key={`${source.name}-${topics[idx]}`}
                  style={{
                    padding: '16px 8px',
                    textAlign: 'center',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '6px',
                    background: value === 0 ? '#fafafa' : getCellColor(value),
                    color: getCellTextColor(value),
                    border: value === 0 ? '1px dashed #c6c9d2' : 'none',
                    position: 'relative'
                  }}
                  title={`${source.name} × ${topics[idx]}\nMention Rate: ${value}%\nClick to drill down`}
                  onClick={() => {
                    alert(`Filtering to:\n\nSource: ${source.name}\nTopic: ${topics[idx]}\nMention Rate: ${value}%\n\nThis would navigate to the Answer Sources tab with filters applied.`);
                  }}
                >
                  <span style={{ fontSize: '18px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700' }}>
                    {value}%
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>
                    mention rate
                  </span>
                </div>
              ))}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '20px',
          padding: '16px',
          background: '#f4f4f6',
          borderRadius: '6px'
        }}
      >
        <span style={{ fontSize: '12px', color: '#393e51', fontWeight: '600', marginRight: '8px' }}>
          Brand Mention Rate:
        </span>
        <div
          style={{
            height: '24px',
            width: '300px',
            background: 'linear-gradient(to right, hsl(180, 70%, 95%), hsl(180, 80%, 75%), hsl(180, 85%, 55%), hsl(180, 90%, 35%))',
            borderRadius: '4px',
            border: '1px solid #dcdfe5'
          }}
        ></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '300px', fontSize: '11px', color: '#393e51', marginLeft: '8px' }}>
          <span>0%</span>
          <span>15%</span>
          <span>30%</span>
          <span>45%+</span>
        </div>
      </div>
    </div>
  );
};
