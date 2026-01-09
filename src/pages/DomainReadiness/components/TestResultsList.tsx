import { useState } from 'react';
import { AeoAuditResult } from '../types/types';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface TestResultsListProps {
  audit: AeoAuditResult;
  loading?: boolean;
  progress?: {
    active: boolean;
    buckets: Record<
      'technicalCrawlability' | 'contentQuality' | 'semanticStructure' | 'accessibilityAndBrand',
      { total: number; completed: number }
    >;
  };
}

export const TestResultsList = ({ audit, loading, progress }: TestResultsListProps) => {
  // Use a mapped type for state keys
  type CategoryKey = keyof typeof audit.detailedResults;
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    technicalCrawlability: true,
    contentQuality: false,
    semanticStructure: false,
    accessibilityAndBrand: false,
  });

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const categories: { name: string; key: CategoryKey; data: any }[] = [
    { name: 'Technical Crawlability', key: 'technicalCrawlability', data: audit.detailedResults.technicalCrawlability },
    { name: 'Content Quality', key: 'contentQuality', data: audit.detailedResults.contentQuality },
    { name: 'Semantic Structure', key: 'semanticStructure', data: audit.detailedResults.semanticStructure },
    { name: 'Accessibility & Brand', key: 'accessibilityAndBrand', data: audit.detailedResults.accessibilityAndBrand },
  ];

  const getIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.key} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => toggle(cat.key)}
          >
            <div className="flex items-center space-x-3">
              <span className="font-semibold text-gray-800">{cat.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                cat.data.score >= 90 ? 'bg-green-100 text-green-800' : 
                cat.data.score >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
              }`}>
                {cat.data.score}/100
              </span>
              {loading && progress?.active && progress.buckets[cat.key] && (
                <span className="text-xs text-gray-500">
                  {progress.buckets[cat.key].completed}/{progress.buckets[cat.key].total}
                </span>
              )}
            </div>
            {expanded[cat.key] ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </div>
          
          {expanded[cat.key] && (
            <div className="divide-y divide-gray-100">
              {loading && progress?.active && progress.buckets[cat.key] && (
                <div className="px-4 py-2 bg-white">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${
                          progress.buckets[cat.key].total
                            ? Math.round((progress.buckets[cat.key].completed / progress.buckets[cat.key].total) * 100)
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </div>
              )}
              {cat.data.tests.map((test: any, idx: number) => (
                <div key={idx} className="p-4 hover:bg-gray-50 flex items-start space-x-3">
                  <div className="mt-0.5">{getIcon(test.status)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium text-gray-900">{test.name}</h4>
                      <span className="text-xs text-gray-500">Score: {test.score}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                    {test.details && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-200 font-mono text-gray-600 overflow-x-auto">
                        {JSON.stringify(test.details, null, 2)}
                      </div>
                    )}
                    {test.documentationUrl && (
                      <a href={test.documentationUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Learn more
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
