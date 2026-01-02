/**
 * Main Recommendations V3 Hook
 * 
 * Manages all state and core logic for the Recommendations V3 page.
 * Extracted from RecommendationsV3.tsx to improve maintainability.
 */

import { useState, useEffect, useRef } from 'react';
import {
  generateRecommendationsV3,
  getGenerationV3,
  getRecommendationsByStepV3,
  getLatestGenerationV3,
  updateRecommendationStatusV3,
  type RecommendationV3,
  type IdentifiedKPI
} from '../../../api/recommendationsV3Api';

export interface UseRecommendationsV3Return {
  // State
  currentStep: number;
  generationId: string | null;
  kpis: IdentifiedKPI[];
  recommendations: RecommendationV3[];
  allRecommendations: RecommendationV3[]; // For Step 1 filtering
  selectedIds: Set<string>;
  completedIds: Set<string>;
  expandedSections: Map<string, { email: boolean; content: boolean }>;
  contentMap: Map<string, any>;
  statusFilter: 'all' | 'pending_review' | 'approved' | 'rejected';
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;

  // Handlers
  setCurrentStep: (step: number) => void;
  setStatusFilter: (filter: 'all' | 'pending_review' | 'approved' | 'rejected') => void;
  handleGenerate: (brandId: string) => Promise<void>;
  handleStatusChange: (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected') => Promise<void>;
  setAllRecommendations: (recs: RecommendationV3[]) => void;
  setRecommendations: (recs: RecommendationV3[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setCompletedIds: (ids: Set<string>) => void;
  setExpandedSections: (sections: Map<string, { email: boolean; content: boolean }>) => void;
  setContentMap: (map: Map<string, any>) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsGenerating: (generating: boolean) => void;
}

export function useRecommendationsV3(brandId: string | null): UseRecommendationsV3Return {
  // Core state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<IdentifiedKPI[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationV3[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<RecommendationV3[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Map<string, { email: boolean; content: boolean }>>(new Map());
  const [contentMap, setContentMap] = useState<Map<string, any>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');

  // Loading/error state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual loading flags
  const [isManuallyLoading, setIsManuallyLoading] = useState(false);
  const isManuallyNavigatingRef = useRef(false);
  const lastManuallyLoadedStepRef = useRef<number | null>(null);

  // Handle generate recommendations
  const handleGenerate = async (selectedBrandId: string) => {
    if (!selectedBrandId) {
      setError('Please select a brand first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log('🚀 [useRecommendationsV3] Starting generation for brand:', selectedBrandId);
      const response = await generateRecommendationsV3({ brandId: selectedBrandId });
      
      if (response.success && response.data) {
        const genId = response.data.generationId;
        if (genId) {
          setGenerationId(genId);
          
          // Wait for database transaction
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Fetch from database to ensure we have proper IDs
          const fullResponse = await getGenerationV3(genId);
          
          if (fullResponse.success && fullResponse.data && fullResponse.data.recommendations) {
            const recommendationsWithIds = fullResponse.data.recommendations.filter(rec => rec && rec.id && rec.action);
            if (recommendationsWithIds.length > 0) {
              setRecommendations(recommendationsWithIds);
              setAllRecommendations(recommendationsWithIds);
              setCurrentStep(1);
              setError(null);
            }
          }
        }
      } else {
        setError(response.error || 'Failed to generate recommendations');
      }
    } catch (err: any) {
      console.error('Error generating recommendations:', err);
      setError(err.message || 'Failed to generate recommendations');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected') => {
    if (!recommendationId) return;

    setError(null);

    // Optimistic update
    const updateRec = (rec: RecommendationV3) => 
      rec.id === recommendationId 
        ? { ...rec, reviewStatus: status, isApproved: status === 'approved' }
        : rec;
    
    setRecommendations(prev => prev.map(updateRec));
    setAllRecommendations(prev => prev.map(updateRec));

    try {
      const response = await updateRecommendationStatusV3(recommendationId, status);
      
      if (!response.success) {
        // Revert on error
        const revertRec = (rec: RecommendationV3) => 
          rec.id === recommendationId 
            ? { ...rec, reviewStatus: rec.reviewStatus || 'pending_review', isApproved: status === 'approved' ? false : rec.isApproved }
            : rec;
        setRecommendations(prev => prev.map(revertRec));
        setAllRecommendations(prev => prev.map(revertRec));
        setError(response.error || 'Failed to update status');
      }
    } catch (err: any) {
      console.error('Error updating recommendation status:', err);
      // Revert on error
      const revertRec = (rec: RecommendationV3) => 
        rec.id === recommendationId 
          ? { ...rec, reviewStatus: rec.reviewStatus || 'pending_review', isApproved: status === 'approved' ? false : rec.isApproved }
          : rec;
      setRecommendations(prev => prev.map(revertRec));
      setAllRecommendations(prev => prev.map(revertRec));
      setError(err.message || 'Failed to update status');
    }
  };

  // Apply status filter locally
  useEffect(() => {
    if (currentStep !== 1 || allRecommendations.length === 0) {
      return;
    }

    if (statusFilter === 'all') {
      setRecommendations([...allRecommendations]);
    } else {
      const filtered = allRecommendations.filter(rec => {
        const recStatus = rec.reviewStatus || 'pending_review';
        return recStatus === statusFilter;
      });
      setRecommendations([...filtered]);
    }
  }, [statusFilter, allRecommendations, currentStep]);

  // Load step data when step or generationId changes
  useEffect(() => {
    if (!generationId || !brandId || isManuallyLoading || isManuallyNavigatingRef.current) {
      return;
    }

    if (lastManuallyLoadedStepRef.current === currentStep) {
      setTimeout(() => {
        lastManuallyLoadedStepRef.current = null;
      }, 2000);
      return;
    }

    const loadStepData = async () => {
      if (!isManuallyLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await getRecommendationsByStepV3(generationId, currentStep);
        
        if (response.success && response.data) {
          const recommendationsWithIds = response.data.recommendations
            .filter(rec => rec.id && rec.id.length > 10)
            .map(rec => ({ ...rec, id: rec.id! }));
          
          if (currentStep === 1) {
            // Merge with existing to preserve status changes
            const mergedRecommendations = (() => {
              const existingMap = new Map(allRecommendations.map(r => [r.id, r]));
              return recommendationsWithIds.map(rec => {
                const existing = existingMap.get(rec.id);
                if (existing?.reviewStatus && existing.reviewStatus !== rec.reviewStatus) {
                  return { ...rec, reviewStatus: existing.reviewStatus, isApproved: existing.isApproved };
                }
                return rec;
              });
            })();
            
            setAllRecommendations(mergedRecommendations);
            
            // Apply current filter
            if (statusFilter === 'all') {
              setRecommendations(mergedRecommendations);
            } else {
              const filtered = mergedRecommendations.filter(rec => {
                const recStatus = rec.reviewStatus || 'pending_review';
                return recStatus === statusFilter;
              });
              setRecommendations(filtered);
            }
          } else {
            setAllRecommendations([]);
            setRecommendations(recommendationsWithIds);
          }
          setError(null);
        }
      } catch (err: any) {
        console.error('Error loading step data:', err);
        if (!err.message?.includes('timeout')) {
          setError(err.message || 'Failed to load recommendations');
        }
      } finally {
        if (!isManuallyLoading) {
          setIsLoading(false);
        }
      }
    };

    loadStepData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId, currentStep, brandId]);

  return {
    // State
    currentStep,
    generationId,
    kpis,
    recommendations,
    allRecommendations,
    selectedIds,
    completedIds,
    expandedSections,
    contentMap,
    statusFilter,
    isGenerating,
    isLoading,
    error,

    // Setters
    setCurrentStep,
    setStatusFilter,
    setAllRecommendations,
    setRecommendations,
    setSelectedIds,
    setCompletedIds,
    setExpandedSections,
    setContentMap,
    setError,
    setIsLoading,
    setIsGenerating,

    // Handlers
    handleGenerate,
    handleStatusChange
  };
}

