import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface UrlTooltipProps {
  url: string;
  fullUrl: string;
  urls?: string[];
}

export const UrlTooltip = ({ url, fullUrl, urls }: UrlTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const hasMultipleUrls = urls && urls.length > 1;

  if (hasMultipleUrls) {
    return (
      <div className="relative inline-flex items-center">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="text-[12px] text-[#00bcdc] hover:text-[#0096b0] font-medium flex items-center gap-1 transition-colors"
        >
          <ExternalLink size={12} />
          View URL ({urls.length})
        </button>
        {showDropdown && (
          <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[90vw] bg-white border border-[#e8e9ed] rounded-lg shadow-lg z-[100] overflow-hidden">
            <div className="p-2 max-h-64 overflow-y-auto">
              <div className="text-[11px] text-[#64748b] font-medium mb-2 px-2 py-1">
                Select URL to visit:
              </div>
              {urls.map((urlItem, index) => {
                const fullUrlItem = urlItem.startsWith('http') ? urlItem : `https://${urlItem}`;
                return (
                  <a
                    key={index}
                    href={fullUrlItem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2 text-[12px] text-[#1a1d29] hover:bg-[#f9f9fb] rounded transition-colors break-all"
                    onClick={() => setShowDropdown(false)}
                  >
                    <div className="flex items-center gap-2">
                      <ExternalLink size={12} className="flex-shrink-0 text-[#00bcdc]" />
                      <span className="truncate" title={urlItem}>
                        {urlItem.replace(/^https?:\/\//, '')}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
        {showDropdown && (
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-[#00bcdc] hover:text-[#0096b0] font-medium flex items-center gap-1 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <ExternalLink size={12} />
        View URL
      </a>
      {showTooltip && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[90vw] p-2.5 bg-[#1a1d29] text-white text-[11px] rounded-lg shadow-lg z-[100] pointer-events-none break-all">
          <div className="whitespace-normal leading-relaxed" style={{ wordBreak: 'break-all' }}>
            {url}
          </div>
          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a1d29]"></div>
        </div>
      )}
    </div>
  );
};

