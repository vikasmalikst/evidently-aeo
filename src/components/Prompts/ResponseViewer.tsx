import { useState } from 'react';
import { Prompt } from '../../data/mockPromptsData';
import { KeywordHighlighter } from './KeywordHighlighter';

interface ResponseViewerProps {
  prompt: Prompt | null;
  showHighlighting?: boolean;
}

export const ResponseViewer = ({ prompt, showHighlighting = true }: ResponseViewerProps) => {
  const [highlightBrand, setHighlightBrand] = useState(true);
  const [highlightTarget, setHighlightTarget] = useState(true);
  const [highlightTop, setHighlightTop] = useState(true);

  if (!prompt) {
    return (
      <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm h-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-[var(--text-caption)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-2">
            No Prompt Selected
          </h3>
          <p className="text-sm text-[var(--text-caption)]">
            Select a prompt from the left panel to view its response
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text-headings)]">
            Response
          </h3>
          {showHighlighting && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightBrand}
                  onChange={() => setHighlightBrand(!highlightBrand)}
                  className="w-3 h-3 rounded border-2 border-[#498CF9] text-[#498CF9] focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs font-medium text-[#498CF9]">Brand</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightTarget}
                  onChange={() => setHighlightTarget(!highlightTarget)}
                  className="w-3 h-3 rounded border-2 border-[#AC59FB] text-[#AC59FB] focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs font-medium text-[#AC59FB]">Target</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightTop}
                  onChange={() => setHighlightTop(!highlightTop)}
                  className="w-3 h-3 rounded border-2 border-[#F155A2] text-[#F155A2] focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs font-medium text-[#F155A2]">Trending</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 font-data" style={{ maxHeight: 'calc(100vh - 450px)' }}>
        {showHighlighting ? (
          <KeywordHighlighter
            text={prompt.response}
            keywords={prompt.keywords}
            highlightBrand={highlightBrand}
            highlightTarget={highlightTarget}
            highlightTop={highlightTop}
          />
        ) : (
          <p className="text-[var(--text-body)] whitespace-pre-wrap">{prompt.response}</p>
        )}
      </div>
    </div>
  );
};
