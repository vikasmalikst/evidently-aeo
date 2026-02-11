
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconSparkles } from '@tabler/icons-react';
import { useRecommendationContext } from '../RecommendationContext';
import { Filters } from './Filters';
import { RecommendationsTableV3 } from '../../../components/RecommendationsV3/RecommendationsTableV3';
import { OpportunityStrategyCard } from '../../../components/RecommendationsV3/components/OpportunityStrategyCard';
import { AddCustomRecommendationModal } from '../../../components/RecommendationsV3/components/AddCustomRecommendationModal';
import { createCustomRecommendationV3 } from '../../../api/recommendationsV3Api';

export const Step1Opportunities: React.FC = () => {
    const { 
        generationId, 
        recommendations, 
        handleStatusChange, 
        handleNavigate,
        selectedBrandId,
        selectBrand, // to reload
        setError
    } = useRecommendationContext();
    
    const [showAddCustomModal, setShowAddCustomModal] = useState(false);
    const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

    const handleCreateCustomRecommendation = async (recommendation: any) => {
        if (!selectedBrandId) return;
        setIsSubmittingCustom(true);
        try {
            if (!generationId) return;
            const response = await createCustomRecommendationV3(generationId, recommendation);
            if (response.success) {
                setShowAddCustomModal(false);
                // Trigger reload by re-selecting brand or invalidated cache
                // In v3 architecture, we might just reload the page or trigger a data refresh
                // For now, simpler to reuse the selectBrand trigger which reloads generation
                selectBrand(selectedBrandId); 
            } else {
                setError?.(response.error || 'Failed to create recommendation');
            }
        } catch (err: any) {
            setError?.(err.message);
        } finally {
            setIsSubmittingCustom(false);
        }
    };

    if (!generationId) {
        return (
             <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-12 text-center"
            >
              <IconSparkles size={48} className="mx-auto mb-4 text-[#00bcdc] opacity-80" />
              <h3 className="text-[20px] font-semibold text-[#1a1d29] mb-2">
                No recommendations found
              </h3>
              <p className="text-[13px] text-[#64748b] max-w-md mx-auto">
                Recommendations are generated automatically. Please check back later.
              </p>
            </motion.div>
        );
    }

    return (
        <>
            <Filters onAddCustom={() => setShowAddCustomModal(true)} />
            
            <RecommendationsTableV3
                recommendations={recommendations}
                showCheckboxes={false}
                showStatusDropdown={true}
                onStatusChange={handleStatusChange}
                renderExpandedContent={(rec) => <OpportunityStrategyCard recommendation={rec} />}
                onNavigate={handleNavigate}
            />

            <AddCustomRecommendationModal
                isOpen={showAddCustomModal}
                onClose={() => setShowAddCustomModal(false)}
                onSubmit={handleCreateCustomRecommendation}
                isSubmitting={isSubmittingCustom}
            />
        </>
    );
};
