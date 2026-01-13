import React from 'react';
import { motion } from 'framer-motion';
import evidentlyLogo from '../assets/logo.png';

type OnboardingStep = 'brand' | 'competitors' | 'summary';

interface OnboardingLayoutProps {
  currentStep: OnboardingStep;
  title: string | null;
  onBack?: () => void;
  children: React.ReactNode;
}

// Step indicator dots
const steps = [
  { id: 'brand', label: 'Select Brand' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'summary', label: 'Summary' },
];

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ currentStep, children }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 flex flex-col relative overflow-hidden">
      {/* Subtle animated background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-100/40 to-blue-100/40 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-100/30 to-teal-100/30 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floating logo - top left corner */}
      <motion.div 
        className="absolute top-6 left-6 z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-8 w-auto" />
      </motion.div>

      {/* Main content area - centered */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>

      {/* Bottom step indicator */}
      <motion.div 
        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-lg rounded-full px-6 py-3 shadow-lg border border-gray-100">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2">
                  <motion.div
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-cyan-500' :
                      isCurrent ? 'bg-cyan-500 ring-4 ring-cyan-100' :
                      'bg-gray-300'
                    }`}
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.2 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                  <span className={`text-sm font-medium transition-colors duration-300 ${
                    isCurrent ? 'text-gray-900' :
                    isCompleted ? 'text-cyan-600' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 transition-colors duration-300 ${
                    isCompleted ? 'bg-cyan-400' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
