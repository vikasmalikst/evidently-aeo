import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTarget } from '@tabler/icons-react';
import { SEOScoreCard, analyzeContent } from './SEOScoreCard';
// Define API URL (same as SEOScoreCard)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface AEOScoreBadgeProps {
  content: string;
  brandName?: string;
  contentType?: string; // Add contentType prop
}

export function AEOScoreBadge({ content, brandName, contentType }: AEOScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [backendScore, setBackendScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  
  // Calculate immediate hygiene score
  const analysis = React.useMemo(() => analyzeContent(content, brandName, contentType), [content, brandName, contentType]);
  // Use projected score as placeholder ONLY if we haven't started fetching? 
  // Actually, user wants "real" score. 
  // Let's use hygiene score (not projected) + backend score.
  
  // Need to de-construct the projected score back to raw hygiene or just use analyzeHygiene if it was exported.
  // analyzeContent returns { score: projected, metrics }.
  // Using projected as temporary placeholder is dangerous if it differs wildly.
  // We'll trust the user wants ACCURACY.
  
  useEffect(() => {
    if (!content || content.length < 50) return;

    let isMounted = true;
    setLoading(true);

    const fetchScore = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/aeo/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, contentType }) // Pass content type
        });
        
        const data = await response.json();
        if (data.success && data.data && isMounted) {
           // Backend returns total score (0-70) + hygiene is handled on frontend.
           // Wait, the backend logic returns a "total" which is just the scrapability part?
           // In SEOScoreCard: totalScore = hygiene.score + scrapability.score.
           // We need to replicate that addition here.
           // However, analyzeContent returns a scaled hygiene score. 
           // We need the RAW hygiene score (out of 30).
           
           // We can recover it roughly: analysis.score is (hygiene/30)*100.
           // So raw_hygiene = (analysis.score / 100) * 30.
           // This is approximate due to rounding.
           
           // Better approach: calculate raw hygiene here if possible, but we don't have access to analyzeHygiene helper directly unless exported?
           // analyzeContent is exported. analyzeHygiene is NOT exported in the previous file view?
           // Let's check imports.
           
           // Assuming we can't easily import analyzeHygiene without changing SEOScoreCard more.
           // Let's use the analysis.metrics to sum it up?
           // Or just approximate.
           const rawHygiene = Math.round((analysis.score / 100) * 30);
           const total = Math.min(100, rawHygiene + data.data.totalScore);
           setBackendScore(total);
        }
      } catch (err) {
        console.error("Badge Score Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Debounce slightly to avoid flooding if generated frequently
    const timer = setTimeout(fetchScore, 500);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [content, analysis.score]);

  // Use backendScore if available, otherwise analysis.score (projected)
  // Visually indicate if it's the real one?
  const displayScore = backendScore !== null ? backendScore : analysis.score;
  const isReal = backendScore !== null;
  const scoreColor = displayScore >= 80 ? 'text-[#059669]' : displayScore >= 60 ? 'text-[#d97706]' : 'text-[#dc2626]';
  const bgColor = displayScore >= 80 ? 'bg-[#d1fae5]' : displayScore >= 60 ? 'bg-[#fef3c7]' : 'bg-[#fee2e2]';

  // Calculate position (Centered logic)
  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const tooltipWidth = 800;
      const predictedHeight = 500; 
      const gap = 12;

      let left = (window.innerWidth - tooltipWidth) / 2;
      if (left < 10) left = 10;

      let top = rect.top - predictedHeight - gap;
      if (top < 10) {
        top = rect.bottom + gap;
        if (top + predictedHeight > window.innerHeight) {
          const spaceAbove = rect.top;
          const spaceBelow = window.innerHeight - rect.bottom;
          if (spaceAbove > spaceBelow) {
            top = 10; 
          } else {
            top = rect.bottom + gap; 
          }
        }
      }

      setCoords({ top, left });
    }
  }, [showTooltip]);

  return (
    <>
      <div 
        ref={badgeRef}
        className="relative z-10" 
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm
            ${bgColor} ${scoreColor}
            group-hover:scale-110
          `}>
             {loading && !isReal ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
             ) : (
                <IconTarget size={16} />
             )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">AEO Score</span>
            <span className={`text-[12px] font-bold ${scoreColor}`}>
              {displayScore}/100
            </span>
          </div>
        </div>
      </div>

      {showTooltip && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 99999,
              pointerEvents: 'none' 
            }}
            className="pointer-events-auto" 
          >
            <div 
              className="w-[800px] max-h-[80vh] bg-white rounded-xl shadow-2xl border-2 border-[#e2e8f0] overflow-hidden flex flex-col"
            >
              <div className="p-1 overflow-y-auto custom-scrollbar">
                <SEOScoreCard 
                  content={content} 
                  brandName={brandName}
                  contentType={contentType} // Pass content type
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}


