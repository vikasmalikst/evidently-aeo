import { IconCheck, IconFileSearch, IconWand, IconEyeglass, IconTargetArrow, IconChevronRight } from '@tabler/icons-react';

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  attentionSteps?: Partial<Record<number, boolean>>;
}

const steps = [
  { 
    number: 1, 
    label: 'Discovery', 
    description: 'Review findings',
    icon: IconFileSearch
  },
  { 
    number: 2, 
    label: 'Action Plan', 
    description: 'Approve & generate',
    icon: IconWand
  },
  { 
    number: 3, 
    label: 'Refinement', 
    description: 'Review content',
    icon: IconEyeglass
  },
  { 
    number: 4, 
    label: 'Impact', 
    description: 'Track ROI',
    icon: IconTargetArrow
  }
];

export const StepIndicator = ({ currentStep, onStepClick, attentionSteps }: StepIndicatorProps) => {
  const isStepComplete = (step: number) => step < currentStep;
  const isStepActive = (step: number) => step === currentStep;
  const isStepClickable = (_step: number) => Boolean(onStepClick);

  return (
    <div className="w-full bg-[#f8fafc] p-1 rounded-xl border border-[#e2e8f0]">
      <div className="flex items-stretch gap-1">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const complete = isStepComplete(step.number);
          const active = isStepActive(step.number);
          const attention = Boolean(attentionSteps?.[step.number]) && !active;

          return (
            <div key={step.number} className="flex-1 flex items-center relative group">
              <button
                onClick={() => isStepClickable(step.number) && onStepClick?.(step.number)}
                disabled={!isStepClickable(step.number)}
                className={`
                  relative flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all text-left
                  ${active 
                    ? 'bg-white shadow-md border border-[#00bcdc]/20 ring-1 ring-[#00bcdc]/10' 
                    : complete
                    ? 'bg-white border border-[#e2e8f0]/50 hover:bg-[#f0fdf4]'
                    : 'hover:bg-white/60 border border-transparent'
                  }
                `}
              >
                {/* Status Icon */}
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors
                  ${active 
                    ? 'bg-[#00bcdc] text-white' 
                    : complete
                    ? 'bg-white border border-[#06c686] text-[#06c686]'
                    : 'bg-white border border-[#e2e8f0] text-[#94a3b8]'
                  }
                `}>
                  <Icon size={18} />
                  
                  {/* Attention Pulse */}
                  {attention && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#06c686] rounded-full border-2 border-white animate-pulse" />
                  )}
                </div>

                {/* Labels */}
                <div className="flex flex-col min-w-0">
                  <span className={`
                    text-[13px] font-bold leading-none mb-1 transition-colors
                    ${active ? 'text-[#1e293b]' : complete ? 'text-[#06c686]' : 'text-[#64748b]'}
                  `}>
                    {step.label}
                  </span>
                  <span className="text-[10px] text-[#94a3b8] truncate font-medium">
                    {step.description}
                  </span>
                </div>
              </button>

              {/* Pipeline Connector (Chevron) */}
              {index < steps.length - 1 && (
                <div className="absolute -right-2 z-10 pointer-events-none text-[#e2e8f0] group-hover:text-[#cbd5e1] transition-colors">
                  <IconChevronRight size={20} stroke={3} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};