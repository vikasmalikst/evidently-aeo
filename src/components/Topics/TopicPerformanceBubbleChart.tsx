import { useRef, useEffect, useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

interface TopicData {
  name: string;
  citationCount: number;
  shareOfAnswer: number;
  searchVolume: number;
  avgSentiment: number;
  category: string;
}

interface TopicPerformanceBubbleChartProps {
  topics: TopicData[];
}

export const TopicPerformanceBubbleChart = ({ topics }: TopicPerformanceBubbleChartProps) => {
  const chartRef = useRef<any>(null);

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.6) {
      return 'rgba(6, 198, 134, 0.7)';
    } else if (sentiment >= 0.3) {
      return 'rgba(249, 219, 67, 0.7)';
    } else if (sentiment >= 0) {
      return 'rgba(250, 138, 64, 0.7)';
    } else {
      return 'rgba(249, 67, 67, 0.7)';
    }
  };

  const getSentimentBorderColor = (sentiment: number) => {
    if (sentiment >= 0.6) {
      return 'rgba(6, 198, 134, 1)';
    } else if (sentiment >= 0.3) {
      return 'rgba(249, 219, 67, 1)';
    } else if (sentiment >= 0) {
      return 'rgba(250, 138, 64, 1)';
    } else {
      return 'rgba(249, 67, 67, 1)';
    }
  };

  const maxVolume = Math.max(...topics.map(t => t.searchVolume));
  const minVolume = Math.min(...topics.map(t => t.searchVolume));

  const calculateBubbleSize = (volume: number) => {
    const minSize = 8;
    const maxSize = 40;
    const normalized = (volume - minVolume) / (maxVolume - minVolume);
    return minSize + normalized * (maxSize - minSize);
  };

  const chartData = useMemo(() => ({
    datasets: topics.map((topic) => ({
      label: topic.name,
      data: [{
        x: topic.citationCount,
        y: topic.shareOfAnswer,
        r: calculateBubbleSize(topic.searchVolume)
      }],
      backgroundColor: getSentimentColor(topic.avgSentiment),
      borderColor: getSentimentBorderColor(topic.avgSentiment),
      borderWidth: 2,
    }))
  }), [topics]);

  const maxX = Math.max(...topics.map(t => t.citationCount));
  const maxY = Math.max(...topics.map(t => t.shareOfAnswer));
  const midX = maxX / 2;
  const midY = maxY / 2;

  const options: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1a1d29',
        bodyColor: '#393e51',
        borderColor: '#e8e9ed',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (context) => {
            const datasetIndex = context[0].datasetIndex;
            return topics[datasetIndex].name;
          },
          label: (context) => {
            const datasetIndex = context.datasetIndex;
            const topic = topics[datasetIndex];
            return [
              `Citation Count: ${topic.citationCount}`,
              `Share of Answer: ${topic.shareOfAnswer.toFixed(2)}×`,
              `Search Volume: ${topic.searchVolume.toLocaleString()}`,
              `Avg Sentiment: ${(topic.avgSentiment * 100).toFixed(0)}%`,
              `Category: ${topic.category}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'Source Citation Count',
          color: '#393e51',
          font: {
            size: 13,
            weight: '600',
            family: 'Sora, sans-serif'
          }
        },
        grid: {
          color: '#e8e9ed',
          drawOnChartArea: true,
        },
        ticks: {
          color: '#393e51',
          font: {
            size: 11
          }
        },
        border: {
          color: '#c6c9d2'
        }
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Topic Share of Answer (SoA)',
          color: '#393e51',
          font: {
            size: 13,
            weight: '600',
            family: 'Sora, sans-serif'
          }
        },
        grid: {
          color: '#e8e9ed',
          drawOnChartArea: true,
        },
        ticks: {
          color: '#393e51',
          font: {
            size: 11
          },
          callback: function(value) {
            return value + '×';
          }
        },
        border: {
          color: '#c6c9d2'
        }
      }
    }
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    if (!chartArea) return;

    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    const midXPixel = xScale.getPixelForValue(midX);
    const midYPixel = yScale.getPixelForValue(midY);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#c6c9d2';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(midXPixel, chartArea.top);
    ctx.lineTo(midXPixel, chartArea.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(chartArea.left, midYPixel);
    ctx.lineTo(chartArea.right, midYPixel);
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.font = '11px Sora, sans-serif';
    ctx.fillStyle = '#393e51';
    ctx.textAlign = 'center';

    const padding = 8;
    const labelY = chartArea.top - padding;

    ctx.fillText('Low SoA / Low Citation', chartArea.left + (midXPixel - chartArea.left) / 2, labelY);
    ctx.fillText('Low SoA / High Citation', midXPixel + (chartArea.right - midXPixel) / 2, labelY);

    const bottomLabelY = chartArea.bottom + 60;
    ctx.fillText('High SoA / Low Citation', chartArea.left + (midXPixel - chartArea.left) / 2, bottomLabelY);

    ctx.fillStyle = '#06c686';
    ctx.font = 'bold 11px Sora, sans-serif';
    ctx.fillText('HIGH VALUE ZONE', midXPixel + (chartArea.right - midXPixel) / 2, bottomLabelY);

    ctx.restore();
  }, [topics, midX, midY]);

  const quadrantStats = useMemo(() => {
    const highValue = topics.filter(t => t.citationCount > midX && t.shareOfAnswer > midY);
    const lowSoaHighCitation = topics.filter(t => t.citationCount > midX && t.shareOfAnswer <= midY);
    const highSoaLowCitation = topics.filter(t => t.citationCount <= midX && t.shareOfAnswer > midY);
    const lowValue = topics.filter(t => t.citationCount <= midX && t.shareOfAnswer <= midY);

    return {
      highValue: highValue.length,
      lowSoaHighCitation: lowSoaHighCitation.length,
      highSoaLowCitation: highSoaLowCitation.length,
      lowValue: lowValue.length,
    };
  }, [topics, midX, midY]);

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
            High Value Topics
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#06c686', fontFamily: 'IBM Plex Mono, monospace' }}>
            {quadrantStats.highValue}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            High SoA + High Citations
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
            Optimization Opportunities
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f9db43', fontFamily: 'IBM Plex Mono, monospace' }}>
            {quadrantStats.lowSoaHighCitation}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            Low SoA but High Citations
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
            Growth Potential
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#498cf9', fontFamily: 'IBM Plex Mono, monospace' }}>
            {quadrantStats.highSoaLowCitation}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            High SoA but Low Citations
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
            Underperforming Topics
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f94343', fontFamily: 'IBM Plex Mono, monospace' }}>
            {quadrantStats.lowValue}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-caption)', marginTop: '4px' }}>
            Low SoA + Low Citations
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-headings)', fontFamily: 'Sora, sans-serif', marginBottom: '8px' }}>
            Topic Performance Analysis
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-caption)', lineHeight: '1.6' }}>
            Bubble size represents search volume. Color indicates average sentiment (green = positive, red = negative).
            The chart is divided into quadrants to identify high-value topics and optimization opportunities.
          </p>
        </div>

        <div style={{ height: '600px', position: 'relative' }}>
          <Scatter ref={chartRef} data={chartData} options={options} />
        </div>

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
            Sentiment:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(6, 198, 134, 0.7)', border: '2px solid rgba(6, 198, 134, 1)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>Positive (60%+)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(249, 219, 67, 0.7)', border: '2px solid rgba(249, 219, 67, 1)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>Neutral (30-60%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(250, 138, 64, 0.7)', border: '2px solid rgba(250, 138, 64, 1)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>Mixed (0-30%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(249, 67, 67, 0.7)', border: '2px solid rgba(249, 67, 67, 1)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>Negative (&lt;0%)</span>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-default)', height: '24px', margin: '0 8px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-caption)' }}>Bubble Size:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--border-strong)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>Low Volume</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--border-strong)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>High Volume</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
