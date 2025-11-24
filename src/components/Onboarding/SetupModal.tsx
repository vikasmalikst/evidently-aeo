import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { WelcomeScreen } from '../Topics/WelcomeScreen';
import { AIModelSelection } from './AIModelSelection';
import { TopicSelectionModal } from '../Topics/TopicSelectionModal';
import { PromptConfiguration, PromptWithTopic } from './PromptConfiguration';
import { StepIndicator } from './StepIndicator';
import type { Topic } from '../../types/topic';
import { featureFlags } from '../../config/featureFlags';

interface SetupModalProps {
  brandName: string;
  industry: string;
  onComplete: (data: SetupData) => void;
  onClose: () => void;
}

export interface SetupData {
  models: string[];
  topics: Topic[];
  prompts: PromptWithTopic[]; // Changed to include topic information
}

// Keep OnboardingData as alias for backward compatibility
export type OnboardingData = SetupData;

type Step = 'welcome' | 'models' | 'topics' | 'prompts';

export const SetupModal = ({
  brandName,
  industry,
  onComplete,
  onClose,
}: SetupModalProps) => {
  // Support direct step access via feature flag (for testing)
  const initialStep: Step = featureFlags.setupStep || featureFlags.onboardingStep || 'welcome';
  const [currentStep, setCurrentStep] = useState<Step>(initialStep);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<PromptWithTopic[]>([]);

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

  const getStepTitle = () => {
    if (currentStep === 'models') return 'Select AI Models';
    if (currentStep === 'topics') return 'Select Topics';
    if (currentStep === 'prompts') return 'Configure Prompts';
    return null;
  };

  // Welcome screen is handled differently
  if (currentStep === 'welcome') {
    return (
      <div className="onboarding-modal-overlay">
        <div className="onboarding-modal-container step-welcome" onClick={(e) => e.stopPropagation()}>
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
    <div className="onboarding-modal-overlay">
      <div
        className={`onboarding-modal-container step-${currentStep}`}
        onClick={(e) => e.stopPropagation()}
      >
        <StepIndicator currentStep={currentStep} />
        
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
              selectedTopics={selectedTopics}
              selectedPrompts={selectedPrompts}
              onPromptsChange={setSelectedPrompts}
            />
          )}
        </div>

        <div className="onboarding-modal-footer">
          <div className="onboarding-button-wrapper" style={{ marginLeft: 'auto' }}>
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
