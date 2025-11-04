import { AlertCircle, Lightbulb, TrendingUp } from 'lucide-react';
import { InsightsData } from '../../data/mockSourcesData';

interface InsightsPanelProps {
  insights: InsightsData;
}

export const InsightsPanel = ({ insights }: InsightsPanelProps) => {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-hover)] p-6">
        <div className="flex items-center gap-3 text-white">
          <Lightbulb size={28} />
          <div>
            <h3 className="text-xl font-bold">AI Insights & Recommendations</h3>
            <p className="text-sm opacity-90 mt-1">
              {insights.bestSource} leads with strongest performance
            </p>
          </div>
        </div>
      </div>

      {insights.warnings.length > 0 && (
        <div className="border-b border-[var(--border-default)]">
          {insights.warnings.map((warning, idx) => (
            <div
              key={idx}
              className="bg-[#fff9e6] border-l-4 border-[var(--text-warning)] p-4 flex items-start gap-3"
            >
              <AlertCircle size={20} className="text-[var(--text-warning)] flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-[var(--text-body)] mb-1">
                  {warning.source} Alert
                </div>
                <p className="text-sm text-[var(--text-caption)]">
                  {warning.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-6">
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-3">
            Analysis
          </h4>
          <p className="text-[var(--text-body)] leading-relaxed">
            {insights.trendAnalysis}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            Recommendations
          </h4>
          <ul className="space-y-3">
            {insights.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-sm text-[var(--text-body)] leading-relaxed flex-1">
                  {rec}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
