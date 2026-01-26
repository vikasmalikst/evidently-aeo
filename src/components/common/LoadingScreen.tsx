import React from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Analyzing topics...', 
  className = '' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[70vh] w-full bg-white/40 backdrop-blur-[2px] ${className}`}>
      <div className="relative">
        {/* Pulsing Outer Rings */}
        <motion.div
          animate={{ 
            scale: [1, 1.6, 1], 
            opacity: [0.1, 0.4, 0.1] 
          }}
          transition={{ 
            duration: 2.5, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="absolute inset-0 rounded-full bg-[#00bcdc]"
        />
        <motion.div
           animate={{ 
             scale: [1, 1.3, 1], 
             opacity: [0.1, 0.3, 0.1] 
           }}
           transition={{ 
             duration: 2.5, 
             repeat: Infinity, 
             ease: "easeInOut", 
             delay: 0.8 
           }}
           className="absolute inset-0 rounded-full bg-[#00bcdc]"
        />
        
        {/* The Animated Icon Container */}
        <div className="relative w-20 h-20 bg-white rounded-[24px] shadow-2xl shadow-cyan-200/50 flex items-center justify-center border border-slate-100 overflow-hidden">
           {/* Moving Shine across the box */}
           <motion.div
             animate={{ x: ["-150%", "150%"] }}
             transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
             className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-50/50 to-transparent skew-x-[-20deg]"
           />
           
           <motion.div 
             animate={{ 
               rotate: [0, 90, 180, 270, 360],
               scale: [0.9, 1.1, 0.9]
             }}
             transition={{ 
               duration: 6, 
               repeat: Infinity, 
               ease: "linear" 
             }}
             className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00bcdc] to-[#00a5c4] shadow-inner" 
           />
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-xl font-extrabold text-[#1a1d29] tracking-tight">
            {message}
          </h2>
          
          {/* Shimmering Progress Tag */}
          <div className="mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white border border-slate-100 shadow-sm relative overflow-hidden">
            <span className="text-[10px] font-black text-[#00bcdc] uppercase tracking-[0.2em] relative z-10">
               Powering AEO Intelligence
            </span>
            <motion.div 
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00bcdc]/10 to-transparent w-full z-20"
            />
          </div>
        </motion.div>
      </div>
      
      {/* Decorative Floating Dots */}
      <div className="mt-12 flex justify-center gap-2">
         {[0, 1, 2].map((i) => (
           <motion.div
             key={i}
             animate={{ 
               y: [0, -6, 0], 
               opacity: [0.3, 1, 0.3],
               scale: [1, 1.2, 1] 
             }}
             transition={{ 
               duration: 1.2, 
               repeat: Infinity, 
               delay: i * 0.25 
             }}
             className="w-2 h-2 rounded-full bg-[#00bcdc]"
           />
         ))}
      </div>
    </div>
  );
};

