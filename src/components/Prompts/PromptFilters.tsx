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
      {/* 
        LLM Filters and DateRangePicker moved to Header.
        This component now primarily handles Competitor Filtering.
      */}

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
