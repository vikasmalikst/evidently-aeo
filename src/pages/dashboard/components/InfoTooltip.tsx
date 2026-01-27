import { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  description: React.ReactNode;
  children?: React.ReactNode;
}

export const InfoTooltip = ({ description, children }: InfoTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <div
        className="flex items-center justify-center cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label="More information"
      >
        {children || (
          <div className="w-4 h-4 flex items-center justify-center text-[#64748b] hover:text-[#1a1d29] transition-colors">
            <Info size={14} />
          </div>
        )}
      </div>
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#1a1d29] text-white text-[12px] rounded-lg shadow-lg z-[100] pointer-events-none">
          <div className="whitespace-normal leading-relaxed">{description}</div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a1d29]"></div>
        </div>
      )}
    </div>
  );
};

