import { useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface SourcesRacingChartProps {
  racingChartData: {
    timePoints: string[];
    sources: Array<{
      domain: string;
      type: string;
      data: number[];
      color: string;
    }>;
  };
}

export const SourcesRacingChart = ({ racingChartData }: SourcesRacingChartProps) => {
  const [currentTimeIndex, setCurrentTimeIndex] = useState(racingChartData.timePoints.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTimeIndex((prev) => {
        if (prev >= racingChartData.timePoints.length - 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, racingChartData.timePoints.length]);

  const currentData = racingChartData.sources
    .map((source) => ({
      ...source,
      value: source.data[currentTimeIndex]
    }))
    .sort((a, b) => b.value - a.value);

  const maxValue = Math.max(...currentData.map(d => d.value));

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Top 10 Sources Over Time
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent-primary)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span className="text-sm font-medium">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <span className="text-sm text-[var(--text-caption)]">
            {racingChartData.timePoints[currentTimeIndex]}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {currentData.map((source, idx) => (
          <div
            key={source.domain}
            className="flex items-center gap-3 transition-all duration-500"
            style={{ transform: `translateY(${idx * 2}px)` }}
          >
            <div className="w-8 text-right text-sm font-semibold text-[var(--text-caption)]">
              #{idx + 1}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="w-32 text-sm font-medium text-[var(--text-body)] truncate">
                {source.domain}
              </div>
              <div className="flex-1 h-8 relative">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-500"
                  style={{
                    width: `${(source.value / maxValue) * 100}%`,
                    backgroundColor: source.color
                  }}
                />
              </div>
              <div className="w-12 text-right text-sm font-bold text-[var(--text-body)]">
                {source.value}%
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <input
          type="range"
          min="0"
          max={racingChartData.timePoints.length - 1}
          value={currentTimeIndex}
          onChange={(e) => {
            setCurrentTimeIndex(parseInt(e.target.value));
            setIsPlaying(false);
          }}
          className="w-full"
        />
      </div>
    </div>
  );
};
