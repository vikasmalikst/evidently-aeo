import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/Auth/LoginForm';
import { RegisterForm } from '../components/Auth/RegisterForm';
import { PasswordResetForm } from '../components/Auth/PasswordResetForm';
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';
import { cachedRequest } from '../lib/apiCache';
import { Zap, Activity, BarChart3, Bot, LayoutGrid } from 'lucide-react';
// Import motion for the particle animation
import { AnimatePresence, motion } from 'framer-motion';

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

    if (!hasCompletedOnboarding) {
      navigate('/onboarding');
    } else if (!hasCompletedSetup) {
      navigate('/setup');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-12 relative overflow-hidden">
      
      {/* Background layer for the Left Side (Replicating reference code logic) */}
      <div className="absolute top-0 left-0 w-full lg:w-[55%] h-full overflow-hidden pointer-events-none">
        
        {/* 1. The Radial Dot Grid Pattern (Adapted from reference Auth.tsx) */}
        <div 
          className="absolute inset-0 opacity-[0.6]"
          style={{
            // Using the exact reference syntax, but changing color to Slate-400 for light mode
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(148, 163, 184, 0.4) 2px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* 2. The Animated Floating Dots (Exact Framer Motion implementation from reference) */}
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              // Changed bg-blue-400/30 (dark mode) to bg-blue-600/20 (light mode)
              className="absolute w-2 h-2 bg-blue-600/20 rounded-full"
              animate={{
                x: [0, 100, -50, 0],
                y: [0, -100, 50, 0],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 8 + i * 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.5,
              }}
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`,
              }}
            />
          ))}
        </div>
        
        {/* Optional: Add a subtle gradient mask to fade it out on the right edge */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-slate-50" />
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="w-full max-w-screen-xl grid lg:grid-cols-[1.1fr,0.9fr] gap-16 lg:gap-20 items-center lg:items-start relative z-10">
        
        {/* Left Side: Text Content */}
        {/* Added border-r to create the visible diversion line requested */}
        <div className="space-y-10 lg:sticky lg:top-24 self-center relative lg:border-r lg:border-slate-200/80 lg:pr-20">
          
          <div className="flex items-center gap-3 text-slate-900">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/20">
                <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Evidently</span>
          </div>

          <div className="space-y-5 max-w-lg">
            <h1 className="text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Master the New Era of Search with <span className="text-blue-600">Answer Engine Optimization</span>
            </h1>
            
            <p className="text-lg text-slate-600 leading-relaxed font-medium">
              Make confident decisions on your brand <span className="font-extrabold text-slate-900">20X Faster</span> — From Hours to Minutes.
            </p>
          </div>
          
          <ul className="space-y-5 mt-8">
            {sellingPoints.map((point) => (
              <li key={point.title} className="flex items-start gap-4">
                <div className="p-1 rounded-md bg-blue-100/50 flex-shrink-0 mt-0.5">
                  <point.icon className="w-5 h-5 text-blue-600 stroke-[1.5]" />
                </div>
                <p className="text-[1.05rem] font-medium text-slate-700 leading-snug">{point.title}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Side: Authentication Form */}
        <div className="w-full flex justify-center lg:justify-end">
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