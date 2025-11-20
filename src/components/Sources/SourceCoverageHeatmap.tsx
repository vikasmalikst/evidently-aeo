import { useState, useMemo } from 'react';
import { IconDownload } from '@tabler/icons-react';
import { SourceDetailModal } from './SourceDetailModal';

interface SourceCoverageHeatmapProps {
  sources: Array<{
    name: string;
    type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional';
    url: string;
  }>;
  topics: string[];
  data: Record<string, {
    mentionRate: number[];
    soa: number[];
    sentiment: number[];
    citations: number[];
  }>;
}

type MetricType = 'mentionRate' | 'soa' | 'sentiment' | 'citations';
type SortType = 'total' | 'name' | 'type' | 'priority';

export const SourceCoverageHeatmap = ({ sources, topics, data }: SourceCoverageHeatmapProps) => {
  const [metric, setMetric] = useState<MetricType>('mentionRate');
  const [sortSources, setSortSources] = useState<SortType>('total');
  const [sortTopics, setSortTopics] = useState<SortType>('total');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    source: string;
    topic: string;
    mentionRate: number;
    shareOfAnswer: number;
  } | null>(null);

  // Get current metric values for a source
  const getMetricValues = (sourceName: string): number[] => {
    const sourceData = data[sourceName];
    if (!sourceData) return [];
    return sourceData[metric] || [];
  };

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
        const aValues = getMetricValues(a.name);
        const bValues = getMetricValues(b.name);
        const aTotal = aValues.reduce((sum, val) => sum + val, 0);
        const bTotal = bValues.reduce((sum, val) => sum + val, 0);
        return bTotal - aTotal;
      });
    }

    return filtered;
  }, [sources, sourceTypeFilter, sortSources, data, metric]);

  const sortedTopics = useMemo(() => {
    if (sortTopics === 'name') {
      return [...topics].sort();
    } else if (sortTopics === 'total') {
      return [...topics].sort((a, b) => {
        const aIdx = topics.indexOf(a);
        const bIdx = topics.indexOf(b);
        const aTotal = filteredSources.reduce((sum, s) => {
          const values = getMetricValues(s.name);
          return sum + (values[aIdx] || 0);
        }, 0);
        const bTotal = filteredSources.reduce((sum, s) => {
          const values = getMetricValues(s.name);
          return sum + (values[bIdx] || 0);
        }, 0);
        return bTotal - aTotal;
      });
    }
    return topics;
  }, [topics, sortTopics, filteredSources, data, metric]);

  // Get max value for current metric to normalize colors
  const getMaxValue = (): number => {
    switch (metric) {
      case 'mentionRate':
        return 45;
      case 'soa':
        return 100;
      case 'sentiment':
        return 1;
      case 'citations':
        return 50;
      default:
        return 45;
    }
  };

  const stats = useMemo(() => {
    if (filteredSources.length === 0 || topics.length === 0) {
      return {
        highestSource: null,
        topTopic: { topic: 'N/A', avg: 0 },
        gaps: 0,
        highValue: 0
      };
    }
    
    const allValues = filteredSources.flatMap(s => getMetricValues(s.name));
    const highestSource = filteredSources.reduce((max, s) => {
      const values = getMetricValues(s.name);
      const maxValues = getMetricValues(max.name);
      const avg = values.reduce((sum, v) => sum + v, 0) / topics.length;
      const maxAvg = maxValues.reduce((sum, v) => sum + v, 0) / topics.length;
      return avg > maxAvg ? s : max;
    }, filteredSources[0]);

    const topicAverages = sortedTopics.map((topic) => {
      const topicIdx = topics.indexOf(topic);
      const avg = filteredSources.reduce((sum, s) => {
        const values = getMetricValues(s.name);
        return sum + (values[topicIdx] || 0);
      }, 0) / (filteredSources.length || 1);
      return { topic, avg };
    });
    const topTopic = topicAverages.length > 0 
      ? topicAverages.reduce((max, t) => t.avg > max.avg ? t : max, topicAverages[0])
      : { topic: 'N/A', avg: 0 };

    // Adjust thresholds based on metric
    const thresholdLow = metric === 'sentiment' ? 0.1 : (metric === 'citations' ? 2 : (metric === 'soa' ? 10 : 5));
    const thresholdHigh = metric === 'sentiment' ? 0.7 : (metric === 'citations' ? 20 : (metric === 'soa' ? 50 : 35));
    
    const gaps = allValues.filter(v => v < thresholdLow).length;
    const highValue = allValues.filter(v => v > thresholdHigh).length;

    return {
      highestSource,
      topTopic,
      gaps,
      highValue
    };
  }, [filteredSources, topics, sortedTopics, data, metric, sources]);

  const getCellColor = (value: number) => {
    if (value === 0) {
      return { bg: '#fafafa', color: '#393e51', border: '1px dashed #c6c9d2' };
    }
    const maxValue = getMaxValue();
    const intensity = Math.min(value / maxValue, 1);
    // Using blue color scheme from dataviz-1 (#498cf9)
    const hue = 215;
    const saturation = 85 + (intensity * 10);
    const lightness = 96 - (intensity * 50);
    return {
      bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      color: intensity > 0.4 ? '#ffffff' : '#212534',
      border: 'none'
    };
  };

  const formatMetricValue = (value: number): string => {
    switch (metric) {
      case 'mentionRate':
        return `${value.toFixed(1)}%`;
      case 'soa':
        return `${value.toFixed(1)}%`;
      case 'sentiment':
        return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
      case 'citations':
        return value.toFixed(0);
      default:
        return value.toFixed(1);
    }
  };

  const getMetricLabel = (): string => {
    switch (metric) {
      case 'mentionRate':
        return 'mention rate';
      case 'soa':
        return 'share of answer';
      case 'sentiment':
        return 'sentiment';
      case 'citations':
        return 'citations';
      default:
        return 'value';
    }
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
            {(() => {
              const values = stats.highestSource ? getMetricValues(stats.highestSource.name) : [];
              const avg = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
              return `${formatMetricValue(avg)} avg ${getMetricLabel()} across topics`;
            })()}
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
            {formatMetricValue(stats.topTopic?.avg || 0)} avg {getMetricLabel()} across sources
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
            Source-topic pairs with low {getMetricLabel()}
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
            Pairs with high {getMetricLabel()}
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
            onClick={(e) => {
              e.preventDefault();
              // Export heatmap data as CSV
              const headers = ['Source', 'Type', ...sortedTopics];
              const rows = filteredSources.map(source => {
                const values = getMetricValues(source.name);
                return [
                  source.name,
                  source.type,
                  ...sortedTopics.map((topic, idx) => {
                    const topicIdx = topics.indexOf(topic);
                    return formatMetricValue(values[topicIdx] || 0);
                  })
                ];
              });
              
              const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
              ].join('\n');
              
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', `heatmap-${metric}-${new Date().toISOString().split('T')[0]}.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            style={{
              fontSize: '13px',
              color: '#00bcdc',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
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
            gap: '0',
            minWidth: 'max-content',
            background: '#ffffff'
          }}>
            {/* Corner cell */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              fontSize: '12px',
              fontWeight: '600',
              background: '#f4f4f6',
              color: '#1a1d29',
              position: 'sticky',
              top: 0,
              left: 0,
              zIndex: 20,
              borderBottom: '2px solid #e8e9ed',
              borderRight: '1px solid #e8e9ed'
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
                  background: '#f4f4f6',
                  color: '#1a1d29',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e8e9ed'
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
                    background: '#ffffff',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    borderRight: '1px solid #e8e9ed',
                    borderBottom: '1px solid #e8e9ed'
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
                  const sourceData = data[source.name];
                  const value = sourceData ? (sourceData[metric]?.[topicIdx] || 0) : 0;
                  const cellStyle = getCellColor(value);
                  
                  // Get all metric values for the modal
                  const mentionRate = sourceData?.mentionRate?.[topicIdx] || 0;
                  const soa = sourceData?.soa?.[topicIdx] || 0;

                  return (
                    <div
                      key={`${source.name}-${topic}`}
                      style={{
                        padding: '16px 8px',
                        textAlign: 'center',
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
                        borderBottom: '1px solid #e8e9ed',
                        position: 'relative'
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedCell({
                          source: source.name,
                          topic,
                          mentionRate,
                          shareOfAnswer: soa
                        });
                        setModalOpen(true);
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
                      title={`${source.name} × ${topic}\n${getMetricLabel()}: ${formatMetricValue(value)}\nClick to drill down`}
                    >
                      <span style={{ fontSize: '18px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: '700' }}>
                        {formatMetricValue(value)}
                      </span>
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        {getMetricLabel()}
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
          borderRadius: '6px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '12px', color: '#393e51', fontWeight: '600', marginRight: '8px' }}>
            {metric === 'mentionRate' ? 'Brand Mention Rate:' : 
             metric === 'soa' ? 'Share of Answer:' :
             metric === 'sentiment' ? 'Sentiment Score:' :
             'Total Citations:'}
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
            {metric === 'mentionRate' ? (
              <>
                <span>0%</span>
                <span>15%</span>
                <span>30%</span>
                <span>45%+</span>
              </>
            ) : metric === 'soa' ? (
              <>
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>100%</span>
              </>
            ) : metric === 'sentiment' ? (
              <>
                <span>-1.0</span>
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
              </>
            ) : (
              <>
                <span>0</span>
                <span>12</span>
                <span>25</span>
                <span>50+</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedCell && (
        <SourceDetailModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedCell(null);
          }}
          sourceName={selectedCell.source}
          topic={selectedCell.topic}
          mentionRate={selectedCell.mentionRate}
          shareOfAnswer={selectedCell.shareOfAnswer}
          urls={[
            {
              url: `https://${selectedCell.source}/article-about-${selectedCell.topic.toLowerCase().replace(/\s+/g, '-')}`,
              title: `Comprehensive Guide to ${selectedCell.topic}`,
              mentionRate: selectedCell.mentionRate + Math.floor(Math.random() * 10) - 5,
              sentiment: parseFloat((Math.random() * 1.5 - 0.3).toFixed(2)),
              lastCrawled: '2 days ago'
            },
            {
              url: `https://${selectedCell.source}/insights/${selectedCell.topic.toLowerCase().replace(/\s+/g, '-')}-analysis`,
              title: `${selectedCell.topic} Market Analysis 2025`,
              mentionRate: selectedCell.mentionRate + Math.floor(Math.random() * 8) - 4,
              sentiment: parseFloat((Math.random() * 1.2 - 0.2).toFixed(2)),
              lastCrawled: '5 days ago'
            },
            {
              url: `https://${selectedCell.source}/blog/${selectedCell.topic.toLowerCase().replace(/\s+/g, '-')}-trends`,
              title: `Top ${selectedCell.topic} Trends to Watch`,
              mentionRate: selectedCell.mentionRate + Math.floor(Math.random() * 12) - 6,
              sentiment: parseFloat((Math.random() * 1.0 - 0.1).toFixed(2)),
              lastCrawled: '1 week ago'
            },
            {
              url: `https://${selectedCell.source}/reports/${selectedCell.topic.toLowerCase().replace(/\s+/g, '-')}-overview`,
              title: `${selectedCell.topic} Industry Overview`,
              mentionRate: selectedCell.mentionRate + Math.floor(Math.random() * 7) - 3,
              sentiment: parseFloat((Math.random() * 0.8).toFixed(2)),
              lastCrawled: '2 weeks ago'
            }
          ]}
        />
      )}
    </>
  );
};
