import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';

interface TopicData {
  id: string;
  name: string;
  category: string;
  citationCount: number;
  shareOfAnswer: number;
  searchVolume: number;
  avgSentiment: number;
}

interface TopicTreemapProps {
  topics: TopicData[];
}

interface TreemapTile {
  topic: TopicData;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TopicTreemap = ({ topics: allTopics }: TopicTreemapProps) => {
  const [hoveredTopic, setHoveredTopic] = useState<TopicData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(allTopics.map(t => t.category)))];

  const topics = useMemo(() => {
    if (selectedCategory === 'all') return allTopics;
    return allTopics.filter(t => t.category === selectedCategory);
  }, [allTopics, selectedCategory]);

  const getSoAColor = (soa: number): string => {
    if (soa >= 3.0) return '#06c686';
    if (soa >= 2.5) return '#4ade80';
    if (soa >= 2.0) return '#facc15';
    if (soa >= 1.5) return '#fb923c';
    if (soa >= 1.0) return '#f97316';
    return '#f94343';
  };

  const groupedByCategory = useMemo(() => {
    const grouped = new Map<string, TopicData[]>();
    topics.forEach(topic => {
      if (!grouped.has(topic.category)) {
        grouped.set(topic.category, []);
      }
      grouped.get(topic.category)!.push(topic);
    });
    return grouped;
  }, [topics]);

  const categoryStats = useMemo(() => {
    const stats = new Map<string, { totalVolume: number; avgSoA: number; topicCount: number }>();
    groupedByCategory.forEach((topicsInCategory, category) => {
      const totalVolume = topicsInCategory.reduce((sum, t) => sum + t.searchVolume, 0);
      const avgSoA = topicsInCategory.reduce((sum, t) => sum + t.shareOfAnswer, 0) / topicsInCategory.length;
      stats.set(category, { totalVolume, avgSoA, topicCount: topicsInCategory.length });
    });
    return stats;
  }, [groupedByCategory]);

  const sortedCategories = useMemo(() => {
    return Array.from(groupedByCategory.entries())
      .sort(([, topicsA], [, topicsB]) => {
        const volumeA = topicsA.reduce((sum, t) => sum + t.searchVolume, 0);
        const volumeB = topicsB.reduce((sum, t) => sum + t.searchVolume, 0);
        return volumeB - volumeA;
      });
  }, [groupedByCategory]);

  const totalVolume = topics.reduce((sum, t) => sum + t.searchVolume, 0);

  const renderTreemap = () => {
    const containerWidth = 1200;
    const containerHeight = 700;
    let currentY = 0;

    return sortedCategories.map(([category, categoryTopics]) => {
      const categoryVolume = categoryTopics.reduce((sum, t) => sum + t.searchVolume, 0);
      const categoryHeight = (categoryVolume / totalVolume) * containerHeight;

      const sortedTopics = [...categoryTopics].sort((a, b) => b.searchVolume - a.searchVolume);

      const tiles: TreemapTile[] = [];
      let currentX = 0;
      const topicsTotalVolume = categoryVolume;

      sortedTopics.forEach((topic) => {
        const tileWidth = (topic.searchVolume / topicsTotalVolume) * containerWidth;
        tiles.push({
          topic,
          x: currentX,
          y: currentY,
          width: tileWidth,
          height: categoryHeight
        });
        currentX += tileWidth;
      });

      const categoryStartY = currentY;
      currentY += categoryHeight;

      return (
        <div
          key={category}
          style={{
            position: 'relative',
            height: `${categoryHeight}px`,
            width: '100%',
            borderBottom: '2px solid var(--border-default)'
          }}
        >
          {tiles.map((tile) => (
            <div
              key={tile.topic.id}
              style={{
                position: 'absolute',
                left: `${(tile.x / containerWidth) * 100}%`,
                top: 0,
                width: `${(tile.width / containerWidth) * 100}%`,
                height: '100%',
                backgroundColor: getSoAColor(tile.topic.shareOfAnswer),
                border: '2px solid #ffffff',
                padding: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={() => setHoveredTopic(tile.topic)}
              onMouseLeave={() => setHoveredTopic(null)}
              onClick={() => setSelectedCategory(category)}
            >
              <div>
                <div
                  style={{
                    fontSize: tile.width > 150 ? '14px' : '11px',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '6px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    lineHeight: '1.3',
                    wordBreak: 'break-word'
                  }}
                >
                  {tile.topic.name}
                </div>
                {tile.width > 120 && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.9)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      marginBottom: '4px'
                    }}
                  >
                    {category}
                  </div>
                )}
              </div>

              {tile.width > 100 && tile.height > 80 && (
                <div style={{ marginTop: 'auto' }}>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#ffffff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      fontFamily: 'IBM Plex Mono, monospace'
                    }}
                  >
                    {tile.topic.searchVolume.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.85)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  >
                    searches · {tile.topic.shareOfAnswer.toFixed(2)}× SoA
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    });
  };

  const highestSoA = topics.reduce((max, t) => Math.max(max, t.shareOfAnswer), 0);
  const lowestSoA = topics.reduce((min, t) => Math.min(min, t.shareOfAnswer), Infinity);
  const avgSoA = topics.reduce((sum, t) => sum + t.shareOfAnswer, 0) / topics.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Topics
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-body)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {topics.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            Across {groupedByCategory.size} categories
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Search Volume
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-body)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {totalVolume.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            Combined market demand
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Average SoA
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: getSoAColor(avgSoA), fontFamily: 'IBM Plex Mono, monospace' }}>
            {avgSoA.toFixed(2)}×
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            Overall performance metric
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            SoA Range
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: getSoAColor(lowestSoA), fontFamily: 'IBM Plex Mono, monospace' }}>
              {lowestSoA.toFixed(1)}×
            </div>
            <div style={{ fontSize: '16px', color: 'var(--text-caption)' }}>to</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: getSoAColor(highestSoA), fontFamily: 'IBM Plex Mono, monospace' }}>
              {highestSoA.toFixed(1)}×
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            Performance spread
          </div>
        </div>
      </div>

      {/* Treemap Container */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-headings)', fontFamily: 'Sora, sans-serif', margin: 0 }}>
              Topic Performance Treemap
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label
                htmlFor="category-filter"
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text-caption)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Category:
              </label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-body)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  minWidth: '200px'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
            <Info size={16} color="var(--text-caption)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <p style={{ fontSize: '14px', color: 'var(--text-caption)', lineHeight: '1.6', margin: 0 }}>
              Tile size represents search volume (market demand). Color indicates Share of Answer performance
              (green = high, red = low). Topics are grouped by category.
            </p>
          </div>
        </div>

        <div style={{
          position: 'relative',
          width: '100%',
          height: '700px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid var(--border-default)'
        }}>
          {renderTreemap()}
        </div>

        {/* Hover Tooltip */}
        {hoveredTopic && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '4px' }}>
                  TOPIC
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-body)' }}>
                  {hoveredTopic.name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '4px' }}>
                  CATEGORY
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-body)' }}>
                  {hoveredTopic.category}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '4px' }}>
                  SEARCH VOLUME
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-body)' }}>
                  {hoveredTopic.searchVolume.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '4px' }}>
                  SHARE OF ANSWER
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: getSoAColor(hoveredTopic.shareOfAnswer) }}>
                  {hoveredTopic.shareOfAnswer.toFixed(2)}×
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '4px' }}>
                  CITATIONS
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-body)' }}>
                  {hoveredTopic.citationCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-caption)', fontWeight: '600', marginBottom: '4px' }}>
                  AVG SENTIMENT
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: hoveredTopic.avgSentiment >= 0.6 ? 'var(--text-success)' : hoveredTopic.avgSentiment >= 0.3 ? 'var(--text-warning)' : 'var(--text-error)' }}>
                  {(hoveredTopic.avgSentiment * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '6px',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-caption)' }}>
            Share of Answer Scale:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#06c686', borderRadius: '4px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>3.0+</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#4ade80', borderRadius: '4px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>2.5-3.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#facc15', borderRadius: '4px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>2.0-2.5</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#fb923c', borderRadius: '4px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>1.5-2.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#f97316', borderRadius: '4px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>1.0-1.5</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: '#f94343', borderRadius: '4px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>&lt;1.0</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-headings)', fontFamily: 'Sora, sans-serif', marginBottom: '16px' }}>
          Category Performance
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {Array.from(categoryStats.entries())
            .sort(([, a], [, b]) => b.totalVolume - a.totalVolume)
            .map(([category, stats]) => (
              <div
                key={category}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: `2px solid ${getSoAColor(stats.avgSoA)}`,
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-body)', marginBottom: '8px' }}>
                  {category}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-caption)' }}>Topics:</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-body)' }}>
                    {stats.topicCount}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-caption)' }}>Volume:</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-body)' }}>
                    {stats.totalVolume.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-caption)' }}>Avg SoA:</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: getSoAColor(stats.avgSoA) }}>
                    {stats.avgSoA.toFixed(2)}×
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
