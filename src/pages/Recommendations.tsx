/**
 * Recommendations Page
 * 
 * Displays AI-generated recommendations for improving brand visibility, SOA, and sentiment.
 * Uses Cerebras/QWEN model to analyze brand data and generate actionable recommendations.
 * 
 * Features:
 * - Brand selector (for multi-brand customers)
 * - Generate recommendations button
 * - Table with columns for Action, Reason, Explanation, Source & Metrics, Focus Sources, Content Focus, KPI, Expected Boost, Effort, Timeline, Confidence, Priority, and Focus Area
 * - No fallbacks - shows "No recommendations generated at this time" if empty
 */

import { useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { useManualBrandDashboard } from '../manual-dashboard';
import { generateRecommendations, Recommendation } from '../api/recommendationsApi';
import { IconSparkles, IconRefresh, IconAlertCircle } from '@tabler/icons-react';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Badge component for effort/priority levels
 */
const LevelBadge = ({ 
  level, 
  type 
}: { 
  level: 'High' | 'Medium' | 'Low'; 
  type: 'effort' | 'priority' 
}) => {
  const colors = {
    High: type === 'priority' 
      ? 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]' 
      : 'bg-[#fed7aa] text-[#9a3412] border-[#fdba74]',
    Medium: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    Low: type === 'priority'
      ? 'bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]'
      : 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border ${colors[level]}`}>
      {level}
    </span>
  );
};

/**
 * Badge for focus area
 */
const FocusAreaBadge = ({ area }: { area: 'visibility' | 'soa' | 'sentiment' }) => {
  const config = {
    visibility: { label: 'Visibility', color: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]' },
    soa: { label: 'SOA', color: 'bg-[#e9d5ff] text-[#6b21a8] border-[#d8b4fe]' },
    sentiment: { label: 'Sentiment', color: 'bg-[#ccfbf1] text-[#134e4a] border-[#99f6e4]' }
  };

  const { label, color } = config[area];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border ${color}`}>
      {label}
    </span>
  );
};

/**
 * Confidence bar
 */
