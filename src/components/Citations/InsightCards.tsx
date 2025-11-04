import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Target, BarChart3, FileText } from 'lucide-react';
import { CitationInsightsData } from '../../data/mockCitationSourcesData';

interface InsightCardsProps {
  insights: CitationInsightsData;
}

export const InsightCards = ({ insights }: InsightCardsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PartnershipOpportunitiesCard opportunities={insights.partnershipOpportunities} />
      <ContentGapsByTopicCard gaps={insights.contentGapsByTopic} />
    </div>
  );
};

const BrandVisibilityCard = ({ data }: { data: any }) => {
  const isGood = data.gap < 5;

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        {isGood ? (
          <CheckCircle size={24} className="text-[var(--text-success)]" />
        ) : (
          <AlertTriangle size={24} className="text-[var(--text-warning)]" />
        )}
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Your Brand Visibility in Sources
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-[var(--text-caption)] mb-1">Your Domain Usage</div>
          <div className="text-2xl font-bold text-[var(--text-body)]">{data.domainUsage}%</div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-caption)] mb-1">Brand Mentioned</div>
          <div className="text-2xl font-bold text-[var(--text-body)]">{data.brandMentioned}%</div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-caption)] mb-1">Gap</div>
          <div className="text-2xl font-bold text-[var(--text-warning)]">{data.gap}%</div>
        </div>
      </div>

      <p className="text-sm text-[var(--text-body)] leading-relaxed">
        {data.gapInterpretation}
      </p>
    </div>
  );
};

const PartnershipOpportunitiesCard = ({ opportunities }: { opportunities: any[] }) => {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Target size={24} className="text-[var(--accent-primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Partnership & Outreach Opportunities
        </h3>
      </div>

      <div className="space-y-4">
        {opportunities.map((opp, idx) => (
          <div key={idx} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[var(--text-body)]">{opp.source}</span>
                  <span className="text-xs px-2 py-0.5 bg-white rounded text-[var(--text-caption)]">
                    {opp.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--text-caption)]">{opp.usage}% usage</span>
                  <span className={`flex items-center gap-1 ${
                    opp.trend.direction === 'up' ? 'text-[var(--text-success)]' : 'text-[var(--text-caption)]'
                  }`}>
                    {opp.trend.direction === 'up' ? <TrendingUp size={12} /> : null}
                    {opp.trend.percent > 0 ? '+' : ''}{opp.trend.percent}%
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--text-body)] mb-2">{opp.recommendation}</p>
            <button className="text-xs font-medium text-[var(--accent-primary)] hover:underline">
              Add to outreach list →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SourceTypeDistributionCard = ({ distribution }: { distribution: any }) => {
  const types = ['Editorial', 'Corporate', 'Reference', 'UGC', 'Institutional'];

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 size={24} className="text-[var(--accent-primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Source Type Distribution
        </h3>
      </div>

      <div className="space-y-3 mb-4">
        {types.map(type => {
          const data = distribution[type];
          return (
            <div key={type} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text-body)]">{type}</span>
                  <span className="text-sm font-semibold text-[var(--text-body)]">{data.percent}%</span>
                </div>
                <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-primary)]"
                    style={{ width: `${data.percent}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-[var(--text-caption)]">
                {data.trend === 'up' ? '⬆' : '➖'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-[var(--text-body)] leading-relaxed">
        {distribution.insight}
      </p>
    </div>
  );
};

const ContentGapsByTopicCard = ({ gaps }: { gaps: any[] }) => {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <FileText size={24} className="text-[var(--accent-primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Content Gaps by Topic
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-caption)] uppercase">Topic</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-caption)] uppercase">Citations</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-caption)] uppercase">Your Domain</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-caption)] uppercase">Alternative Sources</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-caption)] uppercase">Diversity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {gaps.map((gap, idx) => (
              <tr key={idx} className="hover:bg-[var(--bg-secondary)] transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-[var(--text-body)]">{gap.topic}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-body)]">{gap.totalCitations}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--text-success)]">{gap.yourDomainPercent}%</span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-[var(--text-caption)]">
                    {gap.alternativeSources.join(', ')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-[var(--text-body)]">{gap.sourceDiversity} types</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CompetitivePositionCard = ({ position }: { position: any }) => {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 shadow-sm lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp size={24} className="text-[var(--accent-primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-headings)]">
          Your Competitive Position
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-caption)] uppercase mb-3">Your Domain</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-body)]">Visibility</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-[var(--text-success)]">
                <TrendingUp size={14} />
                {position.yourDomain.usage}% (+{position.yourDomain.trend.percent}%)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-body)]">Citation Quality</span>
              <span className="text-sm text-[var(--text-caption)]">{position.yourDomain.citationQuality}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-body)]">Topic Coverage</span>
              <span className="text-sm text-[var(--text-body)]">{position.yourDomain.topicCoverage}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[var(--text-caption)] uppercase mb-3">Competitors</h4>
          <div className="space-y-2">
            {position.competitors.map((comp: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-[var(--bg-secondary)] rounded">
                <span className="text-sm font-medium text-[var(--text-body)]">{comp.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{comp.usage}%</span>
                  <span className={`text-xs ${
                    comp.trend.direction === 'up' ? 'text-[var(--text-success)]' :
                    comp.trend.direction === 'down' ? 'text-[var(--text-error)]' :
                    'text-[var(--text-caption)]'
                  }`}>
                    {comp.trend.direction === 'up' ? <TrendingUp size={12} /> :
                     comp.trend.direction === 'down' ? <TrendingDown size={12} /> : '➖'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
