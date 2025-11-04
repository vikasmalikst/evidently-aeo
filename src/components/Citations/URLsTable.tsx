import { useState } from 'react';
import { ChevronUp, ChevronDown, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { URLData } from '../../data/mockCitationSourcesData';

interface URLsTableProps {
  urls: URLData[];
  filterDomain?: string;
}

type SortKey = 'url' | 'usedTotal' | 'avgCitations';

export const URLsTable = ({ urls, filterDomain }: URLsTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('usedTotal');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredURLs = filterDomain
    ? urls.filter(url => url.domain === filterDomain)
    : urls;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedURLs = [...filteredURLs].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case 'url':
        aVal = a.url;
        bVal = b.url;
        break;
      case 'usedTotal':
        aVal = a.usedTotal;
        bVal = b.usedTotal;
        break;
      case 'avgCitations':
        aVal = a.avgCitations;
        bVal = b.avgCitations;
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
        return <TrendingUp size={14} className="text-[var(--text-success)]" />;
      case 'down':
        return <TrendingDown size={14} className="text-[var(--text-error)]" />;
      default:
        return <Minus size={14} className="text-[var(--text-caption)]" />;
    }
  };

  const truncateURL = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm overflow-hidden">
      {filterDomain && (
        <div className="px-6 py-3 bg-[var(--accent-light)] border-b border-[var(--border-default)]">
          <span className="text-sm text-[var(--text-body)]">
            Showing URLs from: <span className="font-semibold">{filterDomain}</span>
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('url')}
              >
                <div className="flex items-center gap-2">
                  URL
                  <SortIcon columnKey="url" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Your Brand?
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => handleSort('usedTotal')}
              >
                <div className="flex items-center gap-2">
                  Used
                  <SortIcon columnKey="usedTotal" />
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
                Brands Mentioned
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Topics
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">
                Your Competition
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-default)]">
            {sortedURLs.map((urlData, idx) => (
              <tr
                key={idx}
                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[var(--bg-secondary)]'} hover:bg-[var(--bg-tertiary)] transition-colors`}
              >
                <td className="px-6 py-4 max-w-md">
                  <a
                    href={`https://${urlData.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
                    title={urlData.url}
                  >
                    <span className="truncate">{truncateURL(urlData.url)}</span>
                    <ExternalLink size={12} className="flex-shrink-0" />
                  </a>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-xs text-[var(--text-caption)]">
                    {urlData.domain}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`text-xs font-semibold ${
                      urlData.brandMentioned === 'Yes'
                        ? 'text-[var(--text-success)]'
                        : urlData.brandMentioned === 'Partial'
                        ? 'text-[var(--text-warning)]'
                        : 'text-[var(--text-caption)]'
                    }`}
                  >
                    {urlData.brandMentioned}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-[var(--text-body)]">
                    {urlData.usedTotal}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-[var(--text-body)]">
                    {urlData.avgCitations.toFixed(1)}x
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {urlData.brandsMentioned.slice(0, 3).map((brand, bidx) => (
                      <span
                        key={bidx}
                        className="inline-block px-2 py-0.5 bg-[var(--bg-secondary)] text-xs text-[var(--text-body)] rounded"
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {urlData.topics.slice(0, 2).map((topic, tidx) => (
                      <span
                        key={tidx}
                        className="inline-block px-2 py-0.5 bg-[var(--accent-light)] text-xs text-[var(--accent-primary)] rounded"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getTrendIcon(urlData.trend.direction)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {urlData.competitorMentioned ? (
                    <span className="text-xs font-medium text-[var(--text-warning)]">
                      {urlData.competitorMentioned}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-caption)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
