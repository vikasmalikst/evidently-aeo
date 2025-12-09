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
      ? 'bg-red-50 text-red-700 border-red-200' 
      : 'bg-orange-50 text-orange-700 border-orange-200',
    Medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Low: type === 'priority'
      ? 'bg-gray-50 text-gray-600 border-gray-200'
      : 'bg-green-50 text-green-700 border-green-200'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[level]}`}>
      {level}
    </span>
  );
};

/**
 * Badge for focus area
 */
const FocusAreaBadge = ({ area }: { area: 'visibility' | 'soa' | 'sentiment' }) => {
  const config = {
    visibility: { label: 'Visibility', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    soa: { label: 'SOA', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    sentiment: { label: 'Sentiment', color: 'bg-teal-50 text-teal-700 border-teal-200' }
  };

  const { label, color } = config[area];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
};

/**
 * Confidence bar
 */
const ConfidenceBar = ({ value }: { value: number }) => {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-green-500';
    if (v >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(value)} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 font-medium">{value}%</span>
    </div>
  );
};

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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[32px] font-bold text-[#1a1d29] mb-2 flex items-center gap-3">
            <IconSparkles size={32} className="text-[#00bcdc]" />
            AI Recommendations
          </h1>
          <p className="text-[15px] text-[#64748b]">
            Generate AI-powered recommendations to improve your brand's visibility, share of answers, and sentiment in AI-generated content.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Brand Selector */}
            <div className="flex items-center gap-3">
              <label className="text-[12px] font-medium text-[#64748b] uppercase tracking-wide">
                Brand
              </label>
              <select
                value={selectedBrandId || ''}
                onChange={(e) => {
                  selectBrand(e.target.value);
                  setHasGenerated(false);
                  setRecommendations([]);
                  setProblemsDetected(0);
                }}
                className="text-[13px] border border-[#e8e9ed] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc] bg-white min-w-[200px]"
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedBrandId}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium transition-all
                ${isGenerating || !selectedBrandId
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-[#00bcdc] text-white hover:bg-[#0096b0] shadow-sm hover:shadow'
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

          {/* Generated timestamp and problems detected */}
          {generatedAt && (
            <div className="flex items-center gap-4 mt-3">
              <p className="text-[11px] text-[#94a3b8]">
                Last generated: {new Date(generatedAt).toLocaleString()}
                {selectedBrand && ` for ${selectedBrand.name}`}
              </p>
              {problemsDetected > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  {problemsDetected} data issue{problemsDetected !== 1 ? 's' : ''} analyzed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {!hasGenerated ? (
          // Initial state - prompt user to generate
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 text-center">
            <IconSparkles size={48} className="mx-auto mb-4 text-[#00bcdc] opacity-50" />
            <h3 className="text-[18px] font-semibold text-[#1a1d29] mb-2">
              Ready to Generate Recommendations
            </h3>
            <p className="text-[13px] text-[#64748b] max-w-md mx-auto">
              Click "Generate Recommendations" to analyze your brand's performance data and receive AI-powered suggestions for improving your visibility, share of answers, and sentiment.
            </p>
          </div>
        ) : recommendations.length === 0 ? (
          // No recommendations generated
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 text-center">
            <IconAlertCircle size={48} className="mx-auto mb-4 text-[#94a3b8]" />
            <h3 className="text-[18px] font-semibold text-[#1a1d29] mb-2">
              No Recommendations Generated
            </h3>
            <p className="text-[13px] text-[#64748b] max-w-md mx-auto">
              {problemsDetected === 0 
                ? 'No data issues were detected in your brand\'s performance metrics. Your visibility, SOA, and sentiment appear to be performing well.'
                : 'No recommendations generated at this time.'}
            </p>
          </div>
        ) : (
          // Recommendations table
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e8e9ed]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[220px]">Action (Topic-Specific)</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[240px]">Why This (Reason + Explanation)</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[240px]">Source & Metrics</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[220px]">Focus (Sources + Content)</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">KPI & Boost</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Effort & Timeline</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Confidence / Priority / Area</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec, index) => (
                    <tr 
                      key={index} 
                      className={`border-b border-[#e8e9ed] hover:bg-[#f8fafc] transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                      }`}
                    >
                      <td className="px-4 py-4 text-[12px] text-[#94a3b8] font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-[13px] text-[#1a1d29] font-medium leading-relaxed">
                          {rec.action}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-[12px] text-[#1a1d29] font-semibold leading-relaxed">
                          {rec.reason}
                        </p>
                        <p className="text-[12px] text-[#64748b] leading-relaxed mt-1">
                          {rec.explanation}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-[13px] text-[#1a1d29] font-semibold leading-relaxed">
                          {rec.citationSource}
                        </p>
                        <p className="text-[11px] text-[#64748b]">
                          Impact: {rec.impactScore} • Mentions: {rec.mentionRate} • Citations: {rec.citationCount}
                        </p>
                        <p className="text-[11px] text-[#64748b]">
                          SOA: {rec.soa} • Sentiment: {rec.sentiment} • Visibility: {rec.visibilityScore}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-[12px] text-[#1a1d29] leading-relaxed font-semibold">
                          Sources: {rec.focusSources}
                        </p>
                        <p className="text-[12px] text-[#64748b] leading-relaxed mt-1">
                          Content: {rec.contentFocus}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="block text-[12px] text-[#1a1d29] font-medium whitespace-nowrap">
                          {rec.kpi}
                        </span>
                        <span className="block text-[12px] text-[#06c686] font-semibold whitespace-nowrap">
                          {rec.expectedBoost}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <LevelBadge level={rec.effort} type="effort" />
                        <p className="text-[12px] text-[#64748b] whitespace-nowrap mt-1">
                          {rec.timeline}
                        </p>
                      </td>
                      <td className="px-4 py-4 space-y-1">
                        <ConfidenceBar value={rec.confidence} />
                        <LevelBadge level={rec.priority} type="priority" />
                        <FocusAreaBadge area={rec.focusArea} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-4 py-3 bg-[#f8fafc] border-t border-[#e8e9ed] flex items-center justify-between">
              <p className="text-[12px] text-[#64748b]">
                Showing {recommendations.length} data-driven recommendation{recommendations.length !== 1 ? 's' : ''}
                {problemsDetected > 0 && ` based on ${problemsDetected} detected issue${problemsDetected !== 1 ? 's' : ''}`}
              </p>
              <p className="text-[11px] text-[#94a3b8]">
                Powered by Cerebras AI (QWEN) • Data-driven analysis
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Recommendations;

