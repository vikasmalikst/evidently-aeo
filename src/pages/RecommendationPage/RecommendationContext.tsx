
import React, { createContext, useContext } from 'react';
import { useRecommendationEngine } from './hooks/useRecommendationEngine';

type RecommendationEngine = ReturnType<typeof useRecommendationEngine>;

const RecommendationContext = createContext<RecommendationEngine | null>(null);

export const useRecommendationContext = () => {
  const context = useContext(RecommendationContext);
  if (!context) {
    throw new Error('useRecommendationContext must be used within a RecommendationProvider');
  }
  return context;
};

interface RecommendationProviderProps {
  children: React.ReactNode;
  value: RecommendationEngine;
}

export const RecommendationProvider: React.FC<RecommendationProviderProps> = ({ children, value }) => {
  return (
    <RecommendationContext.Provider value={value}>
      {children}
    </RecommendationContext.Provider>
  );
};
