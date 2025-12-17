interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

const MetricCard = ({ label, value, subtitle }: MetricCardProps) => (
  <div className="bg-white border border-[var(--border-default)] rounded-lg p-4 shadow-sm">
    <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-2">
      {label}
    </div>
    <div className="text-2xl font-bold text-[var(--text-headings)] mb-1 font-data">
      {value}
    </div>
    {subtitle && (
      <div className="text-xs text-[var(--text-caption)] font-data">
        {subtitle}
      </div>
    )}
  </div>
);

interface PromptMetricsProps {
  metrics: {
    totalPrompts: number;
    topPerformingTopic: string;
    avgSentiment: number;
  };
}

export const PromptMetrics = ({ metrics }: PromptMetricsProps) => {
  return (
    <div className="grid grid-cols-3 gap-6 mb-6">
      <MetricCard
        label="Total Prompts"
        value={metrics.totalPrompts}
        subtitle="Across all topics"
      />
      <MetricCard
        label="Top Performing Topic"
        value={metrics.topPerformingTopic}
        subtitle="Highest engagement"
      />
      <MetricCard
        label="Sentiment"
        value={Math.round(metrics.avgSentiment)}
        subtitle="Average score"
      />
    </div>
  );
};
