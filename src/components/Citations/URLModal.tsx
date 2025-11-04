import { X, ExternalLink } from 'lucide-react';
import { URLData } from '../../data/mockCitationSourcesData';

interface URLModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: URLData[];
  domain: string;
}

export const URLModal = ({ isOpen, onClose, urls, domain }: URLModalProps) => {
  if (!isOpen) return null;

  const truncateURL = (url: string, maxLength = 60) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-headings)]">
              URLs from {domain}
            </h2>
            <p className="text-sm text-[var(--text-caption)] mt-1">
              {urls.length} {urls.length === 1 ? 'URL' : 'URLs'} found
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--text-caption)]" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-100px)]">
          <div className="p-6 space-y-3">
            {urls.map((urlData, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors group"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <a
                    href={`https://${urlData.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--accent-primary)] hover:underline font-medium flex items-center gap-2"
                    title={urlData.url}
                  >
                    <span className="truncate">{truncateURL(urlData.url, 70)}</span>
                    <ExternalLink size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-[var(--text-caption)]">
                      Used: <span className="font-semibold text-[var(--text-body)]">{urlData.usedTotal}</span>
                    </span>
                    <span className="text-xs text-[var(--text-caption)]">
                      Citations: <span className="font-semibold text-[var(--text-body)]">{urlData.avgCitations.toFixed(1)}x</span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 max-w-xs">
                  {urlData.topics.map((topic, tidx) => (
                    <span
                      key={tidx}
                      className="inline-block px-2 py-1 bg-[var(--accent-light)] text-xs text-[var(--accent-primary)] rounded whitespace-nowrap"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
