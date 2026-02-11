
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRecommendationContext } from '../RecommendationContext';
import { getKPIsV3, type IdentifiedKPI } from '../../../api/recommendationsV3Api';

// Reusing existing Outcome components but wrapping them
// import { KPIScorecard } from '../../../components/RecommendationsV3/components/KPIScorecard';
// import { RecommendationImpactList } from '../../../components/RecommendationsV3/components/RecommendationImpactList';

export const Step4Outcome: React.FC = () => {
    const { 
        generationId,
        kpis,
        recommendations // Used to show impact list
    } = useRecommendationContext();
    
    // Step 4 is relatively simple in V3 - it shows KPIs and Impact
    const [localKpis, setLocalKpis] = useState<IdentifiedKPI[]>(kpis || []);
    
    // Refresh KPIs just in case when entering Step 4
    useEffect(() => {
        if (!generationId) return;
        const fetchKpis = async () => {
             try {
                 const res = await getKPIsV3(generationId);
                 if (res.success && res.data) {
                     setLocalKpis(res.data.kpis);
                 }
             } catch (e) {
                 console.error("Failed to refresh KPIs", e);
             }
        };
        fetchKpis();
    }, [generationId]);

    const completedRecs = recommendations.filter(r => r.isCompleted);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
        >
             <div className="mb-8">
                <h2 className="text-[20px] font-bold text-[#0f172a]">Outcome Tracker</h2>
                <p className="text-[14px] text-[#64748b] mt-1">
                    Monitor performance improvements and impact
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* KPI Scorecard */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm p-6">
                        <h3 className="text-lg font-bold text-[#0f172a] mb-4">KPI Performance</h3>
                        {localKpis.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {localKpis.map((kpi, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                         <p className="text-xs font-semibold text-slate-500 uppercase">{kpi.kpiName}</p>
                                         <div className="flex items-baseline gap-2 mt-1">
                                             <span className="text-2xl font-bold text-slate-900">{kpi.currentValue || '—'}</span>
                                             {kpi.targetValue && <span className="text-xs text-slate-400">/ {kpi.targetValue}</span>}
                                         </div>
                                         <p className="text-xs text-slate-400 mt-2">Target Date: {kpi.targetDate || 'N/A'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic">No KPIs tracked for this campaign yet.</p>
                        )}
                    </div>
                </div>

                {/* Impact List */}
                <div className="lg:col-span-1">
                     <div className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm p-6 h-full">
                        <h3 className="text-lg font-bold text-[#0f172a] mb-4">Completed Actions</h3>
                        {completedRecs.length > 0 ? (
                            <ul className="space-y-3">
                                {completedRecs.map(rec => (
                                    <li key={rec.id} className="flex gap-3 text-sm p-3 bg-green-50 rounded-lg border border-green-100">
                                        <div className="shrink-0 w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-green-700 text-xs">✓</div>
                                        <div>
                                            <p className="font-medium text-green-900">{rec.action}</p>
                                            <p className="text-green-700 text-xs mt-0.5">{new Date().toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                No actions completed yet.
                            </div>
                        )}
                     </div>
                </div>
            </div>
        </motion.div>
    );
};
