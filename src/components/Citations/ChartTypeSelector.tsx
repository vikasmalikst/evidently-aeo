import { Donut, BarChart3, LineChart, Download, TrendingUp } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ChartTypeSelectorProps {
  activeChart: 'donut' | 'racing' | 'bar' | 'line';
  onChartChange: (chart: 'donut' | 'racing' | 'bar' | 'line') => void;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  timeSeries?: string;
  onTimeSeriesChange?: (timeSeries: string) => void;
  onExport?: () => void;
}

export const ChartTypeSelector = ({ 
  activeChart, 
  onChartChange,
  categories = [],
  selectedCategory = 'all',
  onCategoryChange,
  timeSeries = 'weekly',
  onTimeSeriesChange,
  onExport
}: ChartTypeSelectorProps) => {
  const [timeSeriesOpen, setTimeSeriesOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTimeSeriesOpen(false);
        setCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const chartOptions = [
    { value: 'donut' as const, icon: Donut, label: 'Donut Chart' },
    { value: 'racing' as const, icon: TrendingUp, label: 'Racing Chart' },
    { value: 'bar' as const, icon: BarChart3, label: 'Bar Chart' },
    { value: 'line' as const, icon: LineChart, label: 'Line Chart' },
  ];

  const timeSeriesOptions = [
    { value: 'weekly', label: 'Weekly (Last 7 days)' },
    { value: 'monthly', label: 'Monthly (Last 30 days)' },
    { value: 'ytd', label: 'Year to Date' },
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat, label: cat })),
  ];

  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      {/* Icon Bar for Chart Types */}
      <div className="inline-flex rounded-lg border border-[var(--border-default)] p-1 bg-white shadow-sm gap-1">
        {chartOptions.map((option) => {
          const Icon = option.icon;
          const isActive = activeChart === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChartChange(option.value)}
              className={`p-2 rounded-full transition-all duration-200 relative ${
                isActive
                  ? 'bg-[var(--accent50)] text-[var(--accent-primary)]'
                  : 'text-[#6c7289] hover:text-[#212534] hover:bg-[var(--bg-secondary)]'
              }`}
              title={option.label}
              aria-label={option.label}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)]" />
              )}
              <Icon size={18} className="relative z-10" strokeWidth={isActive ? 2 : 1.5} />
            </button>
          );
        })}
      </div>

      {/* Right Side: Categories, Time Series, Export */}
      <div className="flex items-center gap-3" ref={dropdownRef}>
        {/* Categories Dropdown */}
        {onCategoryChange && (
          <div className="relative">
            <button
              onClick={() => {
                setCategoryOpen(!categoryOpen);
                setTimeSeriesOpen(false);
              }}
              className="px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-white text-[var(--text-headings)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2 min-w-[140px] justify-between"
            >
              <span>{categoryOptions.find(opt => opt.value === selectedCategory)?.label || 'All Categories'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {categoryOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-50 min-w-[140px]">
                {categoryOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onCategoryChange(option.value);
                      setCategoryOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      selectedCategory === option.value ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]' : 'text-[var(--text-body)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weekly Time Series Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setTimeSeriesOpen(!timeSeriesOpen);
              setCategoryOpen(false);
            }}
            className="px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-white text-[var(--text-headings)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2 min-w-[160px] justify-between"
          >
            <span>{timeSeriesOptions.find(opt => opt.value === timeSeries)?.label || 'Weekly (Last 7 days)'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {timeSeriesOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-50 min-w-[160px]">
              {timeSeriesOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onTimeSeriesChange?.(option.value);
                    setTimeSeriesOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    timeSeries === option.value ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]' : 'text-[var(--text-body)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Button - Quiet Style */}
        {onExport && (
          <button
            onClick={onExport}
            className="p-2 text-[#6c7289] hover:text-[#212534] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
            title="Export data"
            aria-label="Export data"
          >
            <Download size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
