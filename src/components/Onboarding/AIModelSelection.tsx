import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { IconBrandOpenai, IconInfoCircle } from '@tabler/icons-react'; // Added IconInfoCircle
import { Check, Cpu, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore'; // Added useAuthStore import
import claudeLogoSrc from '../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../assets/Grok-icon.svg';
import llamaLogoSrc from '../../assets/LLaMA-Meta-Logo.svg';
import perplexityLogoSrc from '../../assets/Perplexity-Simple-Icon.svg';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  logo: ReactNode;
  available: boolean;
}

interface AIModelSelectionProps {
  selectedModels: string[];
  onModelToggle: (modelId: string) => void;
}

const AI_MODELS: AIModel[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    logo: <IconBrandOpenai size={40} stroke={1.5} color="#74AA9C" />,
    available: true,
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    logo: <img src={claudeLogoSrc} alt="Claude logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'Google',
    logo: <img src={geminiLogoSrc} alt="Google Gemini logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    logo: <img src={perplexityLogoSrc} alt="Perplexity logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: true,
  },
  {
    id: 'bing_copilot',
    name: 'Microsoft Copilot',
    provider: 'Microsoft',
    logo: <img src={copilotLogoSrc} alt="Microsoft Copilot logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: true,
  },
  {
    id: 'google_aio',
    name: 'Google AIO',
    provider: 'Google',
    logo: <img src={googleAioLogoSrc} alt="Google AIO logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: true,
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    logo: <img src={grokLogoSrc} alt="Grok logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: true,
  },
  {
    id: 'llama',
    name: 'LLaMA',
    provider: 'Meta AI',
    logo: <img src={llamaLogoSrc} alt="LLaMA logo" className="w-10 h-10 object-contain" loading="lazy" />,
    available: false,
  },
];

const MAX_SELECTIONS = 7;

export const AIModelSelection = ({ selectedModels, onModelToggle }: AIModelSelectionProps) => {
  const { user } = useAuthStore();
  const enabledCollectors = user?.settings?.entitlements?.enabled_collectors;

  const isEntitled = (modelId: string) => {
    // If no specific collectors list is defined, assume all allowed (or handle as restricted default)
    // If list exists, check strict inclusion
    if (!enabledCollectors || enabledCollectors.length === 0) return true;

    // Normalize modelId for comparison
    const normalizedId = modelId.toLowerCase();

    // Map frontend IDs to possible backend names (lowercase for comparison)
    const idToBackendMap: Record<string, string[]> = {
      'chatgpt': ['chatgpt'],
      'claude': ['claude'],
      'gemini': ['gemini', 'google gemini'],
      'perplexity': ['perplexity'],
      'google_aio': ['google ai mode', 'google aio'],
      'grok': ['grok'],
      'bing_copilot': ['bing', 'bing copilot', 'microsoft copilot'],
    };

    const possibleMatches = idToBackendMap[normalizedId] || [normalizedId];

    // Check if any of the possible matches exist in enabledCollectors (case-insensitive)
    return (enabledCollectors as string[]).some((collector: string) =>
      possibleMatches.includes(collector.toLowerCase().trim())
    );
  };

  const canSelectMore = selectedModels.length < MAX_SELECTIONS;

  const handleCardClick = (modelId: string, available: boolean) => {
    if (!available) return;
    if (!isEntitled(modelId)) return; // Check entitlement

    const isSelected = selectedModels.includes(modelId);
    if (!isSelected && !canSelectMore) return;
    onModelToggle(modelId);
  };

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Premium Card Container */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">

        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-200 mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            <Cpu size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select AI Models</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Choose which AI platforms you want to track. Select up to {MAX_SELECTIONS} models.
            We recommend starting with ChatGPT and Perplexity.
          </p>
        </motion.div>

        {/* Model Grid */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {AI_MODELS.map((model, index) => {
            const isSelected = selectedModels.includes(model.id);
            const entitled = isEntitled(model.id);
            const isDisabled = !model.available || (!isSelected && !canSelectMore) || !entitled;

            return (
              <motion.button
                key={model.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                onClick={() => handleCardClick(model.id, model.available)}
                disabled={isDisabled}
                className={`relative group p-6 rounded-2xl border-2 transition-all duration-300 text-center
                  ${isSelected
                    ? 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-400 shadow-lg shadow-cyan-100'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'}
                  ${isDisabled && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${!model.available ? 'opacity-60' : ''}
                  ${!entitled ? 'bg-gray-50 opacity-60' : ''}
                `}
              >
                {!entitled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div className="bg-gray-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 translate-y-2 group-hover:translate-y-0 border border-white/10 backdrop-blur-sm">
                      Not included in plan
                    </div>
                  </div>
                )}
                {/* Checkmark */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg z-10"
                  >
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </motion.div>
                )}

                {/* Logo */}
                <div className={`w-14 h-14 mx-auto mb-3 flex items-center justify-center rounded-xl transition-all duration-300 ${isSelected ? 'bg-white shadow-md' : 'bg-gray-50'
                  }`}>
                  {model.logo}
                </div>

                {/* Name */}
                <h3 className={`font-semibold text-sm mb-1 transition-colors ${isSelected ? 'text-cyan-700' : 'text-gray-900'
                  }`}>
                  {model.name}
                </h3>

                {/* Provider */}
                <p className="text-xs text-gray-500">{model.provider}</p>

                {/* Coming Soon Badge */}
                {!model.available && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                    Coming Soon
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Selection Counter */}
        <motion.div
          className="mt-8 flex items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 bg-gray-100 rounded-full px-6 py-3">
            <Sparkles size={18} className="text-cyan-500" />
            <span className="text-sm text-gray-600">
              Selected <span className="font-bold text-gray-900">{selectedModels.length}</span> of {MAX_SELECTIONS} models
            </span>
          </div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          className="mt-4 max-w-xs mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(selectedModels.length / MAX_SELECTIONS) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