const ConfidenceBar = ({ value }: { value: number }) => {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-[#06c686]';
    if (v >= 60) return 'bg-[#00bcdc]';
    return 'bg-[#f59e0b]';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-[#e8e9ed] rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(value)} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[12px] text-[#64748b] font-medium">{value}%</span>
    </div>
  );
};

/**
 * Small stat pill for quick status context
 */
const StatPill = ({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper?: string;
}) => (
  <div className="flex flex-col gap-1 px-4 py-3 rounded-xl border border-[#e8e9ed] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
      {label}
    </span>
    <span className="text-[18px] font-semibold text-[#0f172a]">{value}</span>
    {helper && <span className="text-[12px] text-[#64748b]">{helper}</span>}
  </div>
);

/**
 * Card view for each recommendation (more scannable than a wide table)
 */
const RecommendationCard = ({ rec, index }: { rec: Recommendation; index: number }) => (
  <div className="rounded-xl border border-[#e8e9ed] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] overflow-hidden">
    <div className="px-5 py-4 flex flex-col gap-3 border-b border-[#e8e9ed] bg-gradient-to-br from-[#f8fafc] to-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-[#e8f7ff] text-[#0284c7] flex items-center justify-center font-semibold text-[13px] border border-[#cfe9fb]">
            {index + 1}
          </div>
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-[#0f172a] leading-snug">{rec.action}</p>
            <p className="text-[12px] text-[#64748b]">
              KPI: <span className="font-semibold text-[#0f172a]">{rec.kpi}</span> • Expected boost{' '}
              <span className="font-semibold text-[#06c686]">{rec.expectedBoost}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <FocusAreaBadge area={rec.focusArea} />
          <LevelBadge level={rec.priority} type="priority" />
          <LevelBadge level={rec.effort} type="effort" />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-[#0f172a]">Why this matters</p>
          <p className="text-[12px] text-[#1e293b] leading-relaxed">{rec.reason}</p>
          <p className="text-[12px] text-[#475569] leading-relaxed">{rec.explanation}</p>
        </div>
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-[#0f172a]">Source & metrics</p>
          <p className="text-[13px] text-[#0f172a] font-semibold">{rec.citationSource}</p>
          <p className="text-[11px] text-[#64748b]">
            Impact: {rec.impactScore} • Mentions: {rec.mentionRate} • Citations: {rec.citationCount}
          </p>
          <p className="text-[11px] text-[#64748b]">
            SOA: {rec.soa} • Sentiment: {rec.sentiment} • Visibility: {rec.visibilityScore}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-[#0f172a]">Where to focus</p>
          <p className="text-[12px] text-[#0f172a] font-semibold leading-relaxed">Sources: {rec.focusSources}</p>
          <p className="text-[12px] text-[#475569] leading-relaxed">Content: {rec.contentFocus}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <ConfidenceBar value={rec.confidence} />
            <span className="text-[12px] text-[#475569] whitespace-nowrap">{rec.timeline}</span>
          </div>
        </div>
      </div>
    </div>
    <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#e8e9ed] text-[12px] text-[#64748b] flex items-center justify-between flex-wrap gap-3">
      <span>
        Confidence-backed priority for <span className="text-[#0f172a] font-semibold">{rec.focusArea}</span> improvements
      </span>
      <span className="text-[11px] text-[#94a3b8]">
        Visibility • SOA • Sentiment coverage
      </span>
    </div>
  </div>
);

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const Recommendations = () => {
  // Brand selection hook
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand
  } = useManualBrandDashboard();

  // Local state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [problemsDetected, setProblemsDetected] = useState<number>(0);

  const totalRecommendations = recommendations.length;
  const lastGeneratedLabel = generatedAt ? new Date(generatedAt).toLocaleString() : 'Not generated yet';
  const hasGeneratedResults = hasGenerated && totalRecommendations > 0;

  /**
   * Handle generate recommendations button click
   */
  const handleGenerate = async () => {
    if (!selectedBrandId) {
      setError('Please select a brand first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateRecommendations({ brandId: selectedBrandId });

      if (response.success && response.data) {
        setRecommendations(response.data.recommendations || []);
        setGeneratedAt(response.data.generatedAt || new Date().toISOString());
        setProblemsDetected(response.data.problemsDetected || 0);
        setHasGenerated(true);
      } else {
        setRecommendations([]);
        setProblemsDetected(0);
        setHasGenerated(true);
      }
    } catch (err) {
      console.error('Error generating recommendations:', err);
      setError('Failed to generate recommendations. Please try again.');
      setRecommendations([]);
      setProblemsDetected(0);
      setHasGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state for brands
  if (brandsLoading) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full border-2 border-t-transparent border-[#00bcdc] animate-spin mb-4" />
            <p className="text-[14px] text-[#64748b]">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state for brands
  if (brandsError || brands.length === 0) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="max-w-xl mx-auto bg-white border border-[#fadddb] rounded-lg shadow-sm p-6 text-center">
            <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-2">Unable to load brands</h2>
            <p className="text-[13px] text-[#64748b]">
              {brandsError || 'No brands found. Please complete brand onboarding first.'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-[#e6f6fb] text-[#0ea5e9] flex items-center justify-center flex-shrink-0">
              <IconSparkles size={20} />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-[#0f172a] leading-tight mb-1">AI Recommendations</h1>
              <p className="text-[13px] text-[#64748b]">
                Data-backed, prioritized actions in a clear table layout.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-semibold text-[#0f172a]">Brand</label>
                <p className="text-[12px] text-[#64748b]">Pick the brand to generate a tailored plan.</p>
              </div>
              <select
                value={selectedBrandId || ''}
                onChange={(e) => {
                  selectBrand(e.target.value);
                  setHasGenerated(false);
                  setRecommendations([]);
                  setProblemsDetected(0);
                }}
                className="text-[13px] border border-[#e8e9ed] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc] bg-white min-w-[220px] shadow-inner"
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedBrandId}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold transition-all
                ${isGenerating || !selectedBrandId
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#0ea5e9] text-white hover:bg-[#0284c7] shadow-md hover:shadow-lg'
                }`}
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <IconRefresh size={18} />
                  Generate Recommendations
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[#f8fafc] text-[#0f172a] border border-[#e2e8f0]">
              Last generated: {lastGeneratedLabel}
              {selectedBrand && ` • ${selectedBrand.name}`}
            </span>
            {problemsDetected > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                {problemsDetected} data issue{problemsDetected !== 1 ? 's' : ''} analyzed
              </span>
            )}
            {hasGeneratedResults && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {totalRecommendations} ready-to-action item{totalRecommendations !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatPill label="Recommendations" value={`${totalRecommendations || '—'}`} helper={hasGenerated ? 'Ready to action' : 'Generate to populate'} />
          <StatPill label="Last run" value={hasGenerated ? lastGeneratedLabel : 'Not yet generated'} helper={selectedBrand ? `Brand: ${selectedBrand.name}` : 'Select a brand'} />
          <StatPill label="Data issues analyzed" value={`${problemsDetected || 0}`} helper={problemsDetected > 0 ? 'We factored these in' : 'No blockers detected'} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {!hasGenerated ? (
          <div className="bg-white border border-[#e8e9ed] rounded-2xl shadow-[0_14px_36px_rgba(15,23,42,0.08)] p-10 text-center">
            <IconSparkles size={48} className="mx-auto mb-4 text-[#0ea5e9] opacity-80" />
            <h3 className="text-[20px] font-semibold text-[#0f172a] mb-2">
              Ready to generate a tailored action plan
            </h3>
            <p className="text-[13px] text-[#475569] max-w-md mx-auto">
              Click "Generate Recommendations" to analyze your brand data and surface prioritized actions with rationale, metrics, and timelines.
            </p>
          </div>
        ) : !hasGeneratedResults ? (
          <div className="bg-white border border-[#e8e9ed] rounded-2xl shadow-[0_14px_36px_rgba(15,23,42,0.08)] p-10 text-center">
            <IconAlertCircle size={48} className="mx-auto mb-4 text-[#94a3b8]" />
            <h3 className="text-[20px] font-semibold text-[#0f172a] mb-2">
              No recommendations generated
            </h3>
            <p className="text-[13px] text-[#475569] max-w-md mx-auto">
              {problemsDetected === 0 
                ? 'No data issues were detected across visibility, SOA, or sentiment. Great job—try expanding the date range or monitoring for changes.'
                : 'We reviewed your data but did not produce new actions this run. Re-run after new data is collected or adjust the date range.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <colgroup>
                  <col className="w-12" />
                  <col className="min-w-[280px]" />
                  <col className="min-w-[200px]" />
                  <col className="min-w-[360px]" />
                  <col className="w-[180px]" />
                  <col className="w-[160px]" />
                  <col className="min-w-[140px]" />
                  <col className="min-w-[140px]" />
                  <col className="min-w-[160px]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#f8fafc] border-b-2 border-[#e2e8f0]">
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">#</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Action</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Reason</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Explanation</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Source & Metrics</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Focus</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">KPI / Boost</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Effort / Timeline</th>
                    <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Confidence / Priority / Area</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec, index) => (
                    <tr
                      key={index}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'} border-b border-[#e8e9ed] hover:bg-[#f1f5f9] transition-colors`}
                    >
                      <td className="px-5 py-4 align-top text-[13px] text-[#64748b] font-medium">
                        {index + 1}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#1a1d29] font-medium leading-relaxed break-words">{rec.action}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#1a1d29] font-medium leading-relaxed break-words">{rec.reason}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#1a1d29] font-medium leading-relaxed break-words">{rec.explanation}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#1a1d29] font-medium mb-1.5 break-words hyphens-auto">{rec.citationSource}</p>
                        <div className="space-y-0.5">
                          <p className="text-[12px] text-[#64748b] break-words">
                            Impact: <span className="font-medium text-[#1a1d29]">{rec.impactScore}</span> • Mentions: <span className="font-medium text-[#1a1d29]">{rec.mentionRate}</span> • Citations: <span className="font-medium text-[#1a1d29]">{rec.citationCount}</span>
                          </p>
                          <p className="text-[12px] text-[#64748b] break-words">
                            SOA: <span className="font-medium text-[#1a1d29]">{rec.soa}</span> • Sentiment: <span className="font-medium text-[#1a1d29]">{rec.sentiment}</span> • Visibility: <span className="font-medium text-[#1a1d29]">{rec.visibilityScore}</span>
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#1a1d29] font-medium mb-1.5">Sources:</p>
                        <p className="text-[13px] text-[#64748b] leading-relaxed mb-2.5 break-words hyphens-auto">{rec.focusSources}</p>
                        <p className="text-[13px] text-[#1a1d29] font-medium mb-1.5">Content:</p>
                        <p className="text-[13px] text-[#64748b] leading-relaxed break-words hyphens-auto">{rec.contentFocus}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-[13px] text-[#1a1d29] font-medium mb-1.5">{rec.kpi}</p>
                        <p className="text-[13px] text-[#06c686] font-semibold">{rec.expectedBoost}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="mb-2">
                          <LevelBadge level={rec.effort} type="effort" />
                        </div>
                        <p className="text-[13px] text-[#64748b]">{rec.timeline}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-2.5">
                          <ConfidenceBar value={rec.confidence} />
                          <div>
                            <LevelBadge level={rec.priority} type="priority" />
                          </div>
                          <div>
                            <FocusAreaBadge area={rec.focusArea} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between flex-wrap gap-3">
              <span className="text-[13px] text-[#64748b]">
                Showing {totalRecommendations} recommendation{totalRecommendations !== 1 ? 's' : ''}
                {problemsDetected > 0 && ` based on ${problemsDetected} detected issue${problemsDetected !== 1 ? 's' : ''}`}
              </span>
              <span className="text-[12px] text-[#94a3b8]">
                Powered by Cerebras AI (QWEN) • Data-backed analysis
              </span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Recommendations;

