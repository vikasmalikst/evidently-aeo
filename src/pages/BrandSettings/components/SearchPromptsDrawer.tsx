import { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2, Copy, Search } from 'lucide-react';
import type { Topic } from '../../../types/topic';

interface TopicPrompts {
  [key: string]: {
    name: string;
    prompts: string[];
  };
}

// Mock data - in production this would come from an API
const topicPrompts: TopicPrompts = {
  'topic-1': {
    name: 'Product Reviews',
    prompts: [
      'best product reviews',
      'product reviews 2024',
      'top rated products',
      'trusted product reviews',
      'product comparison reviews',
      'unbiased product reviews',
      'where to buy products',
      'product review sites'
    ]
  },
  'topic-2': {
    name: 'Pricing',
    prompts: [
      'product pricing comparison',
      'best product deals',
      'product cost',
      'affordable products',
      'product price range',
      'discount products',
      'product value for money',
      'cheapest products'
    ]
  },
  'topic-3': {
    name: 'Sustainability',
    prompts: [
      'sustainable products',
      'eco friendly products',
      'sustainable brands',
      'green products',
      'environmentally conscious products',
      'carbon neutral products',
      'recyclable products',
      'eco-conscious brands'
    ]
  }
};

interface SearchPromptsDrawerProps {
  selectedTopic: Topic | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SearchPromptsDrawer = ({
  selectedTopic,
  isOpen,
  onClose,
}: SearchPromptsDrawerProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Get prompts for the selected topic - fallback to mock data if not found
  const topicData = selectedTopic
    ? topicPrompts[selectedTopic.id] || {
        name: selectedTopic.name,
        prompts: Array(8).fill(null).map((_, i) => `${selectedTopic.name.toLowerCase()} query ${i + 1}`)
      }
    : null;

  useEffect(() => {
    if (!isOpen) {
      setIsMaximized(false);
    }
  }, [isOpen]);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleToggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  if (!isOpen || !topicData) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-200"
        onClick={onClose}
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Drawer */}
      <div
        className={`fixed top-20 right-0 bg-white shadow-xl z-50 transition-all duration-200 flex flex-col drawer-container rounded-tl-lg rounded-bl-lg border-l border-t border-b border-[var(--border-default)] ${
          isMaximized ? 'w-full maximized' : 'w-[350px]'
        }`}
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          maxHeight: 'calc(100vh - 5rem)',
          height: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-semibold text-[var(--text-headings)] truncate">
              Topic: {topicData.name}
            </h3>
            <p className="text-xs text-[var(--text-caption)] mt-0.5">
              {topicData.prompts.length} search prompts
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleToggleMaximize}
              className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
              aria-label={isMaximized ? 'Minimize drawer' : 'Maximize drawer'}
            >
              {isMaximized ? (
                <Minimize2 size={18} className="text-[var(--text-body)]" />
              ) : (
                <Maximize2 size={18} className="text-[var(--text-body)]" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
              aria-label="Close drawer"
            >
              <X size={18} className="text-[var(--text-body)]" />
            </button>
          </div>
        </div>

        {/* Content - Auto-height, scrollable if content exceeds max height */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          <div className="space-y-2">
            {topicData.prompts.map((prompt, index) => (
              <div
                key={index}
                className="group flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Search size={14} className="text-[var(--text-caption)] flex-shrink-0" />
                <p className="flex-1 text-xs text-[var(--text-caption)] truncate">
                  {prompt}
                </p>
                <button
                  onClick={() => handleCopy(prompt, index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[var(--bg-primary)] rounded flex-shrink-0"
                  aria-label="Copy prompt"
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? (
                    <span className="text-xs text-[var(--success500)] whitespace-nowrap">Copied!</span>
                  ) : (
                    <Copy size={14} className="text-[var(--text-caption)]" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .drawer-container:not(.maximized) {
            width: 85% !important;
          }
        }
      `}</style>
    </>
  );
};
