
import React from 'react';
import { Layout } from '../../components/Layout/Layout';
import { RecommendationProvider } from './RecommendationContext';
import { useRecommendationEngine } from './hooks/useRecommendationEngine';
import { Header } from './components/Header';
import { Step1Opportunities } from './components/Step1Opportunities';
import { Step2Strategy } from './components/Step2Strategy';
import { Step3Refine } from './components/Step3Refine';
import { Step4Outcome } from './components/Step4Outcome';
import { AnimatePresence } from 'framer-motion';

interface RecommendationPageProps {
  initialStep?: number;
}

export const RecommendationPage: React.FC<RecommendationPageProps> = ({ initialStep }) => {
  const engine = useRecommendationEngine(initialStep);
  const { currentStep, error, isLoading } = engine;

  return (
    <RecommendationProvider value={engine}>
      <Layout>
        <div className="p-6 max-w-[1600px] mx-auto">
             <Header />
            
             {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                    {error}
                </div>
             )}

             {isLoading && (
                 <div className="flex justify-center py-12">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                 </div>
             )}

             {!isLoading && (
                 <AnimatePresence mode="wait">
                    {currentStep === 1 && <Step1Opportunities key="step1" />}
                    {currentStep === 2 && <Step2Strategy key="step2" />}
                    {currentStep === 3 && <Step3Refine key="step3" />}
                    {currentStep === 4 && <Step4Outcome key="step4" />}
                 </AnimatePresence>
             )}
        </div>
      </Layout>
    </RecommendationProvider>
  );
};
