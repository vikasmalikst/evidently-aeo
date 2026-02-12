import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconTrash, IconExternalLink } from '@tabler/icons-react';
import { RecommendationV3, IdentifiedKPI } from '../../../api/recommendationsV3Api';

interface RecommendationImpactListProps {
  recommendations: RecommendationV3[];
  kpis: IdentifiedKPI[];
  onStatusChange: (id: string, status: 'removed') => void;
}

export const RecommendationImpactList: React.FC<RecommendationImpactListProps> = ({
  recommendations,
  kpis,
  onStatusChange
}) => {
  
  // Helper to find KPI current value by name pattern
  const getLiveValue = (pattern: string) => {
    const kpi = kpis.find(k => k.kpiName.toLowerCase().includes(pattern.toLowerCase()));
    return kpi?.currentValue ?? null;
  };

  const renderMetricCell = (
    baseline: string | number | null | undefined, 
    current: number | null, 
    isPercentage: boolean = false
  ) => {
    // Robustly handle baseline values
    // Ensure we don't treat 0 as false, but treat '' as invalid
    const hasBaseline = baseline !== null && baseline !== undefined && baseline !== '';
    const numBaseline = hasBaseline ? Number(baseline) : null;
    
    // Calculate difference if we have both values
    let diff = null;
    
    if (numBaseline !== null && current !== null) {
      diff = current - numBaseline;
    }

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center text-[11px] text-slate-400">
          <span className="w-16 font-medium">Baseline:</span>
          <span className="font-semibold text-slate-600">
            {numBaseline !== null ? numBaseline.toFixed(2) : '0.00'}
          </span>
        </div>
        <div className="flex items-center text-[11px]">
          <span className="w-16 font-medium text-slate-400">Current:</span>
          {current !== null ? (
            <div className="flex items-center gap-2">
              <span className={`font-bold text-[13px] ${
                diff !== null && diff > 0 ? 'text-emerald-500' : 'text-slate-900'
              }`}>
                {current.toFixed(2)}
              </span>
              {diff !== null && (
                <span className={`font-bold text-[11px] px-1.5 py-0.5 rounded ${
                  diff > 0 ? 'bg-emerald-50 text-emerald-600' : 
                  diff < 0 ? 'bg-red-50 text-red-600' : 
                  'bg-slate-50 text-slate-400'
                }`}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 italic">--</span>
          )}
        </div>
      </div>
    );
  };

  // Get live values for the columns
  const currentVisibility = getLiveValue('visibility');
  const currentSOA = getLiveValue('share') || getLiveValue('soa');
  const currentSentiment = getLiveValue('sentiment');

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Recommendation Action
              </th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Domain/Source
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[180px]">
                Visibility (Baseline / Current)
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[180px]">
                SOA % (Baseline / Current)
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[180px]">
                Sentiment (Baseline / Current)
              </th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[60px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recommendations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm font-medium">No outcomes tracked yet</p>
                    <p className="text-xs mt-1">Complete recommendations in Step 3 to see their impact here.</p>
                  </div>
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {recommendations.map((rec) => (
                  <motion.tr
                    key={rec.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Recommendation Action */}
                    <td className="px-6 py-6 align-top w-[35%]">
                      <div className="pr-4">
                        <p className="text-[13px] font-bold text-slate-800 leading-relaxed mb-2 line-clamp-3">
                          {rec.action}
                        </p>
                        {rec.completedAt && (
                          <p className="text-[11px] text-slate-400 font-medium">
                            Completed: {new Date(rec.completedAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Domain/Source */}
                    <td className="px-6 py-6 align-top text-center w-[10%]">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-100 shadow-sm">
                        <IconExternalLink size={10} className="mr-1.5" />
                        <span className="text-[10px] font-bold">{rec.citationSource || 'Link'}</span>
                      </div>
                    </td>

                    {/* Visibility */}
                    <td className="px-6 py-6 align-top w-[15%]">
                      {renderMetricCell(rec.visibilityScore, currentVisibility)}
                    </td>

                    {/* SOA */}
                    <td className="px-6 py-6 align-top w-[15%]">
                      {renderMetricCell(rec.soa, currentSOA, true)}
                    </td>

                    {/* Sentiment */}
                    <td className="px-6 py-6 align-top w-[15%]">
                      {renderMetricCell(rec.sentiment, currentSentiment)}
                    </td>

                    {/* Action */}
                    <td className="px-6 py-6 align-top text-right w-[5%]">
                      {rec.id && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to stop tracking this recommendation?')) {
                              onStatusChange(rec.id!, 'removed');
                            }
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Stop Tracking"
                        >
                          <IconTrash size={16} />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
