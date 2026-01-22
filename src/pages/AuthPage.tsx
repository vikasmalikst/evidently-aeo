import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/Auth/LoginForm';
import { RegisterForm } from '../components/Auth/RegisterForm';
import { PasswordResetForm } from '../components/Auth/PasswordResetForm';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';
import { cachedRequest } from '../lib/apiCache';
import { Zap, Activity, BarChart3, Bot, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
    { title: "Unify your brand's digital footprint across all sources.", icon: Zap, gradient: "from-amber-500 to-orange-500" },
    { title: "Track real-time sentiment & visibility where it matters most.", icon: Activity, gradient: "from-emerald-500 to-teal-500" },
    { title: "Outpace competitors with daily, actionable benchmarking.", icon: BarChart3, gradient: "from-violet-500 to-purple-500" },
    { title: "Get instant, AI-powered answers—not just data.", icon: Bot, gradient: "from-blue-500 to-indigo-500" },
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
    // Clear any stale admin impersonation context - we need user's own context first
    try {
      localStorage.removeItem('admin-selection-storage');
    } catch { /* ignore storage errors */ }

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

      {/* Soft mesh gradient background */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50/60" />

        {/* Soft decorative blobs */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-blue-200/40 via-indigo-100/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-20 w-[500px] h-[500px] bg-gradient-to-br from-violet-200/30 via-purple-100/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-cyan-100/40 via-blue-100/30 to-transparent rounded-full blur-3xl" />

        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.4) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* Animated Particle Background */}
      <HeroBackground />

      {/* --- MAIN CONTENT --- */}
      <div className="w-full max-w-screen-xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center relative z-10">

        {/* Left Side: Text Content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-8 relative lg:pr-8"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl blur-lg opacity-40" />
              <img src={logo} alt="EvidentlyAEO Logo" className="relative h-12 w-12 object-contain rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/50" />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">EvidentlyAEO</span>
          </div>

          {/* Hero Text */}
          <div className="space-y-5 max-w-lg">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Master the New Era of Search with{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Answer Engine Optimization
                </span>
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-full opacity-60" />
              </span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed">
              Make confident decisions on your brand{' '}
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                <Sparkles className="w-4 h-4 text-amber-500" />
                20X Faster
              </span>{' '}
              — From Hours to Minutes.
            </p>
          </div>

          {/* Selling Points */}
          <ul className="space-y-4">
            {sellingPoints.map((point, index) => (
              <motion.li
                key={point.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
                className="flex items-start gap-4 group"
              >
                <div className={`p-2 rounded-xl bg-gradient-to-br ${point.gradient} shadow-lg shadow-slate-900/5 flex-shrink-0 transition-transform group-hover:scale-110`}>
                  <point.icon className="w-4 h-4 text-white stroke-[2]" />
                </div>
                <p className="text-base text-slate-700 leading-relaxed pt-0.5">{point.title}</p>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Right Side: Authentication Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="w-full flex justify-center lg:justify-center"
        >
          {/* Glow Effect Behind Card */}
          <div className="absolute w-[480px] h-[480px] bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-purple-500/20 rounded-full blur-3xl pointer-events-none lg:translate-x-12" />

          {/* Card */}
          <div className="w-full max-w-[480px] relative">
            {/* Glassmorphism Card */}
            <div className="relative bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-slate-900/10 rounded-3xl p-8 sm:p-10 overflow-hidden ring-1 ring-slate-900/5">
              {/* Subtle gradient overlay inside card */}
              <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-blue-50/50 pointer-events-none" />

              {/* Card content */}
              <div className="relative z-10">
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
        </motion.div>
      </div>
    </div>
  );
};