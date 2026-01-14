import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';

interface OnboardingTooltipProps {
  /** Unique storage key to persist dismiss state */
  storageKey: string;
  /** Title of the tooltip */
  title: string;
  /** Main content of the tooltip - can include React nodes */
  children: React.ReactNode;
  /** Whether to show on page load (default: true) */
  autoShow?: boolean;
  /** Delay in ms before showing (default: 0 - immediate) */
  showDelay?: number;
}

/**
 * A beautiful modal tooltip component for onboarding pages.
 * Features backdrop blur, centered design, smooth animations, and persistent dismiss state.
 * Uses the project's cyan/teal theme colors.
 */
export const OnboardingTooltip = ({
  storageKey,
  title,
  children,
  autoShow = true,
  showDelay = 0,
}: OnboardingTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem(`tooltip_dismissed_${storageKey}`);
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Auto-show after delay (default is immediate)
    if (autoShow) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, showDelay);
      return () => clearTimeout(timer);
    }
  }, [storageKey, autoShow, showDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem(`tooltip_dismissed_${storageKey}`, 'true');
  };

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
            onClick={handleDismiss}
          />
          
          {/* Centered Modal Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.16, 1, 0.3, 1],
              delay: 0.1 
            }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-w-md w-full pointer-events-auto">
              {/* Gradient accent bar - Cyan theme */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500" />
              
              {/* Decorative glow - Cyan theme */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-200/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-teal-200/30 rounded-full blur-3xl" />
              
              {/* Content */}
              <div className="relative p-8 pt-10">
                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Dismiss tooltip"
                >
                  <X size={18} className="text-gray-400" />
                </button>

                {/* Icon - Cyan theme */}
                <motion.div 
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center shadow-lg shadow-cyan-100 mb-6"
                >
                  <Lightbulb size={32} className="text-cyan-600" />
                </motion.div>
                
                {/* Title */}
                <motion.h3 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-xl font-bold text-gray-900 text-center mb-4"
                >
                  {title}
                </motion.h3>
                
                {/* Body */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-600 leading-relaxed text-center"
                >
                  {children}
                </motion.div>
                
                {/* Got it button - Cyan theme */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDismiss}
                  className="mt-8 w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-base font-bold rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg shadow-cyan-200/50"
                >
                  Got it!
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

