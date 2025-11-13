/**
 * Feature flags for controlling setup visibility and behavior
 * Set these via environment variables in .env.local
 */
export const featureFlags = {
  // Force show setup regardless of localStorage state
  forceSetup: import.meta.env.VITE_FORCE_SETUP === 'true',
  
  // Skip setup checks (for testing dashboard without setup)
  skipSetupCheck: import.meta.env.VITE_SKIP_SETUP_CHECK === 'true',
  
  // Show specific setup step directly (welcome, models, topics, prompts)
  setupStep: import.meta.env.VITE_SETUP_STEP as 'welcome' | 'models' | 'topics' | 'prompts' | null,
  
  // Enable testing mode in Dashboard (shows topic modal for testing)
  enableTestingMode: import.meta.env.VITE_ENABLE_TESTING_MODE === 'true',
  
  // Skip setup after login (redirects directly to dashboard after login)
  skipSetupAfterLogin: import.meta.env.VITE_SKIP_SETUP_AFTER_LOGIN === 'true',
  
  // Force setup after login (always redirects to setup after login)
  forceSetupAfterLogin: import.meta.env.VITE_FORCE_SETUP_AFTER_LOGIN === 'true',
  
  // Skip onboarding after login (redirects directly to setup after login, skipping brand/competitors)
  skipOnboardingAfterLogin: import.meta.env.VITE_SKIP_ONBOARDING_AFTER_LOGIN === 'true',
  
  // Force onboarding after login (always redirects to onboarding after login)
  forceOnboardingAfterLogin: import.meta.env.VITE_FORCE_ONBOARDING_AFTER_LOGIN === 'true',
  
  // Legacy flags (for backward compatibility)
  forceOnboarding: import.meta.env.VITE_FORCE_ONBOARDING === 'true',
  skipOnboardingCheck: import.meta.env.VITE_SKIP_ONBOARDING_CHECK === 'true',
  onboardingStep: import.meta.env.VITE_ONBOARDING_STEP as 'welcome' | 'models' | 'topics' | 'prompts' | null,
  
  // Development mode flag
  isDevelopment: import.meta.env.DEV,
  
  // Bypass authentication in development (auto-login with dev user)
  bypassAuthInDev: import.meta.env.VITE_BYPASS_AUTH_IN_DEV === 'true' && import.meta.env.DEV,
};

