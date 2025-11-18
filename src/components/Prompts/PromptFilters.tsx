import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getLLMIcon } from '../Visibility/LLMIcons';
import { CountryFlag } from '../CountryFlag';

interface PromptFiltersProps {
  llmOptions: string[];
  selectedLLM: string | null;
  onLLMChange: (llm: string | null) => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  brands: Array<{ id: string; name: string }>;
  selectedBrandId: string | null;
  onBrandChange: (brandId: string) => void;
}

const regionOptions = [
  { value: 'emea', label: 'EMEA' },
  { value: 'latam', label: 'LATAM' },
  { value: 'south-america', label: 'South America' },
  { value: 'southeast-asia', label: 'Southeast Asia' }
];

export const PromptFilters = ({
  llmOptions,
  selectedLLM,
  onLLMChange,
  selectedRegion,
  onRegionChange,
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


  const currentRegion = regionOptions.find(r => r.value === selectedRegion);
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
            {selectedLLM || 'Select LLM'}
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
              openDropdown === 'llm' ? 'rotate-180' : ''
            }`}
          />
        </button>
        {openDropdown === 'llm' && llmOptions.length > 0 && (
          <div 
            className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[400px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]"
            onClick={(e) => e.stopPropagation()}
          >
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
          </div>
        )}
      </div>

      <div className="relative min-w-[200px]">
        <button
          className="flex items-center gap-2 w-full px-4 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]"
          onClick={() => setOpenDropdown(openDropdown === 'region' ? null : 'region')}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {currentRegion && (
              <CountryFlag 
                countryCode={currentRegion.value} 
                className="w-4 h-4 flex-shrink-0"
              />
            )}
            <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis text-left font-medium">
              {currentRegion?.label}
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
              openDropdown === 'region' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openDropdown === 'region' && (
          <div className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[300px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]">
            {/* Countries */}
            {countryOptions.map((option) => (
              <button
                key={option.value}
                className={`flex items-center gap-2 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-primary)] ${
                  selectedRegion === option.value
                    ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)] font-medium'
                    : ''
                }`}
                onClick={() => {
                  onRegionChange(option.value);
                  setOpenDropdown(null);
                }}
              >
                <CountryFlag 
                  countryCode={option.value} 
                  className="w-4 h-4 flex-shrink-0"
                />
                <span>{option.label}</span>
              </button>
            ))}
            
            {/* Separator with Regions Header */}
            <div className="flex items-center px-4 py-2 my-1">
              <div className="flex-1 border-t border-[var(--border-default)]"></div>
              <span className="px-3 text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Regions
              </span>
              <div className="flex-1 border-t border-[var(--border-default)]"></div>
            </div>
            
            {/* Regions */}
            {regionOptions.map((option) => (
              <button
                key={option.value}
                className={`flex items-center gap-2 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-primary)] ${
                  selectedRegion === option.value
                    ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)] font-medium'
                    : ''
                }`}
                onClick={() => {
                  onRegionChange(option.value);
                  setOpenDropdown(null);
                }}
              >
                <CountryFlag 
                  countryCode={option.value} 
                  className="w-4 h-4 flex-shrink-0"
                />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
