/**
 * Premium Tab Navigator for Recommendations V3
 * Compact design with sub-headings and smooth sliding animations
 * Uses existing project color scheme (cyan #00bcdc)
 */

import { IconFileSearch, IconWand, IconEyeglass, IconTargetArrow } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface PremiumTabNavigatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  attentionSteps?: Partial<Record<number, boolean>>;
}

const tabs = [
  { number: 1, label: 'Opportunities', description: 'Review findings', icon: IconFileSearch },
  { number: 2, label: 'Content Generation', description: 'Approve & generate', icon: IconWand },
  { number: 3, label: 'Refine', description: 'Review content', icon: IconEyeglass },
  { number: 4, label: 'Outcome Tracker', description: 'Track ROI', icon: IconTargetArrow }
];

export const PremiumTabNavigator = ({ currentStep, onStepClick, attentionSteps }: PremiumTabNavigatorProps) => {
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);
  const isTabClickable = (_tab: number) => Boolean(onStepClick);

  return (
    <div className="w-full bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-1">
      <div className="flex items-center relative">
        {/* Hover highlight - sliding effect */}
        {hoveredTab !== null && hoveredTab !== currentStep && (
          <motion.div
            className="absolute inset-y-1 bg-white rounded-lg shadow-sm border border-[#e2e8f0]/50"
            style={{
              width: `${100 / tabs.length}%`,
            }}
            animate={{
              left: `${((hoveredTab - 1) / tabs.length) * 100}%`,
            }}
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}

        {/* Active tab background - sliding effect */}
        <motion.div
          className="absolute inset-y-0 bg-gradient-to-r from-[#00bcdc] to-[#0096b0] rounded-lg shadow-md"
          style={{ width: `${100 / tabs.length}%` }}
          animate={{
            left: `${((currentStep - 1) / tabs.length) * 100}%`,
          }}
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.number === currentStep;
          const isHovered = hoveredTab === tab.number && !isActive;
          const attention = Boolean(attentionSteps?.[tab.number]) && !isActive;

          return (
            <button
              key={tab.number}
              onClick={() => isTabClickable(tab.number) && onStepClick?.(tab.number)}
              onMouseEnter={() => setHoveredTab(tab.number)}
              onMouseLeave={() => setHoveredTab(null)}
              disabled={!isTabClickable(tab.number)}
              className="flex-1 relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-lg transition-colors"
            >
              {/* Icon with scale animation */}
              <motion.div
                animate={{
                  scale: isHovered || isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`relative flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  isActive ? 'bg-white/20' : isHovered ? 'bg-[#00bcdc]/10' : 'bg-white border border-[#e2e8f0]'
                }`}
              >
                <Icon 
                  size={16} 
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-white' : isHovered ? 'text-[#00bcdc]' : 'text-[#64748b]'
                  }`}
                />
                {/* Attention pulse */}
                {attention && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#06c686] rounded-full border border-white animate-pulse" />
                )}
              </motion.div>

              {/* Labels */}
              <div className="flex flex-col items-start min-w-0">
                <motion.span
                  animate={{ fontWeight: isActive ? 600 : 500 }}
                  className={`text-[14px] leading-tight transition-colors duration-200 ${
                    isActive ? 'text-white' : isHovered ? 'text-[#00bcdc]' : 'text-[#1e293b]'
                  }`}
                >
                  {tab.label}
                </motion.span>
                <span
                  className={`text-[10px] leading-tight transition-colors duration-200 ${
                    isActive ? 'text-white/75' : 'text-[#94a3b8]'
                  }`}
                >
                  {tab.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
