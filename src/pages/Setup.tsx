import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboardingUtils } from '../utils/onboardingUtils';
import { featureFlags } from '../config/featureFlags';
import { submitBrandOnboarding, upsertBrandProducts } from '../api/brandApi';
import { SetupLayout } from './SetupLayout';
import { WelcomeScreen } from '../components/Topics/WelcomeScreen';
import { AIModelSelection } from '../components/Onboarding/AIModelSelection';
import { TopicChoiceStep } from '../components/Onboarding/TopicChoiceStep';
import { ReviewStep, type ReviewRow } from '../components/Onboarding/ReviewStep';
import { SummaryStep } from '../components/Onboarding/SummaryStep';
import { CollectionProgressStep } from '../components/Onboarding/CollectionProgressStep';
import { TopicSelectionModal } from '../components/Topics/TopicSelectionModal';
import { PromptConfiguration, PromptWithTopic } from '../components/Onboarding/PromptConfiguration';
import type { Topic } from '../types/topic';
import type { OnboardingCompetitor } from '../types/onboarding';

export interface SetupData {
  models: string[];
  topics: Topic[];
  prompts: PromptWithTopic[];
}

type Step = 'welcome' | 'models' | 'topicChoice' | 'topics' | 'prompts' | 'review' | 'summary' | 'progress';

