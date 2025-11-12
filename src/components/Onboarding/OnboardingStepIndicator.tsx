import { IconCircleCheck } from '@tabler/icons-react';
import { useRef, useEffect, useState } from 'react';

interface OnboardingStepIndicatorProps {
  currentStep: 'brand' | 'competitors' | 'summary';
}

export const OnboardingStepIndicator = ({ currentStep }: OnboardingStepIndicatorProps) => {
  const steps = [
    { id: 'brand', label: 'Brand', labelWithSelect: 'Select Brand' },
    { id: 'competitors', label: 'Competitors', labelWithSelect: 'Select Competitors' },
    { id: 'summary', label: 'Summary', labelWithSelect: 'Review Summary' },
  ] as const;

  const textRef = useRef<HTMLDivElement>(null);
  const [pillWidth, setPillWidth] = useState<number>(0);

  const getStepIndex = (stepId: string) => {
    return steps.findIndex((s) => s.id === stepId);
  };

  const currentIndex = getStepIndex(currentStep);
  const currentStepData = steps[currentIndex];

  useEffect(() => {
    if (textRef.current && currentStepData) {
      const textWidth = textRef.current.offsetWidth;
      setPillWidth(textWidth + 32);
    }
  }, [currentStep, currentStepData]);

  return (
    <div className="step-indicator">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <div key={step.id} className="step-indicator-item">
            {isCompleted && (
              <>
                <IconCircleCheck size={20} className="step-indicator-icon-completed" />
                <div className="step-indicator-label step-indicator-label-completed">
                  {step.label}
                </div>
              </>
            )}
            {isCurrent && (
              <div className="step-indicator-active-wrapper">
                <div className="step-indicator-pill" style={{ width: `${pillWidth}px` }}></div>
                <div
                  ref={textRef}
                  className="step-indicator-label step-indicator-label-current"
                >
                  {step.labelWithSelect}
                </div>
              </div>
            )}
            {isPending && (
              <>
                <div className="step-indicator-circle step-indicator-circle-pending"></div>
                <div className="step-indicator-label step-indicator-label-pending">
                  {step.label}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

