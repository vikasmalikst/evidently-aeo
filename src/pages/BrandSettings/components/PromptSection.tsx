import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PromptSectionProps {
  totalPrompts: number;
}

export const PromptSection = ({
  totalPrompts,
}: PromptSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-headings)] mb-1">
            Prompts Generated
          </h2>
          <p className="text-sm text-[var(--text-caption)]">
            {totalPrompts} total prompts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-headings)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            {isExpanded ? (
              <>
                Show Less <ChevronUp size={16} />
              </>
            ) : (
              <>
                Show All <ChevronDown size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-[var(--text-caption)]">
          Prompts generate from your topics and are used to track search visibility across AI platforms.
        </p>
      </div>

      {isExpanded && (
        <div className="pt-4 border-t border-[var(--border-default)]">
          <p className="text-sm text-[var(--text-caption)]">
            Detailed prompt list would appear here...
          </p>
        </div>
      )}
    </div>
  );
};

