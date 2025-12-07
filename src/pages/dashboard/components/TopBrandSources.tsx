import { Link } from 'react-router-dom';
import { ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
import type { DashboardPayload } from '../types';
import { UrlTooltip } from './UrlTooltip';
import { InfoTooltip } from './InfoTooltip';

interface TopBrandSourcesProps {
  brandPages: DashboardPayload['topBrandSources'];
}

export const TopBrandSources = ({ brandPages }: TopBrandSourcesProps) => {
  const displayedPages = brandPages.slice(0, 10);

  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-[#1a1d29]">
            Top Brand Sources
          </h2>
          <InfoTooltip description="Lists the web pages and sources where your brand is most frequently cited in AI-generated answers. Impact Score reflects how prominently your brand appears, helping you identify high-value content partnerships and citation opportunities." />
        </div>
        <Link
          to="/search-sources"
          className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
        >
          View All
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="space-y-3">
        {displayedPages.length > 0 ? (
          displayedPages.map((page) => {
            const hasImpactScore =
              typeof page.impactScore === 'number' && Number.isFinite(page.impactScore);
            const impactLabel = hasImpactScore
              ? page.impactScore!.toFixed(1)
              : '—';
            const hasChange =
              typeof page.change === 'number' && Number.isFinite(page.change);
            const changeValue = hasChange ? page.change! : 0;
            const changeLabel = hasChange ? Math.abs(changeValue).toFixed(1) : '—';
            const changeClass = hasChange
              ? changeValue > 0
                ? 'text-[#06c686]'
                : changeValue < 0
                ? 'text-[#f94343]'
                : 'text-[#64748b]'
              : 'text-[#64748b]';
            const rawUrl =
              (typeof page.url === 'string' && page.url.trim().length > 0
                ? page.url.trim()
                : typeof page.domain === 'string'
                ? `https://${page.domain}`
                : '') || '';
            const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
            const displayUrl = rawUrl.replace(/^https?:\/\//, '') || '—';
            const title =
              (typeof page.title === 'string' && page.title.trim().length > 0
                ? page.title.trim()
                : page.domain) || 'Unknown Source';
            const domain = page.domain || displayUrl.split('/')[0] || '—';

            return (
              <div
                key={page.id}
                className="group flex items-center justify-between p-4 bg-white border border-[#e8e9ed] rounded-lg hover:border-[#00bcdc] hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[14px] font-semibold text-[#1a1d29] truncate">
                      {title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#64748b] font-medium">
                      {domain}
                    </span>
                    <UrlTooltip url={displayUrl} fullUrl={fullUrl} urls={page.urls} />
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-center min-w-[80px]">
                    <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1">
                      Impact
                    </div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-[16px] font-bold text-[#1a1d29]">
                        {impactLabel}
                      </span>
                      {hasImpactScore && (
                        <span className="text-[11px] text-[#64748b]">/10</span>
                      )}
                    </div>
                  </div>
                  <div className="text-center min-w-[70px]">
                    <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1">
                      Change
                    </div>
                    <div className={`inline-flex items-center gap-1 text-[14px] font-semibold ${changeClass}`}>
                      {hasChange ? (
                        <>
                          {changeValue > 0 && <ChevronUp size={14} />}
                          {changeValue < 0 && <ChevronDown size={14} />}
                          {changeValue === 0 ? '0.0' : changeLabel}
                        </>
                      ) : (
                        <span className="text-[#64748b]">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-[13px] text-[#64748b] border border-dashed border-[#e8e9ed] rounded-lg">
            No branded sources detected for this period.
          </div>
        )}
      </div>
    </div>
  );
};

