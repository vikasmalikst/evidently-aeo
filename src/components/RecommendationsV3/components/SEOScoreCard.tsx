/**
 * SEO Score Card & Export Suite
 * 
 * Premium features for content quality analysis and multi-format export.
 */

import React, { useState, useMemo } from 'react';
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
  IconRefresh
} from '@tabler/icons-react';

// =============================================================================
// SEO SCORE ANALYSIS
// =============================================================================

interface SEOMetric {
  name: string;
  status: 'good' | 'warning' | 'error';
  value: string;
  suggestion?: string;
}

interface SEOAnalysis {
  score: number;
  metrics: SEOMetric[];
  citationProbability: 'high' | 'medium' | 'low';
}

/**
 * Analyze content for SEO/AEO quality
 */
export function analyzeContent(content: string, brandName?: string): SEOAnalysis {
  const metrics: SEOMetric[] = [];
  let score = 0;

  // 1. Word Count
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 300) {
    metrics.push({ name: 'Word Count', status: 'good', value: `${wordCount} words` });
    score += 15;
  } else if (wordCount >= 150) {
    metrics.push({ name: 'Word Count', status: 'warning', value: `${wordCount} words`, suggestion: 'Aim for 300+ words for better depth' });
    score += 10;
  } else {
    metrics.push({ name: 'Word Count', status: 'error', value: `${wordCount} words`, suggestion: 'Content is too short' });
    score += 5;
  }

  // 2. Readability (simplified Flesch-Kincaid approximation)
  const sentences = content.split(/[.!?]+/).filter(Boolean).length;
  const avgWordsPerSentence = wordCount / Math.max(sentences, 1);
  if (avgWordsPerSentence <= 20) {
    metrics.push({ name: 'Readability', status: 'good', value: 'Grade 8-10 (Optimal)' });
    score += 20;
  } else if (avgWordsPerSentence <= 25) {
    metrics.push({ name: 'Readability', status: 'warning', value: 'Grade 11-12', suggestion: 'Shorten some sentences' });
    score += 12;
  } else {
    metrics.push({ name: 'Readability', status: 'error', value: 'Complex', suggestion: 'Sentences are too long for AI parsing' });
    score += 5;
  }

  // 3. Structure (Headers, Lists)
  const hasHeaders = /#{1,3}\s/.test(content) || /<h[1-3]>/i.test(content);
  const hasBullets = /^[-*•]/m.test(content) || /^\d+\./m.test(content);
  if (hasHeaders && hasBullets) {
    metrics.push({ name: 'Structure', status: 'good', value: 'Headers + Lists ✓' });
    score += 20;
  } else if (hasHeaders || hasBullets) {
    metrics.push({ name: 'Structure', status: 'warning', value: 'Partial', suggestion: 'Add headers and bullet points' });
    score += 12;
  } else {
    metrics.push({ name: 'Structure', status: 'error', value: 'Missing', suggestion: 'Add headers and lists for better parsing' });
    score += 5;
  }

  // 4. Brand Mentions (if brand provided)
  if (brandName) {
    const brandMentions = (content.match(new RegExp(brandName, 'gi')) || []).length;
    const density = (brandMentions / wordCount) * 100;
    if (brandMentions >= 3 && density <= 3) {
      metrics.push({ name: 'Brand Mentions', status: 'good', value: `${brandMentions} mentions (${density.toFixed(1)}%)` });
      score += 15;
    } else if (brandMentions >= 1) {
      metrics.push({ name: 'Brand Mentions', status: 'warning', value: `${brandMentions} mentions`, suggestion: 'Add 2-3 more brand references' });
      score += 8;
    } else {
      metrics.push({ name: 'Brand Mentions', status: 'error', value: '0 mentions', suggestion: 'Include brand name in content' });
      score += 0;
    }
  } else {
    score += 15; // Skip if no brand provided
  }

  // 5. Statistics/Data Points
  const hasNumbers = /\d+%|\d+x|\$\d+|\d+\s*(million|billion|thousand)/i.test(content);
  if (hasNumbers) {
    metrics.push({ name: 'Data Points', status: 'good', value: 'Statistics included ✓' });
    score += 15;
  } else {
    metrics.push({ name: 'Data Points', status: 'warning', value: 'None found', suggestion: 'Add statistics to boost authority' });
    score += 5;
  }

  // 6. Call to Action
  const hasCTA = /click|subscribe|learn more|get started|sign up|download|contact/i.test(content);
  if (hasCTA) {
    metrics.push({ name: 'Call to Action', status: 'good', value: 'CTA detected ✓' });
    score += 15;
  } else {
    metrics.push({ name: 'Call to Action', status: 'warning', value: 'Missing', suggestion: 'Add a clear call to action' });
    score += 5;
  }

  // Calculate citation probability
  let citationProbability: 'high' | 'medium' | 'low' = 'low';
  if (score >= 80) citationProbability = 'high';
  else if (score >= 60) citationProbability = 'medium';

  return { score: Math.min(score, 100), metrics, citationProbability };
}

// =============================================================================
// SEO SCORE CARD COMPONENT
// =============================================================================

interface SEOScoreCardProps {
  content: string;
  brandName?: string;
  onRefresh?: () => void;
}

export function SEOScoreCard({ content, brandName, onRefresh }: SEOScoreCardProps) {
  const analysis = useMemo(() => analyzeContent(content, brandName), [content, brandName]);

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

  const getCitationBadge = (prob: 'high' | 'medium' | 'low') => {
    switch (prob) {
      case 'high': return { color: 'bg-[#d1fae5] text-[#047857]', label: '🎯 High Citation Probability' };
      case 'medium': return { color: 'bg-[#fef3c7] text-[#92400e]', label: '⚠️ Medium Citation Probability' };
      case 'low': return { color: 'bg-[#fee2e2] text-[#991b1b]', label: '❌ Low Citation Probability' };
    }
  };

  const citationBadge = getCitationBadge(analysis.citationProbability);

  return (
    <div className="seo-score-card border border-[#e2e8f0] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e293b] to-[#334155] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconChartBar size={18} className="text-[#0ea5e9]" />
          <span className="text-[13px] font-semibold text-white">AEO Content Score</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[24px] font-bold ${getScoreColor(analysis.score)}`}>
            {analysis.score}
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
      <div className="px-4 py-2 bg-[#f8fafc]">
        <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analysis.score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${getScoreGradient(analysis.score)} rounded-full`}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-2">
        {analysis.metrics.map((metric, idx) => (
          <div key={idx} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              {metric.status === 'good' && <IconCheck size={14} className="text-[#10b981]" />}
              {metric.status === 'warning' && <IconAlertTriangle size={14} className="text-[#f59e0b]" />}
              {metric.status === 'error' && <IconX size={14} className="text-[#ef4444]" />}
              <span className="text-[12px] text-[#475569]">{metric.name}</span>
            </div>
            <div className="text-right">
              <span className={`text-[12px] font-medium ${
                metric.status === 'good' ? 'text-[#10b981]' :
                metric.status === 'warning' ? 'text-[#f59e0b]' : 'text-[#ef4444]'
              }`}>
                {metric.value}
              </span>
              {metric.suggestion && (
                <p className="text-[10px] text-[#94a3b8]">{metric.suggestion}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Citation Probability */}
      <div className="px-4 pb-4">
        <div className={`${citationBadge.color} rounded-lg px-3 py-2 text-center text-[12px] font-medium`}>
          {citationBadge.label}
        </div>
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
