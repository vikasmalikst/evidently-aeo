import { useState } from 'react';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DomainData, URLData } from '../../data/mockCitationSourcesData';
import { URLModal } from './URLModal';

interface DomainsTableProps {
  domains: DomainData[];
  urls: URLData[];
}

type SortKey = 'domain' | 'usedPercentage' | 'avgCitations' | 'trend';

export const DomainsTable = ({ domains, urls }: DomainsTableProps) => {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('usedPercentage');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedDomains = [...domains].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case 'domain':
        aVal = a.domain;
        bVal = b.domain;
        break;
      case 'usedPercentage':
        aVal = a.usedPercentage;
        bVal = b.usedPercentage;
        break;
      case 'avgCitations':
        aVal = a.avgCitations;
        bVal = b.avgCitations;
        break;
      case 'trend':
        aVal = a.trend.percent;
        bVal = b.trend.percent;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ChevronUp size={14} className="opacity-30" />;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp size={14} />;
      case 'down':
        return <TrendingDown size={14} />;
      default:
        return <Minus size={14} />;
    }
  };

  const getUrlsForDomain = (domain: string) => {
    return urls.filter(url => url.domain === domain);
  };

  const handleTopicClick = (topic: string) => {
    navigate('/topics');
  };

  const handleFaviconsClick = (domain: string) => {
    setSelectedDomain(domain);
    setModalOpen(true);
  };

  return (
    <>
      <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('domain')}
              >
                <div className="flex items-center gap-2">
                  Domain
                  <SortIcon columnKey="domain" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Type
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('usedPercentage')}
              >
                <div className="flex items-center gap-2">
                  Used %
                  <SortIcon columnKey="usedPercentage" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('avgCitations')}
              >
                <div className="flex items-center gap-2">
                  Avg. Citations
                  <SortIcon columnKey="avgCitations" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                URLs
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Topics
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-default)]">
            {sortedDomains.map((domain, idx) => (
              <tr
                key={domain.id}
                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[var(--bg-secondary)]'} hover:bg-[var(--bg-tertiary)] transition-colors`}
              >
                <td className="px-6 py-4">
                  <a
                    href={`https://${domain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
                  >
                    {domain.domain}
                    <ExternalLink size={12} />
                  </a>
                </td>
                <td className="px-6 py-4">
                  <span
                    className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: domain.typeColor }}
                  >
                    {domain.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-body)]">
                      {domain.usedPercentage}%
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        domain.trend.direction === 'up'
                          ? 'text-[var(--text-success)]'
                          : domain.trend.direction === 'down'
                          ? 'text-[var(--text-error)]'
                          : 'text-[var(--text-caption)]'
                      }`}
                    >
                      {getTrendIcon(domain.trend.direction)}
                      {domain.trend.percent > 0 ? '+' : ''}
                      {domain.trend.percent}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-[var(--text-body)]">
                    {domain.avgCitations.toFixed(1)}x
                  </span>
                </td>
                <td className="px-6 py-4">
                  {getUrlsForDomain(domain.domain).length > 0 ? (
                    <button
                      onClick={() => handleFaviconsClick(domain.domain)}
                      className="flex items-center -space-x-2 hover:scale-105 transition-transform cursor-pointer"
                      title={`View ${getUrlsForDomain(domain.domain).length} URLs from ${domain.domain}`}
                    >
                      {getUrlsForDomain(domain.domain).slice(0, 5).map((url, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] border-2 border-white flex items-center justify-center text-xs font-semibold text-[var(--text-caption)] shadow-sm hover:z-10"
                          style={{
                            backgroundColor: `hsl(${idx * 60}, 70%, 85%)`
                          }}
                        >
                          {url.url.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {getUrlsForDomain(domain.domain).length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)] border-2 border-white flex items-center justify-center text-xs font-semibold text-white shadow-sm">
                          +{getUrlsForDomain(domain.domain).length - 5}
                        </div>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-caption)]">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleTopicClick(domain.topTopic)}
                    className="text-sm text-[var(--accent-primary)] hover:underline font-medium cursor-pointer"
                  >
                    {domain.topTopic}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {selectedDomain && (
      <URLModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        urls={getUrlsForDomain(selectedDomain)}
        domain={selectedDomain}
      />
    )}
    </>
  );
};
