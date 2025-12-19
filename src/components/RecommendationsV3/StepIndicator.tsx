/**
 * Step Indicator Component for Recommendations V3
 * 
 * Shows 4-step progress with navigation:
 * Step 1: Generate & Review
 * Step 2: Approved Recommendations
 * Step 3: Content Review
 * Step 4: Results Tracking
 */

import { IconCheck, IconCircle } from '@tabler/icons-react';

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const steps = [
  { number: 1, label: 'Generate & Review', description: 'Review all recommendations' },
  { number: 2, label: 'Approved', description: 'Generate content' },
  { number: 3, label: 'Content Review', description: 'Review generated content' },
  { number: 4, label: 'Results', description: 'View KPI improvements' }
];

export const StepIndicator = ({ currentStep, onStepClick }: StepIndicatorProps) => {
  const isStepComplete = (step: number) => step < currentStep;
  const isStepActive = (step: number) => step === currentStep;
  const isStepClickable = (step: number) => onStepClick && (isStepComplete(step) || isStepActive(step));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1">
              <button
                onClick={() => isStepClickable(step.number) && onStepClick?.(step.number)}
                disabled={!isStepClickable(step.number)}
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all
                  ${isStepComplete(step.number)
                    ? 'bg-[#06c686] border-[#06c686] text-white cursor-pointer hover:bg-[#05a870]'
                    : isStepActive(step.number)
                    ? 'bg-[#00bcdc] border-[#00bcdc] text-white cursor-pointer'
                    : 'bg-white border-[#e8e9ed] text-[#94a3b8] cursor-not-allowed'
                  }
                `}
              >
                {isStepComplete(step.number) ? (
                  <IconCheck size={20} />
                ) : (
                  <span className="text-sm font-semibold">{step.number}</span>
                )}
              </button>
              
              {/* Step Label */}
              <div className="mt-2 text-center">
                <div className={`
                  text-xs font-semibold
                  ${isStepActive(step.number) ? 'text-[#00bcdc]' : isStepComplete(step.number) ? 'text-[#06c686]' : 'text-[#94a3b8]'}
                `}>
                  {step.label}
                </div>
                <div className="text-[10px] text-[#64748b] mt-0.5">
                  {step.description}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className={`
                flex-1 h-0.5 mx-2 transition-colors
                ${isStepComplete(step.number) ? 'bg-[#06c686]' : 'bg-[#e8e9ed]'}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

