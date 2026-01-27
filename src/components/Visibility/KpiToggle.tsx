import { PieChart, TrendingUp, Heart, Eye, Hash, ListOrdered } from 'lucide-react';
import { HelpButton } from '../common/HelpButton';

export type MetricType = 'visibility' | 'share' | 'sentiment' | 'brandPresence' | 'mentions' | 'position';

interface KpiToggleProps {
  metricType: MetricType;
  onChange: (value: MetricType) => void;
  allowedMetricTypes?: MetricType[];
  onHelpClick?: (key: string) => void;
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
      description: 'Percentage of queries where your brand appears in answers',
      Icon: Eye
    },
    {
      id: 'sentiment',
      label: 'Sentiment Score',
      description: 'How positively your brand and competitors are discussed',
      Icon: Heart
    },
    {
      id: 'mentions',
      label: 'Mentions',
      description: 'Total number of times your brand is mentioned',
      Icon: Hash
    },
    {
      id: 'position',
      label: 'Average Position',
      description: 'The average ranking position where your brand appears',
      Icon: ListOrdered
    }
  ];

export const KpiToggle = ({ metricType, onChange, allowedMetricTypes, onHelpClick }: KpiToggleProps) => {
  const options = KPI_OPTIONS.filter((opt) => !allowedMetricTypes || allowedMetricTypes.includes(opt.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8690a8]">
          Select KPI
        </div>
        {onHelpClick && (
          <HelpButton
            onClick={() => onHelpClick('topics-feature-guide')}
            className="p-0.5"
            size={14}
            label="Topics Feature Guide"
          />
        )}
      </div>
      <div className="flex items-center gap-0 border-b border-[#e3e7f3]">
        {options.map(({ id, label, Icon }) => {
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
                ${isActive
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

