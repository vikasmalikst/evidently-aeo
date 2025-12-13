import type { DashboardPayload } from '../types';
import { StackedRacingChart } from './StackedRacingChart';
import { LLMVisibilityTable } from './LLMVisibilityTable';
import { EmptyState } from './EmptyState';
import { InfoTooltip } from './InfoTooltip';
import type { LLMVisibilitySliceUI } from '../types';

interface KeyInsightsProps {
  dashboardData: DashboardPayload;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export const KeyInsights = ({ dashboardData, startDate, endDate, onStartDateChange, onEndDateChange }: KeyInsightsProps) => {
  const sourceSlices = (dashboardData?.sourceDistribution ?? [])
    .map((slice): { type: string; percentage: number; color: string } => ({
      type: slice.label,
      percentage: slice.percentage,
      color: slice.color || '#64748b'
    }))
    .filter((slice) => Number.isFinite(slice.percentage) && slice.percentage >= 0);

  const llmSlices: LLMVisibilitySliceUI[] = (dashboardData?.llmVisibility ?? [])
    .map((slice): LLMVisibilitySliceUI => {
      const totalQueries = slice.totalQueries ?? 0;
      const brandPresenceCount = slice.brandPresenceCount ?? 0;
      // Use totalCollectorResults if available (more accurate), otherwise fall back to totalQueries
      // This matches the calculation in SearchVisibility.tsx
      // Brand presence should be calculated as: (collector results with brand presence / total collector results) * 100
      const totalCollectorResults = slice.totalCollectorResults ?? totalQueries;
      const brandPresencePercentage = totalCollectorResults > 0 
        ? Math.min(100, Math.round((brandPresenceCount / totalCollectorResults) * 100))
        : 0;
      
      return {
        provider: slice.provider,
        share: slice.shareOfSearch ?? slice.share,
        shareOfSearch: slice.shareOfSearch ?? slice.share,
        visibility: slice.visibility ?? 0,
        delta: slice.delta ?? 0,
        brandPresenceCount: brandPresencePercentage,
        color: slice.color || '#64748b',
        topTopic: slice.topTopic ?? null,
        topTopics: slice.topTopics
      };
    })
    .filter((slice) => Number.isFinite(slice.visibility ?? 0) && (slice.visibility ?? 0) >= 0);

  const hasSourceData = sourceSlices.length > 0;
  const hasLlmData = llmSlices.length > 0;

  return (
    <>
      <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[18px] font-semibold text-[#1a1d29]">Source Type Distribution</h2>
          <InfoTooltip description="Shows the breakdown of citation sources by category (Editorial, Corporate, Reference, UGC, Social, Institutional). This helps you understand where your brand is being cited across different types of content sources in AI-generated answers. Click on any bar to see the top 5 sources for that source type." />
        </div>
        {hasSourceData ? (
          <StackedRacingChart 
            data={sourceSlices} 
            topSourcesByType={dashboardData?.topSourcesByType}
          />
        ) : (
          <EmptyState message="No source distribution data available for this period." />
        )}
      </div>

      <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[18px] font-semibold text-[#1a1d29]">LLM Visibility (7 Days)</h2>
          <InfoTooltip description="Displays your brand's visibility score and brand presence percentage across different AI models (ChatGPT, Gemini, Claude, etc.) over the last 7 days. Visibility score measures prominence, while brand presence shows the percentage of queries where your brand appears." />
        </div>
        {hasLlmData ? (
          <LLMVisibilityTable llmSlices={llmSlices} />
        ) : (
          <EmptyState message="No LLM visibility data available for this period." />
        )}
      </div>
    </>
  );
};

