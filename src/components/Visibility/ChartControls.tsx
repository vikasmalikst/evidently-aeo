import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LineChart, BarChart3 } from 'lucide-react';
import { CountryFlag } from '../CountryFlag';

interface BrandOption {
  id: string;
  name: string;
}

interface ChartControlsProps {
  timeframe: string;
  onTimeframeChange: (value: string) => void;
  chartType: string;
  onChartTypeChange: (value: string) => void;
  region: string;
  onRegionChange: (value: string) => void;
  brands?: BrandOption[];
  selectedBrandId?: string | null;
  onBrandChange?: (brandId: string) => void;
  metricType?: 'visibility' | 'share' | 'sentiment';
  onMetricTypeChange?: (value: 'visibility' | 'share' | 'sentiment') => void;
}

export const ChartControls = ({
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  region,
  onRegionChange,
  brands = [],
  selectedBrandId,
  onBrandChange,
  metricType = 'visibility',
  onMetricTypeChange
}: ChartControlsProps) => {
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

  const timeframeOptions = [
    { value: 'weekly', label: 'Weekly (Last 7 days)' },
    { value: 'monthly', label: 'Monthly (Last 30 days)' },
    { value: 'ytd', label: 'Year to Date' }
  ];

  const chartTypeOptions = [
    { value: 'line', label: 'Line Chart', icon: LineChart },
    { value: 'bar', label: 'Bar Chart', icon: BarChart3 }
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

  const currentTimeframe = timeframeOptions.find(o => o.value === timeframe);
  const allRegionOptions = [...countryOptions, ...regionOptions];
  const currentRegion = allRegionOptions.find(o => o.value === region);

  const renderDropdown = (
    id: string,
    _label: string,
    value: string | undefined,
    options: { value: string; label: string }[],
    onChange: (value: string) => void,
    showFlags: boolean = false
  ) => {
    const currentOption = id === 'region' 
      ? options.find(o => o.value === region)
      : id === 'brand' && selectedBrandId
      ? options.find(o => o.value === selectedBrandId)
      : options.find(o => value === o.label);
    return (
      <div className="relative min-w-[200px]">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--text-action)] hover:bg-[var(--bg-secondary)]"
          onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showFlags && currentOption && (
              <CountryFlag 
                countryCode={currentOption.value} 
                className="w-4 h-4 flex-shrink-0"
              />
            )}
            <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis text-left">
              {value}
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
              openDropdown === id ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openDropdown === id && (
          <div className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[300px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000] animate-slideDown">
            {id === 'region' ? (
              <>
                {/* Countries */}
                {countryOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-action)] ${
                      region === option.value
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-action)] font-medium'
                        : ''
                    }`}
                    onClick={() => {
                      onChange(option.value);
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
                <div className="flex items-center px-3 py-2 my-1">
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
                    className={`flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-action)] ${
                      region === option.value
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-action)] font-medium'
                        : ''
                    }`}
                    onClick={() => {
                      onChange(option.value);
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
              </>
            ) : (
              options.map((option) => {
                const isSelected = id === 'brand' && selectedBrandId
                  ? option.value === selectedBrandId
                  : value === option.label;
                return (
                  <button
                    key={option.value}
                    className={`flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-action)] ${
                      isSelected
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-action)] font-medium'
                        : ''
                    }`}
                    onClick={() => {
                      onChange(option.value);
                      setOpenDropdown(null);
                    }}
                  >
                    {showFlags && (
                      <CountryFlag 
                        countryCode={option.value} 
                        className="w-4 h-4 flex-shrink-0"
                      />
                    )}
                    <span>{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={dropdownRef}
      className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[var(--border-default)] bg-transparent relative z-10"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pl-2">
          {chartTypeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = chartType === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onChartTypeChange(option.value)}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--surface-accent)] text-white'
                    : 'bg-transparent text-[#6c7289] hover:text-[#212534]'
                }`}
                title={option.label}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        {onMetricTypeChange && (
          <div className="flex items-center gap-2 px-1">
            <div className="relative inline-flex items-center bg-[#f4f4f6] rounded-lg p-1 border border-[#e8e9ed] shadow-sm">
              <button
                onClick={() => onMetricTypeChange('visibility')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 whitespace-nowrap relative ${
                  metricType === 'visibility'
                    ? 'bg-white text-[#06b6d4] shadow-sm'
                    : 'text-[#6c7289] hover:text-[#212534] hover:bg-white/50'
                }`}
              >
                Visibility Score
              </button>
              <button
                onClick={() => onMetricTypeChange('share')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 whitespace-nowrap relative ${
                  metricType === 'share'
                    ? 'bg-white text-[#06b6d4] shadow-sm'
                    : 'text-[#6c7289] hover:text-[#212534] hover:bg-white/50'
                }`}
              >
                Share of Answers
              </button>
              <button
                onClick={() => onMetricTypeChange('sentiment')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 whitespace-nowrap relative ${
                  metricType === 'sentiment'
                    ? 'bg-white text-[#06b6d4] shadow-sm'
                    : 'text-[#6c7289] hover:text-[#212534] hover:bg-white/50'
                }`}
              >
                Sentiment Score
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 items-center">
        {brands.length > 1 && selectedBrandId && onBrandChange && 
          renderDropdown(
            'brand',
            'Brand',
            brands.find(b => b.id === selectedBrandId)?.name,
            brands.map(b => ({ value: b.id, label: b.name })),
            onBrandChange
          )
        }
        {renderDropdown(
          'timeframe',
          'Timeframe',
          currentTimeframe?.label,
          timeframeOptions,
          onTimeframeChange
        )}
        {renderDropdown(
          'region',
          'Region',
          currentRegion?.label,
          allRegionOptions,
          onRegionChange,
          true
        )}
      </div>
    </div>
  );
};
