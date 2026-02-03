/**
 * SEO Score Card & Export Suite
 * 
 * Premium features for content quality analysis and multi-format export.
 * Updates V2:
 * - Splits scoring into "Hygiene" (Frontend, 30pts) and "Scrapability" (Backend, 70pts).
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

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

export interface HygieneAnalysis {
  score: number; // Max 30
  metrics: SEOMetric[];
}

export interface ScrapabilityAnalysis {
  score: number; // Max 70
  metrics: SEOMetric[];
  loading: boolean;
  error?: string;
}

export interface CombinedAnalysis {
  totalScore: number;
  hygiene: HygieneAnalysis;
  scrapability: ScrapabilityAnalysis;
  citationProbability: 'high' | 'medium' | 'low';
}

// =============================================================================
// HYGIENE ANALYSIS (Frontend - 30pts)
// =============================================================================

export function analyzeHygiene(content: string, contentType: string = 'article'): HygieneAnalysis {
  const metrics: SEOMetric[] = [];
  let score = 0;
  
  const isVideo = contentType === 'short_video' || contentType === 'video' || contentType.includes('video');

  // 1. Word Count (Max 10)
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  // Video target: 130-180 words is optimal. Article: 300+
  const minWords = isVideo ? 120 : 300;
  const goodWords = isVideo ? 130 : 300;

  if (wordCount >= goodWords) {
    metrics.push({ name: 'Word Count', status: 'good', value: `${wordCount}`, score: 10, maxScore: 10 });
    score += 10;
  } else if (wordCount >= minWords) {
    metrics.push({ name: 'Word Count', status: 'warning', value: `${wordCount}`, suggestion: `Aim for ${goodWords}+`, score: 5, maxScore: 10 });
    score += 5;
  } else {
    metrics.push({ name: 'Word Count', status: 'error', value: `${wordCount}`, suggestion: 'Too short', score: 0, maxScore: 10 });
    score += 0;
  }

  // 2. Readability (Max 10)
  const sentences = content.split(/[.!?]+/).filter(Boolean).length;
  const avgWordsPerSentence = wordCount / Math.max(sentences, 1);
  if (avgWordsPerSentence <= 20) {
    metrics.push({ name: 'Readability', status: 'good', value: 'Grade 8-10', score: 10, maxScore: 10 });
    score += 10;
  } else if (avgWordsPerSentence <= 25) {
    metrics.push({ name: 'Readability', status: 'warning', value: 'Grade 11-12', suggestion: 'Simplify sentences', score: 5, maxScore: 10 });
    score += 5;
  } else {
    metrics.push({ name: 'Readability', status: 'error', value: 'Complex', suggestion: 'Sentences too long', score: 2, maxScore: 10 });
    score += 2;
  }

  // 3. Structure (Max 10)
  const hasHeaders = /#{1,3}\s/.test(content) || /<h[1-3]>/i.test(content) || /\*\*.+:\*\*/.test(content); // Bold labels valid for video
  const hasBullets = /^[-*•]/m.test(content) || /^\d+\./m.test(content);
  
  // For video, labels (Bold) + Bullets (Visuals) is the key structure
  if (hasHeaders || (isVideo && /\*\*.+\*\*/.test(content))) {
     if (hasBullets || (isVideo && content.split('\n\n').length >= 3)) {
        metrics.push({ name: 'Structure', status: 'good', value: 'Structured', score: 10, maxScore: 10 });
        score += 10;
     } else {
        metrics.push({ name: 'Structure', status: 'warning', value: 'Partial', suggestion: 'Add lists/breaks', score: 5, maxScore: 10 });
        score += 5;
     }
  } else if (hasBullets) {
     metrics.push({ name: 'Structure', status: 'warning', value: 'Partial', suggestion: 'Add headers', score: 5, maxScore: 10 });
     score += 5;
  } else {
    metrics.push({ name: 'Structure', status: 'error', value: 'Flat text', suggestion: 'Formatting needed', score: 2, maxScore: 10 });
    score += 2;
  }

  return { score, metrics };
}

/**
 * Legacy Export for backward compatibility with ContentAnalysisTools.
 * Returns a projected score based on Hygiene only (scaled to 100) or just the raw hygiene score.
 * Since users are used to a 100-pt scale, we'll project: 30pts hygiene -> 100pts.
 * This is just a placeholder until they open the full card.
 */
