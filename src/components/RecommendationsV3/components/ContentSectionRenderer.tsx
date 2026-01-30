/**
 * Content Section Renderer
 *
 * Specialized renderers for different content section types.
 * Supports the FSA Framework's "Container + Payload" model.
 */

import React, { useState } from 'react';
import { IconCopy, IconCheck, IconCode, IconCalculator, IconTable, IconFileText, IconVideo } from '@tabler/icons-react';
import { MarkdownRenderer, AccordionFAQ, TimelineViewer, VideoScriptRenderer } from './EnhancedRenderers';
import { LiveCompetitorData } from './LiveCompetitorData';
import { VisualTableEditor } from './VisualTableEditor';
import { IconEdit } from '@tabler/icons-react';

// TypeScript types matching backend definitions
export type ContentSectionType =
  | 'summary'
  | 'context'
  | 'strategies'
  | 'case_study'
  | 'faq'
  | 'cta'
  | 'custom'
  // Strategic Asset Types
  | 'comparison_table'
  | 'interactive_tool_spec'
  | 'whitepaper_metadata'
  | 'structured_list'
  | 'code_block'
  | 'schema_markup'
  // Video/Script Types
  | 'intro'
  | 'script_segment'
  | 'scene';

export interface ContentSection {
  id: string;
  title: string;
  content: string;
  sectionType: ContentSectionType;
}

interface ContentSectionRendererProps {
  section: ContentSection;
  isEditing?: boolean;
  editedContent?: string;
  onContentChange?: (content: string) => void;
  highlightFillIns?: (text: string) => string;
}

/**
 * Parse FAQ content into structured Q&A pairs
 */
function parseFAQContent(content: string): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = [];
  const lines = content.split('\n').filter(Boolean);

  let currentQuestion = '';
  let currentAnswer = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // Check if this is a question line
    if (trimmed.startsWith('?') || trimmed.toLowerCase().startsWith('q:') ||
      trimmed.toLowerCase().startsWith('question:') ||
      (trimmed.includes('?') && !trimmed.toLowerCase().startsWith('a:'))) {
      // Save previous Q&A pair if exists
      if (currentQuestion && currentAnswer) {
        items.push({ question: currentQuestion, answer: currentAnswer });
      }
      // Start new question
      currentQuestion = trimmed
        .replace(/^\?\s*/, '')
        .replace(/^q:\s*/i, '')
        .replace(/^question:\s*/i, '');
      currentAnswer = '';
    } else if (trimmed.toLowerCase().startsWith('a:') || trimmed.toLowerCase().startsWith('answer:')) {
      // This is an answer
      currentAnswer = trimmed
        .replace(/^a:\s*/i, '')
        .replace(/^answer:\s*/i, '');
    } else if (currentQuestion && !currentAnswer) {
      // Continuation of question
      currentQuestion += ' ' + trimmed;
    } else if (currentQuestion) {
      // Continuation of answer
      currentAnswer += ' ' + trimmed;
    }
  }

  // Don't forget the last pair
  if (currentQuestion) {
    items.push({ question: currentQuestion, answer: currentAnswer || 'No answer provided.' });
  }

  return items;
}

/**
 * Parse timeline/timestamp content (for webinar recaps)
 * Expects format like: "00:00 - Intro" or "10:00 - Gel-X overview"
 */
function parseTimelineContent(content: string): Array<{ timestamp: string; title: string; description?: string }> {
  const items: Array<{ timestamp: string; title: string; description?: string }> = [];
  const lines = content.split('\n').filter(Boolean);

  // Match patterns like "00:00 - Title" or "10:00 Title" or "0:00 - Title"
  const timestampRegex = /^(\d{1,2}:\d{2})\s*[-–—]?\s*(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(timestampRegex);
    if (match) {
      items.push({
        timestamp: match[1],
        title: match[2].trim()
      });
    }
  }

  return items;
}

/**
 * Returns the appropriate icon for a section type
 */
function getSectionIcon(sectionType: ContentSectionType): React.ReactNode {
  switch (sectionType) {
    case 'comparison_table':
      return <IconTable size={14} className="text-[#0ea5e9]" />;
    case 'interactive_tool_spec':
      return <IconCalculator size={14} className="text-[#8b5cf6]" />;
    case 'code_block':
    case 'schema_markup':
      return <IconCode size={14} className="text-[#10b981]" />;
    case 'whitepaper_metadata':
      return <IconFileText size={14} className="text-[#f59e0b]" />;
    default:
      return null;
  }
}

/**
 * Returns a badge color for the section type
 */
