/**
 * Premium Animated Stepper Component
 * Modern stepper with animated progress, glassmorphism, and glow effects
 */

import { motion } from 'framer-motion';
import { IconCheck } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface PremiumStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export const PremiumStepper = ({
  steps,
  currentStep,
  onStepClick,
  className
}: PremiumStepperProps) => {
  const completionPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn('relative w-full', className)}>
      {/* Animated Progress Line */}
      <div className="absolute top-12 left-0 right-0 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#00d4ff] via-[#0080ff] to-[#a855f7]"
          initial={{ width: '0%' }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <motion.div
              key={step.id}
              className="flex flex-col items-center flex-1"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* Step Circle */}
              <motion.button
                onClick={() => onStepClick?.(step.id)}
                className={cn(
                  'relative z-10 mb-3 flex items-center justify-center rounded-full transition-all duration-300',
                  'w-24 h-24',
                  isActive && 'glass-card glow-cyan-border scale-110',
                  isCompleted && 'bg-gradient-primary',
                  isUpcoming && 'glass-card opacity-60'
                )}
                whileHover={{ scale: isActive ? 1.15 : 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Pulse effect for active step */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[var(--accent-primary)] opacity-20"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.2, 0, 0.2]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'text-2xl transition-colors',
                    isActive && 'text-[var(--accent-primary)] animate-pulse-glow',
                    isCompleted && 'text-white',
                    isUpcoming && 'text-[var(--text-caption)]'
                  )}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      <IconCheck size={32} strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{
                        duration: 1.5,
                        repeat: isActive ? Infinity : 0,
                        ease: 'easeInOut'
                      }}
                    >
                      {step.icon}
                    </motion.div>
                  )}
                </div>

                {/* Index Badge */}
                {!isCompleted && (
                  <div
                    className={cn(
                      'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      isActive
                        ? 'bg-gradient-primary text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-caption)]'
                    )}
                  >
                    {stepNumber}
                  </div>
                )}
              </motion.button>

              {/* Step Info */}
              <motion.div
                className="text-center max-w-[180px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.2 }}
              >
                <h3
                  className={cn(
                    'text-sm font-bold mb-1 transition-colors',
                    isActive && 'text-[var(--accent-primary)] text-gradient-primary',
                    isCompleted && 'text-[var(--text-headings)]',
                    isUpcoming && 'text-[var(--text-caption)]'
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cn(
                    'text-xs transition-colors',
                    isActive && 'text-[var(--text-body)]',
                    isCompleted && 'text-[var(--text-caption)]',
                    isUpcoming && 'text-[var(--text-caption)] opacity-70'
                  )}
                >
                  {step.description}
                </p>
              </motion.div>

              {/* Status Badge */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 px-3 py-1 rounded-full bg-gradient-primary text-white text-xs font-medium"
                >
                  In Progress
                </motion.div>
              )}

              {isCompleted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2 px-3 py-1 rounded-full bg-gradient-success text-white text-xs font-medium"
                >
                  Completed ✓
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
