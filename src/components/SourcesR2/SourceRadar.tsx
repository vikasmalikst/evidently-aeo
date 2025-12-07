import { useMemo } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export interface RadarSource {
  name: string;
  mentionRate: number; // 0-100
  soa: number; // 0-100
  sentiment: number; // -1..1
  citations: number;
  topicsCount: number;
}

interface SourceRadarProps {
  sources: RadarSource[];
  maxItems?: number;
}

export const SourceRadar = ({ sources, maxItems = 5 }: SourceRadarProps) => {
  const { chartData, chartOptions } = useMemo(() => {
    const top = [...sources]
      .sort((a, b) => (b.mentionRate + b.soa + ((b.sentiment + 1) / 2) * 100) - (a.mentionRate + a.soa + ((a.sentiment + 1) / 2) * 100))
      .slice(0, maxItems);

    const maxCitations = Math.max(...top.map((s) => s.citations), 1);
    const maxTopics = Math.max(...top.map((s) => s.topicsCount), 1);

    const labels = ['Mention Rate', 'SOA', 'Sentiment', 'Citations', 'Topics'];

    const datasets = top.map((s, idx) => {
      const sentimentPct = ((s.sentiment + 1) / 2) * 100;
      const citationsPct = (s.citations / maxCitations) * 100;
      const topicsPct = (s.topicsCount / maxTopics) * 100;
      const color = palette[idx % palette.length];
      return {
        label: s.name,
        data: [s.mentionRate, s.soa, sentimentPct, citationsPct, topicsPct],
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointHoverRadius: 5,
      };
    });

    const data = { labels, datasets };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' as const },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.formattedValue}%`
          }
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: { stepSize: 20, backdropColor: 'transparent', color: '#475569' },
          angleLines: { color: '#e2e8f0' },
          grid: { color: '#e2e8f0' },
          pointLabels: { color: '#1f2937', font: { size: 12 } }
        }
      }
    };

    return { chartData: data, chartOptions: options };
  }, [sources, maxItems]);

  if (!sources.length) {
    return (
      <div style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>
        No sources to display.
      </div>
    );
  }

  return (
    <div style={{ height: 360 }}>
      <Radar data={chartData} options={chartOptions as any} />
    </div>
  );
};

const palette = ['#06b6d4', '#498cf9', '#ac59fb', '#fa8a40', '#f155a2', '#0d7c96'];

