import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandInput } from '../components/Onboarding/BrandInput';
import { CompetitorGrid } from '../components/Onboarding/CompetitorGrid';
import { Summary } from '../components/Onboarding/Summary';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';
import type { Brand, Competitor } from '../api/onboardingMock';

type OnboardingStep = 'brand' | 'competitors' | 'summary';

export const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('brand');
  const [brand, setBrand] = useState<Brand | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  // Redirect if skip onboarding check is enabled
  useEffect(() => {
    console.log('🔍 Onboarding page loaded. Feature flags:', {
      skipOnboardingCheck: featureFlags.skipOnboardingCheck,
      skipOnboardingAfterLogin: featureFlags.skipOnboardingAfterLogin,
      forceSetup: featureFlags.forceSetup,
      forceSetupAfterLogin: featureFlags.forceSetupAfterLogin,
    });

    if (featureFlags.skipOnboardingCheck || featureFlags.skipOnboardingAfterLogin) {
      console.log('🚀 Onboarding page: Skipping onboarding check - redirecting to setup');
      navigate('/setup', { replace: true });
      return;
    }

    // Force setup if feature flag is set
    if (featureFlags.forceSetup || featureFlags.forceSetupAfterLogin) {
      console.log('🚀 Onboarding page: Forcing setup - redirecting to setup');
      navigate('/setup', { replace: true });
      return;
    }

    console.log('✅ Onboarding page: Rendering onboarding flow');
  }, [navigate]);

  const handleBrandSuccess = (verifiedBrand: Brand) => {
    setBrand(verifiedBrand);
    setCurrentStep('competitors');
  };

  const handleCompetitorsContinue = (selectedCompetitors: Competitor[]) => {
    setCompetitors(selectedCompetitors);
    setCurrentStep('summary');
  };

  const handleOnboardingComplete = () => {
    // Save onboarding data
    if (brand) {
      localStorage.setItem('onboarding_brand', JSON.stringify(brand));
    }
    localStorage.setItem('onboarding_competitors', JSON.stringify(competitors));
    localStorage.setItem('onboarding_complete', 'true');
    
    // Navigate to setup flow
    navigate('/setup');
  };

  const handleBack = () => {
    if (currentStep === 'competitors') {
      setCurrentStep('brand');
    } else if (currentStep === 'summary') {
      setCurrentStep('competitors');
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <h1 className="onboarding-logo">Evidently</h1>
      </div>
      <div className="onboarding-main">
        {currentStep === 'brand' && (
          <BrandInput onSuccess={handleBrandSuccess} />
        )}
        {currentStep === 'competitors' && brand && (
          <CompetitorGrid
            brand={brand}
            onContinue={handleCompetitorsContinue}
            onBack={handleBack}
          />
        )}
        {currentStep === 'summary' && brand && (
          <Summary
            brand={brand}
            competitors={competitors}
            onComplete={handleOnboardingComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};
