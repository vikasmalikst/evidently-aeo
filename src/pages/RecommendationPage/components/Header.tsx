
import React from 'react';
import { CompactStepIndicator } from '../../../components/RecommendationsV3/CompactStepIndicator';
import { PremiumTabNavigator } from '../../../components/RecommendationsV3/PremiumTabNavigator';
import { useRecommendationContext } from '../RecommendationContext';

export const Header: React.FC = () => {
    const { currentStep, stepCounts, handleNavigate } = useRecommendationContext();

    return (
        <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-[24px] font-bold text-[#0f172a] tracking-tight">
                        Optimize
                    </h1>
                    <p className="text-[14px] text-[#64748b] mt-1">
                        Turn insights into action with AI-driven content recommendations
                    </p>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm overflow-hidden mb-6">
                <CompactStepIndicator
                    currentStep={currentStep}
                    onStepClick={(step) => handleNavigate(step)}
                    counts={{
                        1: stepCounts[1] || 0,
                        2: stepCounts[2] || 0,
                        3: stepCounts[3] || 0,
                        4: stepCounts[4] || 0
                    }}
                />
            </div>
            
             {/* Navigation Tabs (if needed as secondary nav) - currently using compact step indicator as primary */}
             {/* <PremiumTabNavigator ... /> */}
        </div>
    );
};
