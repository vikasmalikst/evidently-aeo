import React from 'react';
import { OnboardingStepIndicator } from '../components/Onboarding/OnboardingStepIndicator';
import evidentlyLogo from '../assets/logo.png';
import { ChevronLeft } from 'lucide-react';

type OnboardingStep = 'brand' | 'competitors' | 'summary';

interface OnboardingLayoutProps {
  currentStep: OnboardingStep;
  title: string | null;
  onBack?: () => void;
  children: React.ReactNode;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ currentStep, title, onBack, children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-10 w-auto" />
            </div>
            <div className="flex items-center">
              <OnboardingStepIndicator currentStep={currentStep} />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            {title && (
              <div className="flex items-center mb-8">
                {onBack && (
                  <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Go back">
                    <ChevronLeft size={24} className="text-gray-600" />
                  </button>
                )}
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
