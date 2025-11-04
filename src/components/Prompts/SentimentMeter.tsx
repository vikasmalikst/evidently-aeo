interface SentimentMeterProps {
  sentiment: number;
}

export const SentimentMeter = ({ sentiment }: SentimentMeterProps) => {
  const getSentimentColor = (value: number) => {
    if (value <= 1) return '#f94343';
    if (value <= 2) return '#fa8a40';
    if (value <= 3) return '#f9db43';
    if (value <= 4) return '#06c686';
    return '#06c686';
  };

  const getSentimentColorLight = (step: number) => {
    if (step === 1) return '#fca5a5';
    if (step === 2) return '#fdc4a3';
    if (step === 3) return '#fce96a';
    if (step === 4) return '#86efac';
    return '#86efac';
  };

  const getSentimentLabel = (value: number) => {
    if (value <= 1) return 'Very Negative';
    if (value <= 2) return 'Negative';
    if (value <= 3) return 'Neutral';
    if (value <= 4) return 'Positive';
    return 'Very Positive';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((step) => {
          const isActive = step <= sentiment;
          const color = isActive ? getSentimentColorLight(step) : 'var(--bg-secondary)';

          return (
            <div
              key={step}
              className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all duration-200"
              style={{
                backgroundColor: color,
                color: isActive ? 'white' : 'var(--text-caption)',
                opacity: isActive ? 1 : 0.3
              }}
            >
              {step}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col">
        <span
          className="text-sm font-semibold"
          style={{ color: getSentimentColor(sentiment) }}
        >
          {getSentimentLabel(sentiment)}
        </span>
        <span className="text-xs text-[var(--text-caption)]">
          Sentiment Score: {sentiment}/5
        </span>
      </div>
    </div>
  );
};
