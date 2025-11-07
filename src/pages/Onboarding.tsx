import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LLMSelection } from '../components/Onboarding/LLMSelection';
import { BrandInput } from '../components/Onboarding/BrandInput';
import { TopicSelection } from '../components/Onboarding/TopicSelection';
import { PromptSelectionOnboarding } from '../components/Onboarding/PromptSelectionOnboarding';
import { StepIndicator } from '../components/Onboarding/StepIndicator';
import { type Brand } from '../api/onboardingMock';
import type { Topic } from '../types/topic';

export const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<any[]>([]);

  const handleLLMsSelected = (llms: string[]) => {
    setSelectedLLMs(llms);
    localStorage.setItem('onboarding_llms', JSON.stringify(llms));
    setStep(2);
    setSubStep(1);
  };

  const handleBrandSuccess = (verifiedBrand: Brand) => {
    setBrand(verifiedBrand);
    setSubStep(2);
  };

  const handleTopicsSelected = (topics: Topic[]) => {
    setSelectedTopics(topics);
    localStorage.setItem('onboarding_topics', JSON.stringify(topics));
    setStep(3);
  };

  const handlePromptsSelected = (prompts: any[]) => {
    setSelectedPrompts(prompts);
    localStorage.setItem('onboarding_prompts', JSON.stringify(prompts));
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding_complete', 'true');
    localStorage.setItem('onboarding_brand', JSON.stringify(brand));
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <h2 className="onboarding-logo">Evidently</h2>
        <StepIndicator currentStep={step} totalSteps={3} />
      </div>

      <div className="onboarding-main">
        {step === 1 && <LLMSelection onContinue={handleLLMsSelected} />}

        {step === 2 && subStep === 1 && (
          <BrandInput onSuccess={handleBrandSuccess} />
        )}

        {step === 2 && subStep === 2 && brand && (
          <TopicSelection
            brandName={brand.companyName}
            industry={brand.industry}
            onContinue={handleTopicsSelected}
            onBack={() => {
              setBrand(null);
              setSubStep(1);
            }}
          />
        )}

        {step === 3 && brand && (
          <PromptSelectionOnboarding
            selectedTopics={selectedTopics}
            onContinue={handlePromptsSelected}
            onBack={() => {
              setStep(2);
              setSubStep(2);
            }}
          />
        )}
      </div>

    </div>
  );
};
