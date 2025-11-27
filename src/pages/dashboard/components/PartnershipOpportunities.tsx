import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import type { CollectorSummary } from '../types';
import { EmptyState } from './EmptyState';
import { InfoTooltip } from './InfoTooltip';

interface PartnershipOpportunitiesProps {
  collectorSummaries: CollectorSummary[];
}

export const PartnershipOpportunities = ({ collectorSummaries }: PartnershipOpportunitiesProps) => {
  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-[#1a1d29]">
            Partnership Opportunities
          </h2>
          <InfoTooltip description="Highlights AI models (collectors) where your brand has strong presence and success rates. These represent potential partnership opportunities or areas where your brand is performing well in AI-generated answers. Success rate indicates how often your brand appears when queried." />
        </div>
        <Link
          to="/ai-sources"
          className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
        >
          View All
          <ArrowRight size={14} />
        </Link>
      </div>

      {collectorSummaries.length > 0 ? (
        <div className="space-y-3">
          {collectorSummaries.slice(0, 6).map((summary: CollectorSummary, index) => (
            <div key={summary.collectorType ?? index} className="p-3 bg-[#f9f9fb] rounded-lg border border-[#e8e9ed]">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#00bcdc] text-white text-[12px] font-semibold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <h3 className="text-[14px] font-medium text-[#1a1d29] capitalize">
                    {summary.collectorType?.replace(/[-_]/g, ' ') ?? 'Unknown Collector'}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[12px] font-medium text-[#64748b]">
                  <TrendingUp size={12} className="text-[#06c686]" />
                  {Math.round(summary.successRate ?? 0)}% success
                </div>
              </div>
              <p className="text-[12px] text-[#64748b] mb-2">
                {summary.completed} completed · {summary.failed} failed · Last run{' '}
                {summary.lastRunAt ? new Date(summary.lastRunAt).toLocaleDateString() : 'N/A'}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#64748b] bg-white px-2 py-1 rounded">
                  Status: {summary.status}
                </span>
                <span className="text-[12px] font-medium text-[#1a1d29]">
                  {summary.completed}/{summary.completed + summary.failed} runs successful
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No partnership opportunities identified yet." />
      )}
    </div>
  );
};

