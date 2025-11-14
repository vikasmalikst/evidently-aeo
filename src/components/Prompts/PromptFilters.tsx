import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getLLMIcon } from '../Visibility/LLMIcons';
import { CountryFlag } from '../CountryFlag';

interface PromptFiltersProps {
  selectedLLMs: string[];
  onLLMChange: (llms: string[]) => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
}

const llmOptions = [
  'ChatGPT',
  'Perplexity',
  'Google AI Search',
  'Gemini',
  'Claude',
  'Grok',
  'Deepseek',
  'Microsoft Copilot',
  'Meta Llama'
];

// Country options (sorted alphabetically)
const countryOptions = [
  { value: 'canada', label: 'Canada' },
  { value: 'china', label: 'China' },
  { value: 'india', label: 'India' },
  { value: 'japan', label: 'Japan' },
  { value: 'south-korea', label: 'South Korea' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'us', label: 'United States' }
];

// Region options (sorted alphabetically)
const regionOptions = [
  { value: 'emea', label: 'EMEA' },
  { value: 'latam', label: 'LATAM' },
  { value: 'south-america', label: 'South America' },
  { value: 'southeast-asia', label: 'Southeast Asia' }
];

export const PromptFilters = ({
  selectedLLMs,
  onLLMChange,
  selectedRegion,
  onRegionChange
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
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const handleLLMToggle = (llm: string) => {
    if (selectedLLMs.includes(llm)) {
      onLLMChange(selectedLLMs.filter(l => l !== llm));
    } else {
      onLLMChange([...selectedLLMs, llm]);
    }
  };

  const allOptions = [...countryOptions, ...regionOptions];
  const currentRegion = allOptions.find(r => r.value === selectedRegion);

  return (
    <div ref={dropdownRef} className="flex items-center justify-end gap-3 mb-6">
      <div className="relative min-w-[200px]">
        <button
          className="flex items-center gap-2 w-full px-4 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]"
          onClick={() => setOpenDropdown(openDropdown === 'llm' ? null : 'llm')}
        >
          <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left font-medium">
            {selectedLLMs.length === 0
              ? 'All LLMs'
              : selectedLLMs.length === 1
              ? selectedLLMs[0]
              : `${selectedLLMs.length} LLMs selected`}
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
              openDropdown === 'llm' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openDropdown === 'llm' && (
          <div className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[400px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]">
            {llmOptions.map((llm) => (
              <label
                key={llm}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-all duration-150"
              >
                <input
                  type="checkbox"
                  checked={selectedLLMs.includes(llm)}
                  onChange={() => handleLLMToggle(llm)}
                  className="w-4 h-4 text-[var(--accent-primary)] border-[var(--border-default)] rounded focus:ring-[var(--accent-primary)]"
                />
                <div className="flex items-center gap-2 flex-1">
                  {getLLMIcon(llm)}
                  <span className="text-sm text-[var(--text-body)]">{llm}</span>
                </div>
              </label>
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
