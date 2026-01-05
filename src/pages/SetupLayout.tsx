import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { StepIndicator } from '../components/Onboarding/StepIndicator';
import evidentlyLogo from '../assets/logo.png';

interface SetupLayoutProps {
  currentStep: 'welcome' | 'models' | 'topicChoice' | 'topics' | 'prompts' | 'review' | 'summary' | 'progress';
  title: string | null;
  onBack?: () => void;
  children: React.ReactNode;
}

export const SetupLayout: React.FC<SetupLayoutProps> = ({
  currentStep,
  title,
  onBack,
  children,
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-10 w-auto" />
            </div>
            <div className="flex items-center">
              <StepIndicator currentStep={currentStep} />
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
                  <button
                    onClick={onBack}
                    className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Go back"
                  >
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
