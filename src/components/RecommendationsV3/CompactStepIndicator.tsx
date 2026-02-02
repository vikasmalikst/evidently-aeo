/**
 * Compact Step Indicator for Recommendations V3
 * Minimal dot-based progress indicator with current step label
 */

import { IconCheck } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface CompactStepIndicatorProps {
    currentStep: number;
    totalSteps?: number;
    counts?: Record<number, number>;
    onStepClick?: (step: number) => void;
    attentionSteps?: Partial<Record<number, boolean>>;
}

const stepLabels = ['Opportunities', 'Content Generation', 'Refine', 'Outcome Tracker'];

export const CompactStepIndicator = ({
    currentStep,
    totalSteps = 4,
    counts,
    onStepClick,
    attentionSteps
}: CompactStepIndicatorProps) => {
    const currentLabel = stepLabels[currentStep - 1] || 'Step';
    const currentCount = counts?.[currentStep];

    return (
        <div className="flex items-center gap-4">
            {/* Dot Progress */}
            <div className="flex items-center gap-1.5">
                {Array.from({ length: totalSteps }, (_, i) => {
                    const step = i + 1;
                    const isActive = step === currentStep;
                    const isCompleted = step < currentStep;
                    const hasAttention = attentionSteps?.[step] && !isActive;

                    return (
                        <motion.button
                            key={step}
                            onClick={() => onStepClick?.(step)}
                            className={`relative flex items-center justify-center transition-all duration-200 ${isActive
                                    ? 'w-7 h-7 rounded-full bg-[#00bcdc] shadow-md'
                                    : isCompleted
                                        ? 'w-3 h-3 rounded-full bg-[#06c686] cursor-pointer hover:scale-110'
                                        : 'w-3 h-3 rounded-full bg-[#e2e8f0] cursor-pointer hover:bg-[#cbd5e1]'
                                }`}
                            whileHover={{ scale: isActive ? 1 : 1.2 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {isActive && (
                                <span className="text-white text-[11px] font-bold">{step}</span>
                            )}
                            {isCompleted && (
                                <IconCheck size={8} className="text-white" strokeWidth={3} />
                            )}
                            {hasAttention && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#06c686] rounded-full border border-white animate-pulse" />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Current Step Label */}
            <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#0f172a]">
                    {currentLabel}
                </span>
                {currentCount !== undefined && (
                    <span className="text-[11px] font-medium text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                        {currentCount} items
                    </span>
                )}
            </div>
        </div>
    );
};
