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

  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="text-[#64748b] uppercase text-[11px] tracking-wide">
          <th className="py-2 font-medium">LLM</th>
          <th className="py-2 font-medium text-right">Visibility</th>
          <th className="py-2 font-medium text-right">Brand Presence</th>
        </tr>
      </thead>
      <tbody>
        {llmSlices.map((slice) => (
          <tr key={slice.provider} className="border-t border-[#f0f0f3]">
            <td className="py-3 pr-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">{getLLMIcon(slice.provider)}</div>
                <span className="text-[#1a1d29] font-medium">{slice.provider}</span>
              </div>
            </td>
            <td className="py-3 text-right text-[#1a1d29] font-semibold">
              {Math.round(slice.visibility ?? 0)}
              {slice.delta !== 0 && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ml-2 ${
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
            </td>
            <td className="py-3 text-right text-[#1a1d29] font-semibold">
              {slice.brandPresenceCount}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

