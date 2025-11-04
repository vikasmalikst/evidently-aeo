import { useState } from 'react';
import {
  IconWorldWww,
  IconAt,
  IconQuote,
  IconChevronUp,
  IconChevronDown
} from '@tabler/icons-react';

interface MetricData {
  value: number;
  change: number;
  direction: 'up' | 'down';
}

interface ContentType {
  type: string;
  percentage: number;
  color: string;
}

interface InsightsAndGapsProps {
  metricsData?: {
    domainUsed: MetricData;
    mentioned: MetricData;
    citationGap: MetricData;
  };
  contentTypes?: ContentType[];
}

const defaultMetricsData = {
  domainUsed: { value: 22, change: 3, direction: 'up' as const },
  mentioned: { value: 18, change: 2, direction: 'up' as const },
  citationGap: { value: 4, change: 1, direction: 'down' as const }
};

const defaultContentTypes = [
  { type: 'Editorial', percentage: 35, color: '#498cf9' },
  { type: 'Corporate', percentage: 28, color: '#00bcdc' },
  { type: 'Reference', percentage: 18, color: '#fa8a40' }
];

interface MetricCardProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  metric: number;
  delta: number;
  deltaDirection: 'up' | 'down';
  description: string;
  type: 'insight' | 'gap';
}

const MetricCard = ({
  icon,
  iconColor,
  label,
  metric,
  delta,
  deltaDirection,
  description
}: MetricCardProps) => {
  const deltaColor = deltaDirection === 'up' ? '#06c686' : '#f94343';
  const DeltaIcon = deltaDirection === 'up' ? IconChevronUp : IconChevronDown;

  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg p-5 flex gap-3.5">
      <div style={{ color: iconColor }}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-[#6c7289] uppercase tracking-wider mb-2">
          {label}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold text-[#1a1d29] font-data">
            {metric}%
          </span>
          <div className="flex items-center" style={{ color: deltaColor }}>
            <DeltaIcon size={12} strokeWidth={2.5} />
            <span className="text-xs font-data">
              {delta}%
            </span>
          </div>
        </div>
        <div className="text-[13px] text-[#393e51] font-data">
          {description}
        </div>
      </div>
    </div>
  );
};

export const InsightsAndGaps = ({
  metricsData = defaultMetricsData,
  contentTypes = defaultContentTypes
}: InsightsAndGapsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalPercentage = contentTypes.reduce((sum, ct) => sum + ct.percentage, 0);

  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm overflow-hidden mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#f4f4f6] transition-colors"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse Insights & Gaps section' : 'Expand Insights & Gaps section'}
      >
        <h2 className="text-lg font-semibold text-[#1a1d29]">
          Insights & Gaps
        </h2>
        <span className="text-sm text-[#00bcdc] hover:underline">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isExpanded ? '1000px' : '0',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div className="px-6 pb-6">
          {/* Metrics Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <MetricCard
              icon={<IconWorldWww size={24} />}
              iconColor="#00bcdc"
              label="DOMAIN USED"
              metric={metricsData.domainUsed.value}
              delta={metricsData.domainUsed.change}
              deltaDirection={metricsData.domainUsed.direction}
              description="Your domain is trusted by AI sources"
              type="insight"
            />
            <MetricCard
              icon={<IconAt size={24} />}
              iconColor="#00bcdc"
              label="MENTIONED"
              metric={metricsData.mentioned.value}
              delta={metricsData.mentioned.change}
              deltaDirection={metricsData.mentioned.direction}
              description="Brand appears in AI responses"
              type="insight"
            />
            <MetricCard
              icon={<IconQuote size={24} />}
              iconColor="#f9db43"
              label="CITATION GAP"
              metric={metricsData.citationGap.value}
              delta={metricsData.citationGap.change}
              deltaDirection={metricsData.citationGap.direction}
              description="Content used without explicit credit"
              type="gap"
            />
          </div>

          {/* Key Insight Banner */}
          <div className="bg-[#ebfafc] border-l-[3px] border-[#00bcdc] rounded-md p-4 mb-6">
            <p className="text-[13px] text-[#393e51] font-data">
              💡 <strong>Key Insight:</strong> Your domain is trusted by AI, but 4% of responses use your content without explicit credit. Optimize for citation-friendliness.
            </p>
          </div>

          {/* Content Type Performance */}
          <div>
            <h3 className="text-[13px] font-bold text-[#1a1d29] mb-3">
              Content Type Performance
            </h3>

            <div className="bg-white border border-[#e8e9ed] rounded-lg p-5">
              {/* Stacked Bar */}
              <div className="h-8 bg-[#f4f4f6] rounded-md flex overflow-hidden mb-4">
                {contentTypes.map((contentType, index) => {
                  const widthPercentage = (contentType.percentage / totalPercentage) * 100;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-center text-white text-xs font-semibold font-data"
                      style={{
                        width: `${widthPercentage}%`,
                        backgroundColor: contentType.color
                      }}
                    >
                      {contentType.percentage}%
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 flex-wrap">
                {contentTypes.map((contentType, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: contentType.color }}
                    />
                    <span className="text-xs text-[#6c7289] font-data">
                      {contentType.type}
                    </span>
                    <span className="text-[13px] font-bold text-[#1a1d29] font-data">
                      {contentType.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
