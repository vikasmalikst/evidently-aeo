import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandInput } from '../components/Onboarding/BrandInput';
import { CompetitorGrid } from '../components/Onboarding/CompetitorGrid';
import { Summary } from '../components/Onboarding/Summary';
import { featureFlags } from '../config/featureFlags';
import { OnboardingLayout } from './OnboardingLayout';
import type { OnboardingBrand, OnboardingCompetitor } from '../types/onboarding';

type OnboardingStep = 'brand' | 'competitors' | 'summary';

export const Onboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('brand');
  const [brand, setBrand] = useState<OnboardingBrand | null>(null);
  const [competitors, setCompetitors] = useState<OnboardingCompetitor[]>([]);
  const [allCompetitors, setAllCompetitors] = useState<OnboardingCompetitor[]>([]);
  const [selectedCompetitorDomains, setSelectedCompetitorDomains] = useState<Set<string>>(new Set());
  const getCompetitorKey = (competitor: OnboardingCompetitor) =>
    (competitor.domain || competitor.name || '').toLowerCase();

  const [brandInput, setBrandInput] = useState('');
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  const [brandInputResetKey, setBrandInputResetKey] = useState(0);

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

  const handleAnalyzeBrand = () => {
    if (brandInput.length < 2 || isAnalyzingBrand) return;
    setIsAnalyzingBrand(true);
  };

  const handleBrandSuccess = (
    verifiedBrand: OnboardingBrand,
    competitorSuggestions: OnboardingCompetitor[]
  ) => {
    setBrand(verifiedBrand);
    setAllCompetitors(competitorSuggestions);
    setIsAnalyzingBrand(false);

    if (competitorSuggestions.length > 0) {
      const defaultSelection = new Set(
        competitorSuggestions.slice(0, 5).map(getCompetitorKey)
      );
      setSelectedCompetitorDomains(defaultSelection);
    } else {
      setSelectedCompetitorDomains(new Set());
    }

    setCurrentStep('competitors');
  };

  const handleCompetitorsContinue = (selectedCompetitors: OnboardingCompetitor[]) => {
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
      // Clear all brand-related state when going back to brand step
      setBrand(null);
      setAllCompetitors([]);
      setSelectedCompetitorDomains(new Set());
      setCompetitors([]);
      setBrandInput('');
      setIsAnalyzingBrand(false);
      // Increment reset key to force BrandInput to remount and reset its internal state
      setBrandInputResetKey(prev => prev + 1);
      setCurrentStep('brand');
    } else if (currentStep === 'summary') {
      setCurrentStep('competitors');
    }
  };

  const getStepTitle = () => {
    if (currentStep === 'brand') return 'Select Brand';
    if (currentStep === 'competitors') return 'Select Competitors';
    if (currentStep === 'summary') return 'Review Summary';
    return null;
  };

  const canProceed = () => {
    if (currentStep === 'brand') return brand !== null;
    if (currentStep === 'competitors') return allCompetitors.length >= 3;
    if (currentStep === 'summary') return true;
    return false;
  };

  return (
    <OnboardingLayout
      currentStep={currentStep}
      title={getStepTitle()}
      onBack={currentStep !== 'brand' ? handleBack : undefined}
    >
      <div>
        {currentStep === 'brand' && (
          <BrandInput
            key={`brand-input-${brandInputResetKey}`}
            onSuccess={handleBrandSuccess}
            onAnalysisComplete={() => setIsAnalyzingBrand(false)}
            input={brandInput}
            onInputChange={setBrandInput}
            isLoading={isAnalyzingBrand}
          />
        )}
        {currentStep === 'competitors' && brand && (
          <CompetitorGrid
            key={`competitors-${brand.companyName}-${brand.domain || ''}`}
            brand={brand}
            initialCompetitors={allCompetitors}
            onContinue={handleCompetitorsContinue}
            onBack={handleBack}
            selectedCompetitors={selectedCompetitorDomains}
            onSelectionChange={setSelectedCompetitorDomains}
            onCompetitorsLoaded={setAllCompetitors}
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

      {currentStep !== 'summary' && (
        <div className="mt-8 pt-8 border-t border-gray-200 flex justify-end">
          {currentStep === 'brand' && !brand && (
            <button
              className="px-8 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
              onClick={handleAnalyzeBrand}
              disabled={brandInput.length < 2 || isAnalyzingBrand}
            >
              {isAnalyzingBrand ? 'Verifying...' : 'Analyze Brand'}
            </button>
          )}
          {currentStep === 'brand' && brand && (
            <button
              className="px-8 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-all"
              onClick={() => setCurrentStep('competitors')}
            >
              Next
            </button>
          )}
          {currentStep === 'competitors' && (
            <div className="relative">
              <button
                className="px-8 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                onClick={() => {
                  const selected = allCompetitors.filter((c) =>
                    selectedCompetitorDomains.has(getCompetitorKey(c))
                  );
                  handleCompetitorsContinue(selected.length > 0 ? selected : allCompetitors);
                }}
                disabled={!canProceed()}
              >
                Next
              </button>
              {!canProceed() && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white px-3 py-2 rounded text-sm whitespace-nowrap">
                  Keep at least 3 competitors
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </OnboardingLayout>
  );
};
