import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getLLMIcon } from '../Visibility/LLMIcons';
import { DateRangePicker } from '../DateRangePicker/DateRangePicker';
import { CompetitorFilter } from '../../pages/TopicsAnalysis/components/CompetitorFilter';
import { ManagedCompetitor } from '../../api/competitorManagementApi';

interface PromptFiltersProps {
  llmOptions: string[];
  selectedLLMs: string[];
  onLLMChange: (llms: string[]) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  competitors: ManagedCompetitor[];
  selectedCompetitors: string[];
  onSelectedCompetitorsChange: (competitors: string[]) => void;
}

export const PromptFilters = ({
  llmOptions,
  selectedLLMs,
  onLLMChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  competitors,
  selectedCompetitors,
  onSelectedCompetitorsChange
}: PromptFiltersProps) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      // Use a small timeout to ensure click events on dropdown items fire first
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openDropdown]);

  return (
    <div ref={dropdownRef} className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between gap-3">
        {/* LLM icon filters - multi-select */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onLLMChange([])}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${selectedLLMs.length === 0
              ? 'bg-[#e6f7f0] border-[#12b76a] text-[#027a48]'
              : 'bg-white border-[#e4e7ec] text-[#6c7289] hover:border-[#cfd4e3]'
              }`}
            title="All Models"
          >
            All
          </button>
          {llmOptions.map((llm) => {
            const isActive = selectedLLMs.includes(llm);
            return (
              <button
                key={llm}
                type="button"
                onClick={() => {
                  if (isActive) {
                    // Remove from selection
                    onLLMChange(selectedLLMs.filter(m => m !== llm));
                  } else {
                    // Add to selection
                    onLLMChange([...selectedLLMs, llm]);
                  }
                }}
                className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all ${isActive
                  ? 'bg-[#e6f7f0] border-[#12b76a] shadow-sm'
                  : 'bg-white border-[#e4e7ec] hover:border-[#cfd4e3]'
                  }`}
                title={llm}
                aria-label={`Filter by ${llm}`}
              >
                <span className="inline-flex items-center justify-center w-6 h-6">
                  {getLLMIcon(llm)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Date Range Picker */}
        <div className="min-w-[200px] flex justify-end">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
            showComparisonInfo={false}
          />
        </div>
      </div>

      {/* Competitor Filter Row */}
      {competitors.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] font-bold text-[var(--text-caption)] whitespace-nowrap min-w-[100px] uppercase tracking-wider">
            COMPETITORS
          </span>
          <CompetitorFilter
            competitors={competitors}
            selectedCompetitors={selectedCompetitors}
            onCompetitorToggle={(name) => {
              const key = name.toLowerCase();
              if (selectedCompetitors.includes(key)) {
                onSelectedCompetitorsChange(selectedCompetitors.filter(c => c !== key));
              } else {
                onSelectedCompetitorsChange([...selectedCompetitors, key]);
              }
            }}
            onSelectAll={() => {
              onSelectedCompetitorsChange(competitors.map(c => c.name.toLowerCase()));
            }}
            onDeselectAll={() => {
              onSelectedCompetitorsChange([]);
            }}
          />
        </div>
      )}
    </div>
  );
};
