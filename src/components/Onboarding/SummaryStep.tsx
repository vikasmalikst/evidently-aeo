import React from 'react';
import { 
  IconChevronLeft, 
  IconRocket, 
  IconBuilding, 
  IconUsers, 
  IconSettings, 
  IconListSearch,
  IconBrandOpenai,
  IconCheck
} from '@tabler/icons-react';
import type { Topic } from '../../types/topic';
import type { PromptWithTopic } from './PromptConfiguration';
import type { OnboardingCompetitor } from '../../types/onboarding';
import { SafeLogo } from './common/SafeLogo';

// Import model logos
import claudeLogoSrc from '../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../assets/Grok-icon.svg';
import llamaLogoSrc from '../../assets/LLaMA-Meta-Logo.svg';
import perplexityLogoSrc from '../../assets/Perplexity-Simple-Icon.svg';

interface SummaryStepProps {
  brandName: string;
  domain?: string;
  competitors: OnboardingCompetitor[];
  models: string[];
  topics: Topic[];
  prompts: PromptWithTopic[];
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const getModelInfo = (modelId: string) => {
  switch (modelId) {
    case 'chatgpt':
      return { name: 'ChatGPT', icon: <IconBrandOpenai size={20} color="#74AA9C" /> };
    case 'claude':
      return { name: 'Claude', icon: <img src={claudeLogoSrc} alt="Claude" className="w-5 h-5" /> };
    case 'gemini':
      return { name: 'Google Gemini', icon: <img src={geminiLogoSrc} alt="Gemini" className="w-5 h-5" /> };
    case 'perplexity':
      return { name: 'Perplexity', icon: <img src={perplexityLogoSrc} alt="Perplexity" className="w-5 h-5" /> };
    case 'bing_copilot':
      return { name: 'Microsoft Copilot', icon: <img src={copilotLogoSrc} alt="Copilot" className="w-5 h-5" /> };
    case 'google_aio':
      return { name: 'Google AIO', icon: <img src={googleAioLogoSrc} alt="Google AIO" className="w-5 h-5" /> };
    case 'grok':
      return { name: 'Grok', icon: <img src={grokLogoSrc} alt="Grok" className="w-5 h-5" /> };
    case 'llama':
      return { name: 'LLaMA', icon: <img src={llamaLogoSrc} alt="LLaMA" className="w-5 h-5" /> };
    default:
      return { name: modelId.replace(/_/g, ' '), icon: <IconSettings size={20} /> };
  }
};

export const SummaryStep: React.FC<SummaryStepProps> = ({
  brandName,
  domain,
  competitors,
  models,
  topics,
  prompts,
  onConfirm,
  onBack,
  isSubmitting = false
}) => {
  return (
    <div className="summary-step">
      <div className="onboarding-modal-body p-6">
        <div className="mb-8 text-center">
          <h3 className="text-2xl font-bold text-[var(--text-headings)] mb-2">
            Configuration Summary
          </h3>
          <p className="text-[var(--text-caption)]">
            Please review your settings before we start the data collection process.
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-[var(--border-default)]">
              {/* Brand Row */}
              <tr>
                <td className="w-1/3 p-5 bg-[var(--bg-secondary)] align-top">
                  <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold uppercase tracking-wider text-xs">
                    <IconBuilding size={16} />
                    Brand Information
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex items-center gap-4">
                    <SafeLogo 
                      domain={domain} 
                      alt={brandName} 
                      size={48} 
                      className="rounded-xl border border-[var(--border-default)]"
                    />
                    <div>
                      <div className="text-lg font-bold text-[var(--text-body)]">{brandName}</div>
                      {domain && <div className="text-sm text-[var(--text-caption)]">{domain}</div>}
                    </div>
                  </div>
                </td>
              </tr>

              {/* Competitors Row */}
              <tr>
                <td className="p-5 bg-[var(--bg-secondary)] align-top">
                  <div className="flex items-center gap-2 text-[var(--success500)] font-bold uppercase tracking-wider text-xs">
                    <IconUsers size={16} />
                    Competitors ({competitors.length})
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex flex-wrap gap-3">
                    {competitors.length > 0 ? (
                      competitors.map((comp, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)]">
                          <SafeLogo 
                            src={comp.logo} 
                            domain={comp.domain} 
                            alt={comp.name} 
                            size={20} 
                            className="rounded-md"
                          />
                          <span className="text-sm font-medium text-[var(--text-body)]">{comp.name}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--text-caption)] italic">No competitors selected</span>
                    )}
                  </div>
                </td>
              </tr>

              {/* AI Collectors Row */}
              <tr>
                <td className="p-5 bg-[var(--bg-secondary)] align-top">
                  <div className="flex items-center gap-2 text-[var(--dataviz-1)] font-bold uppercase tracking-wider text-xs">
                    <IconSettings size={16} />
                    AI Collectors ({models.length})
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex flex-wrap gap-3">
                    {models.map((modelId) => {
                      const info = getModelInfo(modelId);
                      return (
                        <div key={modelId} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)]">
                          {info.icon}
                          <span className="text-sm font-medium text-[var(--text-body)]">{info.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>

              {/* Topics & Queries Row */}
              <tr>
                <td className="p-5 bg-[var(--bg-secondary)] align-top">
                  <div className="flex items-center gap-2 text-[var(--accent-primary)] font-bold uppercase tracking-wider text-xs">
                    <IconListSearch size={16} />
                    Topics & Queries
                  </div>
                </td>
                <td className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {topics.map((topic, idx) => {
                      const topicPrompts = prompts.filter(p => p.topic === topic.name);
                      return (
                        <div key={idx} className="p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] flex justify-between items-center">
                          <div>
                            <div className="text-sm font-bold text-[var(--text-body)]">{topic.name}</div>
                            <div className="text-xs text-[var(--text-caption)]">{topicPrompts.length} queries</div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-[var(--success500)]/10 flex items-center justify-center text-[var(--success500)]">
                            <IconCheck size={16} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-10 max-w-4xl mx-auto">
          <div className="flex gap-4">
            <button
              onClick={onBack}
              disabled={isSubmitting}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--border-default)] text-[var(--text-body)] font-bold hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-2"
            >
              <IconChevronLeft size={20} /> Back to Review
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-[2] py-4 rounded-xl bg-[var(--accent-primary)] text-white font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25"
            >
              {isSubmitting ? (
                <>Starting Collection...</>
              ) : (
                <>
                  <IconRocket size={22} /> Launch Data Collection
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
