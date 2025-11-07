import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LLMSelection } from '../components/Onboarding/LLMSelection';
import { BrandInput } from '../components/Onboarding/BrandInput';
import { CompetitorGrid } from '../components/Onboarding/CompetitorGrid';
import { Summary } from '../components/Onboarding/Summary';
import { StepIndicator } from '../components/Onboarding/StepIndicator';
import { type Brand, type Competitor } from '../api/onboardingMock';

export const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  const handleLLMsSelected = (llms: string[]) => {
    setSelectedLLMs(llms);
    localStorage.setItem('onboarding_llms', JSON.stringify(llms));
    setStep(2);
  };

  const handleBrandSuccess = (verifiedBrand: Brand) => {
    setBrand(verifiedBrand);
    localStorage.setItem('onboarding_brand', JSON.stringify(verifiedBrand));
    setStep(3);
  };

  const handleCompetitorsSelected = (selectedCompetitors: Competitor[]) => {
    setCompetitors(selectedCompetitors);
    localStorage.setItem('onboarding_competitors', JSON.stringify(selectedCompetitors));
    setStep(4);
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding_complete', 'true');
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

        {step === 2 && <BrandInput onSuccess={handleBrandSuccess} />}

        {step === 3 && brand && (
          <CompetitorGrid
            brand={brand}
            onContinue={handleCompetitorsSelected}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && brand && (
          <Summary
            brand={brand}
            competitors={competitors}
            onComplete={handleComplete}
            onBack={() => setStep(3)}
          />
        )}
      </div>

    </div>
  );
};
