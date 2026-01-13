import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Upload, Sparkles, Info, ArrowRight, FileText, Zap } from 'lucide-react';
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
    <motion.div 
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Premium Card Container */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
        
        {/* Header */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-200 mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            <FileText size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configure Topics & Prompts</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            How would you like to set up your tracking?
          </p>
        </motion.div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          
          {/* Option 1: AI Recommendations */}
          <motion.button
            onClick={() => onChoice('ai')}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="group relative flex flex-col items-center p-8 rounded-2xl border-2 border-gray-200 hover:border-cyan-400 hover:shadow-xl transition-all text-center bg-white"
          >
            {/* Recommended Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold rounded-full shadow-md">
              Recommended
            </div>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Sparkles size={32} className="text-cyan-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">AI Recommendations</h3>
            <p className="text-sm text-gray-500 mb-6">
              Let our AI analyze your brand and suggest the most relevant topics and prompts automatically.
            </p>
            <div className="mt-auto w-full">
              <div className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-cyan-200 group-hover:shadow-xl transition-shadow">
                Get Started <ArrowRight size={18} />
              </div>
            </div>
          </motion.button>

          {/* Option 2: Upload CSV */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="group relative flex flex-col items-center p-8 rounded-2xl border-2 border-gray-200 hover:border-emerald-400 hover:shadow-xl transition-all text-center bg-white"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Upload CSV</h3>
            <p className="text-sm text-gray-500 mb-6">
              Import your own list of topics and prompts using our CSV template.
            </p>
            
            <div className="mt-auto flex flex-col gap-3 w-full">
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-2 text-cyan-600 hover:text-cyan-700 text-sm font-medium transition-colors"
              >
                <Download size={16} />
                Download Sample Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
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
          </motion.div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Section */}
        <motion.div 
          className="mt-10 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-gradient-to-r from-gray-50 to-cyan-50/30 rounded-2xl p-6 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Zap size={20} className="text-cyan-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">Topics</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Key areas of interest for your brand (e.g., "Pricing", "Features").
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Info size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">Prompts</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Specific questions customers likely ask AI while searching for your brand.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