export function analyzeContent(content: string, brandName?: string, contentType?: string): { score: number; metrics: SEOMetric[] } {
  const hygiene = analyzeHygiene(content, contentType);
  // Scale score: (score / 30) * 100.
  const projectedScore = Math.min(100, Math.round((hygiene.score / 30) * 100));
  
  return { 
    score: projectedScore, 
    metrics: hygiene.metrics 
  };
}

// =============================================================================
// SEO SCORE CARD COMPONENT
// =============================================================================

interface SEOScoreCardProps {
  content: string;
  brandName?: string;
  contentType?: string; // Add contentType prop
  onRefresh?: () => void;
}

export function SEOScoreCard({ content, brandName, contentType, onRefresh }: SEOScoreCardProps) {
  // Client-side state
  const [hygiene, setHygiene] = useState<HygieneAnalysis>(analyzeHygiene(content, contentType));
  
  // Server-side state
  const [scrapability, setScrapability] = useState<ScrapabilityAnalysis>({
    score: 0,
    metrics: [],
    loading: false
  });

  // Debounce logic for API calls
  useEffect(() => {
    // Immediate update for hygiene
    setHygiene(analyzeHygiene(content, contentType));

    // Debounced update for scrapability
    const timer = setTimeout(async () => {
      // If content is empty or very short, don't bother asking backend
      if (!content || content.length < 50) return;
      
      setScrapability(prev => ({ ...prev, loading: true, error: undefined }));
      
      try {
        const response = await fetch(`${API_BASE_URL}/aeo/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, contentType }) // Pass content type
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
           const b = data.data.breakdown;
           const newMetrics: SEOMetric[] = [];

           // --- 1. Generic / Article Metrics ---
           if (b.primaryAnswer) newMetrics.push({ name: 'Primary Answer', ...b.primaryAnswer, value: b.primaryAnswer.status === 'good' ? 'Found' : 'Missing', suggestion: b.primaryAnswer.feedback });
           // chunkability removed - no longer relevant for v4.0 JSON content
           
           // --- 2. Expert Community Response Metrics ---
           if (b.questionRelevance) newMetrics.push({ name: 'Question Relevance', ...b.questionRelevance, value: b.questionRelevance.status === 'good' ? 'High' : 'Low', suggestion: b.questionRelevance.feedback });
           if (b.earlyAnswerSignal) newMetrics.push({ name: 'Early Answer', ...b.earlyAnswerSignal, value: b.earlyAnswerSignal.status === 'good' ? 'Direct' : 'Buried', suggestion: b.earlyAnswerSignal.feedback });
           if (b.experienceSignals) newMetrics.push({ name: 'Expertise Signals', ...b.experienceSignals, value: b.experienceSignals.status === 'good' ? 'Strong' : 'Weak', suggestion: b.experienceSignals.feedback });
           if (b.informationalDensity) newMetrics.push({ name: 'Info Density', ...b.informationalDensity, value: b.informationalDensity.status === 'good' ? 'High' : 'Low', suggestion: b.informationalDensity.feedback });
           if (b.toneTrust) newMetrics.push({ name: 'Trustable Tone', ...b.toneTrust, value: b.toneTrust.status === 'good' ? 'Neutral' : 'Bias', suggestion: b.toneTrust.feedback });
           if (b.contextualReasoning) newMetrics.push({ name: 'Contextual Reasoning', ...b.contextualReasoning, value: b.contextualReasoning.status === 'good' ? 'Deep' : 'Shallow', suggestion: b.contextualReasoning.feedback });
           if (b.semanticClarity) newMetrics.push({ name: 'Semantic Clarity', ...b.semanticClarity, value: b.semanticClarity.status === 'good' ? 'Clear' : 'Issues', suggestion: b.semanticClarity.feedback });
           if (b.followUpReadiness) newMetrics.push({ name: 'Follow-Up Ready', ...b.followUpReadiness, value: b.followUpReadiness.status === 'good' ? 'Yes' : 'No', suggestion: b.followUpReadiness.feedback });
           if (b.verifiability) newMetrics.push({ name: 'Verifiability', ...b.verifiability, value: b.verifiability.status === 'good' ? 'Linked' : 'None', suggestion: b.verifiability.feedback });

           // --- 3. Comparison Table Metrics ---
           if (b.comparisonIntent) newMetrics.push({ name: 'Comparison Intent', ...b.comparisonIntent, value: b.comparisonIntent.status === 'good' ? 'Clear' : 'Vague', suggestion: b.comparisonIntent.feedback });
           if (b.tableStructure) newMetrics.push({ name: 'Table Structure', ...b.tableStructure, value: b.tableStructure.status === 'good' ? 'Valid' : 'Broken', suggestion: b.tableStructure.feedback });
           if (b.attributeQuality) newMetrics.push({ name: 'Attribute Quality', ...b.attributeQuality, value: b.attributeQuality.status === 'good' ? 'High' : 'Low', suggestion: b.attributeQuality.feedback });
           if (b.neutralFactuality) newMetrics.push({ name: 'Neutral Factuality', ...b.neutralFactuality, value: b.neutralFactuality.status === 'good' ? 'Neutral' : 'Bias', suggestion: b.neutralFactuality.feedback });
           if (b.semanticConsistency) newMetrics.push({ name: 'Semantic Consistency', ...b.semanticConsistency, value: b.semanticConsistency.status === 'good' ? 'match' : 'mismatch', suggestion: b.semanticConsistency.feedback });
           if (b.contextualInterpretation) newMetrics.push({ name: 'Context Layer', ...b.contextualInterpretation, value: b.contextualInterpretation.status === 'good' ? 'Present' : 'Missing', suggestion: b.contextualInterpretation.feedback });
           if (b.edgeCaseCoverage) newMetrics.push({ name: 'Edge Case / Limits', ...b.edgeCaseCoverage, value: b.edgeCaseCoverage.status === 'good' ? 'Covered' : 'Missing', suggestion: b.edgeCaseCoverage.feedback });
           if (b.timeliness) newMetrics.push({ name: 'Timeliness', ...b.timeliness, value: b.timeliness.status === 'good' ? 'Fresh' : 'Unknown', suggestion: b.timeliness.feedback });
           if (b.llmReadiness) newMetrics.push({ name: 'LLM Readiness', ...b.llmReadiness, value: b.llmReadiness.status === 'good' ? 'Ready' : 'Hard', suggestion: b.llmReadiness.feedback });
           
           // --- 4. Shared / Other Metrics (Fallbacks) ---
           if (b.conceptClarity) newMetrics.push({ name: 'Concept Definitions', ...b.conceptClarity, value: b.conceptClarity.status === 'good' ? 'Clear' : 'Vague', suggestion: b.conceptClarity.feedback });
           if (b.explanationDepth) newMetrics.push({ name: 'Explanation Depth', ...b.explanationDepth, value: b.explanationDepth.status === 'good' ? 'Deep' : 'Shallow', suggestion: b.explanationDepth.feedback });
           if (b.comparison) newMetrics.push({ name: 'Comparisons', ...b.comparison, value: b.comparison.status === 'good' ? 'Present' : 'None', suggestion: b.comparison.feedback });
           if (b.authority) newMetrics.push({ name: 'Authority Signals', ...b.authority, value: b.authority.status === 'good' ? 'Strong' : 'Weak', suggestion: b.authority.feedback });
           if (b.antiMarketing) newMetrics.push({ name: 'Tone Check', ...b.antiMarketing, value: b.antiMarketing.status === 'good' ? 'Neutral' : 'Promo', suggestion: b.antiMarketing.feedback });

           setScrapability({
             score: data.data.totalScore,
             metrics: newMetrics,
             loading: false
           });
        }
      } catch (err) {
        console.error("AEO Score API Error:", err);
        setScrapability(prev => ({ ...prev, loading: false, error: 'Scoring failed' }));
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [content]);

  // Combined score
  // If scrapability is 0 (not loaded yet or failed), should we show just hygiene?
  // Let's assume scrapability starts at 0.
  // We should probably visually indicate "calculating" if score is low but loading is true.
  const totalScore = Math.min(100, Math.max(0, hygiene.score + scrapability.score));
  
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

      <div className="flex flex-col md:flex-row">
        {/* Hygiene Column */}
        <div className="flex-1 border-b md:border-b-0 md:border-r border-[#f1f5f9] p-4">
          <div className="flex items-center gap-2 mb-3">
             <IconLayout size={14} className="text-[#64748b]" />
             <h4 className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wide">Hygiene (30pts)</h4>
          </div>
          <div className="space-y-3">
            {hygiene.metrics.map((metric, idx) => (
               <MetricItem key={idx} metric={metric} />
            ))}
          </div>
        </div>

        {/* Scrapability Column */}
        <div className="flex-1 p-4 bg-[#fafcff]">
          <div className="flex items-center gap-2 mb-3">
             <IconServer size={14} className="text-[#64748b]" />
             <h4 className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wide">AI Scrapability (70pts)</h4>
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
