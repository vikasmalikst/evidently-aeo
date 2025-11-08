import type { SetupData, OnboardingData } from '../components/Onboarding/SetupModal';

/**
 * Utility functions for managing onboarding state in localStorage
 */
export const onboardingUtils = {
  /**
   * Clear all onboarding state from localStorage
   */
  clearOnboardingState: () => {
    localStorage.removeItem('onboarding_complete');
    localStorage.removeItem('onboarding_data');
    localStorage.removeItem('onboarding_topics');
    localStorage.removeItem('onboarding_prompts');
    localStorage.removeItem('onboarding_brand');
    console.log('✅ Onboarding state cleared');
  },

  /**
   * Set onboarding as complete
   */
  setOnboardingComplete: (data?: SetupData | OnboardingData) => {
    localStorage.setItem('onboarding_complete', 'true');
    if (data) {
      localStorage.setItem('onboarding_data', JSON.stringify(data));
    }
    console.log('✅ Onboarding marked as complete', data);
  },

  /**
   * Check if onboarding is complete
   */
  isOnboardingComplete: (): boolean => {
    return localStorage.getItem('onboarding_complete') === 'true';
  },

  /**
   * Get onboarding data from localStorage
   */
  getOnboardingData: (): SetupData | OnboardingData | null => {
    const data = localStorage.getItem('onboarding_data');
    return data ? JSON.parse(data) : null;
  },

  /**
   * Get onboarding topics from localStorage
   */
  getOnboardingTopics: (): any[] | null => {
    const topics = localStorage.getItem('onboarding_topics');
    return topics ? JSON.parse(topics) : null;
  },

  /**
   * Get onboarding prompts from localStorage
   */
  getOnboardingPrompts: (): string[] | null => {
    const prompts = localStorage.getItem('onboarding_prompts');
    return prompts ? JSON.parse(prompts) : null;
  },

  /**
   * Reset onboarding to a specific step
   * Useful for testing specific steps
   */
  resetToStep: (step: 'welcome' | 'models' | 'topics' | 'prompts') => {
    onboardingUtils.clearOnboardingState();
    console.log(`✅ Onboarding reset to step: ${step}`);
  },
};

