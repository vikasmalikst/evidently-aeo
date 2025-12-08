import { BrandIcon } from '../../../components/Visibility/BrandIcon';
import type { ManagedCompetitor } from '../../../api/competitorManagementApi';

interface CompetitorFilterProps {
  competitors: ManagedCompetitor[];
  selectedCompetitors: Set<string>; // Set of competitor names (lowercase)
  onCompetitorToggle: (competitorName: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isLoading?: boolean; // Loading state when data is being fetched
}

export const CompetitorFilter = ({
  competitors,
  selectedCompetitors,
  onCompetitorToggle,
  onSelectAll,
  onDeselectAll,
  isLoading = false,
}: CompetitorFilterProps) => {
  // Check if all competitors are selected (same logic as LLM filter - when all are selected, "All" button is active)
  const allSelected = competitors.length > 0 && 
    selectedCompetitors.size === competitors.length &&
    competitors.every(c => selectedCompetitors.has(c.name.toLowerCase()));

  // Show component even when loading (to avoid layout shift)
  // Only hide if not loading and no competitors
  if (competitors.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* "All" button - show even when loading */}
      <button
        type="button"
        onClick={onSelectAll}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
          allSelected
            ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48] shadow-sm'
            : 'bg-white border-[#e4e7ec] text-[#1a1d29] hover:border-[#cfd4e3]'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Select all competitors"
      >
        All
      </button>

      {/* Individual competitor toggle buttons - show even when loading */}
      {competitors.length > 0 ? competitors.map((competitor) => {
        const isSelected = selectedCompetitors.has(competitor.name.toLowerCase());

        return (
          <button
            key={competitor.name}
            type="button"
            onClick={() => onCompetitorToggle(competitor.name)}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-all relative ${
              isSelected
                ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48] shadow-sm'
                : 'bg-white border-[#e4e7ec] text-[#1a1d29] hover:border-[#cfd4e3]'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={competitor.name}
            aria-label={`Filter by ${competitor.name}`}
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white">
              <BrandIcon brandName={competitor.name} size={24} />
            </span>
          </button>
        );
      }) : null}

      {/* Loading spinner - show when loading */}
      {isLoading && (
        <div className="flex items-center gap-2 ml-1">
          <div className="w-4 h-4 rounded-full border-2 border-[#00bcdc] border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
};

