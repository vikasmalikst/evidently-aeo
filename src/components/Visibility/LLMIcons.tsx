import { IconBrandOpenai } from '@tabler/icons-react';
import claudeLogoSrc from '../../assets/Claude-AI-icon.svg';
import copilotLogoSrc from '../../assets/Microsoft-Copilot-icon.svg';
import geminiLogoSrc from '../../assets/Google-Gemini-Icon.svg';
import googleAioLogoSrc from '../../assets/Google-AI-icon.svg';
import grokLogoSrc from '../../assets/Grok-icon.svg';
import llamaLogoSrc from '../../assets/LLaMA-Meta-Logo.svg';
import perplexityLogoSrc from '../../assets/Perplexity-Simple-Icon.svg';

export const ChatGPTIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <IconBrandOpenai size={24} stroke={1.5} color="#74AA9C" />
  </div>
);

export const ClaudeIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={claudeLogoSrc}
      alt="Claude logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const GeminiIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={geminiLogoSrc}
      alt="Google Gemini logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const PerplexityIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={perplexityLogoSrc}
      alt="Perplexity logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const GoogleAIOIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={googleAioLogoSrc}
      alt="Google AIO logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const CopilotIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={copilotLogoSrc}
      alt="Microsoft Copilot logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const MetaAIIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={llamaLogoSrc}
      alt="LLaMA logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const GrokIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center">
    <img
      src={grokLogoSrc}
      alt="Grok logo"
      className="w-6 h-6"
      loading="lazy"
    />
  </div>
);

export const getLLMIcon = (name: string) => {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('chatgpt') || lowerName.includes('gpt')) {
    return <ChatGPTIcon />;
  } else if (lowerName.includes('claude')) {
    return <ClaudeIcon />;
  } else if (lowerName.includes('gemini')) {
    return <GeminiIcon />;
  } else if (lowerName.includes('perplexity')) {
    return <PerplexityIcon />;
  } else if (lowerName.includes('google aio') || lowerName.includes('googleaio') || lowerName.includes('google_aio')) {
    return <GoogleAIOIcon />;
  } else if (lowerName.includes('copilot') || lowerName.includes('bing copilot')) {
    return <CopilotIcon />;
  } else if (lowerName.includes('meta') || lowerName.includes('llama')) {
    return <MetaAIIcon />;
  } else if (lowerName.includes('grok') || lowerName.includes('x-ai')) {
    return <GrokIcon />;
  }

  return (
    <div className="w-6 h-6 flex items-center justify-center bg-[#8b90a7] rounded-md">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
        <circle cx="12" cy="12" r="4"/>
      </svg>
    </div>
  );
};
