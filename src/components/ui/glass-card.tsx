/**
 * Glassmorphic Card Component
 * A reusable card with glass effect, perfect for modern UI
 */

import { HTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  variant?: 'default' | 'strong';
  hover?: boolean;
  glow?: 'cyan' | 'purple' | 'pink' | 'none';
  animated?: boolean;
  className?: string;
}

export const GlassCard = ({
  children,
  variant = 'default',
  hover = false,
  glow = 'none',
  animated = false,
  className,
  ...props
}: GlassCardProps) => {
  const baseClasses = variant === 'strong' ? 'glass-card-strong' : 'glass-card';
  
  const hoverClasses = hover ? 'premium-card' : '';
  
  const glowClasses = {
    cyan: 'hover:glow-cyan-border',
    purple: 'hover:glow-purple',
    pink: 'hover:glow-pink',
    none: ''
  };

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hover ? { y: -4 } : {}}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          baseClasses,
          hoverClasses,
          glowClasses[glow],
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        baseClasses,
        hoverClasses,
        glowClasses[glow],
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Card with entrance animation and hover effects
 */
export const AnimatedCard = ({
  children,
  delay = 0,
  className,
  ...props
}: AnimatedCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={cn('glass-card', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface GradientBorderCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  gradient?: 'primary' | 'secondary' | 'success';
  className?: string;
}

/**
 * Card with animated gradient border
 */
export const GradientBorderCard = ({
  children,
  gradient = 'primary',
  className,
  ...props
}: GradientBorderCardProps) => {
  const gradients = {
    primary: 'from-[#00d4ff] via-[#0080ff] to-[#00d4ff]',
    secondary: 'from-[#a855f7] via-[#ec4899] to-[#a855f7]',
    success: 'from-[#10b981] via-[#06b6d4] to-[#10b981]'
  };

  return (
    <div className={cn('relative p-[1px] rounded-xl', className)} {...props}>
      <div className={`absolute inset-0 bg-gradient-to-r ${gradients[gradient]} rounded-xl opacity-75 blur-sm animate-pulse-glow`} />
      <div className="relative bg-[var(--bg-primary)] dark:bg-[var(--bg-primary)] rounded-xl">
        {children}
      </div>
    </div>
  );
};
