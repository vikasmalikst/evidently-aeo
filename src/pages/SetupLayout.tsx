import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import evidentlyLogo from '../assets/logo.png';

type SetupStep = 'welcome' | 'models' | 'topicChoice' | 'topics' | 'prompts' | 'review' | 'summary' | 'progress';

interface SetupLayoutProps {
  currentStep: SetupStep;
  title: string | null;
  onBack?: () => void;
  children: React.ReactNode;
}

// Step indicator configuration
const steps = [
  { id: 'models', label: 'Models' },
  { id: 'topics', label: 'Configuration' },
  { id: 'summary', label: 'Summary' },
];

const getStepIndex = (stepId: SetupStep) => {
  if (stepId === 'welcome' || stepId === 'models') return 0;
  if (['topicChoice', 'topics', 'prompts', 'review'].includes(stepId)) return 1;
  if (stepId === 'summary' || stepId === 'progress') return 2;
  return 0;
};

export const SetupLayout: React.FC<SetupLayoutProps> = ({ currentStep, onBack, children }) => {
  const currentIndex = getStepIndex(currentStep);
  const showBackButton = currentStep !== 'welcome' && onBack;

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

      {/* Top bar with logo and optional back button */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="flex items-center justify-between px-6 py-5">
          {/* Back button - left side */}
          {showBackButton ? (
            <motion.button
              type="button"
              onClick={() => onBack?.()}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ x: -4 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="group flex items-center gap-2 px-5 py-2.5 bg-white/90 backdrop-blur-md border border-gray-200 rounded-full shadow-lg shadow-gray-200/50 hover:shadow-xl hover:border-gray-300 transition-all duration-300"
            >
              <motion.div
                className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full group-hover:bg-cyan-100 transition-colors"
              >
                <ChevronLeft size={16} className="text-gray-600 group-hover:text-cyan-600 transition-colors" />
              </motion.div>
              <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">Back</span>
            </motion.button>
          ) : (
            <div className="w-28" /> 
          )}
          
          {/* Logo - center */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-8 w-auto" />
          </motion.div>
          
          <div className="w-28" /> {/* Right spacer for balance */}
        </div>
      </div>

      {/* Main content area - centered */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-6xl">
          {/* Step indicator - above the card */}
          <motion.div 
            className="flex justify-center mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-lg rounded-full px-6 py-3 shadow-lg border border-gray-100">
              {steps.map((step, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;

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

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
};
