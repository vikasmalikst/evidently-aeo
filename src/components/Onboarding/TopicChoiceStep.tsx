import React, { useRef, useState } from 'react';
import { IconDownload, IconUpload, IconSparkles, IconInfoCircle, IconChevronRight } from '@tabler/icons-react';
import type { ReviewRow } from './ReviewStep';

interface TopicChoiceStepProps {
  onChoice: (choice: 'ai' | 'csv', data?: ReviewRow[]) => void;
  onBack: () => void;
}

export const TopicChoiceStep: React.FC<TopicChoiceStepProps> = ({ onChoice, onBack }) => {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = ['topic', 'prompt', 'country', 'locale'];
    const sampleData = [
      ['Product Features', 'What are the main features of your product?', 'US', 'en-US'],
      ['Pricing', 'How much does your product cost?', 'US', 'en-US'],
      ['Competitor Comparison', 'How does your product compare to competitors?', 'US', 'en-US'],
    ];

    const escapeCsvCell = (value: string) => {
      const str = String(value ?? '');
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.map(escapeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'topic_prompts_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCsv = (csvText: string): string[][] => {
    const rowsOut: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      if (inQuotes) {
        if (char === '"') {
          const next = csvText[i + 1];
          if (next === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }
      if (char === '"') {
        inQuotes = true;
        continue;
      }
      if (char === ',') {
        row.push(field);
        field = '';
        continue;
      }
      if (char === '\n') {
        row.push(field);
        field = '';
        rowsOut.push(row);
        row = [];
        continue;
      }
      if (char === '\r') continue;
      field += char;
    }
    row.push(field);
    rowsOut.push(row);
    while (rowsOut.length > 0) {
      const last = rowsOut[rowsOut.length - 1];
      const isEmpty = last.every(cell => cell.trim() === '');
      if (!isEmpty) break;
      rowsOut.pop();
    }
    return rowsOut;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      const parsedRows = parseCsv(text);
      
      if (parsedRows.length < 2) {
        throw new Error('CSV file is empty or missing data rows');
      }

      const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_');
      const header = parsedRows[0].map(normalizeHeader);
      
      const indexOf = (candidates: string[]) => {
        for (const c of candidates) {
          const idx = header.indexOf(c);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxTopic = indexOf(['topic']);
      const idxPrompt = indexOf(['prompt', 'query', 'query_text']);
      const idxCountry = indexOf(['country', 'country_code']);
      const idxLocale = indexOf(['locale']);

      if (idxTopic === -1 || idxPrompt === -1) {
        throw new Error('CSV must contain "topic" and "prompt" columns');
      }

      const rows: ReviewRow[] = [];
      parsedRows.slice(1).forEach((row) => {
        const topicName = row[idxTopic]?.trim();
        const promptText = row[idxPrompt]?.trim();
        const country = (idxCountry >= 0 ? row[idxCountry]?.trim() : 'US') || 'US';
        const locale = (idxLocale >= 0 ? row[idxLocale]?.trim() : 'en-US') || 'en-US';

        if (topicName && promptText) {
          rows.push({
            topic: topicName,
            prompt: promptText,
            country,
            locale
          });
        }
      });

      if (rows.length === 0) {
        throw new Error('No valid topics or prompts found in CSV');
      }

      onChoice('csv', rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  };

  return (
    <div className="topic-choice-step h-full flex flex-col">
      <div className="onboarding-modal-body p-6 flex-1 flex flex-col justify-between">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-[var(--text-headings)] mb-2">
            How would you like to set up your Topics & Prompts?
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
          {/* Option 1: AI Recommendations */}
          <button
            onClick={() => onChoice('ai')}
            className="flex flex-col items-center p-5 rounded-xl border-2 border-[var(--border-default)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <IconSparkles size={24} className="text-[var(--accent-primary)]" />
            </div>
            <h4 className="text-lg font-bold text-[var(--text-headings)] mb-1">AI Recommendations</h4>
            <p className="text-xs text-[var(--text-caption)] mb-4">
              Let our AI analyze your brand and suggest the most relevant topics and prompts automatically.
            </p>
            <div className="mt-auto w-full">
              <div className="w-full py-2 rounded-lg bg-[var(--accent-primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
                Get Started <IconChevronRight size={14} />
              </div>
            </div>
          </button>

          {/* Option 2: Upload CSV */}
          <div className="flex flex-col items-center p-5 rounded-xl border-2 border-[var(--border-default)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all text-center group relative">
            <div className="w-12 h-12 rounded-full bg-[var(--success500)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <IconUpload size={24} className="text-[var(--success500)]" />
            </div>
            <h4 className="text-lg font-bold text-[var(--text-headings)] mb-1">Upload CSV</h4>
            <p className="text-xs text-[var(--text-caption)] mb-4">
              Import your own list of topics and prompts using our CSV template.
            </p>
            
            <div className="mt-auto flex flex-col gap-2 w-full">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-1 text-[var(--accent-primary)] hover:underline text-[10px] font-medium"
              >
                <IconDownload size={12} /> Download Sample Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 rounded-lg bg-[var(--accent-primary)] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Choose File
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-2 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs text-center">
            {error}
          </div>
        )}

        <div className="mt-8">
          <div className="flex flex-col gap-3 text-sm text-[var(--text-caption)] max-w-2xl mx-auto bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-default)]">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                <IconInfoCircle size={14} className="text-[var(--accent-primary)]" />
              </div>
              <div className="text-left">
                <p className="font-bold text-[var(--text-body)] text-xs mb-0.5">Topics</p>
                <p className="leading-tight text-[11px]">
                  Key areas of interest for your brand (e.g., "Pricing", "Features").
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-[var(--border-default)] pt-3">
              <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                <IconInfoCircle size={14} className="text-[var(--accent-primary)]" />
              </div>
              <div className="text-left">
                <p className="font-bold text-[var(--text-body)] text-xs mb-0.5">Prompts</p>
                <p className="leading-tight text-[11px]">
                  Specific questions potential customers likely ask LLMs while searching for your brand.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
