import { PieChart, TrendingUp, Heart } from 'lucide-react';

type MetricType = 'visibility' | 'share' | 'sentiment';

interface KpiToggleProps {
  metricType: MetricType;
  onChange: (value: MetricType) => void;
}

const KPI_OPTIONS: Array<{
  id: MetricType;
  label: string;
  description: string;
  Icon: typeof PieChart;
}> = [
  {
    id: 'visibility',
    label: 'Visibility Score',
    description: 'How prominently your brand surfaces in AI answers',
    Icon: TrendingUp
  },
  {
    id: 'share',
    label: 'Share of Answers',
    description: 'Percent of answers where your brand is mentioned',
    Icon: PieChart
  },
  {
    id: 'sentiment',
    label: 'Sentiment Score',
    description: 'How positively your brand and competitors are discussed',
    Icon: Heart
  }
];

export const KpiToggle = ({ metricType, onChange }: KpiToggleProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8690a8]">
        Select KPI
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {KPI_OPTIONS.map(({ id, label, description, Icon }) => {
          const isActive = metricType === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`group relative flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] ${
                isActive
                  ? 'border-transparent bg-gradient-to-r from-[#06b6d4] via-[#3b82f6] to-[#6366f1] text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]'
                  : 'border-[#e3e7f3] bg-white/80 text-[#1f2a37] hover:border-[#06b6d4] hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]'
              }`}
            >
              <div
                className={`flex items-center gap-2 rounded-2xl px-2 py-1 text-xs font-semibold tracking-wide ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#f3f4ff] text-[#5b5f7c]'
                }`}
              >
                <Icon
                  size={16}
                  className={isActive ? 'text-white' : 'text-[#5b5f7c]'}
                />
                {label}
              </div>
              <p
                className={`text-sm leading-relaxed ${
                  isActive ? 'text-white/90' : 'text-[#646b85]'
                }`}
              >
                {description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

