import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/Auth/LoginForm';
import { RegisterForm } from '../components/Auth/RegisterForm';
import { PasswordResetForm } from '../components/Auth/PasswordResetForm';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';

type AuthView = 'login' | 'register' | 'reset';

export const AuthPage = () => {
  const [view, setView] = useState<AuthView>('login');
  const navigate = useNavigate();

  // In dev bypass mode, redirect away from auth page
  useEffect(() => {
    if (featureFlags.bypassAuthInDev) {
      console.log('🔓 Dev mode: Redirecting away from auth page');
      // Use the same redirect logic as DefaultRedirect
      if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
        navigate('/dashboard', { replace: true });
      } else if (localStorage.getItem('onboarding_complete') === 'true') {
        navigate(onboardingUtils.isOnboardingComplete() ? '/dashboard' : '/setup', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [navigate]);

  const handleSuccess = () => {
    // Check if onboarding (brand/competitors) is complete
    const hasCompletedOnboarding = localStorage.getItem('onboarding_complete') === 'true';
    const hasCompletedSetup = onboardingUtils.isOnboardingComplete();

    console.log('🔍 Post-login check:', {
      hasCompletedOnboarding,
      hasCompletedSetup,
      skipOnboardingAfterLogin: featureFlags.skipOnboardingAfterLogin,
      forceOnboardingAfterLogin: featureFlags.forceOnboardingAfterLogin,
      skipSetupCheck: featureFlags.skipSetupCheck,
      skipOnboardingCheck: featureFlags.skipOnboardingCheck,
    });

    // Check feature flags for post-login behavior
    if (featureFlags.skipOnboardingAfterLogin) {
      console.log('🚀 Skipping onboarding after login (feature flag enabled) - going to setup');
      // Skip onboarding, go directly to setup
      if (hasCompletedSetup) {
        navigate('/dashboard');
      } else {
        navigate('/setup');
      }
      return;
    }

    if (featureFlags.skipSetupAfterLogin || featureFlags.skipSetupCheck || 
        featureFlags.skipOnboardingCheck) {
      console.log('🚀 Skipping setup after login (feature flag enabled)');
      navigate('/dashboard');
      return;
    }

    if (featureFlags.forceOnboardingAfterLogin) {
      console.log('🚀 Forcing onboarding after login (feature flag enabled)');
      navigate('/onboarding');
      return;
    }

    if (featureFlags.forceSetupAfterLogin || featureFlags.forceSetup ||
        featureFlags.forceOnboarding) {
      console.log('🚀 Forcing setup after login (feature flag enabled)');
      navigate('/setup');
      return;
    }

    // Normal flow: check onboarding first, then setup
    if (!hasCompletedOnboarding) {
      console.log('📋 Onboarding not complete - redirecting to onboarding');
      navigate('/onboarding');
    } else if (!hasCompletedSetup) {
      console.log('📋 Setup not complete - redirecting to setup');
      navigate('/setup');
    } else {
      console.log('✅ All complete - redirecting to dashboard');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      {view === 'login' && (
        <LoginForm
          onSuccess={handleSuccess}
          onSwitchToRegister={() => setView('register')}
          onForgotPassword={() => setView('reset')}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          onSuccess={handleSuccess}
          onSwitchToLogin={() => setView('login')}
        />
      )}
      {view === 'reset' && (
        <PasswordResetForm
          onBack={() => setView('login')}
        />
      )}
    </div>
  );
};
