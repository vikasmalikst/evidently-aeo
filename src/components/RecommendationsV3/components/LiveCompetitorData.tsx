/**
 * Live Competitor Data Mock
 * 
 * Conceptual demonstration of injecting real-time competitor data
 * into content placeholders.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconDatabaseImport,
  IconSearch,
  IconCheck,
  IconLoader,
  IconAlertTriangle,
  IconTable,
  IconRefresh
} from '@tabler/icons-react';

interface LiveDataPoint {
  field: string;
  value: string;
  source: string;
  confidence: number;
}

interface CompetitorMock {
  name: string;
  data: LiveDataPoint[];
}

interface LiveCompetitorDataProps {
  content: string;
  onApplyData: (newData: Record<string, string>) => void;
}

export function LiveCompetitorData({ content, onApplyData }: LiveCompetitorDataProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [foundData, setFoundData] = useState<CompetitorMock[] | null>(null);
  const [applied, setApplied] = useState(false);
  
  const [competitorInput, setCompetitorInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Parse placeholders from content
  const placeholders = (content.match(/\[FILL_IN:[^\]]+\]/g) || []).map(p => 
    p.replace('[FILL_IN:', '').replace(']', '').trim()
  );

  const hasPlaceholders = placeholders.length > 0;

  const handleScan = async () => {
    if (!competitorInput) {
      setShowInput(true);
      return;
    }

    setShowInput(false);
    setIsScanning(true);
    setFoundData(null);
    setApplied(false);

    try {
      const response = await fetch('http://localhost:3000/api/tools/scrape-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor: competitorInput,
          fields: placeholders
        })
      });

      const data = await response.json();

      if (data && data.data) {
        setFoundData([
          {
            name: data.competitor,
            data: data.data
          }
        ]);
      }
    } catch (e) {
      console.error(e);
      // Fallback in case of API failure for demo purposes
      setFoundData([
          {
            name: competitorInput,
            data: placeholders.map(ph => ({
                field: ph,
                value: 'Error/Mock',
                source: 'offline',
                confidence: 0
            }))
          }
        ]);
    } finally {
      setIsScanning(false);
    }
  };


  const handleApply = () => {
    setApplied(true);
    if (onApplyData && foundData) {
      // Create a map of substitutions
      const replacements: Record<string, string> = {};
      placeholders.forEach((ph, idx) => {
        const dataPoint = foundData[0].data[idx % foundData[0].data.length];
        replacements[`[FILL_IN: ${ph}]`] = `${dataPoint.value} (${dataPoint.source})`;
      });
      onApplyData(replacements);
    }
  };

  if (!hasPlaceholders) return null;

  return (
    <div className="live-competitor-data border border-[#e2e8f0] rounded-xl overflow-hidden mt-4 bg-white">
      {/* Header */}
      <div className="bg-[#f0f9ff] px-5 py-3 border-b border-[#e0f2fe] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#0ea5e9]/10 rounded-lg">
            <IconDatabaseImport size={18} className="text-[#0ea5e9]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#0c4a6e]">Live Data Injection</h3>
            <p className="text-[11px] text-[#0369a1]">
              {placeholders.length} placeholders detected
            </p>
          </div>
        </div>
        
        {!foundData && !isScanning && !showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0ea5e9] text-white rounded-lg text-[11px] font-semibold hover:bg-[#0284c7] transition-colors"
          >
            <IconSearch size={14} />
            Scan Web
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          
          {/* Input State */}
          {showInput && (
             <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 mb-4"
            >
              <input 
                type="text" 
                placeholder="Enter competitor name (e.g. Asana)" 
                className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#0ea5e9]"
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                autoFocus
              />
              <button
                onClick={handleScan}
                className="px-4 py-2 bg-[#0ea5e9] text-white rounded-lg text-[13px] font-semibold hover:bg-[#0284c7]"
              >
                Go
              </button>
            </motion.div>
          )}

          {/* State: Initial */}
          {!isScanning && !foundData && !showInput && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-4"
            >
              <div className="inline-block p-3 bg-[#f1f5f9] rounded-full mb-3">
                <IconTable size={24} className="text-[#64748b]" />
              </div>
              <p className="text-[13px] text-[#64748b] mb-1">
                Save research time. We can fill these placeholders for you.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {placeholders.slice(0, 3).map((ph, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[#fef3c7] border border-[#fcd34d] text-[#92400e] text-[10px] rounded font-mono">
                    {ph}
                  </span>
                ))}
                {placeholders.length > 3 && (
                  <span className="text-[10px] text-[#94a3b8] self-center">+{placeholders.length - 3} more</span>
                )}
              </div>
            </motion.div>
          )}

          {/* State: Scanning */}
          {isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <IconLoader size={32} className="text-[#0ea5e9]" />
              </motion.div>
              <p className="text-[13px] font-medium text-[#0f172a] mt-3">
                Scanning competitor pages for {competitorInput}...
              </p>
              <p className="text-[11px] text-[#64748b]">
                Checking DuckDuckGo and Pricing pages via Puppeteer
              </p>
            </motion.div>
          )}

          {/* State: Results found */}
          {foundData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <IconCheck size={16} className="text-[#10b981]" />
                <span className="text-[13px] font-semibold text-[#10b981]">
                  Found live data for {placeholders.length} items
                </span>
              </div>

              <div className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] overflow-hidden">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[#f1f5f9] text-[#64748b] font-medium border-b border-[#e2e8f0]">
                    <tr>
                      <th className="px-3 py-2">Placeholder</th>
                      <th className="px-3 py-2">Found Value</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {placeholders.map((ph, idx) => {
                      const item = foundData[0].data[idx % foundData[0].data.length];
                      return (
                        <tr key={idx} className="group hover:bg-white transition-colors">
                          <td className="px-3 py-2 font-mono text-[#64748b]">{ph}</td>
                          <td className="px-3 py-2 font-semibold text-[#0f172a]">{item.value}</td>
                          <td className="px-3 py-2 text-[#64748b] flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#10b981]" title="Verified"></span>
                            {item.source}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {applied ? (
                <div className="flex items-center justify-center gap-2 py-2 text-[#10b981] font-medium text-[13px] bg-[#ecfdf5] rounded-lg border border-[#a7f3d0]">
                  <IconCheck size={18} />
                  Data Injected Successfully
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleApply}
                    className="flex-1 py-2 bg-[#0ea5e9] text-white rounded-lg text-[13px] font-semibold hover:bg-[#0284c7] transition-colors shadow-sm"
                  >
                    Apply Data
                  </button>
                  <button
                    onClick={() => { setFoundData(null); setShowInput(false); }}
                    className="px-4 py-2 border border-[#e2e8f0] text-[#64748b] rounded-lg text-[13px] hover:bg-[#f8fafc] transition-colors"
                  >
                    Discard
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LiveCompetitorData;
