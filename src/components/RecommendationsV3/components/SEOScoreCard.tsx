/**
 * SEO Score Card & Export Suite
 * 
 * Premium features for content quality analysis and multi-format export.
 * Updates V2:
 * - Splits scoring into "Hygiene" (Frontend, 20pts) and "Scrapability" (Backend, 80pts).
 * - Fetches backend score asynchronously.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconChartBar,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconCopy,
  IconFileText,
  IconCode,
  IconDownload,
  IconBrandLinkedin,
  IconBrandWordpress,
  IconRefresh,
  IconServer,
  IconLayout,
  IconLoader
} from '@tabler/icons-react';

import { apiClient } from '../../../lib/apiClient';

// Remove API_BASE_URL local def

// =============================================================================
// TYPES
// =============================================================================

export interface SEOMetric {
  name: string;
  status: 'good' | 'warning' | 'error';
  value: string;
  suggestion?: string;
  score?: number;
  maxScore?: number;
}

export interface ScrapabilityAnalysis {
  score: number; // Max 100
  metrics: SEOMetric[];
  loading: boolean;
  error?: string;
}

export interface LLMAnalysisResult {
    final_score: number;
    category: string;
    signal_breakdown: Record<string, string>;
    key_strengths: string[];
    key_weaknesses: string[];
    recommendations: string[];
}

// =============================================================================
// SEO SCORE CARD COMPONENT
// =============================================================================

interface SEOScoreCardProps {
  content: string;
  brandName?: string;
  contentType?: string;
  onRefresh?: () => void;
}

export function SEOScoreCard({ content, brandName, contentType, onRefresh }: SEOScoreCardProps) {
  // Server-side state
  const [scrapability, setScrapability] = useState<ScrapabilityAnalysis>({
    score: 0,
    metrics: [],
    loading: false
  });
  
  // LLM Analysis State
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysisResult | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const handleDeepAnalysis = async () => {
    if (!content) return;
    setLlmLoading(true);
    setLlmError(null);
    try {
        const response = await apiClient.post<{ success: boolean; data: LLMAnalysisResult }>('/aeo/score-llm', {
            content,
            contentType: contentType || 'article'
        });
        if (response.success && response.data) {
            setLlmAnalysis(response.data);
        }
    } catch (err: any) {
        console.error("LLM Analysis Error:", err);
        setLlmError(err.message || 'Analysis failed. Please try again.');
    } finally {
        setLlmLoading(false);
    }
  };

  // Debounce logic for API calls
  useEffect(() => {
    // Debounced update for scrapability
    const timer = setTimeout(async () => {
      // If content is empty or very short, don't bother asking backend
      if (!content || content.length < 50) return;
      
      setScrapability(prev => ({ ...prev, loading: true, error: undefined }));
      
      try {
        // Use apiClient for automatic Base URL and Auth injection
        const response = await apiClient.post<{ success: boolean; data: any }>('/aeo/score', { 
            content, 
            contentType 
        });
        
        if (response.success && response.data) {
           const b = response.data.breakdown;
           const newMetrics: SEOMetric[] = [];

           // --- V2 Metrics (Universal) ---
           if (b.chunkability) newMetrics.push({ name: 'Chunkability', ...b.chunkability, value: b.chunkability.status === 'good' ? 'Structured' : 'Flat', suggestion: b.chunkability.feedback });
           if (b.fleschReadability) newMetrics.push({ name: 'Readability (Flesch)', ...b.fleschReadability, value: b.fleschReadability.score + '/35', suggestion: b.fleschReadability.feedback });
           if (b.freshness) newMetrics.push({ name: 'Freshness', ...b.freshness, value: b.freshness.status === 'good' ? 'Fresh' : 'Older', suggestion: b.freshness.feedback });

           // --- Fallback for old metrics if they still exist (should be hidden now) ---
           // Keeping them commented out or removed as per user request to "get rid of previous AEO scores"
           
           setScrapability({
             score: response.data.totalScore,
             metrics: newMetrics,
             loading: false
           });
        }
      } catch (err: any) {
        console.error("AEO Score API Error:", err);
        setScrapability(prev => ({ 
            ...prev, 
            loading: false, 
            // improved error display
            error: err.message || 'Scoring failed' 
        }));
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [content]);

  // Combined score is just the backend score now
  const totalScore = Math.min(100, Math.max(0, scrapability.score));
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#10b981]';
    if (score >= 60) return 'text-[#f59e0b]';
    return 'text-[#ef4444]';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-[#10b981] to-[#06c686]';
    if (score >= 60) return 'from-[#f59e0b] to-[#fbbf24]';
    return 'from-[#ef4444] to-[#f87171]';
  };

  const getCitationBadge = (score: number) => {
    if (score >= 80) return { color: 'bg-[#d1fae5] text-[#047857]', label: '🎯 High Citation Probability' };
    if (score >= 60) return { color: 'bg-[#fef3c7] text-[#92400e]', label: '⚠️ Medium Citation Probability' };
    return { color: 'bg-[#fee2e2] text-[#991b1b]', label: '❌ Low Citation Probability' };
  };

  const citationBadge = getCitationBadge(totalScore);

  return (
    <div className="seo-score-card border border-[#e2e8f0] rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e293b] to-[#334155] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconChartBar size={18} className="text-[#0ea5e9]" />
          <span className="text-[13px] font-semibold text-white">AEO Content Score</span>
        </div>
        <div className="flex items-center gap-3">
           {scrapability.loading && (
             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
               <IconLoader size={14} className="text-[#94a3b8]" />
             </motion.div>
           )}
          <span className={`text-[24px] font-bold ${getScoreColor(totalScore)}`}>
            {totalScore}
          </span>
          <span className="text-[12px] text-[#94a3b8]">/100</span>
          {onRefresh && (
            <button onClick={onRefresh} className="p-1 hover:bg-white/10 rounded">
              <IconRefresh size={14} className="text-[#94a3b8]" />
            </button>
          )}
        </div>
      </div>

      {/* Score Bar */}
      <div className="px-4 py-2 bg-[#f8fafc] border-b border-[#f1f5f9]">
        <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${getScoreGradient(totalScore)} rounded-full`}
          />
        </div>
      </div>

      <div className="p-4 bg-[#fafcff]">
        <div className="flex items-center gap-2 mb-3">
           <IconServer size={14} className="text-[#64748b]" />
           <h4 className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wide">Score Breakdown</h4>
        </div>
        <div className="space-y-3">
          {scrapability.loading && scrapability.metrics.length === 0 ? (
             <div className="text-[12px] text-[#94a3b8] italic p-2">Analyzing content semantics...</div>
          ) : (
              scrapability.metrics.map((metric, idx) => (
                 <MetricItem key={idx} metric={metric} />
              ))
          )}
          {scrapability.error && <div className="text-[11px] text-red-400">{scrapability.error}</div>}
        </div>
      </div>

      {/* Deep Analysis Section */}
      <div className="p-4 border-t border-[#f1f5f9] bg-white">
        {!llmAnalysis && !llmLoading ? (
            <button 
                onClick={handleDeepAnalysis}
                className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-md text-[13px] font-medium shadow-sm flex items-center justify-center gap-2 transition-all"
            >
                <IconServer size={16} />
                <span>Run Deep AI Analysis</span>
            </button>
        ) : llmLoading ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"
                />
                <span className="text-[12px] text-[#64748b] animate-pulse">Analyzing 25+ signals with AI...</span>
            </div>
        ) : llmAnalysis ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center justify-between">
                     <h4 className="text-[13px] font-bold text-[#1e293b] flex items-center gap-2">
                        <IconTarget size={16} className="text-indigo-500" />
                        AI Quality Score
                     </h4>
                     <div className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                        llmAnalysis.final_score >= 4 ? 'bg-green-100 text-green-700' :
                        llmAnalysis.final_score >= 2 ? 'bg-blue-100 text-blue-700' :
                        llmAnalysis.final_score >= 0 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                     }`}>
                        {llmAnalysis.final_score > 0 ? '+' : ''}{llmAnalysis.final_score} / +5
                     </div>
                </div>
                
                <div className="text-[12px] text-[#64748b] font-medium border-l-2 border-indigo-200 pl-3 py-1">
                    {llmAnalysis.category}
                </div>

                {/* Recommendations */}
                {llmAnalysis.recommendations && llmAnalysis.recommendations.length > 0 && (
                    <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                        <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <IconChartBar size={12} /> Key Improvements
                        </div>
                        <ul className="space-y-1">
                            {llmAnalysis.recommendations.map((rec, i) => (
                                <li key={i} className="text-[12px] text-indigo-900 flex items-start gap-2">
                                    <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                 {/* Strengths & Weaknesses Grid */}
                 <div className="grid grid-cols-2 gap-3">
                    {llmAnalysis.key_strengths?.length > 0 && (
                        <div>
                            <span className="text-[11px] font-semibold text-green-700 mb-1 block">Strengths</span>
                            <div className="flex flex-wrap gap-1">
                                {llmAnalysis.key_strengths.map((str, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded border border-green-100">
                                        {str}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {llmAnalysis.key_weaknesses?.length > 0 && (
                        <div>
                             <span className="text-[11px] font-semibold text-red-700 mb-1 block">Weaknesses</span>
                             <div className="flex flex-wrap gap-1">
                                {llmAnalysis.key_weaknesses.map((wk, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] rounded border border-red-100">
                                        {wk}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>
            </div>
        ) : null}
        
        {llmError && (
            <div className="mt-3 p-2 bg-red-50 text-red-600 text-[11px] rounded border border-red-100 flex items-center justify-between">
                <span>{llmError}</span>
                <button onClick={() => setLlmError(null)} className="text-red-400 hover:text-red-700"><IconLayout size={12}/></button>
            </div>
        )}
      </div>

      {/* Citation Probability Footer */}
      <div className="px-4 py-3 bg-white border-t border-[#f1f5f9]">
        <div className={`${citationBadge.color} rounded-lg px-3 py-2 text-center text-[12px] font-medium`}>
          {citationBadge.label}
        </div>
      </div>
    </div>
  );
}

function MetricItem({ metric }: { metric: SEOMetric }) {
  return (
    <div className="flex items-start justify-between group">
      <div className="flex items-start gap-2 max-w-[65%]">
        <div className="mt-0.5">
          {metric.status === 'good' && <IconCheck size={14} className="text-[#10b981]" />}
          {metric.status === 'warning' && <IconAlertTriangle size={14} className="text-[#f59e0b]" />}
          {metric.status === 'error' && <IconX size={14} className="text-[#ef4444]" />}
        </div>
        <div>
           <span className="text-[12px] text-[#334155] font-medium block leading-tight">{metric.name}</span>
           {metric.suggestion && (
             <p className="text-[10px] text-[#94a3b8] leading-tight mt-0.5">{metric.suggestion}</p>
           )}
        </div>
      </div>
      <div className="text-right">
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
          metric.status === 'good' ? 'bg-[#d1fae5] text-[#047857]' :
          metric.status === 'warning' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#fee2e2] text-[#991b1b]'
        }`}>
          {metric.value}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// EXPORT MODAL COMPONENT
// =============================================================================

interface ExportOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  action: () => void;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  title: string;
  sections?: Array<{ title: string; content: string }>;
}

export function ExportModal({ isOpen, onClose, content, title, sections }: ExportModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Generate HTML version
  const generateHTML = () => {
    const sectionsHtml = sections?.map(s => 
      `<section>\n  <h2>${s.title}</h2>\n  <p>${s.content}</p>\n</section>`
    ).join('\n\n') || content;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { color: #1e293b; }
    h2 { color: #334155; margin-top: 2rem; }
    p { color: #475569; }
  </style>
</head>
<body>
  <article>
    <h1>${title}</h1>
    ${sectionsHtml}
  </article>
</body>
</html>`;
  };

  // Generate Markdown version
  const generateMarkdown = () => {
    const sectionsMarkdown = sections?.map(s => 
      `## ${s.title}\n\n${s.content}`
    ).join('\n\n---\n\n') || content;
    
    return `# ${title}\n\n${sectionsMarkdown}`;
  };

  const exportOptions: ExportOption[] = [
    {
      id: 'markdown',
      label: 'Copy as Markdown',
      icon: <IconFileText size={18} />,
      description: 'Ready for blogs, docs, or CMS',
      action: () => copyToClipboard(generateMarkdown(), 'markdown')
    },
    {
      id: 'html',
      label: 'Copy as HTML',
      icon: <IconCode size={18} />,
      description: 'Styled HTML with meta tags',
      action: () => copyToClipboard(generateHTML(), 'html')
    },
    {
      id: 'text',
      label: 'Copy Plain Text',
      icon: <IconCopy size={18} />,
      description: 'Just the content',
      action: () => copyToClipboard(content, 'text')
    }
  ];

  const futureOptions = [
    { label: 'Post to LinkedIn', icon: <IconBrandLinkedin size={18} />, coming: true },
    { label: 'Publish to WordPress', icon: <IconBrandWordpress size={18} />, coming: true },
    { label: 'Download as PDF', icon: <IconDownload size={18} />, coming: true }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#e2e8f0]">
            <h3 className="text-[16px] font-semibold text-[#1e293b]">Export Content</h3>
            <p className="text-[12px] text-[#64748b] mt-1">Choose a format to export "{title}"</p>
          </div>

          {/* Export Options */}
          <div className="p-4 space-y-2">
            {exportOptions.map(option => (
              <button
                key={option.id}
                onClick={option.action}
                className="w-full flex items-center gap-4 p-3 rounded-lg border border-[#e2e8f0] hover:border-[#0ea5e9] hover:bg-[#f0f9ff] transition-colors text-left"
              >
                <div className="text-[#0ea5e9]">{option.icon}</div>
                <div className="flex-1">
                  <span className="text-[13px] font-medium text-[#1e293b]">{option.label}</span>
                  <p className="text-[11px] text-[#64748b]">{option.description}</p>
                </div>
                {copied === option.id && (
                  <span className="text-[11px] text-[#10b981] font-medium">Copied!</span>
                )}
              </button>
            ))}
          </div>

          {/* Coming Soon */}
          <div className="px-4 pb-4">
            <p className="text-[10px] text-[#94a3b8] uppercase tracking-wide mb-2">Coming Soon</p>
            <div className="flex gap-2">
              {futureOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f1f5f9] rounded-lg text-[11px] text-[#94a3b8]"
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#e2e8f0] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-[#64748b] hover:text-[#1e293b] transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default { SEOScoreCard, ExportModal };
