import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRecommendationContext } from '../RecommendationContext';
import { getKPIsV3, type IdentifiedKPI } from '../../../api/recommendationsV3Api';
import { RecommendationImpactList } from './RecommendationImpactList';

export const Step4Outcome: React.FC = () => {
    const { 
        generationId,
        kpis,
        recommendations,
        handleStatusChange
    } = useRecommendationContext();
    
    // Local state for KPIs to allow refreshing independently if needed
    // In V3.5 (Screenshot design), these provide the "Current" values for the table
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
             <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-slate-900">Track Outcomes</h2>
                <p className="text-sm text-slate-500">
                    Monitor the impact of your completed recommendations on key performance metrics.
                </p>
            </div>

            <RecommendationImpactList 
                recommendations={completedRecs}
                kpis={localKpis}
                onStatusChange={handleStatusChange}
            />
        </motion.div>
    );
};
