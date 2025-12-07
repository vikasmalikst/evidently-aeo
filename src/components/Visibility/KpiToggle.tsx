import { PieChart, TrendingUp, Heart, Eye } from 'lucide-react';

type MetricType = 'visibility' | 'share' | 'sentiment' | 'brandPresence';

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
    id: 'brandPresence',
    label: 'Brand Presence',
    description: 'How often collectors show your brand at all',
    Icon: Eye
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
      <div className="flex items-center gap-0 border-b border-[#e3e7f3]">
        {KPI_OPTIONS.map(({ id, label, Icon }) => {
          const isActive = metricType === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`
                px-4 py-3
                text-sm font-medium
                border-b-2
                transition-all duration-200
                whitespace-nowrap
                flex items-center gap-2
                ${
                  isActive
                    ? 'text-[#00bcdc] border-[#00bcdc]'
                    : 'text-[#6c7289] border-transparent hover:text-[#212534]'
                }
              `}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

