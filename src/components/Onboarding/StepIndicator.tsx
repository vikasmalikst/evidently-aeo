import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const steps = [
  { number: 1, label: 'LLMs' },
  { number: 2, label: 'Topics' },
  { number: 3, label: 'Prompts' }
];

export const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  return (
    <div className="onboarding-step-indicator">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;

        return (
          <div key={step.number} className="onboarding-step-indicator__item">
            <div className="onboarding-step-indicator__content">
              <div
                className={`
                  onboarding-step-indicator__circle
                  ${isCompleted ? 'onboarding-step-indicator__circle--completed' : ''}
                  ${isCurrent ? 'onboarding-step-indicator__circle--current' : ''}
                `}
              >
                {isCompleted ? <Check size={12} /> : step.number}
              </div>
              <span
                className={`
                  onboarding-step-indicator__label
                  ${isCurrent ? 'onboarding-step-indicator__label--current' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
            {index < totalSteps - 1 && (
              <div
                className={`
                  onboarding-step-indicator__line
                  ${isCompleted ? 'onboarding-step-indicator__line--completed' : ''}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
