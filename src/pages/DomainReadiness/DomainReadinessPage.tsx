import { useEffect, useMemo, useState } from 'react';
import { useDomainReadiness } from './hooks/useDomainReadiness';
import { ScoreGauge } from './components/ScoreGauge';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { TestResultsList } from './components/TestResultsList';
import { BotAccessTable } from './components/BotAccessTable';
import { Button } from '../../components/Onboarding/common/Button';
import { Loader2 } from 'lucide-react';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { updateBrandWebsiteUrl } from '../../api/brandApi';

export const DomainReadinessPage = () => {
  const {
    brands,
    brandsLoading,
    brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    reloadBrands,
    audit,
    loading,
    error,
    progress,
    runAudit,
    brandDomain
  } = useDomainReadiness();

  const [brandUrlDraft, setBrandUrlDraft] = useState('');
  const [brandUrlSaving, setBrandUrlSaving] = useState(false);
  const [brandUrlError, setBrandUrlError] = useState<string | null>(null);

  useEffect(() => {
    setBrandUrlDraft(selectedBrand?.homepage_url || '');
    setBrandUrlError(null);
    setBrandUrlSaving(false);
  }, [selectedBrandId, selectedBrand?.homepage_url]);

  const normalizedBrandUrlDraft = useMemo(() => {
    const trimmed = brandUrlDraft.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }, [brandUrlDraft]);

  const brandUrlDirty =
    (selectedBrand?.homepage_url || '').trim() !== normalizedBrandUrlDraft.trim();

  const handleRunAudit = () => {
    runAudit();
  };

  const handleSaveBrandUrl = async () => {
    if (!selectedBrandId) return;

    setBrandUrlError(null);

    const nextUrl = normalizedBrandUrlDraft;
    if (!nextUrl) {
      setBrandUrlError('Brand URL is required');
      return;
    }

    try {
      new URL(nextUrl);
    } catch {
      setBrandUrlError('Invalid URL format');
      return;
    }

    setBrandUrlSaving(true);
    try {
      const response = await updateBrandWebsiteUrl(selectedBrandId, nextUrl);
      if (!response.success) {
        throw new Error(response.error || response.message || 'Failed to update brand URL');
      }
      reloadBrands();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update brand URL';
      setBrandUrlError(message);
    } finally {
      setBrandUrlSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3">
            {!!selectedBrand && (
              <SafeLogo
                src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                domain={selectedBrand.homepage_url || undefined}
                alt={selectedBrand.name}
                size={44}
                className="w-11 h-11 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900">Domain Readiness</h1>
          </div>
          <p className="text-gray-500 mt-1">
            Analyzing AEO readiness for{' '}
            <span className="font-semibold">
              {selectedBrand?.name || brandDomain || '—'}
            </span>
          </p>
          {brands.length > 1 && (
            <div className="flex items-center gap-2 mt-3">
              <label htmlFor="domain-readiness-brand-selector" className="text-[12px] font-medium text-[#64748b] uppercase tracking-wide">
                Brand
              </label>
              <select
                id="domain-readiness-brand-selector"
                value={selectedBrandId || ''}
                onChange={(event) => selectBrand(event.target.value)}
                className="text-[13px] border border-[#e8e9ed] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc] bg-white"
                disabled={brandsLoading || loading}
              >
                {brands.map((brandOption) => (
                  <option key={brandOption.id} value={brandOption.id}>
                    {brandOption.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!!selectedBrand && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <label
                htmlFor="domain-readiness-brand-url"
                className="text-[12px] font-medium text-[#64748b] uppercase tracking-wide"
              >
                Brand URL
              </label>
              <input
                id="domain-readiness-brand-url"
                value={brandUrlDraft}
                onChange={(event) => setBrandUrlDraft(event.target.value)}
                className="text-[13px] border border-[#e8e9ed] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc] bg-white w-[320px] max-w-full"
                placeholder="https://example.com"
                disabled={brandsLoading || loading || brandUrlSaving}
              />
              <Button
                onClick={handleSaveBrandUrl}
                isLoading={brandUrlSaving}
                disabled={!brandUrlDirty || brandsLoading || loading || brandUrlSaving || !selectedBrandId}
                variant="secondary"
                className="!px-3 !py-1.5 !text-sm"
              >
                Save
              </Button>
              {brandUrlError && (
                <div className="w-full text-sm text-red-600">
                  {brandUrlError}
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={handleRunAudit}
          isLoading={loading}
          disabled={loading || brandsLoading || !selectedBrandId}
        >
          {audit ? 'Re-run Audit' : 'Run Audit'}
        </Button>
      </div>

      {brandsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {brandsError}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {brandsLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500">Loading brands...</p>
        </div>
      )}

      {!brandsLoading && !selectedBrand && (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Brand</h3>
          <p className="text-gray-500 mb-6">Choose a brand to run a domain readiness audit.</p>
        </div>
      )}

      {loading && !audit && !!selectedBrand && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500">Running domain analysis... This may take up to a minute.</p>
        </div>
      )}

      {!brandsLoading && !!selectedBrand && !loading && !audit && !error && (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Audit Results Yet</h3>
          <p className="text-gray-500 mb-6">Run your first audit to see how well your domain is optimized for AI engines.</p>
          <Button onClick={handleRunAudit} disabled={!selectedBrandId}>
            Start Analysis
          </Button>
        </div>
      )}

      {audit && (
        <div className="space-y-8">
          {/* Top Section: Score & Breakdown */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
              <div className="flex-shrink-0">
                <ScoreGauge score={audit.overallScore} size={160} />
              </div>
              <div className="flex-1 w-full">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Readiness Breakdown</h3>
                <CategoryBreakdown audit={audit} loading={loading} progress={progress} />
                <div className="text-sm text-gray-500">
                  Last updated: {new Date(audit.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed Results</h2>
              <TestResultsList
                audit={audit}
                loading={loading}
                progress={{
                  active: progress.active,
                  buckets: {
                    technicalCrawlability: progress.buckets.technicalCrawlability,
                    contentQuality: progress.buckets.contentQuality,
                    semanticStructure: progress.buckets.semanticStructure,
                    accessibilityAndBrand: progress.buckets.accessibilityAndBrand
                  }
                }}
              />
            </div>
            <div>
              <BotAccessTable
                bots={audit.botAccessStatus}
                loading={loading}
                progress={{
                  active: progress.active,
                  completed: progress.buckets.botAccess.completed,
                  total: progress.buckets.botAccess.total
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainReadinessPage;
