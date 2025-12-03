import { useMemo, useState } from 'react';
import { PromptEntry } from '../../types/prompts';
import { KeywordHighlighter } from './KeywordHighlighter';
import { getLLMIcon } from '../Visibility/LLMIcons';

interface ResponseViewerProps {
  prompt: PromptEntry | null;
  selectedLLM: string | null;
}

export const ResponseViewer = ({ prompt, selectedLLM }: ResponseViewerProps) => {
  const [highlightBrand, setHighlightBrand] = useState(true);
  const [highlightProducts, setHighlightProducts] = useState(true);
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [highlightCompetitors, setHighlightCompetitors] = useState(true);

  // Get all responses, filtered by selectedLLM if specified
  const filteredResponses = useMemo(() => {
    if (!prompt) return [];
    
    // Debug logging
    if (prompt.responses && prompt.responses.length > 0) {
      console.log(`[ResponseViewer] Prompt "${prompt.question}" has ${prompt.responses.length} responses:`, 
        prompt.responses.map(r => r.collectorType).join(', '))
    } else if (prompt.response) {
      console.log(`[ResponseViewer] Prompt "${prompt.question}" has single response (fallback mode)`)
    }
    
    // If responses array exists, use it; otherwise fall back to single response
    if (prompt.responses && prompt.responses.length > 0) {
      // If selectedLLM is null (All Models), show all responses
      if (!selectedLLM) {
        return prompt.responses;
      }
      // Otherwise filter by selected collector
      return prompt.responses.filter(r => r.collectorType === selectedLLM);
    }
    
    // Fallback: if no responses array but we have a single response, create a response object
    if (prompt.response && prompt.latestCollectorType && prompt.collectorResultId) {
      const singleResponse = {
        collectorResultId: prompt.collectorResultId,
        collectorType: prompt.latestCollectorType,
        response: prompt.response,
        lastUpdated: prompt.lastUpdated || new Date().toISOString()
      };
      
      // Apply filter if needed (null means show all)
      if (!selectedLLM || singleResponse.collectorType === selectedLLM) {
        return [singleResponse];
      }
    }
    
    return [];
  }, [prompt, selectedLLM]);

  const formattedTimestamp = useMemo(() => {
    if (!prompt?.lastUpdated) {
      return null;
    }
    try {
      const date = new Date(prompt.lastUpdated);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return date.toLocaleString();
    } catch {
      return null;
    }
  }, [prompt?.lastUpdated]);

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
            Responses {filteredResponses.length > 0 && `(${filteredResponses.length})`}
          </h3>
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
                checked={highlightProducts}
                onChange={() => setHighlightProducts(!highlightProducts)}
                className="w-3 h-3 rounded border-2 border-[#AC59FB] text-[#AC59FB] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs font-medium text-[#AC59FB]">Product</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={highlightKeywords}
                onChange={() => setHighlightKeywords(!highlightKeywords)}
                className="w-3 h-3 rounded border-2 border-[#10B981] text-[#10B981] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs font-medium text-[#10B981]">Keywords</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={highlightCompetitors}
                onChange={() => setHighlightCompetitors(!highlightCompetitors)}
                className="w-3 h-3 rounded border-2 border-[#F59E0B] text-[#F59E0B] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs font-medium text-[#F59E0B]">Competitors</span>
            </label>
          </div>
        </div>
        {prompt.latestCollectorType && filteredResponses.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-caption)] font-medium">
            <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-[var(--bg-secondary)] text-[var(--text-caption)]">
              {prompt.latestCollectorType}
            </span>
            {formattedTimestamp && <span>Updated {formattedTimestamp}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 font-data" style={{ maxHeight: 'calc(100vh - 450px)' }}>
        {filteredResponses.length === 0 ? (
          <p className="text-sm text-[var(--text-caption)]">
            {selectedLLM
              ? `No response available for ${selectedLLM} for this prompt.`
              : 'No response captured for this prompt within the selected filters.'}
          </p>
        ) : (
          <div className="space-y-6">
            {filteredResponses.map((responseItem, index) => {
              const responseDate = new Date(responseItem.lastUpdated);
              const formattedDate = !Number.isNaN(responseDate.getTime())
                ? responseDate.toLocaleString()
                : null;

              return (
                <div key={`${responseItem.collectorResultId}-${index}`} className="border-b border-[var(--border-default)] pb-6 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {getLLMIcon(responseItem.collectorType)}
                      <span className="text-sm font-semibold text-[var(--text-headings)]">
                        {responseItem.collectorType}
                      </span>
                    </div>
                    {formattedDate && (
                      <span className="text-xs text-[var(--text-caption)]">
                        • {formattedDate}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[var(--text-body)]">
                    <KeywordHighlighter
                      text={responseItem.response}
                      keywords={prompt.highlights}
                      highlightBrand={highlightBrand}
                      highlightProducts={highlightProducts}
                      highlightKeywords={highlightKeywords}
                      highlightCompetitors={highlightCompetitors}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
