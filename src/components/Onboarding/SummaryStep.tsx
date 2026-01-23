import React from 'react';
import { 
  IconChevronLeft, 
  IconRocket, 
  IconBuilding, 
  IconUsers, 
  IconSettings, 
  IconListSearch,
  IconBrandOpenai,
  IconCheck,
  IconBolt,
  IconSparkles
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
      return { name: 'ChatGPT', icon: <IconBrandOpenai size={18} color="#74AA9C" /> };
    case 'claude':
      return { name: 'Claude', icon: <img src={claudeLogoSrc} alt="Claude" className="w-[18px] h-[18px]" /> };
    case 'gemini':
      return { name: 'Google Gemini', icon: <img src={geminiLogoSrc} alt="Gemini" className="w-[18px] h-[18px]" /> };
    case 'perplexity':
      return { name: 'Perplexity', icon: <img src={perplexityLogoSrc} alt="Perplexity" className="w-[18px] h-[18px]" /> };
    case 'bing_copilot':
      return { name: 'Microsoft Copilot', icon: <img src={copilotLogoSrc} alt="Copilot" className="w-[18px] h-[18px]" /> };
    case 'google_aio':
      return { name: 'Google AIO', icon: <img src={googleAioLogoSrc} alt="Google AIO" className="w-[18px] h-[18px]" /> };
    case 'grok':
      return { name: 'Grok', icon: <img src={grokLogoSrc} alt="Grok" className="w-[18px] h-[18px]" /> };
    case 'llama':
      return { name: 'LLaMA', icon: <img src={llamaLogoSrc} alt="LLaMA" className="w-[18px] h-[18px]" /> };
    default:
      return { name: modelId.replace(/_/g, ' '), icon: <IconSettings size={18} /> };
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
    <div className="onboarding-modal-body p-6">
      <style>{`
        .summary-header-compact {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .summary-title-compact {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-headings);
          margin: 0 0 4px 0;
          font-family: 'Sora', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .summary-subtitle-compact {
          font-size: 13px;
          color: var(--text-caption);
          margin: 0;
          font-family: 'IBM Plex Sans', sans-serif;
        }
        
        .summary-card-compact {
          background: white;
          border: 1px solid var(--border-default);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        
        .summary-row-compact {
          display: flex;
          align-items: center;
          padding: 24px 32px;
          border-bottom: 1px solid var(--border-default);
          min-height: 88px;
        }
        
        .summary-row-compact:hover {
          background-color: var(--bg-secondary);
        }
        
        .summary-row-compact:last-child {
          border-bottom: none;
        }
        
        .summary-label-col {
          width: 240px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-caption);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        
        .summary-content-col {
          flex: 1;
        }
        
        .brand-compact {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .brand-details h4 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-headings);
          margin: 0;
          font-family: 'Sora', sans-serif;
        }
        
        .brand-details p {
          font-size: 14px;
          color: var(--text-caption);
          margin: 0;
          font-weight: 500;
        }
        
        .chip-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .icon-chip-compact {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: white;
          border: 1px solid var(--border-default);
          border-radius: 12px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        
        .icon-chip-compact:hover {
          border-color: var(--accent500);
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 4px 12px rgba(0, 188, 220, 0.15);
          z-index: 10;
        }
        
        /* Premium Tooltip */
        .icon-chip-compact::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-8px) scale(0.9);
          background: #1A1D29;
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .icon-chip-compact:hover::after {
          opacity: 1;
          transform: translateX(-50%) translateY(-8px) scale(1);
        }
        
        .icon-chip-compact::before {
          content: '';
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          border: 5px solid transparent;
          border-top-color: #1A1D29;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        
        .icon-chip-compact:hover::before {
          opacity: 1;
        }
        
        .topics-grid-compact {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          max-height: 180px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .topics-grid-compact::-webkit-scrollbar {
          width: 4px;
        }
        
        .topics-grid-compact::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .topics-grid-compact::-webkit-scrollbar-thumb {
          background: var(--border-default);
          border-radius: 4px;
        }
        
        .topic-row-compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: var(--bg-tertiary);
          border-radius: 10px;
          width: 100%;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        
        .topic-row-compact:hover {
          background: white;
          border-color: var(--accent500);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .topic-title-subtle {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-body);
          display: block;
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .topic-count-badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-headings);
          padding: 2px 8px;
          background: white;
          border-radius: 6px;
          margin-left: gap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        /* Premium Icon Styles */
        .premium-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, white, #f8f9fc);
          box-shadow: 
            0 2px 4px rgba(0,0,0,0.04),
            inset 0 1px 0 rgba(255,255,255,0.8);
          border: 1px solid var(--border-default);
          color: var(--text-caption);
        }
        
        .premium-icon-box--brand { color: var(--accent500); border-color: rgba(0, 188, 220, 0.3); background: rgba(0, 188, 220, 0.04); }
        .premium-icon-box--comp { color: var(--success500); border-color: rgba(6, 198, 134, 0.3); background: rgba(6, 198, 134, 0.04); }
        .premium-icon-box--ai { color: var(--dataviz-3); border-color: rgba(172, 89, 251, 0.3); background: rgba(172, 89, 251, 0.04); }
        .premium-icon-box--topics { color: var(--dataviz-4); border-color: rgba(250, 138, 64, 0.3); background: rgba(250, 138, 64, 0.04); }
        
        .summary-footer {
          display: flex;
          gap: 16px;
          margin-top: auto;
          padding-top: 24px;
        }
        
        .btn-launch-compact {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: var(--accent500);
          color: white;
          border: none;
          padding: 16px 28px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          box-shadow: 0 4px 12px rgba(0, 188, 220, 0.25);
          position: relative;
          overflow: hidden;
        }
        
        .btn-launch-compact:hover:not(:disabled) {
          background: var(--accent600);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0, 188, 220, 0.35);
        }
        
        .btn-back-compact {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: white;
          color: var(--text-body);
          border: 1px solid var(--border-default);
          padding: 16px 28px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        
        .btn-back-compact:hover {
          background: var(--bg-secondary);
          border-color: var(--primary300);
        }
      `}</style>
      
      {/* Header */}
      <div className="summary-header-compact">
        <h3 className="summary-title-compact">
          <IconSparkles size={24} className="text-[var(--accent500)]" />
          Configuration Summary
        </h3>
        <p className="summary-subtitle-compact">
          Confirm your settings to launch data collection
        </p>
      </div>

      {/* Main Content Card */}
      <div className="summary-card-compact">
        {/* Brand Row */}
        <div className="summary-row-compact">
          <div className="summary-label-col">
            <div className="premium-icon-box premium-icon-box--brand">
              <IconBuilding size={24} strokeWidth={1.5} />
            </div>
            Brand Info
          </div>
          <div className="summary-content-col">
            <div className="brand-compact">
              <SafeLogo 
                domain={domain} 
                alt={brandName} 
                size={48} 
                className="rounded-lg border border-[var(--border-default)] shadow-sm"
              />
              <div className="brand-details">
                <h4>{brandName}</h4>
                {domain && <p>{domain}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Competitors Row */}
        <div className="summary-row-compact">
          <div className="summary-label-col">
            <div className="premium-icon-box premium-icon-box--comp">
              <IconUsers size={24} strokeWidth={1.5} />
            </div>
            Competitors
          </div>
          <div className="summary-content-col">
            <div className="chip-container">
              {competitors.length > 0 ? (
                competitors.map((comp, idx) => (
                  <div key={idx} className="icon-chip-compact" data-tooltip={comp.name}>
                    <SafeLogo 
                      src={comp.logo} 
                      domain={comp.domain} 
                      alt={comp.name} 
                      size={24} 
                      className="rounded-sm"
                    />
                  </div>
                ))
              ) : (
                <span className="text-xs text-[var(--text-caption)] italic">No competitors selected</span>
              )}
            </div>
          </div>
        </div>

        {/* AI Collectors Row */}
        <div className="summary-row-compact">
          <div className="summary-label-col">
            <div className="premium-icon-box premium-icon-box--ai">
              <IconBolt size={24} strokeWidth={1.5} />
            </div>
            AI Collectors
          </div>
          <div className="summary-content-col">
            <div className="chip-container">
              {models.map((modelId) => {
                const info = getModelInfo(modelId);
                return (
                  <div key={modelId} className="icon-chip-compact" data-tooltip={info.name}>
                    {/* We need to clone specific elements if possible, or just render them. 
                        Since info.icon is a ReactNode, we can't easily resize it here unless we change getModelInfo 
                        or wrap it. However, the SVG icons inside getModelInfo have explicit pixel sizes in className or size prop.
                        
                        We should probably update getModelInfo to return larger icons, 
                        BUT getModelInfo is defined inside this file above.
                        
                        I will update getModelInfo in a separate call or same call if possible.
                        For now, I'll update the row headers.
                    */}
                    {React.isValidElement(info.icon) 
                      ? React.cloneElement(info.icon as React.ReactElement<any>, { size: 24, className: "w-[24px] h-[24px]" })
                      : info.icon}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Topics Row */}
        <div className="summary-row-compact" style={{ alignItems: 'flex-start', padding: '24px 32px' }}>
          <div className="summary-label-col" style={{ paddingTop: '8px' }}>
            <div className="premium-icon-box premium-icon-box--topics">
              <IconListSearch size={24} strokeWidth={1.5} />
            </div>
            Topics
          </div>
          <div className="summary-content-col">
            <div className="topics-grid-compact">
              {topics.map((topic, idx) => {
                const topicPrompts = prompts.filter(p => p.topic === topic.name);
                return (
                  <div key={idx} className="topic-row-compact">
                    <span className="topic-title-subtle" title={topic.name}>{topic.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="topic-count-badge">{topicPrompts.length}</span>
                      <IconCheck size={14} className="text-[var(--success500)]" strokeWidth={2.5} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="summary-footer">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="btn-back-compact"
        >
          <IconChevronLeft size={18} />
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="btn-launch-compact"
        >
          {isSubmitting ? (
            <>Starting...</>
          ) : (
            <>
              <IconRocket size={18} />
              Launch Collection
            </>
          )}
        </button>
      </div>
    </div>
  );
};
