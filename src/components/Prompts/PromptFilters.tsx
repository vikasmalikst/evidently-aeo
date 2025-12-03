import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getLLMIcon } from '../Visibility/LLMIcons';

interface PromptFiltersProps {
  llmOptions: string[];
  selectedLLM: string | null;
  onLLMChange: (llm: string | null) => void;
  brands: Array<{ id: string; name: string }>;
  selectedBrandId: string | null;
  onBrandChange: (brandId: string) => void;
}

export const PromptFilters = ({
  llmOptions,
  selectedLLM,
  onLLMChange,
  brands,
  selectedBrandId,
  onBrandChange
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
    <div ref={dropdownRef} className="flex items-center justify-end gap-3 mb-6">
      {brands.length > 1 && (
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
            <div className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[300px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]">
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
      )}
      <div className="relative min-w-[200px]">
        <button
          type="button"
          className="flex items-center gap-2 w-full px-4 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]"
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdown(openDropdown === 'llm' ? null : 'llm');
          }}
        >
          <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left font-medium">
            {selectedLLM || 'All Models'}
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
              openDropdown === 'llm' ? 'rotate-180' : ''
            }`}
          />
        </button>
        {openDropdown === 'llm' && (
          <div 
            className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[400px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* All Models option */}
            <button
              type="button"
              className={`w-full px-4 py-3 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-primary)] flex items-center gap-2 ${
                selectedLLM === null || selectedLLM === 'All Models'
                  ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)] font-medium'
                  : ''
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLLMChange(null);
                setOpenDropdown(null);
              }}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
              </div>
              <span>All Models</span>
            </button>
            {llmOptions.length > 0 && (
              <>
                <div className="border-t border-[var(--border-default)] my-1"></div>
                {llmOptions.map((llm) => (
                  <button
                    key={llm}
                    type="button"
                    className={`w-full px-4 py-3 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-primary)] flex items-center gap-2 ${
                      selectedLLM === llm
                        ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)] font-medium'
                        : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (selectedLLM !== llm) {
                        onLLMChange(llm);
                      }
                      setOpenDropdown(null);
                    }}
                  >
                    {getLLMIcon(llm)}
                    <span>{llm}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
