import { useMemo, useRef, useState } from 'react';
import { PromptEntry } from '../../types/prompts';
import { PositionHighlighter } from './PositionHighlighter';
import { getLLMIcon } from '../Visibility/LLMIcons';

interface ResponseViewerProps {
  prompt: PromptEntry | null;
  selectedLLMs: string[];
}

export const ResponseViewer = ({ prompt, selectedLLMs }: ResponseViewerProps) => {
  const [highlightBrand, setHighlightBrand] = useState(true);
  const [highlightCompetitors, setHighlightCompetitors] = useState(true);
  const [selectionText, setSelectionText] = useState('');
  const responseContainerRef = useRef<HTMLDivElement>(null);

  const handleResponseMouseUp = () => {
    const container = responseContainerRef.current;
    if (!container) return;

    const selection = window.getSelection?.();
    if (!selection) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    if (anchorNode && !container.contains(anchorNode)) return;
    if (focusNode && !container.contains(focusNode)) return;

    const nextSelection = selection.toString().trim();
    setSelectionText(nextSelection);
  };

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
      // If no LLMs selected (All Models), show all responses
      if (selectedLLMs.length === 0) {
        return prompt.responses;
      }
      // Otherwise filter by selected collectors
      return prompt.responses.filter(r => selectedLLMs.includes(r.collectorType));
    }
    
    // Fallback: if no responses array but we have a single response, create a response object
    if (prompt.response && prompt.latestCollectorType && prompt.collectorResultId) {
      const singleResponse = {
        collectorResultId: prompt.collectorResultId,
        collectorType: prompt.latestCollectorType,
        response: prompt.response,
        lastUpdated: prompt.lastUpdated || new Date().toISOString(),
        brandMentions: null,
        competitorMentions: null,
        productMentions: null,
        keywordCount: null,
        brandPositions: [],
        competitorPositions: []
      };
      
      // Apply filter if needed (empty array means show all)
      if (selectedLLMs.length === 0 || selectedLLMs.includes(singleResponse.collectorType)) {
        return [singleResponse];
      }
    }
    
    return [];
  }, [prompt, selectedLLMs]);

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

      <div
        ref={responseContainerRef}
        onMouseUp={handleResponseMouseUp}
        className="flex-1 overflow-y-auto p-6 font-data"
        style={{ maxHeight: 'calc(100vh - 450px)' }}
      >
        {filteredResponses.length === 0 ? (
          <p className="text-sm text-[var(--text-caption)]">
            {selectedLLMs.length > 0
              ? `No response available for ${selectedLLMs.length === 1 ? selectedLLMs[0] : selectedLLMs.join(', ')} for this prompt.`
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                  {(responseItem.brandMentions !== null ||
                    responseItem.competitorMentions !== null) && (
                    <div className="text-xs text-[var(--text-caption)] flex items-center gap-2 mb-3 flex-wrap">
                      {(responseItem.brandMentions !== null && responseItem.brandMentions !== undefined) && (
                        <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--bg-secondary)] text-[var(--text-caption)]">
                          Brand: {responseItem.brandMentions}
                        </span>
                      )}
                      {(responseItem.competitorMentions !== null && responseItem.competitorMentions !== undefined) && (
                        <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[var(--bg-secondary)] text-[var(--text-caption)]">
                          Competitor: {responseItem.competitorMentions}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-[var(--text-body)]">
                    <PositionHighlighter
                      text={responseItem.response}
                      brandPositions={responseItem.brandPositions ?? []}
                      competitorPositions={responseItem.competitorPositions ?? []}
                      highlightBrand={highlightBrand}
                      highlightCompetitors={highlightCompetitors}
                      selectionText={selectionText}
                      className="text-sm text-[var(--text-body)]"
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
