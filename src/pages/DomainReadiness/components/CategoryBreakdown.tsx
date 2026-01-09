import { AeoAuditResult } from '../types/types';

interface CategoryBreakdownProps {
  audit: AeoAuditResult;
  loading?: boolean;
  progress?: {
    active: boolean;
    completed: number;
    total: number;
  };
}

export const CategoryBreakdown = ({ audit, loading, progress }: CategoryBreakdownProps) => {
  const categories = [
    { name: 'Technical', key: 'technicalCrawlability', score: audit.scoreBreakdown.technicalCrawlability },
    { name: 'Content', key: 'contentQuality', score: audit.scoreBreakdown.contentQuality },
    { name: 'Semantic', key: 'semanticStructure', score: audit.scoreBreakdown.semanticStructure },
    { name: 'Access & Brand', key: 'accessibilityAndBrand', score: audit.scoreBreakdown.accessibilityAndBrand },
  ];

  const getColor = (s: number) => {
    if (s >= 90) return 'bg-green-500';
    if (s >= 75) return 'bg-blue-500';
    if (s >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="mb-6">
      {loading && progress?.active && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Analyzing…</span>
            <span>
              {progress.completed}/{progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <div key={cat.key} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-gray-700">{cat.name}</span>
              <span className="font-bold text-lg">{cat.score}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className={`h-2.5 rounded-full ${getColor(cat.score)}`} style={{ width: `${cat.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
