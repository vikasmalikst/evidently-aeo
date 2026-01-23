import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { IconLock } from '@tabler/icons-react';

interface RestrictedFeatureProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const MockDashboard = () => (
  <div className="w-full h-full p-6 space-y-6 opacity-50 filter blur-[8px] select-none pointer-events-none overflow-hidden bg-gray-50/50">
    {/* Mock Header */}
    <div className="flex justify-between items-center mb-8">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-96 bg-gray-100 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
    </div>

    {/* Mock KPI Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-lg bg-blue-50" />
            <div className="h-5 w-16 bg-green-50 rounded-full" />
          </div>
          <div className="space-y-1">
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>

    {/* Mock Chart Section */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
      <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-8 w-32 bg-gray-100 rounded" />
        </div>
        <div className="flex items-end justify-between h-64 gap-2 px-4 pb-4 border-b border-l border-gray-100">
           {[...Array(12)].map((_, i) => (
              <div key={i} className="w-full bg-blue-50 rounded-t-sm" style={{ height: `${Math.random() * 60 + 20}%` }} />
           ))}
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100" />
                    <div className="flex-1 h-4 bg-gray-50 rounded" />
                    <div className="h-4 w-12 bg-gray-100 rounded" />
                </div>
            ))}
        </div>
      </div>
    </div>
  </div>
);

export const RestrictedFeature = ({ feature, children, fallback }: RestrictedFeatureProps) => {
  const { user } = useAuthStore();
  
  const entitlements = user?.settings?.entitlements;
  // If undefined, default to true unless we strictly want to block
  const isEnabled = entitlements?.features?.[feature] ?? true;

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative w-full h-full min-h-[80vh] overflow-hidden">
      {/* Real Content Background - Blurred */}
      <div className="filter blur-[6px] opacity-70 pointer-events-none select-none">
        {children}
      </div>

      {/* Unlock Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-6 text-center bg-white/30 backdrop-blur-[2px]">
        <div className="bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl p-8 max-w-md w-full flex flex-col items-center animate-in fade-in zoom-in duration-300 ring-1 ring-black/5">
          <div className="w-16 h-16 bg-[var(--accent-primary)]/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-[var(--accent-primary)]/5">
            <IconLock size={32} className="text-[var(--accent-primary)]" />
          </div>
          
          <h3 className="text-2xl font-bold text-[var(--text-headings)] mb-2">
            Upgrade to Pro
          </h3>
          
          <p className="text-[var(--text-caption)] mb-8 text-base leading-relaxed">
            Upgrade to <strong>Pro</strong> to access this feature.
          </p>
          
          <button 
            className="w-full py-3.5 px-6 bg-gradient-to-r from-[var(--accent-primary)] to-[#6366f1] hover:from-[var(--accent-primary)]/90 hover:to-[#6366f1]/90 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
            onClick={() => window.open('mailto:sales@evidently.ai?subject=Upgrade Plan Request', '_blank')}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
};
