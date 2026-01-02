/**
 * Recommendations V3 Page
 * 
 * KPI-first approach with 4-step workflow:
 * Step 1: Generate & Review - All recommendations with status dropdown (Approved/Rejected/Pending Review)
 * Step 2: Approved Recommendations - Generate content for approved items
 * Step 3: Content Review - Review generated content and mark as completed
 * Step 4: Results Tracking - View KPI improvements (before/after)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { useManualBrandDashboard } from '../manual-dashboard';
import {
  generateRecommendationsV3,
  getGenerationV3,
  getRecommendationsByStepV3,
  generateContentV3,
  generateContentBulkV3,
  completeRecommendationV3,
  getKPIsV3,
  getLatestGenerationV3,
  updateRecommendationStatusV3,
  type RecommendationV3,
  type IdentifiedKPI
} from '../api/recommendationsV3Api';
import { fetchRecommendationContentLatest } from '../api/recommendationsApi';
import { StepIndicator } from '../components/RecommendationsV3/StepIndicator';
import { RecommendationsTableV3 } from '../components/RecommendationsV3/RecommendationsTableV3';
import { StatusFilter } from '../components/RecommendationsV3/components/StatusFilter';
import { IconSparkles, IconAlertCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';

export const RecommendationsV3 = () => {
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectBrand
  } = useManualBrandDashboard();

  // Helper functions to persist/restore current step in sessionStorage
  const getPersistedStep = (brandId: string | null): number => {
    if (!brandId) return 1;
    try {
      const persisted = sessionStorage.getItem(`recommendations-v3-step-${brandId}`);
      if (persisted) {
        const step = parseInt(persisted, 10);
        if (step >= 1 && step <= 4) {
          return step;
        }
      }
    } catch (e) {
      // Ignore sessionStorage errors
    }
    return 1; // Default to step 1
  };

  const persistStep = (step: number, brandId: string | null) => {
    if (!brandId) return;
    try {
      sessionStorage.setItem(`recommendations-v3-step-${brandId}`, String(step));
    } catch (e) {
      // Ignore sessionStorage errors
    }
  };

  // State
  const [currentStep, setCurrentStep] = useState<number>(() => getPersistedStep(selectedBrandId));
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<IdentifiedKPI[]>([]); // Keep for potential future use, but not displayed in UI
  const [recommendations, setRecommendations] = useState<RecommendationV3[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Map<string, { email: boolean; content: boolean }>>(new Map()); // For Step 3: track collapsed/expanded sections
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentMap, setContentMap] = useState<Map<string, any>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [allRecommendations, setAllRecommendations] = useState<RecommendationV3[]>([]); // Store all Step 1 recommendations for local filtering
  const [generatingContentIds, setGeneratingContentIds] = useState<Set<string>>(new Set()); // Track which recommendations are generating content
  const [hasGeneratedContentForStep3, setHasGeneratedContentForStep3] = useState(false); // Drives Step 3 "attention" animation after generating content
  const [hasCompletedForStep4, setHasCompletedForStep4] = useState(false); // Drives Step 4 "attention" animation after marking completed

  // Track if we're manually loading data to prevent useEffect from interfering
  const [isManuallyLoading, setIsManuallyLoading] = useState(false);
  // Use ref to track manual navigation (synchronous, avoids state batching issues)
  const isManuallyNavigatingRef = useRef(false);
  // Track the last step that was manually loaded to prevent useEffect from reloading it
  const lastManuallyLoadedStepRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!generationId || !selectedBrandId) return;
    
    // Skip loading if we're manually loading data (prevents race conditions)
    // Check both state and ref for reliability
    if (isManuallyLoading || isManuallyNavigatingRef.current) {
      console.log('⏭️ [RecommendationsV3] Skipping loadStepData - manual load in progress');
      return;
    }
    
    // Skip if we just manually loaded this exact step (prevents double loading)
    if (lastManuallyLoadedStepRef.current === currentStep) {
      console.log(`⏭️ [RecommendationsV3] Skipping loadStepData - Step ${currentStep} was just manually loaded`);
      // Clear the ref after a brief delay to allow normal loading on subsequent changes
      setTimeout(() => {
        lastManuallyLoadedStepRef.current = null;
      }, 2000);
      return;
    }

    const loadStepData = async () => {
      // Don't set isLoading if we're already loading manually (prevents UI flicker)
      if (!isManuallyLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        console.log(`📥 [RecommendationsV3] Loading Step ${currentStep} data for generation ${generationId}`);
        // For Step 1, load all recommendations (no filter) so we can filter locally by status
        // For other steps, use default backend filtering
        const response = await getRecommendationsByStepV3(generationId, currentStep);
        console.log(`📊 [RecommendationsV3] Step ${currentStep} response:`, {
          success: response.success,
          hasData: !!response.data,
          recommendationsCount: response.data?.recommendations?.length || 0,
          error: response.error,
          fullResponse: response // Log full response for debugging
        });
        
        if (response.success && response.data) {
          // Recommendations from database should already have IDs
          // Log if any are missing IDs for debugging
          const missingIds = response.data.recommendations.filter(rec => !rec.id);
          if (missingIds.length > 0) {
            console.warn(`⚠️ [RecommendationsV3] ${missingIds.length} recommendations missing IDs from database`);
          }
          
          // Only keep recommendations with valid IDs (database UUIDs)
          const recommendationsWithIds = response.data.recommendations
            .filter(rec => rec.id && rec.id.length > 10) // Filter out invalid IDs
            .map(rec => ({ ...rec, id: rec.id! })); // Ensure ID is defined
          
          console.log(`✅ [RecommendationsV3] Loaded ${recommendationsWithIds.length} recommendations for Step ${currentStep}`);
          if (currentStep === 2) {
            console.log(`📊 [RecommendationsV3] Step 2 recommendations (approved only):`, 
              recommendationsWithIds.map(r => ({ 
                id: r.id, 
                action: r.action?.substring(0, 40), 
                isApproved: r.isApproved,
                isContentGenerated: r.isContentGenerated 
              })));
            // Verify all are approved
            const notApproved = recommendationsWithIds.filter(r => !r.isApproved);
            if (notApproved.length > 0) {
              console.error(`❌ [RecommendationsV3] ERROR: Step 2 contains ${notApproved.length} unapproved recommendations!`, notApproved);
            }
          }
          
          if (recommendationsWithIds.length === 0 && response.data.recommendations.length > 0) {
            setError('Recommendations loaded but no valid IDs found. Please refresh the page.');
          } else {
            // For Step 1, store all recommendations separately for filtering
            if (currentStep === 1) {
              // Merge with existing allRecommendations to preserve any unsaved status changes
              const mergedRecommendations = (() => {
                const existingMap = new Map(allRecommendations.map(r => [r.id, r]));
                // Preserve status from existing if it exists and differs from loaded value (user changed it)
                return recommendationsWithIds.map(rec => {
                  const existing = existingMap.get(rec.id);
                  if (existing?.reviewStatus && existing.reviewStatus !== rec.reviewStatus) {
                    // User has changed status, preserve it
                    return { ...rec, reviewStatus: existing.reviewStatus, isApproved: existing.isApproved };
                  }
                  return rec;
                });
              })();
              
              setAllRecommendations(mergedRecommendations);
              // Filter will be applied by the filter useEffect when allRecommendations updates
            } else {
              // For other steps, set recommendations directly
              setAllRecommendations([]);
              setRecommendations(recommendationsWithIds);
            }
            // Clear any previous errors on successful load
            setError(null);
          }
          
          // For Step 3, load content for each recommendation
          if (currentStep === 3) {
            // Initialize all recommendations to have expanded sections by default
            const newExpandedSections = new Map(expandedSections);
            recommendationsWithIds.forEach(rec => {
              if (rec.id && !newExpandedSections.has(rec.id)) {
                // Default to both sections expanded
                newExpandedSections.set(rec.id, { email: true, content: true });
              }
            });
            setExpandedSections(newExpandedSections);
            
            const contentPromises = recommendationsWithIds
              .filter(r => r.id && r.isContentGenerated)
              .map(async (rec) => {
                try {
                  const contentResponse = await fetchRecommendationContentLatest(rec.id!);
                  if (contentResponse.success && contentResponse.data?.content) {
                    return { id: rec.id, content: contentResponse.data.content };
                  }
                } catch (err) {
                  console.error(`Error loading content for ${rec.id}:`, err);
                }
                return null;
              });
            
            const contentResults = await Promise.all(contentPromises);
            const newContentMap = new Map(contentMap);
            contentResults.forEach(result => {
              if (result) {
                newContentMap.set(result.id!, result.content);
              }
            });
            setContentMap(newContentMap);
          }
        } else {
          // If no recommendations found, set empty array instead of error
          if (response.error?.includes('not found') || response.error?.includes('No recommendations')) {
            setRecommendations([]);
            setError(null); // Clear error - empty state is not an error
          } else {
            // Only set error if it's a real error (not just empty results)
            if (response.error && !response.error.includes('No recommendations')) {
              console.error(`❌ [RecommendationsV3] Error loading Step ${currentStep}:`, response.error);
              setError(response.error);
            } else {
              // No error, just empty results
              setRecommendations([]);
              setError(null);
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading step data:', err);
        // Only set error if it's a real error (not timeout/network that might recover)
        if (!err.message?.includes('timeout') && !err.message?.includes('network') && !err.message?.includes('aborted')) {
          setError(err.message || 'Failed to load recommendations');
        } else {
          // Timeout/network errors - don't show error, just log
          console.warn('⚠️ [RecommendationsV3] Timeout/network error (non-critical):', err.message);
          setError(null); // Clear any previous errors
        }
      } finally {
        // Only clear loading if we're not manually loading
        if (!isManuallyLoading) {
          setIsLoading(false);
        }
      }
    };

    loadStepData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId, currentStep, selectedBrandId]);

  // Apply status filter locally instead of reloading (prevents overwriting status changes)
  useEffect(() => {
    // Only apply filter on Step 1
    if (currentStep !== 1) {
      return;
    }

    // If no recommendations yet, clear the filtered list and wait for data to load
    if (allRecommendations.length === 0) {
      setRecommendations([]);
      return;
    }

    // Apply the filter
    if (statusFilter === 'all') {
      // Show all recommendations when filter is "all"
      setRecommendations([...allRecommendations]);
    } else {
      // Filter locally by status
      const filtered = allRecommendations.filter(rec => {
        const recStatus = rec.reviewStatus || 'pending_review';
        return recStatus === statusFilter;
      });
      setRecommendations([...filtered]);
    }
  }, [statusFilter, allRecommendations, currentStep]);

  // Restore persisted step when selectedBrandId changes (e.g., brand switch)
  useEffect(() => {
    if (selectedBrandId) {
      const persistedStep = getPersistedStep(selectedBrandId);
      setCurrentStep(persistedStep);
    }
  }, [selectedBrandId]);

  // Update persisted step whenever currentStep changes (for the current brand)
  useEffect(() => {
    if (selectedBrandId && currentStep >= 1 && currentStep <= 4) {
      persistStep(currentStep, selectedBrandId);
    }
  }, [currentStep, selectedBrandId]);

  // Handle brand switching with proper state cleanup
  const handleBrandSwitch = useCallback((newBrandId: string) => {
    console.log(`🔄 [RecommendationsV3] Switching from brand ${selectedBrandId} to ${newBrandId}`);
    
    // Clear all state related to the current brand
    setGenerationId(null);
    setRecommendations([]);
    setAllRecommendations([]); // Clear all recommendations cache
    setSelectedIds(new Set());
    setContentMap(new Map());
    setExpandedSections(new Map());
    setError(null);
    setStatusFilter('all'); // Reset filter
    
    // Load persisted step for new brand, or default to 1
    const newStep = getPersistedStep(newBrandId);
    setCurrentStep(newStep);
    
    // Now update the brand - this will trigger loadLatestGeneration
    selectBrand(newBrandId);
  }, [selectedBrandId, selectBrand]);
  
  // Load latest generation on mount or when brand changes
  useEffect(() => {
    if (!selectedBrandId) return;

    const loadLatestGeneration = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('📥 [RecommendationsV3] Loading latest generation for brand:', selectedBrandId);
        const response = await getLatestGenerationV3(selectedBrandId);
        
        if (response.success && response.data && response.data.generationId) {
          const genId = response.data.generationId;
          
          // Check if this is a different generation than what we currently have
          const isDifferentGeneration = genId !== generationId;
          
          if (isDifferentGeneration) {
            console.log(`🔄 [RecommendationsV3] Switching to generation ${genId} (previous: ${generationId})`);
            setGenerationId(genId);
            
            if (response.data.recommendations && response.data.recommendations.length > 0) {
              // Ensure all recommendations have IDs
              const recommendationsWithIds = response.data.recommendations
                .filter(rec => rec.id && rec.id.length > 10)
                .map(rec => ({ ...rec, id: rec.id! }));
              
              if (recommendationsWithIds.length > 0) {
                setKpis(response.data.kpis || []);
                
                // Don't auto-change step - use persisted step or keep current step
                // The user's current step selection should be respected
                console.log(`✅ [RecommendationsV3] Loaded generation ${genId}, keeping step ${currentStep}`);
                
                setError(null);
                // Clear selections when switching brands/generations
                setSelectedIds(new Set());
              }
            }
          }
        } else {
          // No previous generation found - this is fine, user can generate new ones
          console.log('📭 [RecommendationsV3] No previous generation found for this brand');
          setRecommendations([]);
          setGenerationId(null);
          setCurrentStep(1); // Reset to step 1 when no generation
          persistStep(1, selectedBrandId);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading latest generation:', err);
        setError(null); // Clear error on catch to prevent stale error messages
      } finally {
        setIsLoading(false);
      }
    };

    loadLatestGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId]); // Run when brand changes or on mount

  // Load KPIs when generation is available
  useEffect(() => {
    if (!generationId) return;

    const loadKPIs = async () => {
      try {
        const response = await getKPIsV3(generationId);
        if (response.success && response.data) {
          setKpis(response.data.kpis);
        }
      } catch (err) {
        console.error('Error loading KPIs:', err);
      }
    };

    loadKPIs();
  }, [generationId]);

  // Load content when step 3 is active
  useEffect(() => {
    if (currentStep !== 3 || !generationId || recommendations.length === 0) return;

    const loadContent = async () => {
      const newContentMap = new Map(contentMap);
      const contentPromises = recommendations.map(async (rec: RecommendationV3) => {
        if (rec.id && !newContentMap.has(rec.id)) {
          try {
            const contentResponse = await fetchRecommendationContentLatest(rec.id);
            if (contentResponse?.success && contentResponse.data?.content) {
              newContentMap.set(rec.id, contentResponse.data.content);
            }
          } catch (err) {
            console.error(`Error loading content for ${rec.id}:`, err);
          }
        }
      });
      await Promise.all(contentPromises);
      setContentMap(newContentMap);
    };

    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, generationId, recommendations]);

  // Handle generate recommendations
  const handleGenerate = async () => {
    if (!selectedBrandId) {
      setError('Please select a brand first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log('🚀 [RecommendationsV3] Starting generation for brand:', selectedBrandId);
      const response = await generateRecommendationsV3({ brandId: selectedBrandId });
      
      console.log('📊 [RecommendationsV3] Generation response:', {
        success: response.success,
        hasData: !!response.data,
        hasGenerationId: !!response.data?.generationId,
        hasRecommendations: !!response.data?.recommendations,
        recommendationsCount: response.data?.recommendations?.length || 0,
        error: response.error
      });
      
      // Use data directly from generate response (no need for second API call)
      if (response.success && response.data) {
        const genId = response.data.generationId;
        if (genId) {
          console.log('✅ [RecommendationsV3] Setting generationId:', genId);
          setGenerationId(genId);
          
          // Set manual loading flags to prevent useEffect from interfering
          isManuallyNavigatingRef.current = true;
          setIsManuallyLoading(true);
          
          // ALWAYS fetch from database to ensure we have the latest data with proper IDs
          console.log('📥 [RecommendationsV3] Fetching recommendations from database to ensure we have latest data...');
          // Longer delay to ensure database transaction is fully committed
          // The backend saves recommendations, so we need to wait for the transaction
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const fullResponse = await getGenerationV3(genId);
          console.log('📊 [RecommendationsV3] Database fetch response:', {
            success: fullResponse.success,
            hasData: !!fullResponse.data,
            hasRecommendations: !!fullResponse.data?.recommendations,
            recommendationsCount: fullResponse.data?.recommendations?.length || 0,
            error: fullResponse.error,
            fullResponse: fullResponse // Log full response for debugging
          });
          
          if (fullResponse.success && fullResponse.data && fullResponse.data.recommendations) {
            const recommendationsWithIds = fullResponse.data.recommendations.filter(rec => rec && rec.id && rec.action);
            if (recommendationsWithIds.length > 0) {
              console.log(`✅ [RecommendationsV3] Setting ${recommendationsWithIds.length} recommendations from database`);
              console.log(`📊 [RecommendationsV3] Recommendation IDs:`, recommendationsWithIds.map(r => r.id));
              setRecommendations(recommendationsWithIds);
              setAllRecommendations(recommendationsWithIds); // Store all for filtering
              setCurrentStep(1);
              setSelectedIds(new Set());
              setError(null);
            } else {
              console.warn('⚠️ [RecommendationsV3] No valid recommendations found in database');
              // Fallback to response data
              if (response.data.recommendations && response.data.recommendations.length > 0) {
                const recsToSet = response.data.recommendations.filter(rec => rec && rec.id && rec.action);
                if (recsToSet.length > 0) {
                  console.log(`✅ [RecommendationsV3] Using ${recsToSet.length} recommendations from response (fallback)`);
                  setRecommendations(recsToSet);
                  setAllRecommendations(recsToSet); // Store all for filtering
                  setCurrentStep(1);
                  setError(null);
                } else {
                  setError('Recommendations generated but could not be loaded. Please refresh the page.');
                }
              } else {
                setError('Recommendations generated but could not be loaded. Please refresh the page.');
              }
            }
          } else {
            console.warn('⚠️ [RecommendationsV3] Failed to fetch from database, trying response data...');
            console.warn('⚠️ [RecommendationsV3] Full response details:', JSON.stringify(fullResponse, null, 2));
            // Fallback to response data if database fetch fails
            if (response.data.recommendations && response.data.recommendations.length > 0) {
              const recsToSet = response.data.recommendations.filter(rec => rec && rec.id && rec.action);
              if (recsToSet.length > 0) {
                console.log(`✅ [RecommendationsV3] Using ${recsToSet.length} recommendations from response (fallback)`);
                setRecommendations(recsToSet);
                setCurrentStep(1);
                setSelectedIds(new Set());
                setError(null);
              } else {
                setError('Recommendations generated but could not be loaded. Please refresh the page.');
              }
            } else {
              setError('Recommendations generated but could not be loaded. Please refresh the page.');
            }
          }
          
          // Clear manual loading flags after a short delay to allow state to settle
          setTimeout(() => {
            setIsManuallyLoading(false);
            isManuallyNavigatingRef.current = false;
          }, 100);
        } else {
          // No generationId received
          console.error('❌ [RecommendationsV3] Generation completed but no generationId received');
          setError('Generation completed but no generation ID received. Please try again.');
        }
      } else {
        // Check if error is timeout - if so, try to fetch latest generation
        if (response.error?.includes('timeout') || response.error?.includes('timed out')) {
          setError('Generation is taking longer than expected. Please wait a moment and refresh, or check if recommendations were generated.');
        } else {
          setError(response.error || 'Failed to generate recommendations');
        }
      }
    } catch (err: any) {
      console.error('Error generating recommendations:', err);
      const errorMsg = err.message || 'Failed to generate recommendations';
      
      // If timeout, try to poll for latest generation
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        setError('Generation is taking longer than expected. Checking for completed generation...');
        // Try to find the latest generation for this brand
        await pollForLatestGeneration(selectedBrandId);
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Poll for generation completion
  const pollForGeneration = async (genId: string, attempt: number = 0, maxAttempts: number = 10) => {
    if (attempt >= maxAttempts) {
      setError('Generation is taking longer than expected. Please refresh the page in a moment.');
      return;
    }

    // Wait before polling (exponential backoff: 2s, 4s, 6s, etc.)
    await new Promise(resolve => setTimeout(resolve, 2000 + (attempt * 2000)));

    try {
      const response = await getGenerationV3(genId);
      if (response.success && response.data) {
        if (response.data.recommendations && response.data.recommendations.length > 0) {
          setKpis(response.data.kpis || []);
          // Ensure all recommendations have IDs
          const recommendationsWithIds = response.data.recommendations.map((rec, idx) => ({
            ...rec,
            id: rec.id || `rec-${genId}-${idx}-${Date.now()}`
          }));
          setRecommendations(recommendationsWithIds);
          setCurrentStep(1);
          setSelectedIds(new Set());
          setError(null);
        } else {
          // Still no data, poll again
          await pollForGeneration(genId, attempt + 1, maxAttempts);
        }
      } else {
        // Poll again
        await pollForGeneration(genId, attempt + 1, maxAttempts);
      }
    } catch (err) {
      console.error('Error polling for generation:', err);
      // Poll again
      await pollForGeneration(genId, attempt + 1, maxAttempts);
    }
  };

  // Poll for latest generation by brand
  const pollForLatestGeneration = async (brandId: string, attempt: number = 0, maxAttempts: number = 5) => {
    if (attempt >= maxAttempts) {
      setError('Unable to find completed generation. Please try generating again.');
      return;
    }

    // Wait before polling (exponential backoff: 3s, 5s, 7s, etc.)
    await new Promise(resolve => setTimeout(resolve, 3000 + (attempt * 2000)));

    try {
      const response = await getLatestGenerationV3(brandId);
      
      if (response.success && response.data) {
        if (response.data.recommendations && response.data.recommendations.length > 0) {
          setGenerationId(response.data.generationId);
          setKpis(response.data.kpis || []);
          // Ensure all recommendations have IDs
          const recommendationsWithIds = response.data.recommendations.map((rec, idx) => ({
            ...rec,
            id: rec.id || `rec-${response.data?.generationId || 'latest'}-${idx}-${Date.now()}`
          }));
          setRecommendations(recommendationsWithIds);
          setCurrentStep(1);
          setSelectedIds(new Set());
          setError(null);
          return;
        } else {
          // Still no data, poll again
          await pollForLatestGeneration(brandId, attempt + 1, maxAttempts);
        }
      } else {
        // Poll again
        await pollForLatestGeneration(brandId, attempt + 1, maxAttempts);
      }
    } catch (err) {
      console.error('Error polling for latest generation:', err);
      // Poll again
      await pollForLatestGeneration(brandId, attempt + 1, maxAttempts);
    }
  };

  // Handle status change for a recommendation
  const handleStatusChange = async (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected') => {
    if (!recommendationId) return;

    setError(null);

    // Optimistically update UI immediately in both filtered and all recommendations
    // Only update reviewStatus - this is the single source of truth synced with database
    const updateRec = (rec: RecommendationV3) => 
      rec.id === recommendationId 
        ? { ...rec, reviewStatus: status }
        : rec;
    
    setRecommendations(prev => prev.map(updateRec));
    setAllRecommendations(prev => prev.map(updateRec));

    try {
      console.log(`📝 [RecommendationsV3] Updating status for ${recommendationId} to ${status}`);
      const response = await updateRecommendationStatusV3(recommendationId, status);
      
      if (response.success) {
        console.log(`✅ [RecommendationsV3] Successfully updated status for ${recommendationId}`);
        // Status already updated optimistically, no need to update again
      } else {
        // Revert optimistic update on error - restore previous reviewStatus
        const revertRec = (rec: RecommendationV3) => 
          rec.id === recommendationId 
            ? { ...rec, reviewStatus: rec.reviewStatus || 'pending_review' }
            : rec;
        setRecommendations(prev => prev.map(revertRec));
        setAllRecommendations(prev => prev.map(revertRec));
        setError(response.error || 'Failed to update status');
      }
    } catch (err: any) {
      console.error('Error updating recommendation status:', err);
      // Revert optimistic update on error - restore previous reviewStatus
      const revertRec = (rec: RecommendationV3) => 
        rec.id === recommendationId 
          ? { ...rec, reviewStatus: rec.reviewStatus || 'pending_review' }
          : rec;
      setRecommendations(prev => prev.map(revertRec));
      setAllRecommendations(prev => prev.map(revertRec));
      setError(err.message || 'Failed to update status');
    }
  };

  // Note: Approval now happens automatically when user changes status to "approved" via dropdown
  // The handleStatusChange function handles updating the status, which automatically sets is_approved = true

  // Handle generate content for all approved recommendations (Step 2 → Step 3)
  const handleGenerateContentBulk = async () => {
    if (!generationId) {
      setError('No generation ID found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📝 [RecommendationsV3] Generating content for all approved recommendations...');
      const response = await generateContentBulkV3(generationId);
      
      console.log('📊 [RecommendationsV3] Bulk content generation response:', {
        success: response.success,
        hasData: !!response.data,
        total: response.data?.total,
        successful: response.data?.successful,
        failed: response.data?.failed,
        error: response.error
      });
      
      if (response.success && response.data) {
        const { total, successful, failed, results } = response.data;
        
        console.log(`✅ [RecommendationsV3] Generated content: ${successful}/${total} successful, ${failed} failed`);
        
        // Store all generated content in contentMap
        const newContentMap = new Map(contentMap);
        results.forEach((result: any) => {
          if (result.success && result.content) {
            // Content can be either a parsed JSON object or raw text string
            // Store it as-is (the UI handles both cases)
            try {
              // Try to parse if it's a JSON string
              if (typeof result.content === 'string' && result.content.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(result.content);
                  newContentMap.set(result.recommendationId, parsed);
                } catch {
                  // Not valid JSON, store as string
                  newContentMap.set(result.recommendationId, result.content);
                }
              } else if (typeof result.content === 'object') {
                // Already an object (parsed JSON or database record)
                // If it has a .content property, extract it (this is the actual content from DB)
                if (result.content.content !== undefined) {
                  // The .content property contains the JSON string or parsed object
                  if (typeof result.content.content === 'string') {
                    try {
                      const parsed = JSON.parse(result.content.content);
                      // Store the parsed content directly (it's the structured JSON)
                      newContentMap.set(result.recommendationId, parsed);
                    } catch {
                      // Not valid JSON, store the string
                      newContentMap.set(result.recommendationId, result.content.content);
                    }
                  } else {
                    // Already parsed, store directly
                    newContentMap.set(result.recommendationId, result.content.content);
                  }
                } else {
                  // No .content property, might be the parsed JSON directly
                  newContentMap.set(result.recommendationId, result.content);
                }
              } else {
                // String content
                newContentMap.set(result.recommendationId, result.content);
              }
            } catch (err) {
              console.error(`Error processing content for ${result.recommendationId}:`, err);
              // Store as-is anyway
              newContentMap.set(result.recommendationId, result.content);
            }
          }
        });
        setContentMap(newContentMap);
        console.log(`📊 [RecommendationsV3] Stored ${newContentMap.size} content items in contentMap`);
        
        // Reload step 2 data to see updated state
        if (generationId) {
          const step2Response = await getRecommendationsByStepV3(generationId, 2);
          if (step2Response.success && step2Response.data) {
            setRecommendations(step2Response.data.recommendations);
          }
        }
        
        // Set manual loading flags to prevent useEffect from interfering
        isManuallyNavigatingRef.current = true;
        setIsManuallyLoading(true);
        
        // Move to step 3 to show all generated content
        if (successful > 0) {
          // Small delay to ensure database transactions are committed
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Load step 3 data to ensure we have all content
          // Mark Step 3 as manually loaded to prevent useEffect from reloading
          setIsManuallyLoading(true);
          isManuallyNavigatingRef.current = true;
          lastManuallyLoadedStepRef.current = 3;
          
          const step3Response = await getRecommendationsByStepV3(generationId, 3);
          if (step3Response.success && step3Response.data) {
            const step3Recs = step3Response.data.recommendations;
            setRecommendations(step3Recs);
            
            // Initialize all recommendations to have expanded sections by default
            const newExpandedSections = new Map(expandedSections);
            step3Recs.forEach(rec => {
              if (rec.id && !newExpandedSections.has(rec.id)) {
                // Default to both sections expanded
                newExpandedSections.set(rec.id, { email: true, content: true });
              }
            });
            setExpandedSections(newExpandedSections);
            
            // Load content for all recommendations (with better error handling)
            const contentPromises = step3Recs.map(async (rec: RecommendationV3) => {
              if (rec.id) {
                try {
                  // First check if we already have it from the bulk response
                  if (newContentMap.has(rec.id)) {
                    return; // Already have it
                  }
                  
                  // Otherwise fetch from API
                  const contentResponse = await fetchRecommendationContentLatest(rec.id);
                  if (contentResponse?.success && contentResponse.data?.content) {
                    // contentResponse.data.content is RecommendationGeneratedContent
                    // It has a .content property that contains the JSON string or parsed object
                    const contentRecord = contentResponse.data.content as any;
                    let contentToStore: any = null;
                    
                    // The content record has structure: { id, content: "<JSON string>", ... }
                    if (contentRecord.content !== undefined) {
                      // Content is stored in .content property as a JSON string
                      const rawContent = contentRecord.content;
                      if (typeof rawContent === 'string') {
                        try {
                          // Parse the JSON string to get the structured content
                          contentToStore = JSON.parse(rawContent);
                        } catch {
                          // Not valid JSON, use as string
                          contentToStore = rawContent;
                        }
                      } else {
                        // Already parsed
                        contentToStore = rawContent;
                      }
                    } else {
                      // No .content property, use the record itself
                      contentToStore = contentRecord;
                    }
                    
                    if (contentToStore) {
                      newContentMap.set(rec.id, contentToStore);
                    }
                  }
                } catch (err) {
                  console.error(`Error loading content for ${rec.id}:`, err);
                  // Don't throw - continue loading other content
                }
              }
            });
            await Promise.all(contentPromises);
            setContentMap(newContentMap);
            
            // Move to step 3 after content is loaded
            setCurrentStep(3);
            setError(null);
          }
        }
        
        // Clear manual loading flags
        setTimeout(() => {
          setIsManuallyLoading(false);
          isManuallyNavigatingRef.current = false;
        }, 300);
        
        if (failed > 0) {
          // Show warning but don't treat as error if some succeeded
          console.warn(`⚠️ [RecommendationsV3] ${failed} recommendation(s) failed to generate content. ${successful} succeeded.`);
          // Don't set error if at least some succeeded - just show a warning message
          if (successful === 0) {
            setError(`${failed} recommendation(s) failed to generate content.`);
          } else {
            // Clear any previous errors since we have successful generations
            setError(null);
          }
        } else {
          // All succeeded - clear any errors
          setError(null);
        }
      } else {
        // Response was not successful - log details
        console.error('❌ [RecommendationsV3] Bulk content generation failed:', {
          success: response.success,
          error: response.error,
          hasData: !!response.data
        });
        setError(response.error || 'Failed to generate content');
        
        // Even if response.success is false, check if we have partial results
        if (response.data && response.data.successful > 0) {
          console.log(`⚠️ [RecommendationsV3] Partial success: ${response.data.successful} succeeded, loading Step 3 anyway...`);
          // Try to load step 3 to show what was generated
          try {
            lastManuallyLoadedStepRef.current = 3;
            isManuallyNavigatingRef.current = true;
            setIsManuallyLoading(true);
            const step3Response = await getRecommendationsByStepV3(generationId, 3);
            if (step3Response.success && step3Response.data && step3Response.data.recommendations.length > 0) {
              setRecommendations(step3Response.data.recommendations);
              setCurrentStep(3);
            }
            setTimeout(() => {
              setIsManuallyLoading(false);
              isManuallyNavigatingRef.current = false;
            }, 300);
          } catch (loadErr) {
            console.error('Error loading step 3 after partial failure:', loadErr);
            setIsManuallyLoading(false);
            isManuallyNavigatingRef.current = false;
          }
        }
      }
    } catch (err: any) {
      console.error('❌ [RecommendationsV3] Exception in bulk content generation:', err);
      // Check if it's a timeout error
      if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        setError('Content generation is taking longer than expected. Some content may have been generated. Please check Step 3.');
        // Try to load step 3 anyway in case some content was generated
        if (generationId) {
          try {
            lastManuallyLoadedStepRef.current = 3;
            isManuallyNavigatingRef.current = true;
            setIsManuallyLoading(true);
            const step3Response = await getRecommendationsByStepV3(generationId, 3);
            if (step3Response.success && step3Response.data && step3Response.data.recommendations.length > 0) {
              setRecommendations(step3Response.data.recommendations);
              setCurrentStep(3);
            }
            setTimeout(() => {
              setIsManuallyLoading(false);
              isManuallyNavigatingRef.current = false;
            }, 300);
          } catch (loadErr) {
            console.error('Error loading step 3 after timeout:', loadErr);
            setIsManuallyLoading(false);
            isManuallyNavigatingRef.current = false;
          }
        }
      } else {
        setError(err.message || 'Failed to generate content');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle generate content for single recommendation
  const handleGenerateContent = async (recommendation: RecommendationV3, action: string) => {
    if (!recommendation.id || action !== 'generate-content') return;
    if (generatingContentIds.has(recommendation.id)) return; // Prevent duplicate requests

    // Add to generating set
    setGeneratingContentIds(prev => new Set(prev).add(recommendation.id!));
    setError(null);

    try {
      console.log(`📝 [RecommendationsV3] Generating content for recommendation ${recommendation.id}...`);
      const response = await generateContentV3(recommendation.id);
      
      if (response.success && response.data) {
        console.log(`✅ [RecommendationsV3] Content generated successfully for ${recommendation.id}`);
        
        // Store content in contentMap (for Step 3)
        setContentMap(prev => new Map(prev).set(recommendation.id!, response.data.content));

        // UX: Once content is generated, make Step 3 "light up" and navigate to it
        setHasGeneratedContentForStep3(true);
        setRecommendations(prev => prev.filter(rec => rec.id !== recommendation.id));

        // Navigate to Step 3 immediately after content generation
        if (generationId) {
          isManuallyNavigatingRef.current = true;
          setIsManuallyLoading(true);
          lastManuallyLoadedStepRef.current = 3;
          
          try {
            const step3Response = await getRecommendationsByStepV3(generationId, 3);
            if (step3Response.success && step3Response.data) {
              const recommendationsWithIds = step3Response.data.recommendations
                .filter(rec => rec.id && rec.id.length > 10)
                .map(rec => ({ ...rec, id: rec.id! }));
              
              // Initialize expanded sections for Step 3 recommendations
              const newExpandedSections = new Map(expandedSections);
              recommendationsWithIds.forEach(rec => {
                if (rec.id && !newExpandedSections.has(rec.id)) {
                  newExpandedSections.set(rec.id, { email: true, content: true });
                }
              });
              setExpandedSections(newExpandedSections);
              
              setRecommendations(recommendationsWithIds);
              setCurrentStep(3);
              setHasGeneratedContentForStep3(false); // Clear the attention animation
              setError(null);
            }
          } catch (loadErr) {
            console.error('Error loading step 3 after content generation:', loadErr);
          } finally {
            setIsManuallyLoading(false);
            isManuallyNavigatingRef.current = false;
          }
        }
      } else {
        setError(response.error || 'Failed to generate content');
      }
    } catch (err: any) {
      console.error('Error generating content:', err);
      setError(err.message || 'Failed to generate content');
    } finally {
      // Remove from generating set
      setGeneratingContentIds(prev => {
        const next = new Set(prev);
        next.delete(recommendation.id!);
        return next;
      });
    }
  };

  // Handle toggle completion - optimistically navigate to Step 4, then complete in background
  const handleToggleComplete = async (recommendation: RecommendationV3) => {
    if (!recommendation.id || recommendation.isCompleted) return;
    
    setError(null);
    
    // Capture IDs before async operations
    const currentGenerationId = generationId;
    const recommendationIdToComplete = recommendation.id;
    if (!recommendationIdToComplete || !currentGenerationId) return;
    
    // Optimistically mark as completed and navigate to Step 4 immediately
    const optimisticRec = { 
      ...recommendation, 
      isCompleted: true, 
      completedAt: new Date().toISOString(),
      reviewStatus: 'approved' as const, // Ensure it's marked as approved for Step 4 filtering
      isApproved: true
    };
    
    // Navigate to Step 4 immediately (optimistic navigation)
    isManuallyNavigatingRef.current = true;
    setIsManuallyLoading(true);
    lastManuallyLoadedStepRef.current = 4;
    
    try {
      // Load Step 4 data
      const step4Response = await getRecommendationsByStepV3(currentGenerationId, 4);
      
      if (step4Response.success && step4Response.data) {
        const recommendationsWithIds = step4Response.data.recommendations
          .filter(rec => rec.id && rec.id.length > 10)
          .map(rec => ({ ...rec, id: rec.id! }));
        
        // Include the optimistically completed recommendation if it's not already in the list
        const hasOptimisticRec = recommendationsWithIds.some(r => r.id === recommendationIdToComplete);
        const finalRecommendations = hasOptimisticRec 
          ? recommendationsWithIds 
          : [...recommendationsWithIds, optimisticRec];
        
        setRecommendations(finalRecommendations);
        setCurrentStep(4);
        setHasCompletedForStep4(false);
        setError(null);
        console.log(`✅ [RecommendationsV3] Navigated to Step 4 with ${finalRecommendations.length} recommendations`);
      } else {
        // If Step 4 load fails, still show the optimistic recommendation
        setRecommendations([optimisticRec]);
        setCurrentStep(4);
        setError(null);
      }
    } catch (loadErr: any) {
      console.error('Error loading step 4:', loadErr);
      // On error, still navigate and show optimistic recommendation
      setRecommendations([optimisticRec]);
      setCurrentStep(4);
      setError(null);
    } finally {
      setIsManuallyLoading(false);
      isManuallyNavigatingRef.current = false;
    }
    
    // Complete the recommendation in the background (API call)
    // This ensures the database is updated with correct kpiBeforeValue
    (async () => {
      try {
        console.log(`📝 [RecommendationsV3] Completing recommendation ${recommendationIdToComplete} in background...`);
        const response = await completeRecommendationV3(recommendationIdToComplete);
        
        if (response.success) {
          console.log(`✅ [RecommendationsV3] Successfully completed recommendation ${recommendationIdToComplete} (background)`);
          // Reload Step 4 to get the latest data with correct completedAt timestamp and kpiBeforeValue
          if (currentGenerationId) {
            getRecommendationsByStepV3(currentGenerationId, 4).then(step4Response => {
              if (step4Response.success && step4Response.data) {
                const recommendationsWithIds = step4Response.data.recommendations
                  .filter(rec => rec.id && rec.id.length > 10)
                  .map(rec => ({ ...rec, id: rec.id! }));
                setRecommendations(recommendationsWithIds);
                console.log(`✅ [RecommendationsV3] Reloaded Step 4 with ${recommendationsWithIds.length} recommendations after completion`);
              }
            }).catch(err => console.error('Error reloading Step 4:', err));
          }
        } else {
          console.error('Failed to complete recommendation:', response.error);
          setError(response.error || 'Failed to complete recommendation');
          // Revert optimistic update on failure
          setRecommendations(prev => prev.filter(r => r.id !== recommendationIdToComplete));
        }
      } catch (err: any) {
        console.error('Error completing recommendation:', err);
        setError(err.message || 'Failed to complete recommendation');
        // Revert optimistic update on failure
        setRecommendations(prev => prev.filter(r => r.id !== recommendationIdToComplete));
      }
    })();
  };


  // Handle select recommendation
  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(recommendations.filter(r => r.id).map(r => r.id!)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Loading state
  if (brandsLoading || isLoading) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-10 flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full border-2 border-t-transparent border-[#00bcdc] animate-spin mb-4" />
            <p className="text-[14px] text-[#64748b]">
              {brandsLoading ? 'Loading brands...' : 'Loading recommendations...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state for brands
  if (brandsError || brands.length === 0) {
    return (
      <Layout>
        <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 text-[#ef4444] mb-4">
              <IconAlertCircle size={20} />
              <p className="text-[14px] font-medium">Unable to load brands</p>
            </div>
            <p className="text-[13px] text-[#64748b]">
              {brandsError || 'No brands found. Please complete brand onboarding first.'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        {/* Header */}
        <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-[24px] font-bold text-[#1a1d29] mb-1">Recommendations</h1>
              <p className="text-[13px] text-[#64748b]">
                KPI-first approach with 4-step workflow
              </p>
            </div>
            <div className="flex items-center gap-3">
              {brands && brands.length > 1 && (
                <select
                  value={selectedBrandId || ''}
                  onChange={(e) => handleBrandSwitch(e.target.value)}
                  className="px-3 py-2 border border-[#e8e9ed] rounded-md text-[13px] text-[#1a1d29] bg-white focus:outline-none focus:ring-2 focus:ring-[#00bcdc] focus:border-transparent"
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedBrandId}
                className="px-4 py-2 bg-[#00bcdc] text-white rounded-md text-[13px] font-medium hover:bg-[#0096b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <IconSparkles size={16} />
                    Generate Recommendations
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step Indicator */}
          {generationId && (
            <div className="mb-6">
              <StepIndicator
                currentStep={currentStep}
                attentionSteps={{
                  2: (() => {
                    const sourceArray = allRecommendations.length > 0 ? allRecommendations : recommendations;
                    const approvedCount = sourceArray.filter(
                      rec => (rec.reviewStatus || 'pending_review') === 'approved'
                    ).length;
                    return currentStep === 1 && approvedCount > 0;
                  })(),
                  3: currentStep <= 2 && hasGeneratedContentForStep3,
                  4: currentStep <= 3 && hasCompletedForStep4
                }}
                onStepClick={async (step) => {
                  // Set manual loading flags
                  isManuallyNavigatingRef.current = true;
                  setIsManuallyLoading(true);
                  lastManuallyLoadedStepRef.current = step;
                  
                  try {
                    setIsLoading(true);
                    setError(null);
                    console.log(`📥 [RecommendationsV3] Manual step navigation to Step ${step}`);
                    const response = await getRecommendationsByStepV3(generationId, step);
                    if (response.success && response.data) {
                      const recommendationsWithIds = response.data.recommendations
                        .filter(rec => rec.id && rec.id.length > 10)
                        .map(rec => ({ ...rec, id: rec.id! }));
                      
                      console.log(`✅ [RecommendationsV3] Loaded ${recommendationsWithIds.length} recommendations for Step ${step}`);
                      
                      setRecommendations(recommendationsWithIds);
                      setError(null);
                      
                      // Load content for Step 3
                      if (step === 3) {
                        setHasGeneratedContentForStep3(false);
                        const newExpandedSections = new Map(expandedSections);
                        recommendationsWithIds.forEach(rec => {
                          if (rec.id && !newExpandedSections.has(rec.id)) {
                            newExpandedSections.set(rec.id, { email: true, content: true });
                          }
                        });
                        setExpandedSections(newExpandedSections);
                        
                        const contentPromises = recommendationsWithIds
                          .filter(r => r.id && r.isContentGenerated)
                          .map(async (rec) => {
                            try {
                              const contentResponse = await fetchRecommendationContentLatest(rec.id!);
                              if (contentResponse.success && contentResponse.data?.content) {
                                return { id: rec.id, content: contentResponse.data.content };
                              }
                            } catch (err) {
                              console.error(`Error loading content for ${rec.id}:`, err);
                            }
                            return null;
                          });
                        
                        const contentResults = await Promise.all(contentPromises);
                        const newContentMap = new Map(contentMap);
                        contentResults.forEach(result => {
                          if (result) {
                            newContentMap.set(result.id!, result.content);
                          }
                        });
                        setContentMap(newContentMap);
                      }

                      // Clear "completed" attention once user visits Step 4
                      if (step === 4) {
                        setHasCompletedForStep4(false);
                      }
                      
                      setCurrentStep(step);
                    } else {
                      setRecommendations([]);
                      setCurrentStep(step);
                      if (response.error && !response.error.includes('not found') && !response.error.includes('No recommendations')) {
                        setError(response.error);
                      }
                    }
                  } catch (err: any) {
                    console.error('Error loading step data:', err);
                    setError(err.message || 'Failed to load recommendations');
                    setCurrentStep(step);
                  } finally {
                    setIsLoading(false);
                    setTimeout(() => {
                      setIsManuallyLoading(false);
                      isManuallyNavigatingRef.current = false;
                    }, 300);
                  }
                }}
              />
            </div>
          )}

        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 mb-6 flex items-center gap-3">
            <IconAlertCircle size={20} className="text-[#ef4444] flex-shrink-0" />
            <p className="text-[13px] text-[#991b1b]">{error}</p>
          </div>
        )}

        {/* Step Content */}
        {!generationId ? (
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-12 text-center">
            <IconSparkles size={48} className="mx-auto mb-4 text-[#00bcdc] opacity-80" />
            <h3 className="text-[20px] font-semibold text-[#1a1d29] mb-2">
              Ready to generate recommendations
            </h3>
            <p className="text-[13px] text-[#64748b] max-w-md mx-auto">
              Click "Generate Recommendations" to identify KPIs and create actionable recommendations.
            </p>
          </div>
        ) : (
          <>
            {/* Step 1: Generate & Review */}
            {currentStep === 1 && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-1">Step 1: Generate & Review</h2>
                    <p className="text-[13px] text-[#64748b]">Review recommendations and set their status</p>
                  </div>
                  <div className="flex items-end gap-3 flex-wrap">
                    {/* Status Filter - Enhanced UI */}
                    <StatusFilter value={statusFilter} onChange={setStatusFilter} />
                  </div>
                </div>
                <RecommendationsTableV3
                  recommendations={recommendations}
                  showCheckboxes={false}
                  showStatusDropdown={true}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}

            {/* Step 2: Approved Recommendations */}
            {currentStep === 2 && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-1">Step 2: Approved Recommendations</h2>
                    <p className="text-[13px] text-[#64748b]">Generate content for each approved recommendation</p>
                  </div>
                </div>
                <RecommendationsTableV3
                  recommendations={recommendations}
                  showActions={true}
                  onAction={handleGenerateContent}
                  generatingContentIds={generatingContentIds}
                />
              </div>
            )}

            {/* Step 3: Content Review */}
            {currentStep === 3 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-[18px] font-semibold text-[#1a1d29]">Step 3: Content Review</h2>
                  <p className="text-[13px] text-[#64748b] mt-1">Review generated content and mark items as completed</p>
                </div>
                <div className="space-y-6">
                  {recommendations.map((rec) => {
                    const content = rec.id ? contentMap.get(rec.id) : null;
                    return (
                      <div key={rec.id} className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm overflow-hidden">
                        {/* Header Section */}
                        <div className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-b border-[#e8e9ed] px-6 py-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-[16px] font-semibold text-[#1a1d29] mb-2 leading-tight">{rec.action}</h3>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#e0f2fe] text-[#0369a1]">
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                  {rec.citationSource}
                                </span>
                              </div>
                            </div>
                            {!rec.isCompleted && (
                              <button
                                onClick={() => handleToggleComplete(rec)}
                                className="ml-4 px-3 py-1.5 bg-[#06c686] text-white rounded-md text-[12px] font-medium hover:bg-[#05a870] transition-colors flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Mark as Completed
                              </button>
                            )}
                            {rec.isCompleted && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-[#d1fae5] text-[#065f46] ml-4">
                                ✓ Completed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Content Section */}
                        <div className="p-6">
                          {content ? (() => {
                            // Parse content - it might be a string (JSON), object with .content property, or already parsed
                            let parsedContent: any = null;
                            let rawContent: string = '';
                            
                            // Strategy 1: Content is already an object
                            if (typeof content === 'object' && content !== null) {
                              if (content.content) {
                                // Content is in .content property
                                if (typeof content.content === 'string') {
                                  rawContent = content.content;
                                  try {
                                    parsedContent = JSON.parse(content.content);
                                  } catch {
                                    // Try to extract JSON from string
                                    const jsonMatch = content.content.match(/\{[\s\S]*\}/);
                                    if (jsonMatch) {
                                      try {
                                        parsedContent = JSON.parse(jsonMatch[0]);
                                      } catch {
                                        parsedContent = null;
                                      }
                                    }
                                  }
                                } else {
                                  parsedContent = content.content;
                                }
                              } else {
                                parsedContent = content;
                              }
                            } else if (typeof content === 'string') {
                              // Strategy 2: Content is a string - try to parse it
                              rawContent = content;
                              try {
                                parsedContent = JSON.parse(content);
                              } catch {
                                // Try to extract JSON object from text
                                const jsonMatch = content.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                  try {
                                    parsedContent = JSON.parse(jsonMatch[0]);
                                  } catch {
                                    parsedContent = null;
                                  }
                                }
                              }
                            }
                            
                            // Handle v2.0 format (new structure with separate sections)
                            if (parsedContent && parsedContent.version === '2.0') {
                              const v2Content = parsedContent as any;
                              const collaborationEmail = v2Content.collaborationEmail;
                              const publishableContent = v2Content.publishableContent;
                              const sourceType = v2Content.targetSource?.sourceType || 'other';
                              
                              // Get expanded state for this recommendation (default to both expanded)
                              const sectionState = expandedSections.get(rec.id || '') || { email: true, content: true };
                              const isEmailExpanded = sectionState.email;
                              const isContentExpanded = sectionState.content;
                              
                              // Toggle function for email section
                              const toggleEmail = () => {
                                setExpandedSections(prev => {
                                  const next = new Map(prev);
                                  const current = next.get(rec.id || '') || { email: true, content: true };
                                  next.set(rec.id || '', { ...current, email: !current.email });
                                  return next;
                                });
                              };
                              
                              // Toggle function for content section
                              const toggleContent = () => {
                                setExpandedSections(prev => {
                                  const next = new Map(prev);
                                  const current = next.get(rec.id || '') || { email: true, content: true };
                                  next.set(rec.id || '', { ...current, content: !current.content });
                                  return next;
                                });
                              };
                              
                              return (
                                <div className="space-y-6">
                                  {/* Collaboration Email Section - Collapsible */}
                                  {collaborationEmail && collaborationEmail.emailBody && (
                                    <div className="bg-gradient-to-br from-[#fef3c7] to-[#fde68a] rounded-lg border border-[#fbbf24] shadow-sm overflow-hidden">
                                      {/* Header - Clickable to toggle */}
                                      <div 
                                        onClick={toggleEmail}
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#fde68a]/50 transition-colors border-b border-[#f59e0b]"
                                      >
                                        <div className="flex items-center gap-2">
                                          {isEmailExpanded ? (
                                            <IconChevronUp size={18} className="text-[#92400e]" />
                                          ) : (
                                            <IconChevronDown size={18} className="text-[#92400e]" />
                                          )}
                                          <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></div>
                                          <h4 className="text-[13px] font-semibold text-[#92400e] uppercase tracking-wider">Collaboration Email</h4>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation(); // Prevent toggle when clicking copy
                                            const emailText = `Subject: ${collaborationEmail.subjectLine || ''}\n\n${collaborationEmail.emailBody || ''}\n\n${collaborationEmail.cta || ''}`;
                                            navigator.clipboard.writeText(emailText);
                                          }}
                                          className="px-3 py-1.5 bg-[#f59e0b] text-white rounded text-[11px] font-medium hover:bg-[#d97706] transition-colors flex items-center gap-1.5"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                          Copy Email
                                        </button>
                                      </div>
                                      
                                      {/* Content - Collapsible */}
                                      {isEmailExpanded && (
                                        <div className="p-6">
                                          {collaborationEmail.subjectLine && (
                                            <div className="mb-3">
                                              <div className="text-[11px] font-semibold text-[#92400e] mb-1">Subject Line:</div>
                                              <div className="text-[14px] font-semibold text-[#78350f]">{collaborationEmail.subjectLine}</div>
                                            </div>
                                          )}
                                          <div className="mb-3">
                                            <div className="text-[11px] font-semibold text-[#92400e] mb-2">Email Body:</div>
                                            <div className="text-[14px] text-[#78350f] leading-relaxed whitespace-pre-wrap font-sans">
                                              {collaborationEmail.emailBody}
                                            </div>
                                          </div>
                                          {collaborationEmail.cta && (
                                            <div className="pt-3 border-t border-[#f59e0b]">
                                              <div className="text-[11px] font-semibold text-[#92400e] mb-1">Call to Action:</div>
                                              <div className="text-[14px] text-[#78350f] font-medium">{collaborationEmail.cta}</div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Publishable Content Section - Collapsible */}
                                  {publishableContent && publishableContent.content && (
                                    <div className="bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                                      {/* Header - Clickable to toggle */}
                                      <div 
                                        onClick={toggleContent}
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#f8fafc] transition-colors border-b border-[#e2e8f0]"
                                      >
                                        <div className="flex items-center gap-2">
                                          {isContentExpanded ? (
                                            <IconChevronUp size={18} className="text-[#475569]" />
                                          ) : (
                                            <IconChevronDown size={18} className="text-[#475569]" />
                                          )}
                                          <div className="w-1.5 h-1.5 rounded-full bg-[#00bcdc]"></div>
                                          <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider">
                                            {publishableContent.type === 'video_script' ? 'Video Script' : 
                                             publishableContent.type === 'article' ? 'Article Content' : 
                                             'Publishable Content'}
                                          </h4>
                                          {sourceType === 'youtube' && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#ff0000] text-white">YouTube</span>
                                          )}
                                          {publishableContent.type === 'article' && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#06c686] text-white">Article</span>
                                          )}
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation(); // Prevent toggle when clicking copy
                                            navigator.clipboard.writeText(publishableContent.content || '');
                                          }}
                                          className="px-3 py-1.5 bg-[#00bcdc] text-white rounded text-[11px] font-medium hover:bg-[#0096b0] transition-colors flex items-center gap-1.5"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                          Copy Content
                                        </button>
                                      </div>
                                      
                                      {/* Content - Collapsible */}
                                      {isContentExpanded && (
                                        <div className="p-6">
                                          {publishableContent.title && (
                                            <div className="mb-4">
                                              <h5 className="text-[16px] font-semibold text-[#1a1d29]">{publishableContent.title}</h5>
                                            </div>
                                          )}
                                          
                                          {/* Video Script Metadata */}
                                          {publishableContent.type === 'video_script' && publishableContent.metadata && (
                                            <div className="mb-4 p-3 bg-[#f0f9ff] rounded border border-[#bae6fd]">
                                              {publishableContent.metadata.estimatedDuration && (
                                                <div className="text-[12px] text-[#0369a1] mb-2">
                                                  <span className="font-semibold">Duration:</span> {publishableContent.metadata.estimatedDuration}
                                                </div>
                                              )}
                                              {publishableContent.metadata.scenes && publishableContent.metadata.scenes.length > 0 && (
                                                <div className="text-[12px] text-[#0369a1] mb-2">
                                                  <span className="font-semibold">Scenes:</span> {publishableContent.metadata.scenes.length}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                          {/* Article Metadata (H1, H2, FAQ) */}
                                          {publishableContent.type === 'article' && publishableContent.metadata && (
                                            <div className="mb-4 space-y-3">
                                              {publishableContent.metadata.h1 && (
                                                <div className="p-3 bg-[#f0fdf4] rounded border border-[#bbf7d0]">
                                                  <div className="text-[11px] font-semibold text-[#166534] mb-1">H1:</div>
                                                  <div className="text-[14px] font-semibold text-[#166534]">{publishableContent.metadata.h1}</div>
                                                </div>
                                              )}
                                              {publishableContent.metadata.h2 && publishableContent.metadata.h2.length > 0 && (
                                                <div className="p-3 bg-[#f0fdf4] rounded border border-[#bbf7d0]">
                                                  <div className="text-[11px] font-semibold text-[#166534] mb-2">H2 Headings:</div>
                                                  <ul className="list-disc list-inside space-y-1">
                                                    {publishableContent.metadata.h2.map((h2: string, idx: number) => (
                                                      <li key={idx} className="text-[13px] text-[#166534]">{h2}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                              {publishableContent.metadata.faq && publishableContent.metadata.faq.length > 0 && (
                                                <div className="p-3 bg-[#f0fdf4] rounded border border-[#bbf7d0]">
                                                  <div className="text-[11px] font-semibold text-[#166534] mb-2">FAQ Questions:</div>
                                                  <ul className="list-disc list-inside space-y-1">
                                                    {publishableContent.metadata.faq.map((faq: string, idx: number) => (
                                                      <li key={idx} className="text-[13px] text-[#166534]">{faq}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          
                                          {/* Main Content */}
                                          <div className="prose prose-sm max-w-none">
                                            <div className={`text-[14px] text-[#1a1d29] leading-relaxed whitespace-pre-wrap font-sans ${
                                              publishableContent.type === 'video_script' ? 'font-mono' : ''
                                            }`}>
                                              {publishableContent.content}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // Handle v1.0 format (backward compatibility)
                            let readyToPasteText: string | null = null;
                            
                            // Strategy 1: Check structured format (version 1.0)
                            if (parsedContent && parsedContent.version === '1.0' && parsedContent.whatToPublishOrSend) {
                              readyToPasteText = parsedContent.whatToPublishOrSend.readyToPaste || null;
                            }
                            // Strategy 2: Check nested whatToPublishOrSend
                            else if (parsedContent?.whatToPublishOrSend?.readyToPaste) {
                              readyToPasteText = parsedContent.whatToPublishOrSend.readyToPaste;
                            }
                            // Strategy 3: Check direct readyToPaste
                            else if (parsedContent?.readyToPaste) {
                              readyToPasteText = parsedContent.readyToPaste;
                            }
                            // Strategy 4: Try to extract from raw string using regex
                            else if (rawContent) {
                              const readyToPasteMatch = rawContent.match(/"readyToPaste"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
                              if (readyToPasteMatch && readyToPasteMatch[1]) {
                                readyToPasteText = readyToPasteMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                              }
                            }
                            
                            if (readyToPasteText && readyToPasteText.trim()) {
                              // Display readyToPaste content in a polished format (v1.0)
                              return (
                                <div className="relative">
                                  {/* Content Card */}
                                  <div className="bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-lg border border-[#e2e8f0] p-6 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#e2e8f0]">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#00bcdc]"></div>
                                      <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider">Content</h4>
                                    </div>
                                    <div className="prose prose-sm max-w-none">
                                      <div className="text-[14px] text-[#1a1d29] leading-relaxed whitespace-pre-wrap font-sans">
                                        {readyToPasteText}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Copy Button */}
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(readyToPasteText || '');
                                    }}
                                    className="mt-4 px-4 py-2 bg-[#00bcdc] text-white rounded-lg text-[12px] font-medium hover:bg-[#0096b0] transition-colors flex items-center gap-2 shadow-sm"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copy Content
                                  </button>
                                </div>
                              );
                            } else {
                              // Fallback: display raw content or JSON
                              const fallbackText = parsedContent?.raw || rawContent || JSON.stringify(parsedContent, null, 2);
                              return (
                                <div className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-6">
                                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#e2e8f0]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#64748b]"></div>
                                    <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider">Generated Content</h4>
                                  </div>
                                  <pre className="text-[13px] text-[#1a1d29] whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto max-h-96 overflow-y-auto">
                                    {fallbackText}
                                  </pre>
                                </div>
                              );
                            }
                          })() : rec.isContentGenerated ? (
                            <div className="flex items-center justify-center py-12">
                              <div className="text-center">
                                <div className="h-10 w-10 rounded-full border-2 border-t-transparent border-[#00bcdc] animate-spin mx-auto mb-3" />
                                <p className="text-[13px] text-[#64748b]">Content is being generated...</p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-[13px] text-[#64748b]">No content available for this recommendation.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Results Tracking */}
            {currentStep === 4 && (
              <div>
                <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-6">Step 4: Results Tracking</h2>
                <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-b border-[#e8e9ed]">
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            Recommendation Action
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            Domain/Source
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            Current Visibility
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            New Visibility
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            Current SOA
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            New SOA
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            Current Sentiment
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">
                            New Sentiment
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e8e9ed]">
                        {recommendations.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-[14px] text-[#64748b]">
                              No completed recommendations found. Complete recommendations in Step 3 to see results here.
                            </td>
                          </tr>
                        ) : (
                          recommendations.map((rec) => {
                            // Parse current values from recommendation
                            const currentVisibility = rec.visibilityScore ? parseFloat(rec.visibilityScore) : null;
                            const currentSOA = rec.soa ? parseFloat(rec.soa) : null;
                            const currentSentiment = rec.sentiment ? parseFloat(rec.sentiment) : null;

                            // For "New" values, we'll use kpiAfterValue if it exists and matches the KPI type
                            // For now, we'll show "N/A" or "Pending" as new values will be collected later
                            // If kpiAfterValue exists, map it to the appropriate KPI column
                            const kpiName = (rec.kpi || '').toLowerCase();
                            const hasAfterValue = rec.kpiAfterValue !== null && rec.kpiAfterValue !== undefined;
                            
                            let newVisibility: number | null = null;
                            let newSOA: number | null = null;
                            let newSentiment: number | null = null;

                            if (hasAfterValue) {
                              if (kpiName.includes('visibility')) {
                                newVisibility = rec.kpiAfterValue!;
                              } else if (kpiName.includes('soa') || kpiName.includes('share')) {
                                newSOA = rec.kpiAfterValue!;
                              } else if (kpiName.includes('sentiment')) {
                                newSentiment = rec.kpiAfterValue!;
                              }
                            }

                            // Format completion date
                            const formatCompletionDate = (dateString?: string): string | null => {
                              if (!dateString) return null;
                              try {
                                const date = new Date(dateString);
                                return date.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                              } catch (e) {
                                return null;
                              }
                            };

                            const formattedCompletionDate = formatCompletionDate(rec.completedAt);

                            return (
                              <tr key={rec.id} className="hover:bg-[#f9f9fb] transition-colors">
                                {/* Recommendation Action */}
                                <td className="px-6 py-4">
                                  <div className="text-[14px] font-medium text-[#1a1d29] leading-snug">
                                    {rec.action || 'N/A'}
                                  </div>
                                  {formattedCompletionDate && (
                                    <div className="text-[11px] text-[#64748b] mt-1.5">
                                      Completed: {formattedCompletionDate}
                                    </div>
                                  )}
                                </td>
                                
                                {/* Domain/Source */}
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#e0f2fe] text-[#0369a1]">
                                    <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    {rec.citationSource || 'N/A'}
                                  </span>
                                </td>
                                
                                {/* Current Visibility */}
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {currentVisibility !== null && !isNaN(currentVisibility) ? (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>
                                        <span className="text-[14px] font-semibold text-[#1a1d29]">
                                          {currentVisibility.toFixed(2)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[13px] text-[#94a3b8] italic">N/A</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* New Visibility */}
                                <td className="px-6 py-4">
                                  {hasAfterValue && kpiName.includes('visibility') && newVisibility !== null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-[#06c686]"></div>
                                      <span className="text-[14px] font-semibold text-[#06c686]">
                                        {newVisibility.toFixed(2)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[13px] text-[#94a3b8] italic">—</span>
                                  )}
                                </td>
                                
                                {/* Current SOA */}
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {currentSOA !== null && !isNaN(currentSOA) ? (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>
                                        <span className="text-[14px] font-semibold text-[#1a1d29]">
                                          {currentSOA.toFixed(2)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[13px] text-[#94a3b8] italic">N/A</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* New SOA */}
                                <td className="px-6 py-4">
                                  {hasAfterValue && (kpiName.includes('soa') || kpiName.includes('share')) && newSOA !== null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-[#06c686]"></div>
                                      <span className="text-[14px] font-semibold text-[#06c686]">
                                        {newSOA.toFixed(2)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[13px] text-[#94a3b8] italic">—</span>
                                  )}
                                </td>
                                
                                {/* Current Sentiment */}
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {currentSentiment !== null && !isNaN(currentSentiment) ? (
                                      <>
                                        <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>
                                        <span className="text-[14px] font-semibold text-[#1a1d29]">
                                          {currentSentiment.toFixed(2)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-[13px] text-[#94a3b8] italic">N/A</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* New Sentiment */}
                                <td className="px-6 py-4">
                                  {hasAfterValue && kpiName.includes('sentiment') && newSentiment !== null ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-[#06c686]"></div>
                                      <span className="text-[14px] font-semibold text-[#06c686]">
                                        {newSentiment.toFixed(2)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[13px] text-[#94a3b8] italic">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

