import { useState, useMemo } from 'react';
import { IconDownload } from '@tabler/icons-react';

interface SourceCoverageHeatmapProps {
  sources: Array<{
    name: string;
    type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
    url: string;
  }>;
  topics: string[];
  data: Record<string, number[]>;
}

type MetricType = 'mentionRate' | 'soa' | 'sentiment' | 'citations';
type SortType = 'total' | 'name' | 'type' | 'priority';

export const SourceCoverageHeatmap = ({ sources, topics, data }: SourceCoverageHeatmapProps) => {
  const [metric, setMetric] = useState<MetricType>('mentionRate');
  const [sortSources, setSortSources] = useState<SortType>('total');
  const [sortTopics, setSortTopics] = useState<SortType>('total');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');

  const filteredSources = useMemo(() => {
    let filtered = sourceTypeFilter === 'all'
      ? sources
      : sources.filter(s => s.type === sourceTypeFilter);

    if (sortSources === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortSources === 'type') {
      filtered = [...filtered].sort((a, b) => a.type.localeCompare(b.type));
    } else if (sortSources === 'total') {
      filtered = [...filtered].sort((a, b) => {
        const aTotal = data[a.name].reduce((sum, val) => sum + val, 0);
        const bTotal = data[b.name].reduce((sum, val) => sum + val, 0);
        return bTotal - aTotal;
      });
    }

    return filtered;
  }, [sources, sourceTypeFilter, sortSources, data]);

  const sortedTopics = useMemo(() => {
    if (sortTopics === 'name') {
      return [...topics].sort();
    } else if (sortTopics === 'total') {
      return [...topics].sort((a, b) => {
        const aIdx = topics.indexOf(a);
        const bIdx = topics.indexOf(b);
        const aTotal = filteredSources.reduce((sum, s) => sum + (data[s.name]?.[aIdx] || 0), 0);
        const bTotal = filteredSources.reduce((sum, s) => sum + (data[s.name]?.[bIdx] || 0), 0);
        return bTotal - aTotal;
      });
    }
    return topics;
  }, [topics, sortTopics, filteredSources, data]);

  const stats = useMemo(() => {
    const allValues = filteredSources.flatMap(s => data[s.name] || []);
    const highestSource = filteredSources.reduce((max, s) => {
      const avg = (data[s.name] || []).reduce((sum, v) => sum + v, 0) / topics.length;
      const maxAvg = (data[max.name] || []).reduce((sum, v) => sum + v, 0) / topics.length;
      return avg > maxAvg ? s : max;
    }, filteredSources[0]);

    const topicAverages = sortedTopics.map((topic, idx) => {
      const topicIdx = topics.indexOf(topic);
      const avg = filteredSources.reduce((sum, s) => sum + (data[s.name]?.[topicIdx] || 0), 0) / filteredSources.length;
      return { topic, avg };
    });
    const topTopic = topicAverages.reduce((max, t) => t.avg > max.avg ? t : max, topicAverages[0]);

    const gaps = allValues.filter(v => v < 5).length;
    const highValue = allValues.filter(v => v > 35).length;

    return {
      highestSource,
      topTopic,
      gaps,
      highValue
    };
  }, [filteredSources, topics, sortedTopics, data]);

  const getCellColor = (value: number) => {
    if (value === 0) {
      return { bg: '#fafafa', color: '#393e51', border: '1px dashed #c6c9d2' };
    }
    const intensity = value / 45;
    // Using blue color scheme from dataviz-1 (#498cf9)
    const hue = 215;
    const saturation = 85 + (intensity * 10);
    const lightness = 96 - (intensity * 50);
    return {
      bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      color: intensity > 0.5 ? '#ffffff' : '#212534',
      border: 'none'
    };
  };

  return (
    <>
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
          <div className="text-xs text-[var(--text-caption)] mb-2 uppercase tracking-wide font-medium">
            Highest Coverage Source
          </div>
          <div className="text-2xl font-bold text-[var(--text-body)] mb-1">
            {stats.highestSource?.name || 'N/A'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--text-success)]">↑ 8%</span>
          </div>
          <div className="text-xs text-[var(--text-caption)] mt-1">
            45% avg mention rate across topics
          </div>
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
          <div className="text-xs text-[var(--text-caption)] mb-2 uppercase tracking-wide font-medium">
            Top Topic
          </div>
          <div className="text-2xl font-bold text-[var(--text-body)] mb-1">
            {stats.topTopic?.topic || 'N/A'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--text-success)]">↑ 5%</span>
          </div>
          <div className="text-xs text-[var(--text-caption)] mt-1">
            {stats.topTopic?.avg.toFixed(0)}% avg mention rate across sources
          </div>
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
          <div className="text-xs text-[var(--text-caption)] mb-2 uppercase tracking-wide font-medium">
            Coverage Gaps
          </div>
          <div className="text-3xl font-bold text-[var(--text-body)] mb-1">
            {stats.gaps}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--text-error)]">↓ 3</span>
          </div>
          <div className="text-xs text-[var(--text-caption)] mt-1">
            Source-topic pairs with &lt;5% mention
          </div>
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
          <div className="text-xs text-[var(--text-caption)] mb-2 uppercase tracking-wide font-medium">
            High-Value Pairs
          </div>
          <div className="text-3xl font-bold text-[var(--text-body)] mb-1">
            {stats.highValue}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-[var(--text-success)]">↑ 4</span>
          </div>
          <div className="text-xs text-[var(--text-caption)] mt-1">
            Pairs with &gt;35% mention rate
          </div>
        </div>
      </div>

      {/* Main Heatmap Card */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1a1d29', fontFamily: 'Sora, sans-serif', margin: 0 }}>
            Interactive Heatmap
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
            Export matrix <IconDownload size={14} />
          </a>
        </div>

        <p style={{ fontSize: '14px', color: '#393e51', marginBottom: '24px', lineHeight: '1.6' }}>
          This heatmap shows how frequently each source mentions your brand across different topics.
          <strong> Dark cells = high mention rate</strong> (strengths to amplify).
          <strong> Light cells = low/zero mentions</strong> (optimization opportunities).
          Click any cell to filter the Sources page to that specific source-topic combination.
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Metric:</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricType)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdfe5',
                borderRadius: '4px',
                background: '#ffffff',
                color: '#212534',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="mentionRate">Brand Mention Rate (%)</option>
              <option value="soa">Share of Answer (×)</option>
              <option value="sentiment">Avg Sentiment Score</option>
              <option value="citations">Total Citations</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Sort Sources:</span>
            <select
              value={sortSources}
              onChange={(e) => setSortSources(e.target.value as SortType)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdfe5',
                borderRadius: '4px',
                background: '#ffffff',
                color: '#212534',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="total">Total Coverage (High to Low)</option>
              <option value="name">Alphabetical</option>
              <option value="type">By Source Type</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Sort Topics:</span>
            <select
              value={sortTopics}
              onChange={(e) => setSortTopics(e.target.value as SortType)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdfe5',
                borderRadius: '4px',
                background: '#ffffff',
                color: '#212534',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="total">Total Coverage (High to Low)</option>
              <option value="name">Alphabetical</option>
              <option value="priority">By Priority</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#393e51', fontWeight: '500' }}>Filter Source Type:</span>
            <select
              value={sourceTypeFilter}
              onChange={(e) => setSourceTypeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdfe5',
                borderRadius: '4px',
                background: '#ffffff',
                color: '#212534',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Types</option>
              <option value="brand">Your Brand</option>
              <option value="editorial">Editorial</option>
              <option value="corporate">Corporate</option>
              <option value="reference">Reference</option>
              <option value="institutional">Institutional</option>
              <option value="ugc">User-Generated</option>
            </select>
          </div>
        </div>

      </div>

      {/* Heatmap - Outside the card */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        marginTop: '24px'
      }}>
        <div style={{
          overflowX: 'auto',
          border: '1px solid #e8e9ed',
          borderRadius: '6px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `180px repeat(${sortedTopics.length}, 140px)`,
            gap: '2px',
            minWidth: 'max-content',
            background: '#e8e9ed',
            padding: '2px'
          }}>
            {/* Corner cell */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '500',
              background: '#1a1d29',
              color: 'white',
              position: 'sticky',
              top: 0,
              left: 0,
              zIndex: 20
            }}>
              Source / Topic
            </div>

            {/* Header row */}
            {sortedTopics.map(topic => (
              <div
                key={topic}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: '#1a1d29',
                  color: 'white',
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
            {filteredSources.map(source => (
              <>
                {/* Row header */}
                <div
                  key={`${source.name}-header`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
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
                {sortedTopics.map((topic) => {
                  const topicIdx = topics.indexOf(topic);
                  const value = data[source.name]?.[topicIdx] || 0;
                  const cellStyle = getCellColor(value);

                  return (
                    <div
                      key={`${source.name}-${topic}`}
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
                        background: cellStyle.bg,
                        color: cellStyle.color,
                        border: cellStyle.border,
                        position: 'relative'
                      }}
                      onClick={() => {
                        alert(`Filtering to:\n\nSource: ${source.name}\nTopic: ${topic}\nMention Rate: ${value}%\n\nThis would navigate to the Top Sources tab with filters applied.`);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.08)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
                        e.currentTarget.style.zIndex = '15';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.zIndex = '1';
                      }}
                      title={`${source.name} × ${topic}\nMention Rate: ${value}%\nClick to drill down`}
                    >
                      <span style={{ fontSize: '18px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700' }}>
                        {value}%
                      </span>
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        mention rate
                      </span>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '20px',
          padding: '16px',
          background: '#f4f4f6',
          borderRadius: '6px'
        }}>
          <span style={{ fontSize: '12px', color: '#393e51', fontWeight: '600', marginRight: '8px' }}>
            Brand Mention Rate:
          </span>
          <div style={{
            height: '24px',
            width: '300px',
            background: 'linear-gradient(to right, hsl(215, 85%, 96%), hsl(215, 90%, 75%), hsl(215, 93%, 60%), hsl(215, 95%, 46%))',
            borderRadius: '4px',
            border: '1px solid #dcdfe5'
          }} />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '300px',
            fontSize: '11px',
            color: '#393e51',
            marginLeft: '8px'
          }}>
            <span>0%</span>
            <span>15%</span>
            <span>30%</span>
            <span>45%+</span>
          </div>
        </div>
      </div>
    </>
  );
};
