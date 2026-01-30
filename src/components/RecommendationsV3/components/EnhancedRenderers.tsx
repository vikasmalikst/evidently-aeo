/**
 * Enhanced Content Renderers
 * 
 * Premium visual components for content sections.
 * Includes: MarkdownRenderer, TimelineViewer, AccordionFAQ, VideoScriptRenderer
 */

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconVideo,
  IconMicrophone,
  IconEye,
  IconCopy,
  IconCheck
} from '@tabler/icons-react';

// =============================================================================
// MARKDOWN RENDERER
// =============================================================================

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlightFillIns?: boolean;
}

export function MarkdownRenderer({ content, className = '', highlightFillIns = true }: MarkdownRendererProps) {
  // Pre-process content to highlight [FILL_IN] placeholders
  const processedContent = highlightFillIns
    ? content.replace(/\[FILL_IN[^\]]*\]/g, (match) => `<span class="fill-in-placeholder">${match}</span>`)
    : content;

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom heading styles
          h1: ({ children }) => <h1 className="text-[20px] font-bold text-[#1e293b] mb-3 mt-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[18px] font-semibold text-[#334155] mb-2 mt-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[16px] font-semibold text-[#475569] mb-2 mt-2">{children}</h3>,

          // Paragraph styling
          p: ({ children }) => <p className="text-[13px] text-[#374151] leading-relaxed mb-3">{children}</p>,

          // List styling
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-3 text-[13px] text-[#374151]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-3 text-[13px] text-[#374151]">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // Strong/Bold
          strong: ({ children }) => <strong className="font-semibold text-[#1e293b]">{children}</strong>,

          // Links
          a: ({ href, children }) => (
            <a href={href} className="text-[#0ea5e9] hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),

          // Code blocks
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return <code className="bg-[#f1f5f9] px-1 py-0.5 rounded text-[12px] text-[#be185d]">{children}</code>;
            }
            return (
              <pre className="bg-[#1e293b] text-[#e2e8f0] rounded-lg p-3 overflow-x-auto text-[12px] my-3">
                <code>{children}</code>
              </pre>
            );
          },

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#0ea5e9] pl-4 py-1 my-3 bg-[#f0f9ff] rounded-r-lg">
              {children}
            </blockquote>
          ),

          // Table styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-[#e2e8f0] shadow-sm">
              <table className="w-full text-[13px] border-collapse bg-white">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#f8fafc] border-b-2 border-[#e2e8f0]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-bold text-[#1e293b] border-r border-[#e2e8f0] last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-[#374151] border-b border-[#eff1f5] border-r border-[#eff1f5] last:border-r-0">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[#f8fafc] transition-colors">
              {children}
            </tr>
          ),

        }}
      >
        {processedContent}
      </ReactMarkdown>

      {/* CSS for FILL_IN highlighting */}
      <style>{`
        .fill-in-placeholder {
          background-color: #fef3c7;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// TIMELINE VIEWER (for Webinar Timestamps)
// =============================================================================

interface TimelineItem {
  timestamp: string;
  title: string;
  description?: string;
}

interface TimelineViewerProps {
  items: TimelineItem[];
  title?: string;
}

export function TimelineViewer({ items, title = 'Timeline' }: TimelineViewerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="timeline-viewer">
      {/* Timeline Header */}
      <div className="flex items-center gap-2 mb-4">
        <IconClock size={16} className="text-[#0ea5e9]" />
        <span className="text-[13px] font-semibold text-[#1e293b]">{title}</span>
      </div>

      {/* Visual Timeline Bar */}
      <div className="relative mb-6">
        <div className="h-1 bg-gradient-to-r from-[#0ea5e9] to-[#8b5cf6] rounded-full" />
        <div className="flex justify-between mt-1">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="relative flex flex-col items-center cursor-pointer group"
              onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
            >
              <div className={`w-3 h-3 rounded-full -mt-2 transition-all ${activeIndex === idx
                  ? 'bg-[#0ea5e9] ring-4 ring-[#0ea5e9]/20'
                  : 'bg-white border-2 border-[#0ea5e9] group-hover:bg-[#0ea5e9]'
                }`} />
              <span className="text-[10px] text-[#64748b] mt-1 font-mono">{item.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={false}
            animate={{
              backgroundColor: activeIndex === idx ? '#f0f9ff' : 'transparent',
              borderColor: activeIndex === idx ? '#0ea5e9' : '#e2e8f0'
            }}
            className="border rounded-lg p-3 cursor-pointer transition-colors"
            onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono bg-[#f1f5f9] px-2 py-0.5 rounded text-[#64748b]">
                {item.timestamp}
              </span>
              <span className="text-[13px] font-medium text-[#1e293b]">{item.title}</span>
            </div>
            <AnimatePresence>
              {activeIndex === idx && item.description && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-[12px] text-[#64748b] mt-2 pl-[60px]">{item.description}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ACCORDION FAQ
// =============================================================================

interface FAQItem {
  question: string;
  answer: string;
}

interface AccordionFAQProps {
  items: FAQItem[];
  title?: string;
}

export function AccordionFAQ({ items, title = 'Frequently Asked Questions' }: AccordionFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="accordion-faq">
      {title && (
        <h4 className="text-[14px] font-semibold text-[#1e293b] mb-3">{title}</h4>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="border border-[#e2e8f0] rounded-lg overflow-hidden"
          >
            {/* Question Header */}
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between p-3 bg-[#f8fafc] hover:bg-[#f1f5f9] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#fb923c] font-bold">?</span>
                <span className="text-[13px] font-medium text-[#1e293b]">{item.question}</span>
              </div>
              <motion.div
                animate={{ rotate: openIndex === idx ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <IconChevronDown size={16} className="text-[#64748b]" />
              </motion.div>
            </button>

            {/* Answer Content */}
            <AnimatePresence>
              {openIndex === idx && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 pt-0 border-l-4 border-[#10b981] ml-3 mb-3">
                    <p className="text-[13px] text-[#475569] leading-relaxed">{item.answer}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// VIDEO SCRIPT RENDERER (Scene-by-Scene Storyboard)
// =============================================================================

interface ScriptScene {
  id: string;
  title: string;
  content: string;
  sectionType?: string;
  timestamp?: string;
}

interface VideoScriptRendererProps {
  scenes: ScriptScene[];
  videoTitle: string;
  platform?: string;
}

export function VideoScriptRenderer({ scenes, videoTitle, platform = 'YouTube' }: VideoScriptRendererProps) {
  const [expandedScene, setExpandedScene] = useState<string | null>(scenes[0]?.id || null);
  const [copied, setCopied] = useState(false);

  const copyFullScript = async () => {
    const fullScript = scenes.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    await navigator.clipboard.writeText(fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSceneIcon = (sectionType?: string) => {
    switch (sectionType) {
      case 'intro': return '🎬';
      case 'context': return '👤';
      case 'script_segment': return '💡';
      case 'cta': return '📢';
      default: return '🎥';
    }
  };

  return (
    <div className="video-script-renderer">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#dc2626] to-[#991b1b] rounded-t-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconVideo size={24} />
            <div>
              <h3 className="text-[16px] font-bold">{videoTitle}</h3>
              <span className="text-[11px] opacity-80">Platform: {platform} • {scenes.length} Scenes</span>
            </div>
          </div>
          <button
            onClick={copyFullScript}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[12px] transition-colors"
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            {copied ? 'Copied!' : 'Copy Script'}
          </button>
        </div>
      </div>

      {/* Scenes */}
      <div className="border border-t-0 border-[#e2e8f0] rounded-b-lg divide-y divide-[#e2e8f0]">
        {scenes.map((scene, idx) => (
          <div key={scene.id} className="overflow-hidden">
            {/* Scene Header */}
            <button
              onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#f8fafc] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-[18px]">{getSceneIcon(scene.sectionType)}</span>
                <div>
                  <span className="text-[11px] text-[#64748b] font-mono">SCENE {idx + 1}</span>
                  <h4 className="text-[14px] font-semibold text-[#1e293b]">{scene.title}</h4>
                </div>
              </div>
              <motion.div
                animate={{ rotate: expandedScene === scene.id ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <IconChevronRight size={18} className="text-[#64748b]" />
              </motion.div>
            </button>

            {/* Scene Content */}
            <AnimatePresence>
              {expandedScene === scene.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4 bg-[#f8fafc] rounded-lg p-4">
                      {/* Visual Column */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <IconEye size={14} className="text-[#8b5cf6]" />
                          <span className="text-[11px] font-semibold text-[#8b5cf6] uppercase">Visual</span>
                        </div>
                        <div className="bg-[#1e293b] rounded-lg p-3 min-h-[80px] flex items-center justify-center">
                          <span className="text-[12px] text-[#94a3b8] italic">
                            [B-Roll / Camera Direction]
                          </span>
                        </div>
                      </div>

                      {/* Script Column */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <IconMicrophone size={14} className="text-[#0ea5e9]" />
                          <span className="text-[11px] font-semibold text-[#0ea5e9] uppercase">Script</span>
                        </div>
                        <div className="bg-white border border-[#e2e8f0] rounded-lg p-3">
                          <MarkdownRenderer content={scene.content} className="text-[12px]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 mt-3">
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] rounded-lg text-[11px] text-[#64748b] transition-colors">
          🎬 Export to Teleprompter
        </button>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] rounded-lg text-[11px] text-[#64748b] transition-colors">
          📊 SEO Tags
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// COPY BUTTON UTILITY
// =============================================================================

interface CopyButtonProps {
  content: string;
  label?: string;
  variant?: 'default' | 'small' | 'icon';
}

export function CopyButton({ content, label = 'Copy', variant = 'default' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCopy}
        className="p-1.5 text-[#64748b] hover:text-[#0ea5e9] hover:bg-[#f8fafc] rounded transition-colors"
      >
        {copied ? <IconCheck size={14} className="text-[#10b981]" /> : <IconCopy size={14} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#64748b] hover:text-[#0ea5e9] hover:bg-[#f8fafc] rounded transition-colors"
    >
      {copied ? <IconCheck size={12} className="text-[#10b981]" /> : <IconCopy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

export default {
  MarkdownRenderer,
  TimelineViewer,
  AccordionFAQ,
  VideoScriptRenderer,
  CopyButton,
};
