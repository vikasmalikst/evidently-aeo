import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDomainReadiness } from './hooks/useDomainReadiness';
import { ActionItemsTable } from './components/ActionItemsTable';
import { MiddleSection } from './components/MiddleSection';
import { ScoreGauge } from './components/ScoreGauge';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { BotAccessTable } from './components/BotAccessTable';
import { Button } from '../../components/Onboarding/common/Button';
import { Loader2, RefreshCw } from 'lucide-react';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { updateBrandWebsiteUrl } from '../../api/brandApi';
import { Layout } from '../../components/Layout/Layout';
import { TrendCharts } from './components/TrendCharts';

export const DomainReadinessPage = () => {
  const navigate = useNavigate();
  const {
    brands,
    brandsLoading,
    brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    reloadBrands,
    audit,
    auditHistory,
    loading,
    error,
    progress,
    runAudit,
    brandDomain
  } = useDomainReadiness();

  // Local state for filtering categories
  const [selectedCategory, setSelectedCategory] = useState<string>('overall');

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
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6"> {/* Reduced space-y from default/implicit */}

        {/* Header Row: Title + Brand Selector + URL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4"> {/* Reduced mb */}
          <div>
            <div className="flex items-center gap-3">
              {!!selectedBrand && (
                <SafeLogo
                  src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                  domain={selectedBrand.homepage_url || undefined}
                  alt={selectedBrand.name}
                  size={40} // Slightly smaller
                  className="w-10 h-10 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Domain Readiness</h1>
                <p className="text-gray-500 text-xs">
                  Analyzing <span className="font-semibold">{selectedBrand?.name || brandDomain || '—'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {brands.length > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="domain-readiness-brand-selector" className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Brand
                </label>
                <select
                  id="domain-readiness-brand-selector"
                  value={selectedBrandId || ''}
                  onChange={(event) => selectBrand(event.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 bg-white"
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
              <div className="flex items-center gap-2">
                <label
                  htmlFor="domain-readiness-brand-url"
                  className="text-[11px] font-medium text-gray-500 uppercase tracking-wide"
                >
                  URL
                </label>
                <div className="relative">
                  <input
                    id="domain-readiness-brand-url"
                    value={brandUrlDraft}
                    onChange={(event) => setBrandUrlDraft(event.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-[240px] focus:outline-none focus:border-blue-500 bg-white pr-16"
                    placeholder="https://example.com"
                  />
                  {brandUrlDirty && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        variant="primary"
                        className="h-6 text-[10px] px-2 py-0"
                        onClick={handleSaveBrandUrl}
                        disabled={brandUrlSaving}
                      >
                        {brandUrlSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Refresh Button */}
            {!!selectedBrand && audit && !loading && (
              <Button
                variant="secondary"
                onClick={handleRunAudit}
                className="ml-2 py-1.5 h-[30px] text-xs flex items-center gap-2 border border-gray-200"
                disabled={loading}
              >
                <RefreshCw className="w-3 h-3" />
                Refresh Analysis
              </Button>
            )}
          </div>
        </div>

        {/* Error / Loading States */}
        {brandUrlError && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
            {brandUrlError}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Running Audit...</h3>
            <p className="text-gray-500 text-sm mb-6">Analyzing {brandDomain}...</p>
            {progress && progress.active && (
              <div className="w-full max-w-md space-y-2"> {/* Show total progress */}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Progress</span>
                  <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleRunAudit}>Retry Audit</Button>
          </div>
        )}

        {/* Empty State */}
        {!audit && !loading && !error && ( // Added !error to prevent showing empty state if there's an error
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Audit Results Yet</h3>
            <p className="text-gray-500 mb-6">Run your first audit to see how well your domain is optimized.</p>
            <Button onClick={handleRunAudit} disabled={!selectedBrandId}>
              Start Analysis
            </Button>
          </div>
        )}

        {/* MAIN DASHBOARD CONTENT */}
        {audit && !loading && (
          <div className="space-y-6"> {/* Reduced gap */}
            {/* --- TOP SECTION: Aggregate Results --- */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"> {/* Compact padding */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left: Score Gauge (Click to reset to Overall) */}
                <div className="lg:col-span-3 flex flex-col items-center justify-center border-r border-gray-100 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                  <div onClick={() => setSelectedCategory('overall')}>
                    <ScoreGauge score={audit.overallScore} size={140} />
                  </div>
                  <div className="text-center mt-2 w-full">
                    <span className="text-sm font-medium text-gray-500 block">Overall Score</span>
                    <span className="text-[10px] text-blue-500 font-medium cursor-pointer"
                      onClick={() => setSelectedCategory('overall')}
                      style={{ visibility: selectedCategory !== 'overall' ? 'visible' : 'hidden' }}>
                      Click to View All
                    </span>
                    <div className="flex flex-col gap-1 mt-3 w-full px-4">
                      <button
                        onClick={() => document.getElementById('action-plan')?.scrollIntoView({ behavior: 'smooth' })}
                        className="text-xs text-gray-400 hover:text-blue-600 font-medium transition-colors"
                      >
                        View Audit Details ↓
                      </button>
                      <button
                        onClick={() => navigate('/recommendations')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors border-t border-gray-100 pt-2 mt-1"
                      >
                        View AI Recommendations →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Category Breakdown Bars */}
                <div className="lg:col-span-9 pl-4">
                  <CategoryBreakdown
                    audit={audit}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                  <div className="mt-2 text-right text-[10px] text-gray-400">
                    Last updated: {new Date(audit.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>


            {/* --- MIDDLE SECTION: Activity & Details --- */}
            {/* Shows Charts (Left) and Details (Right) based on selection */}
            <MiddleSection
              audit={audit}
              history={auditHistory}
              selectedCategory={selectedCategory}
            />


            {/* --- BOTTOM SECTION: Actionable Insights --- */}
            <div className="space-y-4" id="action-plan">
              <h2 className="text-xl font-bold text-gray-800">Action Plan & Improvements</h2>
              <ActionItemsTable
                audit={audit}
                selectedCategory={selectedCategory}
              />
            </div>

          </div>
        )}

      </div>
    </Layout>
  );
};

export default DomainReadinessPage;
