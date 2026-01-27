/**
 * Optimize Page (Recommendations V3)
 * 
 * KPI-first approach with 4-step workflow:
 * Step 1: Opportunities - All recommendations with status dropdown (Approved/Rejected/Pending Review)
 * Step 2: Content Generation - Generate content for approved items
 * Step 3: Refine - Review generated content and mark as completed
 * Step 4: Outcome Tracker - View KPI improvements (before/after)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { useManualBrandDashboard } from '../manual-dashboard';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import {
  getRecommendationsByStepV3,
  generateContentV3,
  generateContentBulkV3,
  generateGuideV3,
  completeRecommendationV3,
  getKPIsV3,
  getLatestGenerationV3,
  updateRecommendationStatusV3,
  regenerateContentV3,
  type RecommendationV3,
  type IdentifiedKPI
} from '../api/recommendationsV3Api';
import { fetchRecommendationContentLatest } from '../api/recommendationsApi';
import { apiClient } from '../lib/apiClient';
import { StepIndicator } from '../components/RecommendationsV3/StepIndicator';
import { RecommendationsTableV3 } from '../components/RecommendationsV3/RecommendationsTableV3';
import { StatusFilter } from '../components/RecommendationsV3/components/StatusFilter';
import { IconSparkles, IconAlertCircle, IconChevronDown, IconChevronUp, IconTrash, IconTarget, IconTrendingUp, IconActivity, IconCheck, IconArrowLeft, IconPencil, IconDeviceFloppy, IconX, IconMessageCircle, IconPlus, IconMinus } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecommendationsV3Props {
  initialStep?: number;
}

export const RecommendationsV3 = ({ initialStep }: RecommendationsV3Props = {}) => {
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand
  } = useManualBrandDashboard();

  // Helper functions to persist/restore current step in sessionStorage
  const getPersistedStep = (brandId: string | null): number => {
    // If initialStep is provided via props (from route), use that
    if (initialStep && initialStep >= 1 && initialStep <= 4) {
      return initialStep;
    }
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

  // State - use initialStep from props if provided
  const [currentStep, setCurrentStep] = useState<number>(() => initialStep || getPersistedStep(selectedBrandId));
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [dataMaturity, setDataMaturity] = useState<'cold_start' | 'low_data' | 'normal' | null>(null);
  const [kpis, setKpis] = useState<IdentifiedKPI[]>([]); // Keep for potential future use, but not displayed in UI
  const [recommendations, setRecommendations] = useState<RecommendationV3[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Map<string, { content: boolean }>>(new Map()); // For backward compatibility/generic use
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null); // For Step 3 accordion (one at a time)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentMap, setContentMap] = useState<Map<string, any>>(new Map());
  const [guideMap, setGuideMap] = useState<Map<string, any>>(new Map());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [allRecommendations, setAllRecommendations] = useState<RecommendationV3[]>([]); // Store all Step 1 recommendations for local filtering
  const [generatingContentIds, setGeneratingContentIds] = useState<Set<string>>(new Set()); // Track which recommendations are generating content
  const [hasGeneratedContentForStep3, setHasGeneratedContentForStep3] = useState(false); // Drives Step 3 "attention" animation after generating content
  const [hasCompletedForStep4, setHasCompletedForStep4] = useState(false); // Drives Step 4 "attention" animation after marking completed
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedRecommendationForRegen, setSelectedRecommendationForRegen] = useState<RecommendationV3 | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [activeFeedbackSection, setActiveFeedbackSection] = useState<string | null>(null); // recId_sectionId

  // v4.0 Interactive Refinement state
  const [sectionFeedback, setSectionFeedback] = useState<Map<string, Map<string, string>>>(new Map()); // recId -> (sectionId -> feedback)
  const [sectionEdits, setSectionEdits] = useState<Map<string, Map<string, string>>>(new Map()); // recId -> (sectionId -> editedContent)
  const [globalReferences, setGlobalReferences] = useState<Map<string, string>>(new Map()); // recId -> references
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set()); // Track which recommendations are being refined
  const [refinedContent, setRefinedContent] = useState<Map<string, any>>(new Map()); // recId -> refined v4.0 content

  const isColdStart = dataMaturity === 'cold_start';

  // Helper: safely parse JSON-ish strings without crashing the UI
  const safeJsonParse = useCallback((value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value; // keep raw if invalid/truncated
    }
  }, []);

  const extractGuideObject = useCallback((contentRecordOrRaw: any): any => {
    // contentRecordOrRaw can be:
    // - RecommendationGeneratedContent record { content: "<json>" }
    // - already parsed object
    // - raw string
    if (contentRecordOrRaw && typeof contentRecordOrRaw === 'object' && 'content' in contentRecordOrRaw) {
      return safeJsonParse((contentRecordOrRaw as any).content);
    }
    return safeJsonParse(contentRecordOrRaw);
  }, [safeJsonParse]);

  // Backend stores JSON strings with escaped newlines (\\n) to keep JSON valid.
  // For display/copy we want real line breaks.
  const unescapeNewlines = useCallback((value: any): any => {
    if (typeof value !== 'string') return value;
    return value.replace(/\\n/g, '\n');
  }, []);

  useEffect(() => {
    // Reset per-generation artifacts when generation changes
    setGuideMap(new Map());
  }, [generationId]);

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
          if (response.data.dataMaturity !== undefined) {
            setDataMaturity((response.data.dataMaturity as any) || null);
          }
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
            // Debug: Log dataMaturity state
            console.log(`🧊 [RecommendationsV3] Step 2 - dataMaturity: ${dataMaturity}, isColdStart: ${isColdStart}`);
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

          // For Step 3, load content/guides for each recommendation
          if (currentStep === 3) {
            const isColdStartForThisStep =
              (response.data?.dataMaturity === 'cold_start') || isColdStart;

            // Initialize all recommendations to have expanded sections by default
            const newExpandedSections = new Map(expandedSections);
            recommendationsWithIds.forEach(rec => {
              if (rec.id && !newExpandedSections.has(rec.id)) {
                // Default to both sections expanded
                newExpandedSections.set(rec.id, { content: true });
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
            if (isColdStartForThisStep) {
              const newGuideMap = new Map(guideMap);
              contentResults.forEach(result => {
                if (result) {
                  newGuideMap.set(result.id!, extractGuideObject(result.content));
                }
              });
              setGuideMap(newGuideMap);
            } else {
              const newContentMap = new Map(contentMap);
              contentResults.forEach(result => {
                if (result) {
                  newContentMap.set(result.id!, result.content);
                }
              });
              setContentMap(newContentMap);
            }
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
    setDataMaturity(null);
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
          if (response.data.dataMaturity !== undefined) {
            setDataMaturity((response.data.dataMaturity as any) || null);
          }

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



  // Handle status change for a recommendation
  const handleStatusChange = async (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected' | 'removed') => {
    if (!recommendationId) return;

    setError(null);

    // Optimistically update UI
    // If status is 'removed' (Stop Tracking) or 'rejected' (User request), remove from view immediately
    if (status === 'removed' || status === 'rejected') {
      setRecommendations(prev => prev.filter(r => r.id !== recommendationId));
      setAllRecommendations(prev => prev.filter(r => r.id !== recommendationId));
    } else {
      // Otherwise just update the status
      const updateRec = (rec: RecommendationV3) =>
        rec.id === recommendationId
          ? { ...rec, reviewStatus: status, isApproved: status === 'approved' }
          : rec;

      setRecommendations(prev => prev.map(updateRec));
      setAllRecommendations(prev => prev.map(updateRec));
    }

    try {
      console.log(`📝 [RecommendationsV3] Updating status for ${recommendationId} to ${status}`);
      const response = await updateRecommendationStatusV3(recommendationId, status);

      if (response.success) {
        console.log(`✅ [RecommendationsV3] Successfully updated status for ${recommendationId}`);
        // Status already updated optimistically
      } else {
        // Revert optimistic update on error. Note: If we removed it, we need to fetch it back,
        // but since we don't have the original object easily here without complex state management,
        // we might just show an error. For now, we'll try to handle the 'update' revert case.
        // For 'remove' revert, a refresh would be needed or we'd need to keep a backup.
        // Given the low likelihood of API failure after optimistic update, we'll focus on error reporting.
        setError(response.error || 'Failed to update status');

        // If we didn't remove it, we can revert the status
        if (status !== 'removed' && status !== 'rejected') {
          // We can't easily revert if we don't know the previous status, but usually it was 'pending_review'
          // or we could reload the data.
          // Ideally we should reload the step data here to be safe.
        }
      }
    } catch (err: any) {
      console.error('Error updating recommendation status:', err);
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
                newExpandedSections.set(rec.id, { content: true });
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
            setShowSuccessModal(true);
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

  // Cold-start Step 2: Generate a guide for a single recommendation (Step 2 → Step 3)
  const handleGenerateGuide = async (recommendation: RecommendationV3, action: string) => {
    if (!recommendation.id || action !== 'generate-guide') return;
    if (generatingContentIds.has(recommendation.id)) return; // Prevent duplicate requests

    setGeneratingContentIds(prev => new Set(prev).add(recommendation.id!));
    setError(null);

    try {
      console.log(`📘 [RecommendationsV3] Generating guide for recommendation ${recommendation.id}...`);
      const response = await generateGuideV3(recommendation.id);

      if (response.success && response.data) {
        // Store parsed guide into guideMap (Step 3)
        try {
          const record = response.data.content;
          const raw = record?.content ?? record;
          if (typeof raw === 'string') {
            let parsed: any = raw;
            try {
              parsed = JSON.parse(raw);
            } catch {
              // Keep as raw string if JSON is invalid/truncated
              parsed = raw;
            }
            setGuideMap(prev => new Map(prev).set(recommendation.id!, parsed));
          } else {
            setGuideMap(prev => new Map(prev).set(recommendation.id!, raw));
          }
        } catch (e) {
          console.warn('⚠️ [RecommendationsV3] Could not store guide content, proceeding:', e);
        }

        // Navigate to Step 3 (guide review)
        setHasGeneratedContentForStep3(true);
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
              setRecommendations(recommendationsWithIds);
              setCurrentStep(3);
              setShowSuccessModal(true);
              setHasGeneratedContentForStep3(false);
            }
          } finally {
            setIsManuallyLoading(false);
            isManuallyNavigatingRef.current = false;
          }
        }
      } else {
        setError(response.error || 'Failed to generate guide');
      }
    } catch (err: any) {
      console.error('Error generating guide:', err);
      setError(err.message || 'Failed to generate guide');
    } finally {
      setGeneratingContentIds(prev => {
        const next = new Set(prev);
        next.delete(recommendation.id!);
        return next;
      });
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
                  newExpandedSections.set(rec.id, { content: true });
                }
              });
              setExpandedSections(newExpandedSections);

              setRecommendations(recommendationsWithIds);
              setCurrentStep(3);
              setShowSuccessModal(true);
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

  const handleSaveEdit = (recommendationId: string) => {
    if (!recommendationId) return;

    setContentMap(prev => {
      const next = new Map(prev);
      const existing = next.get(recommendationId);

      if (typeof existing === 'object' && existing !== null) {
        // If it's the v2.0 format, we need to update deep inside
        if (existing.version === '2.0' && existing.publishableContent) {
          next.set(recommendationId, {
            ...existing,
            publishableContent: {
              ...existing.publishableContent,
              content: editBuffer
            }
          });
        }
        // If it has a .content property (DB record format)
        else if (existing.content !== undefined) {
          next.set(recommendationId, { ...existing, content: editBuffer });
        }
        else {
          next.set(recommendationId, editBuffer);
        }
      } else {
        next.set(recommendationId, editBuffer);
      }
      return next;
    });
    setEditingId(null);
  };

  const handleRegenerateContent = async () => {
    if (!selectedRecommendationForRegen?.id || !feedbackText.trim()) return;

    const recommendationId = selectedRecommendationForRegen.id;
    setRegeneratingId(recommendationId);
    setShowFeedbackModal(false);

    try {
      console.log(`🔄 [RecommendationsV3] Regenerating content for ${recommendationId}...`);

      const response = await regenerateContentV3(recommendationId, feedbackText.trim());

      if (response.success && response.data) {
        console.log(`✅ [RecommendationsV3] Content regenerated successfully`);

        // Update contentMap with new content
        setContentMap(prev => {
          const next = new Map(prev);
          next.set(recommendationId, response.data!.content);
          return next;
        });

        // Update recommendation's regenRetry count
        setRecommendations(prev => prev.map(rec =>
          rec.id === recommendationId
            ? { ...rec, regenRetry: response.data!.regenRetry }
            : rec
        ));

        setError(null);
      } else {
        setError(response.error || 'Failed to regenerate content');
      }
    } catch (err: any) {
      console.error('Error regenerating content:', err);
      setError(err.message || 'Failed to regenerate content');
    } finally {
      setRegeneratingId(null);
      setFeedbackText('');
      setSelectedRecommendationForRegen(null);
    }
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
              <div className="flex items-center gap-3 mb-1">
                {selectedBrand && (
                  <SafeLogo
                    src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                    domain={selectedBrand.homepage_url || undefined}
                    alt={selectedBrand.name}
                    size={48}
                    className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100"
                  />
                )}
                <div>
                  <h1 className="text-[24px] font-bold text-[#1a1d29] m-0">Optimize</h1>
                  <p className="text-[13px] text-[#64748b]">
                    KPI-first approach with 4-step workflow
                  </p>
                </div>
              </div>
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
                      // Update dataMaturity if provided
                      if (response.data.dataMaturity !== undefined) {
                        const newMaturity = (response.data.dataMaturity as any) || null;
                        setDataMaturity(newMaturity);
                        console.log(`🧊 [RecommendationsV3] Step ${step} - Updated dataMaturity to: ${newMaturity}`);
                      }
                      const recommendationsWithIds = response.data.recommendations
                        .filter(rec => rec.id && rec.id.length > 10)
                        .map(rec => ({ ...rec, id: rec.id! }));

                      console.log(`✅ [RecommendationsV3] Loaded ${recommendationsWithIds.length} recommendations for Step ${step}`);

                      setRecommendations(recommendationsWithIds);
                      // Update allRecommendations for Step 1 to ensure filter works correctly
                      // This prevents race condition where filter useEffect clears recommendations
                      if (step === 1) {
                        setAllRecommendations(recommendationsWithIds);
                      }
                      setError(null);

                      // Load content/guides for Step 3
                      if (step === 3) {
                        setHasGeneratedContentForStep3(false);
                        const isColdStartForThisStep = (response.data?.dataMaturity === 'cold_start') || isColdStart;
                        const newExpandedSections = new Map(expandedSections);
                        recommendationsWithIds.forEach(rec => {
                          if (rec.id && !newExpandedSections.has(rec.id)) {
                            newExpandedSections.set(rec.id, { content: true });
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
                        if (isColdStartForThisStep) {
                          const newGuideMap = new Map(guideMap);
                          contentResults.forEach(result => {
                            if (result) {
                              newGuideMap.set(result.id!, extractGuideObject(result.content));
                            }
                          });
                          setGuideMap(newGuideMap);
                        } else {
                          const newContentMap = new Map(contentMap);
                          contentResults.forEach(result => {
                            if (result) {
                              newContentMap.set(result.id!, result.content);
                            }
                          });
                          setContentMap(newContentMap);
                        }

                        // Default all to collapsed for Step 3 accordion
                        setExpandedRecId(null);
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
        ) : (
          <AnimatePresence mode="wait">
            {/* Step 1: Discover Opportunities */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-1">Step 1: Discover Opportunities</h2>
                    <p className="text-[13px] text-[#64748b]">Review findings and prioritize recommendations</p>
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
              </motion.div>
            )}

            {/* Step 2: To-Do List */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-1">Step 2: To-Do List</h2>
                    <p className="text-[13px] text-[#64748b]">
                      {isColdStart
                        ? 'Generate an execution-ready implementation guide for each approved action (checklists, deliverables, success criteria).'
                        : 'Approve and generate content for chosen actions'}
                    </p>
                  </div>
                </div>
                {recommendations.length === 0 ? (
                  <div className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-[#f0fdf4] rounded-full flex items-center justify-center mx-auto mb-4">
                      <IconCheck size={32} className="text-[#06c686]" />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#1a1d29] mb-2">
                      To-Do List is empty
                    </h3>
                    <p className="text-[14px] text-[#64748b] max-w-md mx-auto mb-8">
                      You have no pending tasks in your To-Do List. Review other potential opportunities to find more actions to improve your performance.
                    </p>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#00bcdc] text-white rounded-lg text-[14px] font-bold hover:bg-[#00a8c6] transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                      <IconArrowLeft size={18} />
                      Go back to Discover Opportunities
                    </button>
                  </div>
                ) : (
                  <RecommendationsTableV3
                    recommendations={recommendations}
                    showActions={true}
                    onAction={isColdStart ? handleGenerateGuide : handleGenerateContent}
                    actionLabel={isColdStart ? 'Generate Guide' : 'Generate'}
                    actionType={isColdStart ? 'generate-guide' : 'generate-content'}
                    generatedLabel={isColdStart ? 'Guide Ready' : 'Generated'}
                    generatingContentIds={generatingContentIds}
                    onStopTracking={(id) => {
                      if (confirm('Stop tracking this recommendation? It will be removed from your view.')) {
                        handleStatusChange(id, 'removed');
                      }
                    }}
                  />
                )}
              </motion.div>
            )}

            {/* Step 3: Review and Refine */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-6">
                  <h2 className="text-[18px] font-semibold text-[#1a1d29]">Step 3: Review and Refine</h2>
                  <p className="text-[13px] text-[#64748b] mt-1">
                    {isColdStart
                      ? 'Cold-start brands skip content generation. Use Step 2 to review implementation guides, then execute and track results in Step 4.'
                      : 'Review generated content and finalize for publication'}
                  </p>
                </div>
                {isColdStart && (
                  <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-6">
                    <p className="text-[13px] text-[#0f172a]">
                      This step is not used for <span className="font-semibold">cold_start</span>. Your execution guides live in Step 2.
                    </p>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="px-4 py-2 bg-[#00bcdc] text-white rounded-lg text-[13px] font-semibold hover:bg-[#00a8c6] transition-colors"
                      >
                        Go to Step 2
                      </button>
                      <button
                        onClick={() => setCurrentStep(4)}
                        className="px-4 py-2 bg-white border border-[#e2e8f0] text-[#0f172a] rounded-lg text-[13px] font-semibold hover:bg-[#f8fafc] transition-colors"
                      >
                        Go to Step 4
                      </button>
                    </div>
                  </div>
                )}
                {isColdStart ? (
                  <div className="space-y-6">
                    <AnimatePresence>
                      {recommendations.map((rec) => {
                        const guideRaw = rec.id ? guideMap.get(rec.id) : null;
                        const guideObj = extractGuideObject(guideRaw);
                        const isGuide = Boolean(guideObj && typeof guideObj === 'object' && guideObj.version === 'guide_v1');

                        return (
                          <motion.div
                            key={rec.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
                            transition={{ duration: 0.3, layout: { duration: 0.3 } }}
                            className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm overflow-hidden"
                          >
                            {/* Header */}
                            <div
                              className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-b border-[#e8e9ed] px-6 py-4 cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                              onClick={() => setExpandedRecId(expandedRecId === rec.id ? null : (rec.id || null))}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-[#64748b]">
                                    {expandedRecId === rec.id ? <IconMinus size={20} /> : <IconPlus size={20} />}
                                  </span>
                                  <div className="flex-1">
                                    <h3 className="text-[16px] font-semibold text-[#1a1d29] leading-tight">{rec.action}</h3>
                                    <p className="text-[12px] text-[#64748b] mt-1">
                                      KPI: {rec.kpi} · Source: {rec.citationSource} · Effort: {rec.effort} · Timeline: {rec.timeline}
                                    </p>
                                  </div>
                                </div>
                                {!rec.isCompleted ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Stop tracking this recommendation? It will be removed from your view.')) {
                                          handleStatusChange(rec.id!, 'removed');
                                        }
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                      title="Stop Tracking"
                                    >
                                      <IconTrash size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleComplete(rec)}
                                      className="shrink-0 px-3 py-1.5 bg-[#06c686] text-white rounded-md text-[12px] font-semibold hover:bg-[#05a870] transition-colors"
                                    >
                                      Mark as Completed
                                    </button>
                                  </div>
                                ) : (
                                  <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[#d1fae5] text-[#065f46]">
                                    ✓ Completed
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Body - Accordion */}
                            {expandedRecId === rec.id && (
                              <div className="p-6">
                                {!guideRaw ? (
                                  <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4">
                                    <p className="text-[13px] text-[#9a3412] font-semibold">Guide not generated yet</p>
                                    <p className="text-[12px] text-[#7c2d12] mt-1">
                                      Go back to Step 2 and click <span className="font-semibold">Generate Guide</span> for this recommendation.
                                    </p>
                                    <button
                                      onClick={() => setCurrentStep(2)}
                                      className="mt-3 px-4 py-2 bg-[#00bcdc] text-white rounded-lg text-[13px] font-semibold hover:bg-[#00a8c6] transition-colors"
                                    >
                                      Go to Step 2
                                    </button>
                                  </div>
                                ) : isGuide ? (
                                  <div className="space-y-6">
                                    {/* Summary */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4">
                                        <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Goal</p>
                                        <p className="text-[13px] text-[#0f172a]">{guideObj?.summary?.goal || '—'}</p>
                                      </div>
                                      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4">
                                        <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Why this matters</p>
                                        <p className="text-[13px] text-[#0f172a]">{guideObj?.summary?.whyThisMatters || '—'}</p>
                                      </div>
                                    </div>

                                    {/* Prerequisites */}
                                    {Array.isArray(guideObj?.prerequisites) && guideObj.prerequisites.length > 0 && (
                                      <div>
                                        <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Prerequisites</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                          {guideObj.prerequisites.map((p: string, idx: number) => (
                                            <li key={idx} className="text-[13px] text-[#0f172a]">{p}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Implementation plan */}
                                    {Array.isArray(guideObj?.implementationPlan) && guideObj.implementationPlan.length > 0 && (
                                      <div>
                                        <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-3">Implementation Plan</p>
                                        <div className="space-y-4">
                                          {guideObj.implementationPlan.map((phase: any, pIdx: number) => (
                                            <div key={pIdx} className="border border-[#e2e8f0] rounded-lg p-4">
                                              <p className="text-[13px] font-semibold text-[#0f172a] mb-2">{phase.phase}</p>
                                              <div className="space-y-3">
                                                {(phase.steps || []).map((step: any, sIdx: number) => (
                                                  <div key={sIdx} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
                                                    <p className="text-[13px] font-semibold text-[#0f172a]">{step.title}</p>
                                                    <p className="text-[13px] text-[#334155] mt-1 whitespace-pre-line">{step.howTo}</p>
                                                    {step.deliverable && (
                                                      <p className="text-[12px] text-[#475569] mt-2">
                                                        <span className="font-semibold">Deliverable:</span> {step.deliverable}
                                                      </p>
                                                    )}
                                                    {Array.isArray(step.qualityChecks) && step.qualityChecks.length > 0 && (
                                                      <ul className="list-disc pl-5 mt-2 space-y-1">
                                                        {step.qualityChecks.map((c: string, cIdx: number) => (
                                                          <li key={cIdx} className="text-[12px] text-[#0f172a]">{c}</li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Success criteria */}
                                    {guideObj?.successCriteria && (
                                      <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-4">
                                        <p className="text-[12px] font-semibold text-[#0369a1] uppercase tracking-wide mb-2">Success Criteria</p>
                                        {Array.isArray(guideObj.successCriteria.whatToMeasure) && (
                                          <ul className="list-disc pl-5 space-y-1">
                                            {guideObj.successCriteria.whatToMeasure.map((m: string, idx: number) => (
                                              <li key={idx} className="text-[13px] text-[#0f172a]">{m}</li>
                                            ))}
                                          </ul>
                                        )}
                                        {guideObj.successCriteria.expectedDirection && (
                                          <p className="text-[13px] text-[#0f172a] mt-2">{guideObj.successCriteria.expectedDirection}</p>
                                        )}
                                        {guideObj.successCriteria.checkInCadence && (
                                          <p className="text-[12px] text-[#475569] mt-2">
                                            <span className="font-semibold">Check-in cadence:</span> {guideObj.successCriteria.checkInCadence}
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* If already done */}
                                    {guideObj?.ifAlreadyDone && (
                                      <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4">
                                        <p className="text-[12px] font-semibold text-[#9a3412] uppercase tracking-wide mb-2">If you think this is already done</p>
                                        {Array.isArray(guideObj.ifAlreadyDone.verificationSteps) && (
                                          <>
                                            <p className="text-[12px] font-semibold text-[#475569] mb-1">Verification steps</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                              {guideObj.ifAlreadyDone.verificationSteps.map((v: string, idx: number) => (
                                                <li key={idx} className="text-[13px] text-[#0f172a]">{v}</li>
                                              ))}
                                            </ul>
                                          </>
                                        )}
                                        {Array.isArray(guideObj.ifAlreadyDone.upgradePath) && guideObj.ifAlreadyDone.upgradePath.length > 0 && (
                                          <>
                                            <p className="text-[12px] font-semibold text-[#475569] mt-3 mb-1">Upgrade path</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                              {guideObj.ifAlreadyDone.upgradePath.map((u: string, idx: number) => (
                                                <li key={idx} className="text-[13px] text-[#0f172a]">{u}</li>
                                              ))}
                                            </ul>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Common mistakes */}
                                    {Array.isArray(guideObj?.commonMistakes) && guideObj.commonMistakes.length > 0 && (
                                      <div>
                                        <p className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide mb-2">Common mistakes</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                          {guideObj.commonMistakes.map((m: string, idx: number) => (
                                            <li key={idx} className="text-[13px] text-[#0f172a]">{m}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {!isGuide && (
                                      <div className="text-[13px] text-[#0f172a]">
                                        <p className="text-[12px] text-[#64748b] mb-2">Guide generated (raw):</p>
                                        <pre className="whitespace-pre-wrap text-[12px] bg-[#0b1220] text-[#e2e8f0] rounded-lg p-4 overflow-auto">
                                          {typeof guideRaw === 'string' ? guideRaw : JSON.stringify(guideRaw, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4">
                                    <p className="text-[13px] text-[#991b1b] font-semibold">Guide JSON is invalid / truncated</p>
                                    <p className="text-[12px] text-[#7f1d1d] mt-1">
                                      This can happen if the model output is cut off mid-response. Please go back to Step 2 and click Generate Guide again.
                                    </p>
                                    <pre className="mt-3 whitespace-pre-wrap text-[12px] bg-[#0b1220] text-[#e2e8f0] rounded-lg p-4 overflow-auto">
                                      {typeof guideRaw === 'string' ? guideRaw : JSON.stringify(guideRaw, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <AnimatePresence>
                      {recommendations.map((rec) => {
                        const content = rec.id ? contentMap.get(rec.id) : null;
                        return (
                          <motion.div
                            key={rec.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{
                              opacity: 0,
                              x: 100, // Slide right ("dumped")
                              y: 20,  // Drop down slightly
                              scale: 0.9,
                              rotate: 5, // Tilted drop
                              transition: { duration: 0.4, ease: "backIn" }
                            }}
                            transition={{ duration: 0.3, layout: { duration: 0.3 } }}
                            className="bg-white border border-[#e8e9ed] rounded-xl shadow-sm overflow-hidden relative"
                          >
                            {/* Header Section */}
                            <div
                              className="bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-b border-[#e8e9ed] px-6 py-4 cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                              onClick={() => setExpandedRecId(expandedRecId === rec.id ? null : (rec.id || null))}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-[#64748b]">
                                    {expandedRecId === rec.id ? <IconMinus size={20} /> : <IconPlus size={20} />}
                                  </span>
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
                                </div>
                                {!rec.isCompleted && (
                                  <div className="flex items-center gap-2 ml-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Stop tracking this recommendation? It will be removed from your view.')) {
                                          handleStatusChange(rec.id!, 'removed');
                                        }
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                      title="Stop Tracking"
                                    >
                                      <IconTrash size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleComplete(rec)}
                                      className="px-3 py-1.5 bg-[#06c686] text-white rounded-md text-[12px] font-medium hover:bg-[#05a870] transition-colors flex items-center gap-1.5"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Mark as Completed
                                    </button>
                                  </div>
                                )}
                                {rec.isCompleted && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-[#d1fae5] text-[#065f46] ml-4">
                                    ✓ Completed
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Content Section - Accordion */}
                            {expandedRecId === rec.id && (
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
                                          // v4.0 Recovery: Try to fix truncated JSON by closing brackets
                                          if (content.includes('"version":"4.0"') || content.includes('"version": "4.0"')) {
                                            try {
                                              // Extract sections array even if incomplete
                                              const sectionsMatch = content.match(/"sections"\s*:\s*\[([\s\S]*)/);
                                              if (sectionsMatch) {
                                                let sectionsStr = sectionsMatch[1];
                                                // Find complete section objects
                                                const sections: any[] = [];
                                                const sectionRegex = /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"sectionType"\s*:\s*"([^"]+)"\s*\}/g;
                                                let match;
                                                while ((match = sectionRegex.exec(sectionsStr)) !== null) {
                                                  sections.push({
                                                    id: match[1],
                                                    title: match[2],
                                                    content: match[3].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                                                    sectionType: match[4]
                                                  });
                                                }
                                                if (sections.length > 0) {
                                                  // Extract title if present
                                                  const titleMatch = content.match(/"contentTitle"\s*:\s*"([^"]+)"/);
                                                  parsedContent = {
                                                    version: '4.0',
                                                    contentTitle: titleMatch ? titleMatch[1] : 'Content (Recovered)',
                                                    sections,
                                                    callToAction: '',
                                                    requiredInputs: []
                                                  };
                                                }
                                              }
                                            } catch (e) {
                                              console.warn('v4.0 recovery failed:', e);
                                              parsedContent = null;
                                            }
                                          } else {
                                            parsedContent = null;
                                          }
                                        }
                                      }
                                    }
                                  }

                                  // Handle v4.0 format (sectioned content with interactive refinement)
                                  if (parsedContent && parsedContent.version === '4.0') {
                                    const v4Content = refinedContent.get(rec.id || '') || parsedContent;
                                    const sections = v4Content.sections || [];
                                    const contentTitle = v4Content.contentTitle || '';
                                    const callToAction = v4Content.callToAction || '';
                                    const requiredInputs = v4Content.requiredInputs || [];
                                    const recId = rec.id || '';
                                    const isRefining = refiningIds.has(recId);

                                    // Get or initialize section feedback/edits for this recommendation
                                    const recFeedback = sectionFeedback.get(recId) || new Map<string, string>();
                                    const recEdits = sectionEdits.get(recId) || new Map<string, string>();
                                    const refs = globalReferences.get(recId) || '';

                                    // Highlight [FILL_IN: ...] markers
                                    const highlightFillIns = (text: string) => {
                                      if (!text) return text;
                                      return text.replace(/\[FILL_IN:\s*([^\]]+)\]/g, '<span class="bg-yellow-200 text-yellow-800 px-1 rounded font-medium">[FILL_IN: $1]</span>');
                                    };

                                    // Handle section feedback update
                                    const updateSectionFeedback = (sectionId: string, feedback: string) => {
                                      setSectionFeedback(prev => {
                                        const next = new Map(prev);
                                        const recMap = new Map(next.get(recId) || new Map());
                                        recMap.set(sectionId, feedback);
                                        next.set(recId, recMap);
                                        return next;
                                      });
                                    };

                                    // Handle section edit update
                                    const updateSectionEdit = (sectionId: string, content: string) => {
                                      setSectionEdits(prev => {
                                        const next = new Map(prev);
                                        const recMap = new Map(next.get(recId) || new Map());
                                        recMap.set(sectionId, content);
                                        next.set(recId, recMap);
                                        return next;
                                      });
                                    };

                                    // Handle references update
                                    const updateReferences = (refs: string) => {
                                      setGlobalReferences(prev => {
                                        const next = new Map(prev);
                                        next.set(recId, refs);
                                        return next;
                                      });
                                    };

                                    // Handle refinement
                                    const handleRefine = async () => {
                                      setRefiningIds(prev => new Set(prev).add(recId));
                                      try {
                                        const sectionsWithFeedback = sections.map((s: any) => ({
                                          id: s.id,
                                          title: s.title,
                                          content: recEdits.get(s.id) || s.content,
                                          feedback: recFeedback.get(s.id) || '',
                                          sectionType: s.sectionType
                                        }));

                                        console.log('[Refine] Sending request with', sectionsWithFeedback.length, 'sections');
                                        const accessToken = apiClient.getAccessToken();

                                        const response = await fetch(`${apiClient.baseUrl}/recommendations-v3/refine-content`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
                                          },
                                          body: JSON.stringify({
                                            recommendationId: recId,
                                            sections: sectionsWithFeedback,
                                            references: refs,
                                            brandName: v4Content.brandName || ''
                                          })
                                        });

                                        console.log('[Refine] Response status:', response.status);
                                        const result = await response.json();
                                        console.log('[Refine] Result:', result);

                                        if (result.success && result.data?.refinedContent) {
                                          setRefinedContent(prev => {
                                            const next = new Map(prev);
                                            next.set(recId, result.data.refinedContent);
                                            return next;
                                          });
                                          // Clear feedback after successful refinement
                                          setSectionFeedback(prev => {
                                            const next = new Map(prev);
                                            next.delete(recId);
                                            return next;
                                          });
                                        } else {
                                          console.error('[Refine] API returned error:', result.error);
                                        }
                                      } catch (error) {
                                        console.error('Refinement failed:', error);
                                      } finally {
                                        setRefiningIds(prev => {
                                          const next = new Set(prev);
                                          next.delete(recId);
                                          return next;
                                        });
                                      }
                                    };

                                    // Check if any feedback exists
                                    const hasFeedback = Array.from(recFeedback.values()).some(f => f.trim().length > 0) || refs.trim().length > 0;

                                    return (
                                      <div className="space-y-4">
                                        {/* Header with overall title */}
                                        <div className="bg-gradient-to-r from-[#00bcdc] to-[#06c686] rounded-lg p-4 text-white">
                                          <h3 className="text-[18px] font-bold">{contentTitle}</h3>
                                          <p className="text-[12px] opacity-80 mt-1">v4.0 · Sectioned Content · {sections.length} sections</p>
                                        </div>

                                        {/* Section Cards */}
                                        {sections.map((section: any, idx: number) => {
                                          const editedContent = recEdits.get(section.id) || section.content;
                                          const feedback = recFeedback.get(section.id) || '';
                                          const isEditingSection = editingId === `${recId}_${section.id}`;

                                          return (
                                            <div key={section.id} className="bg-white border border-[#e2e8f0] rounded-lg shadow-sm overflow-hidden">
                                              {/* Section Header */}
                                              <div className="flex items-center justify-between p-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
                                                <div className="flex items-center gap-2">
                                                  <span className="w-6 h-6 rounded-full bg-[#00bcdc] text-white text-[11px] font-bold flex items-center justify-center">
                                                    {idx + 1}
                                                  </span>
                                                  <h4 className="text-[14px] font-semibold text-[#1a1d29]">{section.title}</h4>
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#e2e8f0] text-[#64748b] capitalize">
                                                    {section.sectionType}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <button
                                                    onClick={() => {
                                                      const sectionKey = `${recId}_${section.id}`;
                                                      setActiveFeedbackSection(activeFeedbackSection === sectionKey ? null : sectionKey);
                                                    }}
                                                    className={`p-1 rounded-md transition-colors relative ${feedback.trim().length > 0 ? 'text-[#f59e0b] bg-[#fff7ed]' : 'text-[#64748b] hover:text-[#00bcdc] hover:bg-[#f1f5f9]'}`}
                                                    title="Feedback"
                                                  >
                                                    <IconMessageCircle size={16} />
                                                    {feedback.trim().length > 0 && (
                                                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#f59e0b] rounded-full border border-white"></span>
                                                    )}
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      if (isEditingSection) {
                                                        setEditingId(null);
                                                      } else {
                                                        setEditingId(`${recId}_${section.id}`);
                                                      }
                                                    }}
                                                    className="px-2 py-1 text-[11px] text-[#64748b] hover:text-[#00bcdc] transition-colors"
                                                  >
                                                    {isEditingSection ? '✓ Done' : '✎ Edit'}
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Feedback Popover */}
                                              {activeFeedbackSection === `${recId}_${section.id}` && (
                                                <div className="absolute top-12 right-4 z-50 w-[320px] bg-white border border-[#fcd34d] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                                  <div className="bg-[#fffbeb] px-4 py-2 border-b border-[#fcd34d] flex items-center justify-between">
                                                    <span className="text-[12px] font-bold text-[#92400e]">Feedback for {section.title}</span>
                                                    <button
                                                      onClick={() => setActiveFeedbackSection(null)}
                                                      className="text-[#92400e] hover:bg-[#fef3c7] p-1 rounded-md"
                                                    >
                                                      <IconX size={14} />
                                                    </button>
                                                  </div>
                                                  <div className="p-4">
                                                    <textarea
                                                      className="w-full p-3 bg-white border border-[#fcd34d] rounded-lg text-[13px] text-[#1a1d29] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] min-h-[100px]"
                                                      placeholder="E.g., 'Add more specific metrics' or 'Make this more relevant to enterprise'"
                                                      autoFocus
                                                      value={feedback}
                                                      onChange={(e) => updateSectionFeedback(section.id, e.target.value)}
                                                    />
                                                    <div className="mt-3 flex justify-end">
                                                      <button
                                                        onClick={() => setActiveFeedbackSection(null)}
                                                        className="px-4 py-1.5 bg-[#fcd34d] text-[#92400e] text-[12px] font-bold rounded-lg hover:bg-[#fbbf24] transition-colors"
                                                      >
                                                        Done
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              {/* Section Content */}
                                              <div className="p-4">
                                                {isEditingSection ? (
                                                  <textarea
                                                    className="w-full min-h-[150px] p-3 bg-[#f8fafc] border border-[#00bcdc] rounded-lg text-[13px] text-[#1a1d29] focus:outline-none focus:ring-2 focus:ring-[#00bcdc]"
                                                    value={editedContent}
                                                    onChange={(e) => updateSectionEdit(section.id, e.target.value)}
                                                  />
                                                ) : (
                                                  <div
                                                    className="text-[13px] text-[#1a1d29] leading-relaxed whitespace-pre-wrap"
                                                    dangerouslySetInnerHTML={{ __html: highlightFillIns(editedContent) }}
                                                  />
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {/* Call to Action */}
                                        {callToAction && (
                                          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-4">
                                            <p className="text-[12px] font-semibold text-[#166534] mb-1">📢 Call to Action</p>
                                            <p className="text-[13px] text-[#166534]">{callToAction}</p>
                                          </div>
                                        )}

                                        {/* Required Inputs */}
                                        {requiredInputs.length > 0 && (
                                          <div className="bg-[#fef3c7] border border-[#fcd34d] rounded-lg p-4">
                                            <p className="text-[12px] font-semibold text-[#92400e] mb-2">⚠️ Fill in before publishing:</p>
                                            <ul className="list-disc pl-5 space-y-1">
                                              {requiredInputs.map((input: string, idx: number) => (
                                                <li key={idx} className="text-[12px] text-[#92400e]">{input}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Global References */}
                                        <div className="bg-[#f1f5f9] border border-[#cbd5e1] rounded-lg p-4">
                                          <label className="text-[12px] font-semibold text-[#475569] block mb-2">
                                            📎 Additional References (optional)
                                          </label>
                                          <textarea
                                            className="w-full p-3 bg-white border border-[#cbd5e1] rounded-lg text-[12px] text-[#1a1d29] placeholder-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#00bcdc]"
                                            placeholder="Add any additional context, URLs, or reference material..."
                                            rows={2}
                                            value={refs}
                                            onChange={(e) => updateReferences(e.target.value)}
                                          />
                                        </div>

                                        {/* Refine Button */}
                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={handleRefine}
                                            disabled={isRefining || !hasFeedback}
                                            className={`flex-1 py-3 rounded-lg text-[14px] font-semibold transition-colors flex items-center justify-center gap-2 ${isRefining || !hasFeedback
                                              ? 'bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed'
                                              : 'bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] text-white hover:from-[#7c3aed] hover:to-[#9333ea]'
                                              }`}
                                          >
                                            {isRefining ? (
                                              <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Refining...
                                              </>
                                            ) : (
                                              <>
                                                🔄 Refine with Feedback
                                              </>
                                            )}
                                          </button>
                                          <button
                                            onClick={() => {
                                              const fullContent = sections.map((s: any) => `## ${s.title}\n\n${recEdits.get(s.id) || s.content}`).join('\n\n');
                                              navigator.clipboard.writeText(fullContent);
                                            }}
                                            className="px-6 py-3 bg-[#00bcdc] text-white rounded-lg text-[14px] font-semibold hover:bg-[#0096b0] transition-colors flex items-center gap-2"
                                          >
                                            📋 Copy All
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Handle v3.0 format (dual content: guide + publishable)
                                  if (parsedContent && parsedContent.version === '3.0') {
                                    const v3Content = parsedContent as any;
                                    const publishableContent = v3Content.publishableContent;
                                    const requiredInputs = v3Content.requiredInputs || [];

                                    // Highlight [FILL_IN: ...] markers
                                    const highlightFillIns = (text: string) => {
                                      if (!text) return text;
                                      return text.replace(/\[FILL_IN:\s*([^\]]+)\]/g, '<span class="bg-yellow-200 text-yellow-800 px-1 rounded font-medium">[FILL_IN: $1]</span>');
                                    };

                                    return (
                                      <div className="space-y-4">
                                        {/* Publishable Content Section */}
                                        {publishableContent && publishableContent.content && (
                                          <div className="bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                                            {/* Header */}
                                            <div className="flex items-center justify-between p-4 border-b border-[#e2e8f0]">
                                              <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#06c686]"></div>
                                                <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider">
                                                  📝 Publishable Content
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#06c686] text-white capitalize">
                                                  {publishableContent.type?.replace(/_/g, ' ') || 'Content'}
                                                </span>
                                                <span className="text-[10px] text-[#94a3b8] italic ml-2 hidden lg:inline">
                                                  AI Generated. Review before publishing.
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {editingId === rec.id ? (
                                                  <>
                                                    <button
                                                      onClick={() => handleSaveEdit(rec.id!)}
                                                      className="px-3 py-1.5 bg-[#06c686] text-white rounded text-[11px] font-medium hover:bg-[#05a870] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconDeviceFloppy size={14} />
                                                      Save
                                                    </button>
                                                    <button
                                                      onClick={() => setEditingId(null)}
                                                      className="px-3 py-1.5 bg-[#ef4444] text-white rounded text-[11px] font-medium hover:bg-[#dc2626] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconX size={14} />
                                                      Cancel
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <button
                                                      onClick={() => {
                                                        setEditingId(rec.id!);
                                                        setEditBuffer(unescapeNewlines(publishableContent.content || ''));
                                                      }}
                                                      className="px-3 py-1.5 bg-white border border-[#e2e8f0] text-[#475569] rounded text-[11px] font-medium hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconPencil size={14} />
                                                      Edit
                                                    </button>
                                                    <button
                                                      onClick={() => navigator.clipboard.writeText(unescapeNewlines(publishableContent.content || ''))}
                                                      className="px-3 py-1.5 bg-[#00bcdc] text-white rounded text-[11px] font-medium hover:bg-[#0096b0] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                      </svg>
                                                      Copy
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-6">
                                              {publishableContent.title && (
                                                <div className="mb-4">
                                                  <h5 className="text-[16px] font-semibold text-[#1a1d29]">{publishableContent.title}</h5>
                                                </div>
                                              )}

                                              {/* Main Content */}
                                              {editingId === rec.id ? (
                                                <textarea
                                                  className="w-full h-[400px] p-4 bg-white border border-[#00bcdc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00bcdc] text-[14px] text-[#1a1d29] leading-relaxed font-sans shadow-inner"
                                                  value={editBuffer}
                                                  onChange={(e) => setEditBuffer(e.target.value)}
                                                  autoFocus
                                                />
                                              ) : (
                                                <div
                                                  className="prose prose-sm max-w-none text-[14px] text-[#1a1d29] leading-relaxed whitespace-pre-wrap font-sans"
                                                  dangerouslySetInnerHTML={{ __html: highlightFillIns(unescapeNewlines(publishableContent.content)) }}
                                                />
                                              )}

                                              {/* Call to Action */}
                                              {publishableContent.callToAction && (
                                                <div className="mt-4 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                                                  <p className="text-[12px] font-semibold text-[#166534] mb-1">Call to Action</p>
                                                  <p className="text-[13px] text-[#166534]">{publishableContent.callToAction}</p>
                                                </div>
                                              )}

                                              {/* Required Inputs */}
                                              {requiredInputs.length > 0 && (
                                                <div className="mt-4 p-3 bg-[#fef3c7] border border-[#fcd34d] rounded-lg">
                                                  <p className="text-[12px] font-semibold text-[#92400e] mb-2">⚠️ Fill in before publishing:</p>
                                                  <ul className="list-disc pl-5 space-y-1">
                                                    {requiredInputs.map((input: string, idx: number) => (
                                                      <li key={idx} className="text-[12px] text-[#92400e]">{input}</li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  // Handle v2.0 format (new structure with separate sections)
                                  if (parsedContent && parsedContent.version === '2.0') {
                                    const v2Content = parsedContent as any;
                                    const publishableContent = v2Content.publishableContent;
                                    const sourceType = v2Content.targetSource?.sourceType || 'other';

                                    // Get expanded state for this recommendation
                                    const sectionState = expandedSections.get(rec.id || '') || { content: true };
                                    const isContentExpanded = sectionState.content;

                                    // Toggle function for content section
                                    const toggleContent = () => {
                                      setExpandedSections(prev => {
                                        const next = new Map(prev);
                                        const current = next.get(rec.id || '') || { content: true };
                                        next.set(rec.id || '', { ...current, content: !current.content });
                                        return next;
                                      });
                                    };

                                    return (
                                      <div className="space-y-6">
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
                                                <span className="text-[10px] text-[#94a3b8] italic ml-2 hidden lg:inline">
                                                  Disclaimer: AI Generated. Review before publishing.
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {editingId === rec.id ? (
                                                  <>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSaveEdit(rec.id!);
                                                      }}
                                                      className="px-3 py-1.5 bg-[#06c686] text-white rounded text-[11px] font-medium hover:bg-[#05a870] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconDeviceFloppy size={14} />
                                                      Save
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingId(null);
                                                      }}
                                                      className="px-3 py-1.5 bg-[#ef4444] text-white rounded text-[11px] font-medium hover:bg-[#dc2626] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconX size={14} />
                                                      Cancel
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingId(rec.id!);
                                                        setEditBuffer(unescapeNewlines(publishableContent.content || ''));
                                                      }}
                                                      className="px-3 py-1.5 bg-white border border-[#e2e8f0] text-[#475569] rounded text-[11px] font-medium hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconPencil size={14} />
                                                      Edit
                                                    </button>
                                                    {regeneratingId === rec.id ? (
                                                      <span className="inline-flex items-center px-3 py-1.5 rounded text-[11px] font-medium border bg-[#fef3c7] text-[#92400e] border-[#fde68a]">
                                                        <div className="w-3 h-3 border-2 border-[#92400e] border-t-transparent rounded-full animate-spin mr-1.5" />
                                                        Regenerating...
                                                      </span>
                                                    ) : (rec.regenRetry || 0) >= 1 ? (
                                                      <span className="inline-flex items-center px-3 py-1.5 rounded text-[11px] font-medium border bg-[#f3f4f6] text-[#6b7280] border-[#d1d5db] cursor-not-allowed">
                                                        Regenerated
                                                      </span>
                                                    ) : (
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedRecommendationForRegen(rec);
                                                          setShowFeedbackModal(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-[#8b5cf6] text-white rounded text-[11px] font-medium hover:bg-[#7c3aed] transition-colors flex items-center gap-1.5"
                                                      >
                                                        <IconSparkles size={14} />
                                                        Regenerate
                                                      </button>
                                                    )}
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(unescapeNewlines(publishableContent.content || ''));
                                                      }}
                                                      className="px-3 py-1.5 bg-[#00bcdc] text-white rounded text-[11px] font-medium hover:bg-[#0096b0] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                      </svg>
                                                      Copy
                                                    </button>
                                                  </>
                                                )}
                                              </div>
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
                                                {editingId === rec.id ? (
                                                  <textarea
                                                    className="w-full h-[400px] p-4 bg-white border border-[#00bcdc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00bcdc] text-[14px] text-[#1a1d29] leading-relaxed font-sans shadow-inner"
                                                    value={editBuffer}
                                                    onChange={(e) => setEditBuffer(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <div className="prose prose-sm max-w-none">
                                                    <div className={`text-[14px] text-[#1a1d29] leading-relaxed whitespace-pre-wrap font-sans ${publishableContent.type === 'video_script' ? 'font-mono' : ''
                                                      }`}>
                                                      {unescapeNewlines(publishableContent.content)}
                                                    </div>
                                                  </div>
                                                )}
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
                                          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-[#e2e8f0]">
                                            <div className="flex items-center gap-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-[#00bcdc]"></div>
                                              <h4 className="text-[13px] font-semibold text-[#475569] uppercase tracking-wider">Content</h4>
                                              <span className="text-[10px] text-[#94a3b8] italic ml-2 hidden lg:inline">
                                                Disclaimer: AI Generated. Review before publishing.
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {editingId === rec.id ? (
                                                <>
                                                  <button
                                                    onClick={() => handleSaveEdit(rec.id!)}
                                                    className="px-3 py-1 bg-[#06c686] text-white rounded text-[11px] font-medium hover:bg-[#05a870] transition-colors flex items-center gap-1.5"
                                                  >
                                                    <IconDeviceFloppy size={14} />
                                                    Save
                                                  </button>
                                                  <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-3 py-1 bg-[#ef4444] text-white rounded text-[11px] font-medium hover:bg-[#dc2626] transition-colors flex items-center gap-1.5"
                                                  >
                                                    <IconX size={14} />
                                                    Cancel
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    onClick={() => {
                                                      setEditingId(rec.id!);
                                                      setEditBuffer(readyToPasteText || '');
                                                    }}
                                                    className="px-3 py-1 bg-white border border-[#e2e8f0] text-[#475569] rounded text-[11px] font-medium hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5"
                                                  >
                                                    <IconPencil size={14} />
                                                    Edit
                                                  </button>
                                                  {regeneratingId === rec.id ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded text-[11px] font-medium border bg-[#fef3c7] text-[#92400e] border-[#fde68a]">
                                                      <div className="w-3 h-3 border-2 border-[#92400e] border-t-transparent rounded-full animate-spin mr-1.5" />
                                                      Regenerating...
                                                    </span>
                                                  ) : (rec.regenRetry || 0) >= 1 ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded text-[11px] font-medium border bg-[#f3f4f6] text-[#6b7280] border-[#d1d5db] cursor-not-allowed">
                                                      Regenerated
                                                    </span>
                                                  ) : (
                                                    <button
                                                      onClick={() => {
                                                        setSelectedRecommendationForRegen(rec);
                                                        setShowFeedbackModal(true);
                                                      }}
                                                      className="px-3 py-1 bg-[#8b5cf6] text-white rounded text-[11px] font-medium hover:bg-[#7c3aed] transition-colors flex items-center gap-1.5"
                                                    >
                                                      <IconSparkles size={14} />
                                                      Regenerate
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(readyToPasteText || '');
                                                    }}
                                                    className="px-3 py-1 bg-[#00bcdc] text-white rounded text-[11px] font-medium hover:bg-[#0096b0] transition-colors flex items-center gap-1.5"
                                                  >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    Copy
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                          <div className="prose prose-sm max-w-none">
                                            {editingId === rec.id ? (
                                              <textarea
                                                className="w-full h-[400px] p-4 bg-white border border-[#00bcdc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00bcdc] text-[14px] text-[#1a1d29] leading-relaxed font-sans shadow-inner"
                                                value={editBuffer}
                                                onChange={(e) => setEditBuffer(e.target.value)}
                                                autoFocus
                                              />
                                            ) : (
                                              <div className="text-[14px] text-[#1a1d29] leading-relaxed whitespace-pre-wrap font-sans">
                                                {readyToPasteText}
                                              </div>
                                            )}
                                          </div>
                                        </div>
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
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Track Outcomes */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-[18px] font-semibold text-[#1a1d29] mb-6">Step 4: Track Outcomes</h2>

                {/* KPI cards removed as requested for more compact table view */}
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
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[160px]">
                            Visibility (Baseline / Current)
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[160px]">
                            SOA % (Baseline / Current)
                          </th>
                          <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#64748b] uppercase tracking-wider min-w-[160px]">
                            Sentiment (Baseline / Current)
                          </th>
                          <th className="px-6 py-4 text-right text-[12px] font-semibold text-[#64748b] uppercase tracking-wider w-[60px]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e8e9ed]">
                        {recommendations.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-6 py-12 text-center text-[14px] text-[#64748b]">
                              No completed recommendations found. Complete recommendations in Step 3 to see results here.
                            </td>
                          </tr>
                        ) : (
                          <AnimatePresence>
                            {recommendations.map((rec) => {
                              // Parse benchmarked values from recommendation snapshot - robust handling for 0/null
                              const benchmarkedVisibility = (rec.visibilityScore !== null && rec.visibilityScore !== undefined && rec.visibilityScore !== "") ? parseFloat(String(rec.visibilityScore)) : null;
                              const benchmarkedSOA = (rec.soa !== null && rec.soa !== undefined && rec.soa !== "") ? parseFloat(String(rec.soa)) : null;
                              const benchmarkedSentiment = (rec.sentiment !== null && rec.sentiment !== undefined && rec.sentiment !== "") ? parseFloat(String(rec.sentiment)) : null;

                              // Get LIVE Current values from the KPIs state
                              // This ensures "Current" is actually current, not just "After"
                              let currentVisibility: number | null = null;
                              let currentSOA: number | null = null;
                              let currentSentiment: number | null = null;

                              // Helper to find KPI value by name pattern
                              const getLiveValue = (pattern: string) =>
                                kpis.find(k => k.kpiName.toLowerCase().includes(pattern))?.currentValue ?? null;

                              // We can use rec.focusArea to determine which MAIN metric matters, 
                              // but we should try to populate ALL columns if data is available in KPIs
                              currentVisibility = getLiveValue('visibility');
                              currentSOA = getLiveValue('share') || getLiveValue('soa');
                              currentSentiment = getLiveValue('sentiment');

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
                                <motion.tr
                                  key={rec.id}
                                  layout
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{
                                    opacity: 0,
                                    x: 100, // Slide right ("dumped")
                                    y: 20,  // Drop down slightly
                                    scale: 0.9,
                                    rotate: 5, // Tilted drop
                                    transition: { duration: 0.4, ease: "backIn" }
                                  }}
                                  className="bg-white hover:bg-[#f8fafc] transition-colors group"
                                >
                                  {/* Recommendation Action */}
                                  <td className="px-6 py-4">
                                    <div className="text-[14px] font-medium text-[#1a1d29] leading-snug">
                                      {rec.action || 'N/A'}
                                    </div>
                                    {formattedCompletionDate && (
                                      <div className="text-[11px] text-[#64748b] mt-1.5">
                                        {rec.reviewStatus === 'removed' ? (
                                          <span className="text-red-500">Deleted</span>
                                        ) : (
                                          <span>Completed: {formattedCompletionDate}</span>
                                        )}
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

                                  {/* Visibility Metric Group */}
                                  <td className="px-6 py-4">
                                    {benchmarkedVisibility !== null || currentVisibility !== null ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center text-[11px] text-[#64748b]">
                                          <span className="w-16">Baseline:</span>
                                          <span className="font-medium text-[#1a1d29]">{benchmarkedVisibility !== null ? benchmarkedVisibility.toFixed(2) : '—'}</span>
                                        </div>
                                        <div className="flex items-center">
                                          <span className="w-16 text-[12px] text-[#64748b]">Current:</span>
                                          {currentVisibility !== null ? (
                                            <div className="flex items-center gap-1.5 text-left">
                                              <span className={`text-[14px] font-bold ${benchmarkedVisibility !== null && currentVisibility >= benchmarkedVisibility ? 'text-[#06c686]' : (benchmarkedVisibility === null ? 'text-[#1a1d29]' : 'text-[#ef4444]')}`}>
                                                {currentVisibility.toFixed(2)}
                                              </span>
                                              {benchmarkedVisibility !== null && (
                                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${currentVisibility >= benchmarkedVisibility ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                                                  {currentVisibility >= benchmarkedVisibility ? '+' : ''}{(currentVisibility - benchmarkedVisibility).toFixed(2)}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[13px] text-[#94a3b8] italic">Waiting...</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[13px] text-[#94a3b8] italic">—</span>
                                    )}
                                  </td>

                                  {/* SOA Metric Group */}
                                  <td className="px-6 py-4">
                                    {benchmarkedSOA !== null || currentSOA !== null ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center text-[11px] text-[#64748b]">
                                          <span className="w-16">Baseline:</span>
                                          <span className="font-medium text-[#1a1d29]">{benchmarkedSOA !== null ? benchmarkedSOA.toFixed(2) : '—'}</span>
                                        </div>
                                        <div className="flex items-center">
                                          <span className="w-16 text-[12px] text-[#64748b]">Current:</span>
                                          {currentSOA !== null ? (
                                            <div className="flex items-center gap-1.5 text-left">
                                              <span className={`text-[14px] font-bold ${benchmarkedSOA !== null && currentSOA >= benchmarkedSOA ? 'text-[#06c686]' : (benchmarkedSOA === null ? 'text-[#1a1d29]' : 'text-[#ef4444]')}`}>
                                                {currentSOA.toFixed(2)}
                                              </span>
                                              {benchmarkedSOA !== null && (
                                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${currentSOA >= benchmarkedSOA ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                                                  {currentSOA >= benchmarkedSOA ? '+' : ''}{(currentSOA - benchmarkedSOA).toFixed(2)}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[13px] text-[#94a3b8] italic">Waiting...</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[13px] text-[#94a3b8] italic">—</span>
                                    )}
                                  </td>

                                  {/* Sentiment Metric Group */}
                                  <td className="px-6 py-4">
                                    {benchmarkedSentiment !== null || currentSentiment !== null ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center text-[11px] text-[#64748b]">
                                          <span className="w-16">Baseline:</span>
                                          <span className="font-medium text-[#1a1d29]">{benchmarkedSentiment !== null ? benchmarkedSentiment.toFixed(2) : '—'}</span>
                                        </div>
                                        <div className="flex items-center">
                                          <span className="w-16 text-[12px] text-[#64748b]">Current:</span>
                                          {currentSentiment !== null ? (
                                            <div className="flex items-center gap-1.5 text-left">
                                              <span className={`text-[14px] font-bold ${benchmarkedSentiment !== null && currentSentiment >= benchmarkedSentiment ? 'text-[#06c686]' : (benchmarkedSentiment === null ? 'text-[#1a1d29]' : 'text-[#ef4444]')}`}>
                                                {currentSentiment.toFixed(2)}
                                              </span>
                                              {benchmarkedSentiment !== null && (
                                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${currentSentiment >= benchmarkedSentiment ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                                                  {currentSentiment >= benchmarkedSentiment ? '+' : ''}{(currentSentiment - benchmarkedSentiment).toFixed(2)}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[13px] text-[#94a3b8] italic">Waiting...</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[13px] text-[#13px] text-[#94a3b8] italic">—</span>
                                    )}
                                  </td>

                                  {/* Delete Action */}
                                  <td className="px-6 py-4 text-right">
                                    {rec.id && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Are you sure you want to remove this completed recommendation? This will hide it from view.')) {
                                            handleStatusChange(rec.id!, 'removed');
                                          }
                                        }}
                                        className="p-1.5 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fef2f2] rounded-md transition-colors"
                                        title="Stop Tracking"
                                      >
                                        <IconTrash size={16} />
                                      </button>
                                    )}
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      {/* Feedback Modal for Regeneration */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#f3e8ff] rounded-full flex items-center justify-center">
                <IconSparkles size={24} className="text-[#8b5cf6]" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-[#1a1d29]">
                  Regenerate Content with Feedback
                </h2>
                <p className="text-[13px] text-[#64748b]">
                  Provide specific feedback to improve the generated content
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[14px] font-semibold text-[#1a1d29] mb-2">
                Your Feedback <span className="text-[#ef4444]">*</span>
              </label>
              <textarea
                className="w-full h-32 p-4 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-[14px] text-[#1a1d29] leading-relaxed resize-none"
                placeholder="Example: Make the tone more professional, add more technical details about the product features, or focus more on the benefits for enterprise customers..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[12px] text-[#64748b]">
                  Minimum 10 characters required
                </p>
                <p className={`text-[12px] ${feedbackText.length >= 10 ? 'text-[#06c686]' : 'text-[#94a3b8]'}`}>
                  {feedbackText.length} characters
                </p>
              </div>
            </div>

            <div className="bg-[#fef3c7] border border-[#fde68a] rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <IconAlertCircle size={18} className="text-[#92400e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-[#92400e] mb-1">
                    One-Time Regeneration
                  </p>
                  <p className="text-[12px] text-[#92400e]">
                    You can only regenerate content once per recommendation. Make sure your feedback is specific and actionable.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText('');
                  setSelectedRecommendationForRegen(null);
                }}
                className="flex-1 py-3 px-4 bg-white border border-[#e2e8f0] text-[#64748b] rounded-lg text-[14px] font-semibold hover:bg-[#f8fafc] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateContent}
                disabled={feedbackText.trim().length < 10}
                className="flex-1 py-3 px-4 bg-[#8b5cf6] text-white rounded-lg text-[14px] font-semibold hover:bg-[#7c3aed] transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#8b5cf6] disabled:hover:shadow-lg"
              >
                Regenerate Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-[#f0fdf4] rounded-full flex items-center justify-center mx-auto mb-6">
              <IconCheck size={40} className="text-[#06c686]" />
            </div>

            <h2 className="text-[24px] font-bold text-[#1a1d29] mb-3">
              Content Generated!
            </h2>

            <p className="text-[15px] text-[#64748b] leading-relaxed mb-8">
              Great work! Your strategy and implementation content have been generated successfully. The task has moved to the next step where you can review, refine, and finalize it.
            </p>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-4 bg-[#00bcdc] text-white rounded-xl text-[16px] font-bold hover:bg-[#00a8c6] transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              Continue to Review and Refine
            </button>
          </div>
        </div>
      )}
    </Layout >
  );
};