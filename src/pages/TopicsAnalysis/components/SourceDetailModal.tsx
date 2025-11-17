import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TopicSource } from '../types';

interface SourceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: TopicSource | null;
  pages?: string[];
}

// Source type colors matching the sources page
const sourceTypeColors: Record<string, string> = {
  'brand': '#00bcdc',
  'editorial': '#498cf9',
  'corporate': '#fa8a40',
  'reference': '#ac59fb',
  'ugc': '#f155a2',
  'institutional': '#0d7c96'
};

export const SourceDetailModal = ({ isOpen, onClose, source, pages = [] }: SourceDetailModalProps) => {
  const navigate = useNavigate();
  
  if (!isOpen || !source) return null;

  // Extract domain from URL for favicon
  const domain = source.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  // Generate mock pages if none provided
  const sourcePages = pages.length > 0 ? pages : [
    'Product Overview',
    'Pricing Page',
    'Features Comparison',
    'Customer Success Stories',
    'Integration Documentation',
    'Security & Compliance',
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-modal-title"
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[51] bg-white rounded-lg shadow-xl w-[95%] sm:w-[90%] max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <img
              src={faviconUrl}
              alt=""
              className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex-1 min-w-0">
              <h2
                id="source-modal-title"
                className="text-lg sm:text-xl font-semibold text-[var(--text-headings)] truncate"
              >
                {source.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase"
                  style={{
                    backgroundColor: sourceTypeColors[source.type] || '#6c7289',
                    color: '#ffffff',
                  }}
                >
                  {source.type}
                </span>
                {source.citations !== undefined && (
                  <span className="text-xs text-[var(--text-caption)]">
                    {source.citations} citations
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <X size={20} className="text-[var(--text-body)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-headings)] uppercase tracking-wide mb-3 sm:mb-4">
              Source Pages
            </h3>
            <div className="space-y-2">
              {sourcePages.map((page, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--accent500)] flex-shrink-0"></div>
                  <span className="text-sm text-[var(--text-body)] flex-1">{page}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <button
            onClick={() => {
              onClose();
              navigate('/search-sources');
            }}
            className="w-full px-4 py-2 sm:py-2.5 bg-[var(--accent500)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium text-sm sm:text-base"
          >
            Analyze Sources
          </button>
        </div>
      </div>
    </>
  );
};

