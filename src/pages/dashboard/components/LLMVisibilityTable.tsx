import { ChevronUp, ChevronDown } from 'lucide-react';
import { getLLMIcon } from '../../../components/Visibility/LLMIcons';
import type { LLMVisibilitySliceUI } from '../types';
import { EmptyState } from './EmptyState';
import { InfoTooltip } from './InfoTooltip';

interface LLMVisibilityTableProps {
  llmSlices: LLMVisibilitySliceUI[];
}

export const LLMVisibilityTable = ({ llmSlices }: LLMVisibilityTableProps) => {
  const hasLlmData = llmSlices.length > 0;

  if (!hasLlmData) {
    return <EmptyState message="No LLM visibility data available for this period." />;
  }

  // Format sentiment score for display (0-100 scale)
  const formatSentiment = (sentiment: number | null | undefined): string => {
    if (sentiment === null || sentiment === undefined) return '—';
    return Math.round(sentiment).toString();
  };

  // Format SOA (Share of Answers) for display (percentage)
  const formatSOA = (share: number | undefined): string => {
    if (share === undefined || share === null) return '—';
    return `${Math.round(share)}%`;
  };

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-[#64748b] uppercase text-[11px] tracking-wide">
          <th className="py-2 font-medium text-left pl-0 pr-4">LLM</th>
          <th className="py-2 font-medium text-center px-3">Visibility</th>
          <th className="py-2 font-medium text-center px-3">SOA</th>
          <th className="py-2 font-medium text-center px-3">Sentiment</th>
          <th className="py-2 font-medium text-center px-3">Brand Presence</th>
        </tr>
      </thead>
      <tbody>
        {llmSlices.map((slice) => (
          <tr key={slice.provider} className="border-t border-[#f0f0f3]">
            <td className="py-3 pl-0 pr-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">{getLLMIcon(slice.provider)}</div>
                <span className="text-[#1a1d29] font-medium">{slice.provider}</span>
              </div>
            </td>
            <td className="py-3 text-center px-3 text-[#1a1d29] font-semibold">
              <div className="flex items-center justify-center gap-1.5">
                <span>{Math.round(slice.visibility ?? 0)}</span>
              {slice.delta !== 0 && (
                <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                    slice.delta > 0 ? 'text-[#06c686]' : 'text-[#f94343]'
                  }`}
                >
                  {slice.delta > 0 ? (
                    <ChevronUp size={12} strokeWidth={2.5} />
                  ) : (
                    <ChevronDown size={12} strokeWidth={2.5} />
                  )}
                  {Math.abs(slice.delta).toFixed(1)} pts
                </span>
              )}
              </div>
            </td>
            <td className="py-3 text-center px-3 text-[#1a1d29] font-semibold">
              {formatSOA(slice.shareOfSearch ?? slice.share)}
            </td>
            <td className="py-3 text-center px-3 text-[#1a1d29] font-semibold">
              {formatSentiment(slice.sentiment)}
            </td>
            <td className="py-3 text-center px-3 text-[#1a1d29] font-semibold">
              {slice.brandPresenceCount}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

