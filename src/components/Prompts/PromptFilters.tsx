import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getLLMIcon } from '../Visibility/LLMIcons';
import { DateRangePicker } from '../DateRangePicker/DateRangePicker';

interface PromptFiltersProps {
  llmOptions: string[];
  selectedLLMs: string[];
  onLLMChange: (llms: string[]) => void;
  brands: Array<{ id: string; name: string }>;
  selectedBrandId: string | null;
  onBrandChange: (brandId: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export const PromptFilters = ({
  llmOptions,
  selectedLLMs,
  onLLMChange,
  brands,
  selectedBrandId,
  onBrandChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange
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

  const currentBrand = brands.find(b => b.id === selectedBrandId);

  return (
    <div ref={dropdownRef} className="flex items-center justify-between gap-3 mb-6">
      {/* Left: Brand dropdown (if multiple brands) */}
      {brands.length > 1 ? (
        <div className="relative min-w-[200px]">
          <button
            className="flex items-center gap-2 w-full px-4 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]"
            onClick={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')}
          >
            <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left font-medium">
              {currentBrand?.name || 'Select Brand'}
            </span>
            <ChevronDown
              size={16}
              className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
                openDropdown === 'brand' ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openDropdown === 'brand' && (
            <div className="absolute top-[calc(100%+4px)] left-0 min-w-full max-h-[300px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  className={`block w-full px-4 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-primary)] ${
                    selectedBrandId === brand.id
                      ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)] font-medium'
                      : ''
                  }`}
                  onClick={() => {
                    onBrandChange(brand.id);
                    setOpenDropdown(null);
                  }}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="min-w-[200px]"></div>
      )}

      {/* Center: LLM icon filters - multi-select */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onLLMChange([])}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
            selectedLLMs.length === 0
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
              className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all ${
                isActive
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
  );
};
