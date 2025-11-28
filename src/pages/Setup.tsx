import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SetupModal, type SetupData } from '../components/Onboarding/SetupModal';
import { onboardingUtils } from '../utils/onboardingUtils';
import { featureFlags } from '../config/featureFlags';
import { submitBrandOnboarding } from '../api/brandApi';

export const Setup = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Redirect to dashboard if skip setup check is enabled
  useEffect(() => {
    if (featureFlags.skipSetupCheck) {
      console.log('🚀 Setup page: Skipping setup check - redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleComplete = async (data: SetupData) => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Gather all onboarding data from localStorage
      const brandData = localStorage.getItem('onboarding_brand');
      const competitorsData = localStorage.getItem('onboarding_competitors');

      if (!brandData) {
        throw new Error('Brand data not found. Please complete the brand selection first.');
      }

      const brand = JSON.parse(brandData);
      const competitors = competitorsData ? JSON.parse(competitorsData) : [];

      console.log('📦 Gathering onboarding data:', {
        brand: brand.companyName,
        competitors: competitors.length,
        models: data.models.length,
        topics: data.topics.length,
      });

      // Prepare the complete onboarding payload
      const competitorPayload = competitors.map((competitor: any, index: number) => {
        const name =
          competitor?.name ||
          competitor?.companyName ||
          competitor?.domain ||
          `Competitor ${index + 1}`;
        const normalizedDomain =
          (competitor?.domain || competitor?.url || '')
            .toString()
            .trim()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .split('/')[0] || '';
        const url =
          competitor?.url && competitor.url.startsWith('http')
            ? competitor.url
            : normalizedDomain
            ? `https://${normalizedDomain}`
            : '';

        return {
          name: name,
          domain: normalizedDomain,
          url,
          relevance: competitor?.relevance || 'Direct Competitor',
          industry: competitor?.industry || '',
          logo: competitor?.logo || '',
          source: competitor?.source || 'onboarding',
        };
      });

      const onboardingPayload = {
        brand_name: brand.companyName || brand.name,
        website_url: brand.website || brand.domain || 'https://example.com',
        description: brand.description || '',
        industry: brand.industry || 'Technology',
        competitors: competitorPayload,
        aeo_topics: data.topics.map((topic) => ({
          label: topic.name,
          weight: topic.relevance / 100 || 1.0,
          source: topic.source,
          category: topic.category
        })),
        ai_models: data.models, // Selected AI models (chatgpt, perplexity, etc.)
        metadata: {
          ceo: brand.metadata?.ceo || brand.ceo,
          headquarters: brand.headquarters,
          founded_year: brand.founded,
          prompts: data.prompts, // Now includes topic information: { prompt: string, topic: string }[]
          prompts_with_topics: data.prompts, // Explicit field for prompts with topics
          logo: brand.logo || brand.metadata?.brand_logo,
          domain: brand.domain || '',
          competitors_detail: competitorPayload,
          description: brand.description,
          topics_count: data.topics.length,
          prompts_count: data.prompts.length,
          models_count: data.models.length
        },
      };

      console.log('🚀 Submitting complete onboarding data to API...');

      // Submit to backend - this will:
      // 1. Create brand in database
      // 2. Save competitors
      // 3. Save topics and categorize with AI
      // 4. Trigger Cerebras AI query generation
      // 5. Store AI models in metadata
      const response = await submitBrandOnboarding(onboardingPayload);

      if (response.success) {
        console.log('✅ Onboarding completed successfully!');

        // Save to localStorage for backward compatibility
        onboardingUtils.setOnboardingComplete(data);

        const brandId = response.data?.brand?.id;

        if (brandId) {
          // Remember this brand for dashboard + mark data collection in progress
          localStorage.setItem('current_brand_id', brandId);
          localStorage.setItem(`data_collection_in_progress_${brandId}`, 'true');

          console.log('🎯 Redirecting to loading screen for brand:', brandId);
          navigate(`/onboarding/loading/${brandId}`, { replace: true });
        } else {
          console.warn('⚠️ No brand ID returned from onboarding response, sending user to dashboard directly');
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

  const handleClose = () => {
    navigate('/dashboard');
  };

  // Don't render setup if skip check is enabled
  if (featureFlags.skipSetupCheck) {
    return null;
  }

  // Show error if submission failed
  if (submitError) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Onboarding Failed</h2>
          <p className="text-gray-700 mb-4">{submitError}</p>
          <button
            onClick={() => setSubmitError(null)}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <SetupModal
      brandName={(() => {
        const brandData = localStorage.getItem('onboarding_brand');
        if (brandData) {
          const brand = JSON.parse(brandData);
          return brand.companyName || brand.name || 'Your Brand';
        }
        return 'Your Brand';
      })()}
      industry={(() => {
        const brandData = localStorage.getItem('onboarding_brand');
        if (brandData) {
          const brand = JSON.parse(brandData);
          return brand.industry || 'Technology';
        }
        return 'Technology';
      })()}
      onComplete={handleComplete}
      onClose={handleClose}
      isSubmitting={isSubmitting}
    />
  );
};
