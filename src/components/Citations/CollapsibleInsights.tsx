import { useState } from 'react';
import { ChevronRight, ChevronDown, TrendingUp } from 'lucide-react';
import { CitationInsightsData } from '../../data/mockCitationSourcesData';

interface CollapsibleInsightsProps {
  insights: CitationInsightsData;
}

export const CollapsibleInsights = ({ insights }: CollapsibleInsightsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={20} className="text-[var(--accent-primary)] flex-shrink-0" />
        ) : (
          <ChevronRight size={20} className="text-[var(--accent-primary)] flex-shrink-0" />
        )}
        <span className="text-lg font-semibold text-[var(--text-headings)]">
          Insights & Gaps
        </span>
        <span className="ml-auto text-xs text-[var(--text-caption)]">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 bg-[var(--accent-light)] border border-[var(--accent-primary)] rounded-lg">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-sm font-semibold text-[var(--text-body)]">Domain Used: {insights.yourBrandVisibility.domainUsage}%</span>
                <span className="text-sm font-semibold text-[var(--text-body)]">Mentioned: {insights.yourBrandVisibility.brandMentioned}%</span>
                <span className="text-sm font-bold text-[var(--accent-primary)]">Gap: {insights.yourBrandVisibility.gap}%</span>
              </div>
              <p className="text-sm text-[var(--text-body)]">{insights.yourBrandVisibility.gapInterpretation}</p>
            </div>

            <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-[var(--text-body)]">{insights.partnershipOpportunities[0].source}</span>
                    <span className="text-xs px-2 py-0.5 bg-white rounded text-[var(--text-caption)]">
                      {insights.partnershipOpportunities[0].type}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-caption)] mb-1">
                    {insights.partnershipOpportunities[0].usage}% usage
                  </div>
                  <p className="text-xs text-[var(--text-body)]">{insights.partnershipOpportunities[0].recommendation}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
              <p className="text-sm font-medium text-[var(--text-body)] mb-2">{insights.sourceTypeInsight}</p>
              <div className="h-2 bg-white rounded-full overflow-hidden flex">
                <div className="h-full bg-[#498cf9]" style={{ width: '35%' }} title="Editorial: 35%" />
                <div className="h-full bg-[#06b6d4]" style={{ width: '28%' }} title="Corporate: 28%" />
                <div className="h-full bg-[#fa8a40]" style={{ width: '18%' }} title="Reference: 18%" />
              </div>
              <div className="mt-2 flex gap-3 text-xs text-[var(--text-caption)]">
                <span>Editorial 35%</span>
                <span>Corporate 28%</span>
                <span>Reference 18%</span>
              </div>
            </div>

            {insights.contentGapsByTopic.length > 0 && (
              <div className="p-4 bg-[#fff9e6] border border-[var(--text-warning)] rounded-lg">
                <div className="flex items-start gap-2">
                  <TrendingUp size={16} className="text-[var(--text-warning)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--text-body)] mb-1">
                      {insights.contentGapsByTopic[0].topic} topic
                    </div>
                    <p className="text-sm text-[var(--text-body)] mb-1">
                      {insights.contentGapsByTopic[0].underrepresentedSources}
                    </p>
                    <p className="text-xs text-[var(--text-caption)]">
                      {insights.contentGapsByTopic[0].recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
