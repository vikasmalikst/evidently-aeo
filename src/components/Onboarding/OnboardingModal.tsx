import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { WelcomeScreen } from '../Topics/WelcomeScreen';
import { AIModelSelection } from './AIModelSelection';
import { TopicSelectionModal } from '../Topics/TopicSelectionModal';
import { PromptConfiguration } from './PromptConfiguration';
import type { Topic } from '../../types/topic';

interface OnboardingModalProps {
  brandName: string;
  industry: string;
  onComplete: (data: OnboardingData) => void;
  onClose: () => void;
}

export interface OnboardingData {
  models: string[];
  topics: Topic[];
  prompts: string[];
}

type Step = 'welcome' | 'models' | 'topics' | 'prompts';

export const OnboardingModal = ({
  brandName,
  industry,
  onComplete,
  onClose,
}: OnboardingModalProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const handleBack = () => {
    if (currentStep === 'models') setCurrentStep('welcome');
    else if (currentStep === 'topics') setCurrentStep('models');
    else if (currentStep === 'prompts') setCurrentStep('topics');
  };

  const handleNext = () => {
    if (currentStep === 'welcome') setCurrentStep('models');
    else if (currentStep === 'models') setCurrentStep('topics');
    else if (currentStep === 'topics') setCurrentStep('prompts');
  };

  const handleComplete = () => {
    onComplete({
      models: selectedModels,
      topics: selectedTopics,
      prompts: selectedPrompts,
    });
  };

  const canProceed = () => {
    if (currentStep === 'models') return selectedModels.length > 0;
    if (currentStep === 'topics') return selectedTopics.length >= 5;
    if (currentStep === 'prompts') return selectedPrompts.length > 0;
    return true;
  };

  const getStepNumber = () => {
    if (currentStep === 'models') return '1/3';
    if (currentStep === 'topics') return '2/3';
    if (currentStep === 'prompts') return '3/3';
    return null;
  };

  const getStepTitle = () => {
    if (currentStep === 'models') return 'Select AI Models';
    if (currentStep === 'topics') return 'Select Topics';
    if (currentStep === 'prompts') return 'Configure Prompts';
    return null;
  };

  const getProgressPercentage = () => {
    if (currentStep === 'models') return 33;
    if (currentStep === 'topics') return 66;
    if (currentStep === 'prompts') return 100;
    return 0;
  };

  // Welcome screen is handled differently
  if (currentStep === 'welcome') {
    return (
      <div className="onboarding-modal-overlay" onClick={onClose}>
        <div className="onboarding-modal-container step-welcome" onClick={(e) => e.stopPropagation()}>
          <button
            className="onboarding-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <WelcomeScreen onGetStarted={handleNext} />
        </div>
      </div>
    );
  }

  // For topics step, use the existing TopicSelectionModal component
  if (currentStep === 'topics') {
    return (
      <TopicSelectionModal
        brandName={brandName}
        industry={industry}
        onNext={(topics) => {
          setSelectedTopics(topics);
          handleNext();
        }}
        onBack={handleBack}
        onClose={onClose}
      />
    );
  }

  // For models and prompts steps, use the new layout
  return (
    <div className="onboarding-modal-overlay" onClick={onClose}>
      <div
        className={`onboarding-modal-container step-${currentStep}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="onboarding-progress-bar">
          <div
            className="onboarding-progress-fill"
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>
        </div>

        <div className="onboarding-modal-header">
          <button
            className="onboarding-back-button"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>

          <div className="onboarding-header-content">
            <h2 className="onboarding-modal-title">{getStepTitle()}</h2>
          </div>

          <div className="onboarding-step-badge">{getStepNumber()}</div>
        </div>

        <div className="onboarding-modal-body">
          {currentStep === 'models' && (
            <AIModelSelection
              selectedModels={selectedModels}
              onModelToggle={(modelId) => {
                if (selectedModels.includes(modelId)) {
                  setSelectedModels(selectedModels.filter(m => m !== modelId));
                } else {
                  setSelectedModels([...selectedModels, modelId]);
                }
              }}
            />
          )}

          {currentStep === 'prompts' && (
            <PromptConfiguration
              selectedPrompts={selectedPrompts}
              onPromptsChange={setSelectedPrompts}
            />
          )}
        </div>

        <div className="onboarding-modal-footer">
          <button
            className="onboarding-button-secondary"
            onClick={handleBack}
          >
            Back
          </button>

          <div className="onboarding-button-wrapper">
            <button
              className="onboarding-button-primary"
              onClick={currentStep === 'prompts' ? handleComplete : handleNext}
              disabled={!canProceed()}
            >
              {currentStep === 'prompts' ? 'Complete Setup' : 'Next'}
            </button>
            {!canProceed() && currentStep === 'models' && (
              <div className="onboarding-button-tooltip">
                Select at least 1 model
              </div>
            )}
            {!canProceed() && currentStep === 'topics' && (
              <div className="onboarding-button-tooltip">
                Select at least 5 topics
              </div>
            )}
            {!canProceed() && currentStep === 'prompts' && (
              <div className="onboarding-button-tooltip">
                Select at least 1 prompt
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
