import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTarget } from '@tabler/icons-react';
import { SEOScoreCard, analyzeContent, analyzeHygiene } from './SEOScoreCard';
// Define API URL (same as SEOScoreCard)
import { apiClient } from '../../../lib/apiClient';

export interface AEOScoreBadgeProps {
  content: string;
  brandName?: string;
  contentType?: string;
  onClick?: () => void;
}

export function AEOScoreBadge({ content, brandName, contentType, onClick }: AEOScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [backendScore, setBackendScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Calculate immediate hygiene score for fallback/projection
  const analysis = React.useMemo(() => analyzeContent(content, brandName, contentType), [content, brandName, contentType]);
  
  // Calculate raw hygiene score for accurate total summation
  const hygieneAnalysis = React.useMemo(() => analyzeHygiene(content, contentType), [content, contentType]);

  useEffect(() => {
    if (!content || content.length < 50) return;

    let isMounted = true;
    setLoading(true);

    const fetchScore = async () => {
      try {
        const response = await apiClient.post<{ success: boolean; data: any }>('/aeo/score', {
          content,
          contentType
        });

        if (response.success && response.data && isMounted) {
          // Use exact same logic as SEOScoreCard: Raw Hygiene + Scrapability
          const total = Math.min(100, hygieneAnalysis.score + response.data.totalScore);
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
  }, [content, hygieneAnalysis.score, contentType]);

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
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) {
            onClick();
            setShowTooltip(false); // Close tooltip if clicking
          }
        }}
        onMouseEnter={() => !onClick && setShowTooltip(true)} // Only hover if no click handler? Or both? User said "tiled", implies click is main mode. Let's allowing hovering but click overrides.
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


