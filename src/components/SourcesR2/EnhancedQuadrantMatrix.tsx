import { useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bubble } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

export interface EnhancedSource {
  name: string;
  type: string;
  mentionRate: number; // %
  soa: number; // %
  sentiment: number; // -1..1
  citations: number;
  valueScore: number; // 0..100
  quadrant: 'priority' | 'reputation' | 'growth' | 'monitor';
}

interface EnhancedQuadrantMatrixProps {
  sources: EnhancedSource[];
  xThreshold: number;
  yThreshold: number;
}

const quadrantLabels: Record<EnhancedSource['quadrant'], string> = {
  priority: 'Priority Partnerships',
  reputation: 'Reputation Management',
  growth: 'Growth Opportunities',
  monitor: 'Monitor'
};

const quadrantColors: Record<EnhancedSource['quadrant'], string> = {
  priority: '#06c686',
  reputation: '#f97373',
  growth: '#498cf9',
  monitor: '#cbd5e1'
};

export const EnhancedQuadrantMatrix = ({
  sources,
  xThreshold,
  yThreshold
}: EnhancedQuadrantMatrixProps) => {
  const groupedTop = useMemo(() => {
    const buckets: Record<EnhancedSource['quadrant'], EnhancedSource[]> = {
      priority: [],
      reputation: [],
      growth: [],
      monitor: []
    };
    sources.forEach((s) => {
      buckets[s.quadrant].push(s);
    });
    (Object.keys(buckets) as Array<EnhancedSource['quadrant']>).forEach((key) => {
      buckets[key] = buckets[key]
        .sort((a, b) => b.valueScore - a.valueScore)
        .slice(0, 5);
    });
    return buckets;
  }, [sources]);

  const chartData = useMemo(() => {
    const datasets = sources.map((src) => {
      const sentimentRadius = Math.max(10, Math.min(40, Math.abs(src.sentiment) * 40));
      return {
        label: src.name,
        data: [
          {
            x: src.mentionRate,
            y: src.soa,
            r: sentimentRadius
          }
        ],
        backgroundColor: quadrantColors[src.quadrant] + 'B3',
        borderColor: quadrantColors[src.quadrant],
        borderWidth: 2,
        source: src
      };
    });

    return { datasets };
  }, [sources]);

  const chartOptions = useMemo(() => {
    const maxXData = Math.max(...sources.map((s) => s.mentionRate), xThreshold, 1);
    const maxYData = Math.max(...sources.map((s) => s.soa), yThreshold, 1);
    const xMax =
      Math.max(
        10,
        Math.ceil((maxXData * 1.1) / 5) * 5
      );
    const yMax =
      Math.max(
        10,
        Math.ceil((maxYData * 1.1) / 10) * 10
      );

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26,29,41,0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (ctx: any) => ctx[0].dataset.label,
            label: (ctx: any) => {
              const src = ctx.dataset.source as EnhancedSource;
              const sentimentLabel = src.sentiment > 0.1 ? 'Positive' : src.sentiment < -0.1 ? 'Negative' : 'Neutral';
              return [
                `Quadrant: ${quadrantLabels[src.quadrant]}`,
                `Mention Rate: ${src.mentionRate.toFixed(1)}%`,
                `Share of Answer: ${src.soa.toFixed(1)}%`,
                `Sentiment: ${src.sentiment.toFixed(2)} (${sentimentLabel})`,
                `Citations: ${src.citations}`,
                `Value Score: ${src.valueScore.toFixed(1)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Mention Rate (%)' },
          min: 0,
          max: xMax,
          grid: { color: '#e8e9ed' }
        },
        y: {
          title: { display: true, text: 'Share of Answer (%)' },
          min: 0,
          max: yMax,
          grid: { color: '#e8e9ed' }
        }
      }
    };
  }, [sources, xThreshold, yThreshold]);

  // Overlay lines for thresholds using plugin
  const plugins = [
    {
      id: 'quadrant-lines',
      afterDraw: (chart: any) => {
        const { ctx, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(xThreshold);
        const y = scales.y.getPixelForValue(yThreshold);

        ctx.save();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);

        // vertical line
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();

        // horizontal line
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.restore();
      }
    }
  ];

  return (
    <div style={{ height: 520 }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(quadrantLabels).map(([key, label]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 8,
              backgroundColor: quadrantColors[key as EnhancedSource['quadrant']] + '1A',
              border: `1px solid ${quadrantColors[key as EnhancedSource['quadrant']] + '66'}`,
              fontSize: 12,
              color: '#1a1d29'
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: quadrantColors[key as EnhancedSource['quadrant']]
              }}
            />
            {label}
          </div>
        ))}
      </div>
      <Bubble data={chartData} options={chartOptions as any} plugins={plugins} />
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {(Object.keys(quadrantLabels) as Array<EnhancedSource['quadrant']>).map((q) => {
          const list = groupedTop[q];
          return (
            <div
              key={q}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: 10,
                background: '#fff',
                boxShadow: '0 8px 18px rgba(15,23,42,0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: quadrantColors[q] }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{quadrantLabels[q]}</span>
              </div>
              {list.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No sources in this quadrant.</div>
              ) : (
                <ol style={{ paddingLeft: 18, margin: 0, color: '#1f2937', fontSize: 12, display: 'grid', gap: 4 }}>
                  {list.map((s) => (
                    <li key={s.name} style={{ lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700 }}>{s.name}</span>
                      <span style={{ color: '#6b7280', marginLeft: 6 }}>Value {s.valueScore.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

