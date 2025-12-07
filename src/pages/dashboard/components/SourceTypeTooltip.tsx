/**
 * SourceTypeTooltip Component
 * 
 * Displays a tooltip showing the top 5 sources for a selected source type.
 * This tooltip appears when a user clicks on a Source Type Distribution bar.
 * 
 * Props:
 * - sourceType: The name of the source type (e.g., "Editorial", "Corporate")
 * - sources: Array of top sources for this type, each containing domain, title, url, and usage count
 * - position: { x, y } coordinates for tooltip positioning
 * - onClose: Callback function to close the tooltip
 */

interface SourceTypeTooltipProps {
  sourceType: string;
  sources: Array<{
    domain: string;
    title: string | null;
    url: string | null;
    usage: number;
  }>;
  position: { x: number; y: number };
  onClose: () => void;
}

export const SourceTypeTooltip = ({
  sourceType,
  sources,
  position,
  onClose
}: SourceTypeTooltipProps) => {
  if (sources.length === 0) {
    return null;
  }

  return (
    <>
      {/* Backdrop to close tooltip when clicking outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ backgroundColor: 'transparent' }}
      />
      
      {/* Tooltip container */}
      <div
        className="fixed z-50 bg-white border border-[#e8e9ed] rounded-lg shadow-lg p-3 min-w-[260px] max-w-[380px]"
        style={{
          left: `${Math.min(position.x, window.innerWidth - 300)}px`,
          top: `${Math.min(position.y, window.innerHeight - 200)}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[13px] font-semibold text-[#1a1d29]">
            Top 5 {sourceType} Sources
          </h4>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-[#1a1d29] transition-colors"
            aria-label="Close tooltip"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Sources list */}
        <div className="space-y-1.5">
          {sources.map((source, index) => (
            <div
              key={`${source.domain}-${index}`}
              className="flex items-start gap-2 py-1.5 px-1.5 rounded hover:bg-[#f9f9fb] transition-colors"
            >
              {/* Rank number */}
              <span className="text-[11px] font-semibold text-[#64748b] min-w-[18px] flex-shrink-0 pt-0.5">
                {index + 1}.
              </span>
              
              {/* Source info - compact layout */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="text-[12px] font-medium text-[#1a1d29] truncate mb-0.5">
                  {source.title || source.domain}
                </div>
                
                {/* Domain and citations on same row */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#64748b] truncate flex-1">
                    {source.domain}
                  </span>
                  <span className="text-[10px] font-medium text-[#64748b] whitespace-nowrap flex-shrink-0">
                    {source.usage} {source.usage === 1 ? 'citation' : 'citations'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-2 pt-2 border-t border-[#e8e9ed]">
          <p className="text-[10px] text-[#64748b]">
            Click outside to close
          </p>
        </div>
      </div>
    </>
  );
};

