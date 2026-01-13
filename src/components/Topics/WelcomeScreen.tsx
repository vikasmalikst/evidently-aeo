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
      {/* Premium Card Container */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12">
        
        {/* Header Section */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Animated Logo/Icon */}
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-xl shadow-cyan-200 mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          >
            <Sparkles size={40} className="text-white" />
          </motion.div>

          <motion.h1 
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Welcome to <span className="bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">EvidentlyAEO</span>
          </motion.h1>
          
          <motion.p 
            className="text-xl text-gray-500 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Let's set up your Answer Intelligence tracking
          </motion.p>
        </motion.div>

        {/* Description */}
        <motion.div 
          className="max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-center text-gray-600 leading-relaxed">
            To start measuring your brand's visibility across AI platforms, we'll guide you through three quick setup steps.
            This will only take a few minutes.
          </p>
        </motion.div>

        {/* Steps Overview */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="relative group"
            >
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300">
                {/* Step Number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <step.icon size={28} className="text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Features Preview */}
        <motion.div 
          className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-300">
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
                transition={{ delay: 1 + i * 0.1 }}
                className="flex items-center gap-2"
              >
                <feature.icon size={16} className="text-cyan-400" />
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
          transition={{ delay: 1.1 }}
        >
          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-lg font-semibold rounded-xl shadow-xl shadow-cyan-200 hover:shadow-2xl hover:shadow-cyan-300 transition-all"
          >
            Let's Begin
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight size={22} />
            </motion.div>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};
