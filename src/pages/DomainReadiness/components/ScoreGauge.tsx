import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

export const ScoreGauge = ({ score, size = 120 }: ScoreGaugeProps) => {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  // Animated score counting
  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(start + (score - start) * progress);
      setDisplayScore(current);

      if (progress >= 1) {
        clearInterval(timer);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [score]);

  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 90) return '#10B981'; // Green
    if (s >= 75) return '#3B82F6'; // Blue
    if (s >= 60) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getInterpretation = (s: number) => {
    if (s >= 90) return { label: 'Excellent', color: 'text-green-600' };
    if (s >= 75) return { label: 'Good', color: 'text-blue-600' };
    if (s >= 60) return { label: 'Needs Work', color: 'text-yellow-600' };
    return { label: 'Critical', color: 'text-red-600' };
  };

  const interpretation = getInterpretation(displayScore);
  const shouldGlow = displayScore >= 80;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size + 40 }}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow effect for high scores */}
        {shouldGlow && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${getColor(displayScore)}33 0%, transparent 70%)`,
              filter: 'blur(10px)'
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        )}

        <svg width={size} height={size} className="transform -rotate-90 relative z-10">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth="12"
            fill="transparent"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor(displayScore)}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: 1.5,
              ease: 'easeOut'
            }}
          />
        </svg>

        <div className="absolute flex flex-col items-center inset-0 justify-center">
          <motion.span
            className="text-3xl font-bold text-gray-800"
            key={displayScore}
          >
            {displayScore}
          </motion.span>
          <span className="text-xs text-gray-500 font-medium">SCORE</span>
        </div>
      </div>

      {/* Interpretation Label */}
      <motion.div
        className={`mt-2 text-sm font-semibold ${interpretation.color}`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        {interpretation.label}
      </motion.div>
    </div>
  );
};
