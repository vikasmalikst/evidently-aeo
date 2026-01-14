import { motion } from 'framer-motion';
import { Sparkles, Cpu, FileText, ArrowRight, Zap, Target, BarChart3 } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

const steps = [
  {
    icon: Cpu,
    title: 'Select AI Models',
    description: 'Choose which AI platforms track your visibility',
    gradient: 'from-cyan-400 to-cyan-600',
  },
  {
    icon: Target,
    title: 'Configure Topics',
    description: 'Pick 8–10 topics that matter most to your brand',
    gradient: 'from-blue-400 to-blue-600',
  },
  {
    icon: FileText,
    title: 'Set Up Prompts',
    description: 'Select the search queries for AI monitoring',
    gradient: 'from-indigo-400 to-indigo-600',
  },
];

export const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  return (
    <motion.div 
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Premium Card Container - compact */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-6 md:p-8">
        
        {/* Header Section - compact */}
        <motion.div 
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Animated Logo/Icon - smaller */}
          <motion.div
            className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-200 mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          >
            <Sparkles size={28} className="text-white" />
          </motion.div>

          <motion.h1 
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Welcome to <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">EvidentlyAEO</span>
          </motion.h1>
          
          <motion.p 
            className="text-base text-gray-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Let's set up your Answer Intelligence tracking
          </motion.p>
        </motion.div>

        {/* Description - compact */}
        <motion.div 
          className="max-w-2xl mx-auto mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-center text-sm text-gray-600 leading-relaxed">
            To start measuring your brand's visibility across AI platforms, we'll guide you through three quick setup steps.
          </p>
        </motion.div>

        {/* Steps Overview - horizontal layout */}
        <motion.div 
          className="grid grid-cols-3 gap-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="relative group"
            >
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all duration-300 text-center h-full">
                {/* Step Number */}
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className={`w-10 h-10 mx-auto rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                  <step.icon size={20} className="text-white" />
                </div>

                {/* Content */}
                <h3 className="text-sm font-bold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-snug">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Features Preview - compact */}
        <motion.div 
          className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-300">
            {[
              { icon: Zap, text: 'Real-time tracking' },
              { icon: BarChart3, text: 'Competitor analysis' },
              { icon: Target, text: 'AI-powered insights' },
              { icon: Sparkles, text: 'Actionable recommendations' },
            ].map((feature, i) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + i * 0.05 }}
                className="flex items-center gap-1.5"
              >
                <feature.icon size={14} className="text-cyan-400" />
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl shadow-lg shadow-cyan-200 hover:shadow-xl hover:shadow-cyan-300 transition-all"
          >
            Let's Begin
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight size={18} />
            </motion.div>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};
