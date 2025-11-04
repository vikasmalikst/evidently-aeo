import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LineChart, BarChart3 } from 'lucide-react';

interface ChartControlsProps {
  timeframe: string;
  onTimeframeChange: (value: string) => void;
  chartType: string;
  onChartTypeChange: (value: string) => void;
  region: string;
  onRegionChange: (value: string) => void;
  stacked?: boolean;
  onStackedChange?: (value: boolean) => void;
}

export const ChartControls = ({
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  region,
  onRegionChange,
  stacked = false,
  onStackedChange
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

  const regionOptions = [
    { value: 'us', label: '🇺🇸 United States' },
    { value: 'canada', label: '🇨🇦 Canada' },
    { value: 'latam', label: '🌎 LATAM' },
    { value: 'south-america', label: '🌎 South America' },
    { value: 'uk', label: '🇬🇧 United Kingdom' },
    { value: 'emea', label: '🌍 EMEA' },
    { value: 'india', label: '🇮🇳 India' },
    { value: 'south-korea', label: '🇰🇷 South Korea' },
    { value: 'china', label: '🇨🇳 China' },
    { value: 'japan', label: '🇯🇵 Japan' },
    { value: 'southeast-asia', label: '🌏 Southeast Asia' }
  ];

  const currentTimeframe = timeframeOptions.find(o => o.value === timeframe);
  const currentChartType = chartTypeOptions.find(o => o.value === chartType);
  const currentRegion = regionOptions.find(o => o.value === region);

  const renderDropdown = (
    id: string,
    label: string,
    value: string | undefined,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ) => (
    <div className="relative min-w-[200px]">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--text-action)] hover:bg-[var(--bg-secondary)]"
        onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
      >
        <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left">
          {value}
        </span>
        <ChevronDown
          size={16}
          className={`text-[var(--text-caption)] transition-transform duration-150 flex-shrink-0 ${
            openDropdown === id ? 'rotate-180' : ''
          }`}
        />
      </button>

      {openDropdown === id && (
        <div className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[300px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000] animate-slideDown">
          {options.map((option) => (
            <button
              key={option.value}
              className={`block w-full px-3 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-action)] ${
                value === option.label
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-action)] font-medium'
                  : ''
              }`}
              onClick={() => {
                onChange(option.value);
                setOpenDropdown(null);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={dropdownRef}
      className="flex gap-4 items-center justify-between flex-wrap p-4 bg-white border-b border-[var(--border-default)] rounded-b-lg relative z-10"
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

        {onStackedChange && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stacked}
              onChange={(e) => onStackedChange(e.target.checked)}
            />
            <span className="text-sm font-medium text-[#212534]">Stacked</span>
          </label>
        )}
      </div>

      <div className="flex gap-4 items-center">
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
          regionOptions,
          onRegionChange
        )}
      </div>
    </div>
  );
};