export const Setup = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialStep: Step = featureFlags.setupStep || featureFlags.onboardingStep || 'welcome';
  const [currentStep, setCurrentStep] = useState<Step>(initialStep);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<PromptWithTopic[]>([]);
  const [reviewData, setReviewData] = useState<ReviewRow[]>([]);
  const [competitors, setCompetitors] = useState<OnboardingCompetitor[]>([]);
  
  const brandData = localStorage.getItem('onboarding_brand');
  const brand = brandData ? JSON.parse(brandData) : {};

  useEffect(() => {
    if (featureFlags.skipSetupCheck) {
      console.log('🚀 Setup page: Skipping setup check - redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
    
    const competitorsData = localStorage.getItem('onboarding_competitors');
    if (competitorsData) {
      try {
        setCompetitors(JSON.parse(competitorsData));
      } catch (e) {
        console.error('Failed to parse competitors from localStorage', e);
      }
    }
  }, [navigate]);

  const handleBack = () => {
    if (currentStep === 'models') setCurrentStep('welcome');
    else if (currentStep === 'topicChoice') setCurrentStep('models');
    else if (currentStep === 'topics') setCurrentStep('topicChoice');
    else if (currentStep === 'prompts') setCurrentStep('topics');
    else if (currentStep === 'review') {
      if (reviewData.length > 0 && selectedTopics.length === 0) {
        setCurrentStep('topicChoice');
      } else {
        setCurrentStep('prompts');
      }
    }
    else if (currentStep === 'summary') setCurrentStep('review');
  };

  const handleNext = () => {
    if (isSubmitting) return;
    if (currentStep === 'welcome') setCurrentStep('models');
    else if (currentStep === 'models') setCurrentStep('topicChoice');
    else if (currentStep === 'topicChoice') setCurrentStep('topics');
    else if (currentStep === 'topics') setCurrentStep('prompts');
    else if (currentStep === 'prompts') {
      const initialReviewData: ReviewRow[] = selectedPrompts.map(p => ({
        topic: p.topic,
        prompt: p.prompt,
        country: 'US',
        locale: 'en-US'
      }));
      setReviewData(initialReviewData);
      setCurrentStep('review');
    }
    else if (currentStep === 'review') setCurrentStep('summary');
    else if (currentStep === 'summary') {
      handleComplete({
        models: selectedModels,
        topics: selectedTopics,
        prompts: selectedPrompts,
      });
    }
  };
  
  const handleComplete = async (data: SetupData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const competitorPayload = competitors.map((c: any, i: number) => {
        const rawDomainOrUrl = (c?.domain ?? c?.url ?? '') as string;
        const normalizedDomain = rawDomainOrUrl
          .toString()
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0] || '';

        const rawUrl = (c?.url ?? '') as string;
        const normalizedUrl =
          rawUrl && rawUrl.toString().startsWith('http')
            ? rawUrl.toString()
            : normalizedDomain
              ? `https://${normalizedDomain}`
              : '';

        return {
          name: c?.name || c?.companyName || c?.domain || `Competitor ${i + 1}`,
          domain: normalizedDomain,
          url: normalizedUrl,
          relevance: c?.relevance || 'Direct Competitor',
          industry: c?.industry || '',
          logo: c?.logo || '',
          source: c?.source || 'onboarding',
        };
      });

      const onboardingPayload = {
        brand_name: brand.companyName || brand.name,
        website_url: brand.website || brand.domain || 'https://example.com',
        description: brand.description || '',
        industry: brand.industry || 'Technology',
        competitors: competitorPayload,
        aeo_topics: data.topics.map(t => ({
          label: t.name,
          weight: t.relevance / 100 || 1.0,
          source: t.source,
          category: t.category
        })),
        ai_models: data.models,
        metadata: {
          ceo: brand.metadata?.ceo || brand.ceo,
          headquarters: brand.headquarters,
          founded_year: brand.founded,
          prompts: data.prompts,
          logo: brand.logo || brand.metadata?.brand_logo,
          domain: brand.domain || '',
          competitors_detail: competitorPayload,
          description: brand.description,
          topics_count: data.topics.length,
          prompts_count: data.prompts.length,
          models_count: data.models.length
        },
      };

      const response = await submitBrandOnboarding(onboardingPayload);

      if (response.success) {
        onboardingUtils.setOnboardingComplete(data);
        const brandId = response.data?.brand?.id;
        if (brandId) {
          localStorage.setItem('current_brand_id', brandId);
          localStorage.setItem(`data_collection_in_progress_${brandId}`, 'true');
          navigate('/dashboard', { 
            replace: true,
            state: { fromOnboarding: true, autoSelectBrandId: brandId }
          });
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error(response.error || 'Failed to complete onboarding');
      }
    } catch (error) {
      console.error('❌ Onboarding submission failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to complete onboarding');
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 'models') return selectedModels.length > 0;
    if (currentStep === 'topicChoice') return false; 
    if (currentStep === 'topics') return selectedTopics.length >= 1;
    if (currentStep === 'prompts') return selectedPrompts.length > 0;
    return true;
  };

  const getStepTitle = () => {
    if (currentStep === 'models') return 'Select AI Models';
    if (currentStep === 'topicChoice') return 'Choose Setup Method';
    if (currentStep === 'topics') return 'Select Topics';
    if (currentStep === 'prompts') return 'Configure Prompts';
    if (currentStep === 'review') return 'Review & Edit';
    if (currentStep === 'summary') return 'Configuration Summary';
    return null;
  };

  if (featureFlags.skipSetupCheck) return null;

  if (!brandData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-2">No brand data found</h2>
          <p className="text-gray-500 mb-6">Please complete the initial brand analysis first.</p>
          <button
            onClick={() => navigate('/onboarding')}
            className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-all"
          >
            Go to Brand Analysis
          </button>
        </div>
      </div>
    );
  }
  
  if (currentStep === 'welcome') {
    return (
      <SetupLayout currentStep="welcome" title={null}>
        <div className="max-w-2xl mx-auto">
          <WelcomeScreen onGetStarted={handleNext} />
        </div>
      </SetupLayout>
    );
  }

  if (currentStep === 'topics') {
    return (
      <TopicSelectionModal
        brandName={brand.companyName || brand.name}
        industry={brand.industry}
        mode="fullscreen"
        onNext={(topics) => {
          setSelectedTopics(topics);
          handleNext();
        }}
        onBack={handleBack}
        onClose={() => navigate('/dashboard')}
      />
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'models':
        return (
          <AIModelSelection
            selectedModels={selectedModels}
            onModelToggle={(modelId) => {
              setSelectedModels(prev => 
                prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]
              );
            }}
          />
        );
      case 'topicChoice':
        return (
          <TopicChoiceStep
            onChoice={(choice, data) => {
              if (choice === 'ai') handleNext();
              else if (data) {
                setReviewData(data);
                setCurrentStep('review');
              }
            }}
            onBack={handleBack}
          />
        );
      case 'prompts':
        return (
          <PromptConfiguration
            selectedTopics={selectedTopics}
            selectedPrompts={selectedPrompts}
            onPromptsChange={setSelectedPrompts}
          />
        );
      case 'review':
        return (
          <ReviewStep
            initialData={reviewData}
            onBack={handleBack}
            onConfirm={(data) => {
              setSelectedTopics(data.topics);
              setSelectedPrompts(data.prompts);
              handleNext();
            }}
          />
        );
      case 'summary':
        return (
          <SummaryStep
            brandName={brand.companyName || brand.name}
            domain={brand.domain}
            competitors={competitors}
            models={selectedModels}
            topics={selectedTopics}
            prompts={selectedPrompts}
            onBack={handleBack}
            onConfirm={handleNext}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SetupLayout
      currentStep={currentStep}
      title={getStepTitle()}
      onBack={handleBack}
    >
      {renderStepContent()}
      
      {currentStep !== 'topicChoice' && currentStep !== 'review' && currentStep !== 'summary' && (
        <div className="mt-8 pt-8 border-t border-gray-200 flex justify-end">
          <button
            className="px-8 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Next'}
          </button>
        </div>
      )}
    </SetupLayout>
  );
};
