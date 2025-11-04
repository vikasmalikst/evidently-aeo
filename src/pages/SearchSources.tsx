import { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout/Layout';
import { ChevronDown } from 'lucide-react';
import { InsightsAndGaps } from '../components/Prompts/InsightsAndGaps';
import { SourcesRacingChart } from '../components/Citations/SourcesRacingChart';
import { SourceTypeDonutChart } from '../components/Citations/SourceTypeDonutChart';
import { DomainsTable } from '../components/Citations/DomainsTable';
import { mockCitationSourcesData } from '../data/mockCitationSourcesData';

export const SearchSources = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(mockCitationSourcesData);
  const [timeframe, setTimeframe] = useState('weekly');
  const [region, setRegion] = useState('us');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

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
    { value: 'weekly', label: 'Last 7 days' },
    { value: 'monthly', label: 'Last 30 days' },
    { value: 'ytd', label: 'Year to Date' }
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
  const currentRegion = regionOptions.find(o => o.value === region);

  const renderDropdown = (
    id: string,
    value: string | undefined,
    options: { value: string; label: string }[],
    onChange: (value: string) => void
  ) => (
    <div className="relative min-w-[200px]">
      <button
        className="flex items-center gap-2 w-full px-4 py-2 border border-[var(--border-default)] rounded-lg bg-white cursor-pointer text-sm text-[var(--text-body)] transition-all duration-150 justify-between hover:border-[var(--accent-primary)] hover:bg-[var(--bg-secondary)]"
        onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
      >
        <span className="text-[var(--text-body)] whitespace-nowrap overflow-hidden text-ellipsis flex-1 text-left font-medium">
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
        <div className="absolute top-[calc(100%+4px)] right-0 min-w-full max-h-[300px] overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg z-[1000]">
          {options.map((option) => (
            <button
              key={option.value}
              className={`block w-full px-4 py-2 border-none bg-transparent cursor-pointer text-sm text-[var(--text-body)] text-left transition-all duration-150 hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-primary)] ${
                value === option.label
                  ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)] font-medium'
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

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-secondary)] rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-[var(--bg-secondary)] rounded w-1/2 mb-6"></div>
            <div className="h-96 bg-[var(--bg-secondary)] rounded-lg mb-6"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">Search Sources</h1>
            <p className="text-[var(--text-caption)]">
              Websites and URLs cited in AI-generated responses to your tracked queries
            </p>
          </div>
          <div ref={dropdownRef} className="flex items-center gap-3">
            {renderDropdown(
              'timeframe',
              currentTimeframe?.label,
              timeframeOptions,
              setTimeframe
            )}
            {renderDropdown(
              'region',
              currentRegion?.label,
              regionOptions,
              setRegion
            )}
          </div>
        </div>

        <InsightsAndGaps />

        <div className="mb-6">
          <SourcesRacingChart racingChartData={data.racingChartData} />
        </div>

        <div className="mb-6">
          <SourceTypeDonutChart distribution={data.sourceTypeDistribution} />
        </div>

        <div className="mb-6">
          <DomainsTable domains={data.domainsData} urls={data.urlsData} />
        </div>
      </div>
    </Layout>
  );
};
