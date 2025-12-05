import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DashboardPayload } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface TopTopicsProps {
  topTopics: DashboardPayload['topTopics'];
}

export const TopTopics = ({ topTopics }: TopTopicsProps) => {
  const getSentimentColor = (score: number | null) => {
    if (score === null) return { bg: 'bg-[#f4f4f6]', text: 'text-[#64748b]', label: 'No Data' };
    if (score >= 0.5) return { bg: 'bg-[#e6f7f1]', text: 'text-[#06c686]', label: 'Very Positive' };
    if (score >= 0.1) return { bg: 'bg-[#fff8e6]', text: 'text-[#f9db43]', label: 'Positive' };
    if (score >= -0.1) return { bg: 'bg-[#fff4e6]', text: 'text-[#fa8a40]', label: 'Neutral' };
    if (score >= -0.5) return { bg: 'bg-[#fff0f0]', text: 'text-[#f94343]', label: 'Negative' };
    return { bg: 'bg-[#ffe6e6]', text: 'text-[#d32f2f]', label: 'Very Negative' };
  };

  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-[#1a1d29]">
            Top Performing Topics
          </h2>
          <InfoTooltip description="Shows topics where your brand performs best. Visibility Score measures how prominently your brand appears in AI answers. Brand Presence shows what percentage of collector responses include your brand. Sentiment indicates how positively your brand is discussed (0-5 scale, higher is better)." />
        </div>
        <Link
          to="/topics"
          className="text-[13px] font-medium text-[#00bcdc] hover:text-[#0096b0] flex items-center gap-1"
        >
          View All
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="space-y-3">
        {topTopics.length > 0 ? (
          topTopics.map((topic) => {
            const visibility = Number.isFinite(topic.avgVisibility) && topic.avgVisibility !== undefined 
              ? topic.avgVisibility 
              : null;
            const brandPresence = topic.brandPresencePercentage !== null && topic.brandPresencePercentage !== undefined && Number.isFinite(topic.brandPresencePercentage)
              ? topic.brandPresencePercentage 
              : null;
            const shareOfAnswers = topic.avgShare !== null && topic.avgShare !== undefined && Number.isFinite(topic.avgShare)
              ? topic.avgShare 
              : null;
            const sentimentScore = topic.sentimentScore !== null && topic.sentimentScore !== undefined && Number.isFinite(topic.sentimentScore)
              ? topic.sentimentScore
              : null;
            
            const sentimentStyle = getSentimentColor(sentimentScore);

            return (
              <div
                key={topic.topic}
                className="group p-4 bg-white border border-[#e8e9ed] rounded-lg hover:border-[#00bcdc] hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-4">
                    <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-1.5 truncate">
                      {topic.topic}
                    </h3>
                    <p className="text-[12px] text-[#64748b]">
                      {topic.promptsTracked} {topic.promptsTracked === 1 ? 'query' : 'queries'} tracked
                    </p>
                  </div>
                  {sentimentScore !== null && (
                    <div className="relative group/sentiment flex-shrink-0">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${sentimentStyle.bg} flex-shrink-0`}>
                      <div className="text-center">
                        <span className={`text-[16px] font-bold ${sentimentStyle.text} block leading-none`}>
                          {Math.round(sentimentScore * 100)}
                        </span>
                        </div>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-[#1a1d29] text-white text-[11px] rounded-lg shadow-lg z-[100] opacity-0 invisible group-hover/sentiment:opacity-100 group-hover/sentiment:visible transition-all pointer-events-none whitespace-normal text-center">
                        Sentiment Score
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1a1d29]"></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#f4f4f6]">
                  <div className="text-center">
                    <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1.5">
                      Visibility
                    </div>
                    {visibility !== null ? (
                      <>
                        <div className="text-[16px] font-bold text-[#1a1d29]">
                          {visibility.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-[#64748b] mt-0.5">score</div>
                      </>
                    ) : (
                      <div className="text-[13px] text-[#64748b]">—</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1.5">
                      Brand Presence
                    </div>
                    {brandPresence !== null ? (
                      <>
                        <div className="text-[16px] font-bold text-[#1a1d29]">
                          {brandPresence.toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-[#64748b] mt-0.5">of responses</div>
                      </>
                    ) : (
                      <div className="text-[13px] text-[#64748b]">—</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-[#64748b] uppercase tracking-wide mb-1.5">
                      Share of Answers
                    </div>
                    {shareOfAnswers !== null ? (
                      <>
                        <div className="text-[16px] font-bold text-[#1a1d29]">
                          {shareOfAnswers.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-[#64748b] mt-0.5">share</div>
                      </>
                    ) : (
                      <div className="text-[13px] text-[#64748b]">—</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-[13px] text-[#64748b] border border-dashed border-[#e8e9ed] rounded-lg">
            We haven't detected enough topic data for this window yet.
          </div>
        )}
      </div>
    </div>
  );
};

