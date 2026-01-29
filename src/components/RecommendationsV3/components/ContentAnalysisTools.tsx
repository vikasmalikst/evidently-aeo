import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTarget } from '@tabler/icons-react';
import { SEOScoreCard, analyzeContent } from './SEOScoreCard';

interface AEOScoreBadgeProps {
  content: string;
  brandName?: string;
}

export function AEOScoreBadge({ content, brandName }: AEOScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);
  
  // Calculate real score
  const analysis = React.useMemo(() => analyzeContent(content, brandName), [content, brandName]);
  const score = analysis.score;

  // Calculate position
  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const tooltipWidth = 360;
      const predictedHeight = 500; // Estimated max height
      const gap = 12;

      // Horizontal: Align right edge of tooltip with right edge of badge (so it extends left)
      let left = rect.right - tooltipWidth;
      
      // If it goes off-screen to the left, push it right
      if (left < 10) left = 10;

      // Vertical: Prefer placement ABOVE the badge to avoid covering the next row
      let top = rect.top - predictedHeight - gap;

      // If not enough space above, place BELOW
      if (top < 10) {
        top = rect.bottom + gap;
        
        // If below also overflows (unlikely at top of scroll, but possible), fit to screen
        if (top + predictedHeight > window.innerHeight) {
          // If we are strictly constrained, position where there is MORE space
          const spaceAbove = rect.top;
          const spaceBelow = window.innerHeight - rect.bottom;
          
          if (spaceAbove > spaceBelow) {
            top = 10; // Pin to top
            // Height would need to be scrollable max-height
          } else {
            top = rect.bottom + gap; // Keep below
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
            ${score >= 80 ? 'bg-[#d1fae5] text-[#059669]' : score >= 60 ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#fee2e2] text-[#dc2626]'}
            group-hover:scale-110
          `}>
            <IconTarget size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">AEO Score</span>
            <span className={`text-[12px] font-bold ${score >= 80 ? 'text-[#059669]' : score >= 60 ? 'text-[#d97706]' : 'text-[#dc2626]'}`}>
              {score}/100
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
              pointerEvents: 'none' // Let mouse events pass through wrapper to content
            }}
            className="pointer-events-auto" // Re-enable pointer events for specific content
          >
            <div 
              className="w-[800px] max-h-[80vh] bg-white rounded-xl shadow-2xl border-2 border-[#e2e8f0] overflow-hidden flex flex-col"
              // Keep tooltip open when hovering IT (optional UX pattern, but sticking to parent-hover for now for simplicity)
            >
              <div className="p-1 overflow-y-auto custom-scrollbar">
                <SEOScoreCard 
                  content={content} 
                  brandName={brandName}
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


