export const ChatGPTIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center bg-[#10a37f] rounded-md">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  </div>
);

export const ClaudeIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center bg-[#d97757] rounded-md">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
      <path d="M14.5 2L9.5 22h2.5l5-20h-2.5z"/>
      <path d="M6.5 8L2 12l4.5 4v-8z"/>
      <path d="M17.5 8v8l4.5-4-4.5-4z"/>
    </svg>
  </div>
);

export const GeminiIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center bg-gradient-to-br from-[#4285f4] to-[#9c27b0] rounded-md">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.48l7 3.51v7.84l-7-3.5V9.48zm16 0v7.85l-7 3.5v-7.84l7-3.51z"/>
    </svg>
  </div>
);

export const PerplexityIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center bg-[#20808d] rounded-md">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
      <path d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.5L17.5 7v10L12 19.5 6.5 17V7L12 4.5z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </div>
);

export const MetaAIIcon = () => (
  <div className="w-6 h-6 flex items-center justify-center bg-gradient-to-br from-[#0081fb] to-[#0064c8] rounded-md">
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
      <circle cx="7" cy="12" r="3"/>
      <circle cx="17" cy="12" r="3"/>
      <path d="M7 9c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
      <path d="M7 15c0 2.76 2.24 5 5 5s5-2.24 5-5"/>
    </svg>
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
  } else if (lowerName.includes('meta') || lowerName.includes('llama')) {
    return <MetaAIIcon />;
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