function getSectionBadgeStyle(sectionType: ContentSectionType): string {
  switch (sectionType) {
    case 'comparison_table':
      return 'bg-[#e0f2fe] text-[#0369a1]';
    case 'interactive_tool_spec':
      return 'bg-[#ede9fe] text-[#7c3aed]';
    case 'code_block':
    case 'schema_markup':
      return 'bg-[#d1fae5] text-[#047857]';
    case 'whitepaper_metadata':
      return 'bg-[#fef3c7] text-[#92400e]';
    case 'faq':
      return 'bg-[#fce7f3] text-[#be185d]';
    case 'cta':
      return 'bg-[#bbf7d0] text-[#166534]';
    default:
      return 'bg-[#e2e8f0] text-[#64748b]';
  }
}

/**
 * Copy button component with success feedback
 */
function CopyButton({ content, label = 'Copy' }: { content: string; label?: string }) {
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

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#64748b] hover:text-[#00bcdc] hover:bg-[#f8fafc] rounded transition-colors"
    >
      {copied ? <IconCheck size={12} className="text-[#10b981]" /> : <IconCopy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

/**
 * Comparison Table Renderer
 * Parses markdown tables or structured JSON and renders as styled HTML table
 */
function ComparisonTableRenderer({ content }: { content: string }) {
  // Try to parse as JSON first (for structured data)
  try {
    const tableData = JSON.parse(content);
    if (tableData.columnHeaders && tableData.rows) {
      return renderStructuredTable(tableData);
    }
  } catch {
    // Not JSON, treat as markdown table
  }

  // Parse markdown table
  const lines = content.trim().split('\n').filter(line => line.trim());
  const isMarkdownTable = lines.some(line => line.includes('|'));

  if (isMarkdownTable) {
    // Extract headers and rows
    const tableLines = lines.filter(line => line.includes('|'));
    if (tableLines.length < 2) {
      return <div className="text-[13px] text-[#1a1d29] whitespace-pre-wrap">{content}</div>;
    }

    // Parse header row (first row with |)
    const headerRow = tableLines[0];
    const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);

    // Skip separator row (---) and parse data rows
    const dataRows = tableLines
      .slice(1)
      .filter(line => !line.match(/^\|?\s*[-:]+\s*\|/)) // Skip separator rows
      .map(line => line.split('|').map(cell => cell.trim()).filter(Boolean));

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9]">
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    className={`px-4 py-3 text-left font-semibold text-[#1e293b] border-b border-[#e2e8f0] border-r border-[#e2e8f0] last:border-r-0 ${idx === 0 ? 'bg-[#f1f5f9]' : ''
                      }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`${rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'} hover:bg-[#f0f9ff] transition-colors`}
                >
                  {row.map((cell, cellIdx) => {
                    // Highlight FILL_IN placeholders
                    const isFillIn = cell.includes('[FILL_IN');
                    return (
                      <td
                        key={cellIdx}
                        className={`px-4 py-3 border-b border-[#e2e8f0] border-r border-[#e2e8f0] last:border-r-0 ${cellIdx === 0 ? 'font-medium text-[#334155]' : 'text-[#64748b]'
                          } ${isFillIn ? 'bg-[#fef3c7] text-[#92400e]' : ''}`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CopyButton content={content} label="Copy Markdown" />
      </div>
    );
  }

  // Fallback for non-table content
  return <div className="text-[13px] text-[#1a1d29] whitespace-pre-wrap">{content}</div>;
}

/**
 * Renders structured table data (from JSON) 
 */
function renderStructuredTable(tableData: { columnHeaders: string[]; rows: any[]; analysisNotes?: string }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9]">
              {tableData.columnHeaders.map((header: string, idx: number) => (
                <th key={idx} className="px-4 py-3 text-left font-semibold text-[#1e293b] border-b border-[#e2e8f0] border-r border-[#e2e8f0] last:border-r-0">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row: any, idx: number) => (
              <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'} hover:bg-[#f0f9ff] transition-colors`}>
                <td className="px-4 py-3 font-medium text-[#334155] border-b border-[#e2e8f0] border-r border-[#e2e8f0]">
                  {row.feature}
                </td>
                {row.values.map((val: string, vIdx: number) => {
                  const isFillIn = val.includes('[FILL_IN');
                  return (
                    <td key={vIdx} className={`px-4 py-3 border-b border-[#e2e8f0] border-r border-[#e2e8f0] last:border-r-0 ${isFillIn ? 'bg-[#fef3c7] text-[#92400e]' : 'text-[#64748b]'}`}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tableData.analysisNotes && (
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-3 text-[12px] text-[#166534]">
          <strong>Analysis:</strong> {tableData.analysisNotes}
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Tool Blueprint Renderer
 * Displays the tool spec with inputs, formula, outputs, and SEO schema
 */
function ToolBlueprintRenderer({ content }: { content: string }) {
  try {
    const blueprint = JSON.parse(content);
    const { toolName, toolDescription, inputs, formula, outputs, seoSchema, introductionText } = blueprint;

    return (
      <div className="space-y-4">
        {/* Tool Header */}
        <div className="bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] rounded-lg p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <IconCalculator size={18} />
            <h4 className="text-[16px] font-bold">{toolName || 'Interactive Tool'}</h4>
          </div>
          <p className="text-[12px] opacity-90">{toolDescription}</p>
        </div>

        {/* Introduction Text */}
        {introductionText && (
          <div className="bg-[#f8fafc] rounded-lg p-3 text-[13px] text-[#475569] italic border-l-4 border-[#8b5cf6]">
            {introductionText}
          </div>
        )}

        {/* Inputs */}
        {inputs && inputs.length > 0 && (
          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="bg-[#f1f5f9] px-3 py-2 text-[12px] font-semibold text-[#334155]">📥 Inputs</div>
            <div className="p-3 space-y-2">
              {inputs.map((input: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-[#e2e8f0]">
                  <span className="text-[13px] font-medium text-[#1a1d29]">{input.label}</span>
                  <span className="text-[11px] text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded">{input.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formula */}
        {formula && (
          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="bg-[#f1f5f9] px-3 py-2 text-[12px] font-semibold text-[#334155]">⚙️ Calculation Logic</div>
            <div className="p-3 bg-[#1e293b] text-[#e2e8f0] rounded-b-lg font-mono text-[12px] whitespace-pre-wrap">
              {formula}
            </div>
          </div>
        )}

        {/* Outputs */}
        {outputs && outputs.length > 0 && (
          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="bg-[#f1f5f9] px-3 py-2 text-[12px] font-semibold text-[#334155]">📤 Outputs</div>
            <div className="p-3 space-y-2">
              {outputs.map((output: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-[#e2e8f0]">
                  <span className="text-[13px] font-medium text-[#1a1d29]">{output.label}</span>
                  <span className="text-[11px] text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded">{output.format}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEO Schema */}
        {seoSchema && (
          <div className="border border-[#10b981] rounded-lg overflow-hidden">
            <div className="bg-[#d1fae5] px-3 py-2 text-[12px] font-semibold text-[#047857] flex items-center justify-between">
              <span>🔗 SEO Schema (JSON-LD)</span>
              <CopyButton content={JSON.stringify(seoSchema, null, 2)} label="Copy Schema" />
            </div>
            <pre className="p-3 bg-[#1e293b] text-[#10b981] rounded-b-lg font-mono text-[11px] overflow-x-auto">
              {JSON.stringify(seoSchema, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  } catch {
    return <div className="text-[13px] text-[#1a1d29] whitespace-pre-wrap">{content}</div>;
  }
}

/**
 * Code Block Renderer
 */
function CodeBlockRenderer({ content }: { content: string }) {
  return (
    <div className="relative">
      <pre className="bg-[#1e293b] text-[#e2e8f0] rounded-lg p-4 font-mono text-[12px] overflow-x-auto">
        {content}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton content={content} label="Copy" />
      </div>
    </div>
  );
}

/**
 * Schema Markup Renderer
 */
function SchemaMarkupRenderer({ content }: { content: string }) {
  let formattedJson = content;
  try {
    formattedJson = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#10b981] flex items-center gap-1">
          <IconCode size={12} /> JSON-LD Schema
        </span>
        <CopyButton content={formattedJson} label="Copy Schema" />
      </div>
      <pre className="bg-[#1e293b] text-[#10b981] rounded-lg p-4 font-mono text-[11px] overflow-x-auto">
        {formattedJson}
      </pre>
    </div>
  );
}

/**
 * Main Content Section Renderer
 */
export function ContentSectionRenderer({
  section,
  isEditing = false,
  editedContent,
  onContentChange,
  highlightFillIns = (text) => text,
}: ContentSectionRendererProps) {
  const content = editedContent ?? section.content;

  const [isVisualTableMode, setIsVisualTableMode] = useState(section.sectionType === 'comparison_table' || content.includes('|'));

  // Editing mode
  if (isEditing) {
    return (
      <div className="space-y-3 animate-in fade-in duration-200">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isVisualTableMode ? 'text-[#00bcdc]' : 'text-gray-400'}`}>
              {isVisualTableMode ? 'Grid Editor' : 'Markdown Editor'}
            </span>
          </div>
          <button
            onClick={() => setIsVisualTableMode(!isVisualTableMode)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e2e8f0] rounded-full text-[11px] font-semibold text-[#64748b] hover:text-[#00bcdc] hover:border-[#00bcdc] transition-all"
          >
            {isVisualTableMode ? <IconEdit size={12} /> : <IconTable size={12} />}
            {isVisualTableMode ? 'Switch to Raw Markdown' : 'Switch to Visual Grid'}
          </button>
        </div>

        {isVisualTableMode ? (
          <VisualTableEditor
            content={content}
            onContentChange={(newContent) => onContentChange?.(newContent)}
          />
        ) : (
          <textarea
            className="w-full min-h-[300px] p-4 bg-[#0b1220] border border-[#1e293b] rounded-xl text-[13px] text-[#e2e8f0] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#00bcdc] shadow-inner"
            value={content}
            onChange={(e) => onContentChange?.(e.target.value)}
            spellCheck={false}
          />
        )}

        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] text-[#94a3b8]">
            {isVisualTableMode ? 'Changes are automatically saved to the draft.' : 'Use standard Markdown syntax for tables and formatting.'}
          </p>
        </div>
      </div>
    );
  }

  // Render based on section type
  switch (section.sectionType) {
    case 'comparison_table':
      return (
        <div className="space-y-4">
          <ComparisonTableRenderer content={content} />
          {isEditing && (
            <LiveCompetitorData
              content={content}
              onApplyData={(replacements: Record<string, string>) => {
                let newContent = content;
                Object.entries(replacements).forEach(([placeholder, value]) => {
                  const cleanPlaceholder = placeholder.replace('[FILL_IN: ', '').replace(']', '').trim();
                  // Try to replace formatted placeholder first
                  newContent = newContent.split(placeholder).join(value);
                  // Fallback for simple FILL_IN
                  newContent = newContent.split(`[FILL_IN: ${cleanPlaceholder}]`).join(value);
                });
                onContentChange?.(newContent);
              }}
            />
          )}
        </div>
      );



    case 'interactive_tool_spec':
      return <ToolBlueprintRenderer content={content} />;

    case 'code_block':
      return <CodeBlockRenderer content={content} />;

    case 'schema_markup':
      return <SchemaMarkupRenderer content={content} />;

    case 'structured_list':
      // Parse timestamps and render as timeline (for webinar recaps)
      const timelineItems = parseTimelineContent(content);
      if (timelineItems.length > 0) {
        return <TimelineViewer items={timelineItems} title="Agenda & Timestamps" />;
      }
      // Fallback to markdown if no timeline data
      return <MarkdownRenderer content={content} />;

    case 'faq':
      // Parse FAQ content into Q&A pairs and use AccordionFAQ
      const faqItems = parseFAQContent(content);
      return <AccordionFAQ items={faqItems} title="" />;

    case 'cta':
      // CTA gets highlighted styling
      return (
        <div className="bg-gradient-to-r from-[#06c686] to-[#00bcdc] rounded-lg p-4 text-white">
          <p className="text-[14px] font-medium">{content}</p>
        </div>
      );

    default:
      // Default: Use MarkdownRenderer for proper formatting
      return (
        <div className="space-y-4">
          <MarkdownRenderer content={content} highlightFillIns={true} />
          {isEditing && content.includes('[FILL_IN:') && (
            <LiveCompetitorData
              content={content}
              onApplyData={(replacements: Record<string, string>) => {
                let newContent = content;
                Object.entries(replacements).forEach(([placeholder, value]) => {
                  const cleanPlaceholder = placeholder.replace('[FILL_IN: ', '').replace(']', '').trim();
                  newContent = newContent.split(placeholder).join(value);
                  newContent = newContent.split(`[FILL_IN: ${cleanPlaceholder}]`).join(value);
                });
                onContentChange?.(newContent);
              }}
            />
          )}
        </div>
      );
  }
}

/**
 * Section Header Badge (for enhanced section type display)
 */
export function SectionTypeBadge({ sectionType }: { sectionType: ContentSectionType }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize flex items-center gap-1 ${getSectionBadgeStyle(sectionType)}`}>
      {getSectionIcon(sectionType)}
      {sectionType.replace(/_/g, ' ')}
    </span>
  );
}

export default ContentSectionRenderer;
