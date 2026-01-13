import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/Auth/LoginForm';
import { RegisterForm } from '../components/Auth/RegisterForm';
import { PasswordResetForm } from '../components/Auth/PasswordResetForm';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';
import { cachedRequest } from '../lib/apiCache';
import { Zap, Activity, BarChart3, Bot } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { HeroBackground } from '../components/landing/hero-background';

import logo from '../assets/logo.png';

interface BrandsResponse {
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    slug?: string | null;
  }>;
  error?: string;
  message?: string;
}

type AuthView = 'login' | 'register' | 'reset';

export const AuthPage = () => {
  const [view, setView] = useState<AuthView>('login');
  const navigate = useNavigate();

  const sellingPoints = [
    { title: "Unify your brand's digital footprint across all sources.", icon: Zap },
    { title: "Track real-time sentiment & visibility where it matters most.", icon: Activity },
    { title: "Outpace competitors with daily, actionable benchmarking.", icon: BarChart3 },
    { title: "Get instant, AI-powered answers—not just data.", icon: Bot },
  ];

  // ... (useEffect and handleSuccess logic remain unchanged) ...
  useEffect(() => {
    if (featureFlags.bypassAuthInDev) {
      console.log('🔓 Dev mode: Redirecting away from auth page');
      if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
        navigate('/dashboard', { replace: true });
      } else if (localStorage.getItem('onboarding_complete') === 'true') {
        navigate(onboardingUtils.isOnboardingComplete() ? '/dashboard' : '/setup', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [navigate]);

  const handleSuccess = async (isRegistration: boolean = false) => {
    if (isRegistration) {
      console.log('🆕 New user registration - redirecting to onboarding');
      if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
        navigate('/dashboard');
        return;
      }
      if (featureFlags.skipOnboardingAfterLogin) {
        navigate('/setup');
        return;
      }
      navigate('/onboarding');
      return;
    }

    const hasCompletedOnboarding = localStorage.getItem('onboarding_complete') === 'true';
    const hasCompletedSetup = onboardingUtils.isOnboardingComplete();
    let hasExistingBrand = false;

    try {
      const brandsResponse = await cachedRequest<BrandsResponse>('/brands', {}, { requiresAuth: true });
      hasExistingBrand = !!(brandsResponse.success && brandsResponse.data && brandsResponse.data.length > 0);
    } catch (error) {
      console.warn('Failed to check existing brands after login:', error);
    }

    if (featureFlags.skipOnboardingAfterLogin) {
      if (hasCompletedSetup) {
        navigate('/dashboard');
      } else {
        navigate('/setup');
      }
      return;
    }

    if (featureFlags.skipSetupAfterLogin || featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
      navigate('/dashboard');
      return;
    }

    if (featureFlags.forceOnboardingAfterLogin) {
      navigate('/onboarding');
      return;
    }

    if (featureFlags.forceSetupAfterLogin || featureFlags.forceSetup || featureFlags.forceOnboarding) {
      navigate('/setup');
      return;
    }

    if (hasExistingBrand) {
      localStorage.setItem('onboarding_complete', 'true');
      navigate('/dashboard');
      return;
    }

    // If no brand exists, force onboarding regardless of local storage state
    // This handles cases where user aborted onboarding or has stale local storage
    if (localStorage.getItem('onboarding_complete') === 'true') {
      localStorage.removeItem('onboarding_complete');
    }
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-12 relative overflow-hidden">
      
      {/* Animated Particle Background */}
      <HeroBackground />

      {/* --- MAIN CONTENT --- */}
      <div className="w-full max-w-screen-xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Left Side: Text Content */}
        <div className="space-y-6 relative lg:pr-12">
          
          <div className="flex items-center gap-3 text-slate-900">
            <img src={logo} alt="EvidentlyAEO Logo" className="h-10 w-10 object-contain rounded-lg shadow-sm shadow-blue-600/20" />
            <span className="text-2xl font-bold tracking-tight">EvidentlyAEO</span>
          </div>

          <div className="space-y-4 max-w-lg">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Master the New Era of Search with <span className="text-blue-600">Answer Engine Optimization</span>
            </h1>
            
            <p className="text-base text-slate-600 leading-relaxed font-medium">
              Make confident decisions on your brand <span className="font-extrabold text-slate-900">20X Faster</span> — From Hours to Minutes.
            </p>
          </div>
          
          <ul className="space-y-3">
            {sellingPoints.map((point) => (
              <li key={point.title} className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-blue-100/50 flex-shrink-0 mt-0.5">
                  <point.icon className="w-4 h-4 text-blue-600 stroke-[1.5]" />
                </div>
                <p className="text-sm font-medium text-slate-700 leading-snug">{point.title}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Side: Authentication Form */}
        <div className="w-full flex justify-center lg:justify-center">
          <div className="w-full max-w-[480px] bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl p-8 sm:p-10 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {view === 'login' && (
                <LoginForm
                  key="login"
                  onSuccess={handleSuccess}
                  onSwitchToRegister={() => setView('register')}
                  onForgotPassword={() => setView('reset')}
                />
              )}
              {view === 'register' && (
                <RegisterForm
                  key="register"
                  onSuccess={() => handleSuccess(true)}
                  onSwitchToLogin={() => setView('login')}
                />
              )}
              {view === 'reset' && (
                <PasswordResetForm
                  key="reset"
                  onBack={() => setView('login')}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};