
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useManualBrandDashboard } from '../../../manual-dashboard';
import {
    getRecommendationsByStepV3,
    getGenerationV3,
    getLatestGenerationV3,
    updateRecommendationStatusV3,
    getKPIsV3,
    uploadContextFileV3,
    deleteContextFileV3,
    type RecommendationV3,
    type IdentifiedKPI,
    type StrategyPlan
} from '../../../api/recommendationsV3Api';
import { fetchRecommendationContentLatest } from '../../../api/recommendationsApi';

export const useRecommendationEngine = (initialStep?: number) => {
    const [searchParams] = useSearchParams();
    const highlightRecId = searchParams.get('highlightRecId');

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

    // State
    const [currentStep, setCurrentStep] = useState<number>(() => initialStep || getPersistedStep(selectedBrandId));
    const [generationId, setGenerationId] = useState<string | null>(null);
    const [dataMaturity, setDataMaturity] = useState<'cold_start' | 'low_data' | 'normal' | null>(null);
    const [kpis, setKpis] = useState<IdentifiedKPI[]>([]);
    const [recommendations, setRecommendations] = useState<RecommendationV3[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Map<string, { content: boolean }>>(new Map());
    const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contentMap, setContentMap] = useState<Map<string, any>>(new Map());
    const [guideMap, setGuideMap] = useState<Map<string, any>>(new Map());

    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
    const [effortFilter, setEffortFilter] = useState<'all' | 'Low' | 'Medium' | 'High'>('all');
    const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
    const [allRecommendations, setAllRecommendations] = useState<RecommendationV3[]>([]);

    // Other UI State
    const [strategyPlans, setStrategyPlans] = useState<Map<string, StrategyPlan>>(new Map());
    const [stepCounts, setStepCounts] = useState<Record<number, number>>({});
    const [brandName, setBrandName] = useState<string>('');
    const [targetExpandedId, setTargetExpandedId] = useState<string | null>(null);
    const [uploadingContextRecId, setUploadingContextRecId] = useState<string | null>(null);
    const [removingContextFileId, setRemovingContextFileId] = useState<string | null>(null);

    // Manual loading tracking
    const [isManuallyLoading, setIsManuallyLoading] = useState(false);
    const isManuallyNavigatingRef = useRef(false);
    const lastManuallyLoadedStepRef = useRef<number | null>(null);

    const isColdStart = dataMaturity === 'cold_start';

    // Available Content Types
    const availableContentTypes = useMemo(() => {
        const types = new Set<string>();
        allRecommendations.forEach(rec => {
            if (rec.assetType) {
                types.add(rec.assetType);
            }
        });
        return Array.from(types).sort();
    }, [allRecommendations]);

    // JSON Parsing Helper
    const safeJsonParse = useCallback((value: any): any => {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return value;
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }, []);

    const extractGuideObject = useCallback((contentRecordOrRaw: any): any => {
        if (contentRecordOrRaw && typeof contentRecordOrRaw === 'object' && 'content' in contentRecordOrRaw) {
            return safeJsonParse((contentRecordOrRaw as any).content);
        }
        return safeJsonParse(contentRecordOrRaw);
    }, [safeJsonParse]);

    // Fetch Counts
    useEffect(() => {
        if (!generationId) return;

        const fetchCounts = async () => {
            try {
                const response = await getGenerationV3(generationId);
                if (response.success && response.data?.recommendations) {
                    const recs = response.data.recommendations;
                    const counts = {
                        1: recs.filter(r => r.reviewStatus === 'pending_review' || !r.reviewStatus).length,
                        2: recs.filter(r => r.isApproved && !r.isContentGenerated).length,
                        3: recs.filter(r => r.isContentGenerated && !r.isCompleted).length,
                        4: recs.filter(r => r.isCompleted).length
                    };
                    setStepCounts(counts);
                }
            } catch (err) {
                console.error('Error fetching generation counts:', err);
            }
        };

        fetchCounts();
    }, [generationId, currentStep]);

    // Reset GuideMap on generation change
    useEffect(() => {
        setGuideMap(new Map());
    }, [generationId]);

    // Main Data Loading Effect
    useEffect(() => {
        if (!generationId || !selectedBrandId) return;

        if (isManuallyLoading || isManuallyNavigatingRef.current) {
            console.log('⏭️ [RecommendationsV3] Skipping loadStepData - manual load in progress');
            return;
        }

        if (lastManuallyLoadedStepRef.current === currentStep) {
            // Clear the ref after a brief delay
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
                console.log(`📥 [RecommendationsV3] Loading Step ${currentStep} data for generation ${generationId}`);
                const response = await getRecommendationsByStepV3(generationId, currentStep);

                if (response.success && response.data) {
                    if (response.data.dataMaturity !== undefined) {
                        setDataMaturity((response.data.dataMaturity as any) || null);
                    }
                    if (response.data.brandName) {
                        setBrandName(response.data.brandName);
                    }

                    const recommendationsWithIds = response.data.recommendations
                        .filter(rec => rec.id && rec.id.length > 10)
                        .map(rec => ({ ...rec, id: rec.id! }));

                    // Handle target ID sorting
                    const targetId = currentStep === 3 ? expandedRecId : (targetExpandedId || highlightRecId);
                    if (targetId) {
                        const index = recommendationsWithIds.findIndex(rec => rec.id === targetId);
                        if (index > 0) {
                            const [item] = recommendationsWithIds.splice(index, 1);
                            recommendationsWithIds.unshift(item);
                        }
                    }

                    if (recommendationsWithIds.length === 0 && response.data.recommendations.length > 0) {
                        setError('Recommendations loaded but no valid IDs found. Please refresh the page.');
                    } else {
                        if (currentStep === 1) {
                            // Merge to preserve status changes
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
                        } else {
                            setAllRecommendations([]);
                            setRecommendations(recommendationsWithIds);
                        }
                        setError(null);
                    }

                    // Step 3 Content Loading
                    if (currentStep === 3) {
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
                    }

                } else {
                    if (response.error?.includes('not found') || response.error?.includes('No recommendations')) {
                        setRecommendations([]);
                        setError(null);
                    } else {
                        if (response.error && !response.error.includes('No recommendations')) {
                            setError(response.error);
                        } else {
                            setRecommendations([]);
                            setError(null);
                        }
                    }
                }
            } catch (err: any) {
                console.error('Error loading step data:', err);
                if (!err.message?.includes('timeout') && !err.message?.includes('network') && !err.message?.includes('aborted')) {
                    setError(err.message || 'Failed to load recommendations');
                } else {
                    setError(null);
                }
            } finally {
                if (!isManuallyLoading) {
                    setIsLoading(false);
                }
            }
        };

        loadStepData();
    }, [generationId, currentStep, selectedBrandId]); // eslint-disable-next-line react-hooks/exhaustive-deps

    // Filter Effect
    useEffect(() => {
        if (currentStep !== 1) return;
        if (allRecommendations.length === 0) {
            setRecommendations([]);
            return;
        }

        let filtered = [...allRecommendations];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(rec => (rec.reviewStatus || 'pending_review') === statusFilter);
        }
        if (priorityFilter !== 'all') {
            filtered = filtered.filter(rec => rec.priority === priorityFilter);
        }
        if (effortFilter !== 'all') {
            filtered = filtered.filter(rec => rec.effort === effortFilter);
        }
        if (contentTypeFilter !== 'all') {
            filtered = filtered.filter(rec => rec.assetType === contentTypeFilter);
        }

        // Sort
        filtered.sort((a, b) => {
            const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
            const effortOrder: Record<string, number> = { 'Low': 3, 'Medium': 2, 'High': 1 };

            const pA = priorityOrder[a.priority] || 0;
            const pB = priorityOrder[b.priority] || 0;
            if (pA !== pB) return pB - pA;

            const eA = effortOrder[a.effort] || 0;
            const eB = effortOrder[b.effort] || 0;
            return eB - eA;
        });

        setRecommendations(filtered);
    }, [statusFilter, priorityFilter, effortFilter, contentTypeFilter, allRecommendations, currentStep]);

    // Persist Step Effects
    useEffect(() => {
        if (selectedBrandId) {
            setCurrentStep(getPersistedStep(selectedBrandId));
        }
    }, [selectedBrandId]);

    useEffect(() => {
        if (selectedBrandId && currentStep >= 1 && currentStep <= 4) {
            persistStep(currentStep, selectedBrandId);
        }
    }, [currentStep, selectedBrandId]);

    // Load Latest Generation
    useEffect(() => {
        if (!selectedBrandId) return;

        const loadLatestGeneration = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await getLatestGenerationV3(selectedBrandId);
                if (response.success && response.data && response.data.generationId) {
                    const genId = response.data.generationId;
                    if (response.data.dataMaturity !== undefined) {
                        setDataMaturity((response.data.dataMaturity as any) || null);
                    }

                    if (genId !== generationId) {
                        setGenerationId(genId);
                        if (response.data.recommendations?.length > 0) {
                            // Ensure IDs
                            const recommendationsWithIds = response.data.recommendations
                                .filter(rec => rec.id && rec.id.length > 10)
                                .map(rec => ({ ...rec, id: rec.id! }));

                            if (recommendationsWithIds.length > 0) {
                                setKpis(response.data.kpis || []);
                                setSelectedIds(new Set());
                            }
                        }
                    }
                } else {
                    setRecommendations([]);
                    setGenerationId(null);
                    setCurrentStep(1);
                    persistStep(1, selectedBrandId);
                }
            } catch (err) {
                console.error('Error loading latest generation:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadLatestGeneration();
    }, [selectedBrandId]); // eslint-disable-next-line react-hooks/exhaustive-deps

    // Load KPIs
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

    // Actions
    const handleNavigate = (step: number, recId?: string) => {
        setCurrentStep(step);
        if (recId) {
            if (step === 3) {
                setExpandedRecId(recId);
            } else {
                setTargetExpandedId(recId);
            }
        } else {
            setTargetExpandedId(null);
            if (step === 3) {
                setExpandedRecId(null);
            }
        }
    };

    const handleBrandSwitch = useCallback((newBrandId: string) => {
        setGenerationId(null);
        setRecommendations([]);
        setAllRecommendations([]);
        setSelectedIds(new Set());
        setContentMap(new Map());
        setExpandedSections(new Map());
        setDataMaturity(null);
        setError(null);
        setStatusFilter('all');
        setPriorityFilter('all');
        setEffortFilter('all');
        setCurrentStep(getPersistedStep(newBrandId));
        selectBrand(newBrandId);
    }, [selectBrand]);

    const handleStatusChange = async (recommendationId: string, status: 'pending_review' | 'approved' | 'rejected' | 'removed') => {
        if (!recommendationId) return;
        setError(null);

        // Optimistic Update
        if (status === 'removed' || status === 'rejected' || (status === 'pending_review' && currentStep > 1)) {
            setRecommendations(prev => prev.filter(r => r.id !== recommendationId));
            setAllRecommendations(prev => prev.filter(r => r.id !== recommendationId));
        } else {
            const updateRec = (rec: RecommendationV3) =>
                rec.id === recommendationId
                    ? { ...rec, reviewStatus: status, isApproved: status === 'approved' }
                    : rec;
            setRecommendations(prev => prev.map(updateRec));
            setAllRecommendations(prev => prev.map(updateRec));
        }

        try {
            const response = await updateRecommendationStatusV3(recommendationId, status);
            if (!response.success) {
                setError(response.error || 'Failed to update status');
                // Revert logic would go here if strict
            }
        } catch (err: any) {
            setError(err.message || 'Failed to update status');
        }
    };

    const handleUploadContext = async (recId: string, file: File) => {
        if (uploadingContextRecId === recId) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('File size exceeds 5MB limit');
            return;
        }

        setUploadingContextRecId(recId);
        try {
            const response = await uploadContextFileV3(recId, file);
            if (response.success && response.data?.file) {
                const newFile = response.data.file;
                setStrategyPlans(prev => {
                    const next = new Map(prev);
                    const existingPlan = next.get(recId) || {
                        recommendationId: recId,
                        contentType: 'article',
                        primaryEntity: '',
                        targetChannel: '',
                        brandContext: { name: brandName || '' },
                        structure: [],
                        strategicGuidance: {
                            keyFocus: '',
                            aeoTargets: [],
                            toneGuidelines: '',
                            differentiation: ''
                        },
                        contextFiles: []
                    };
                    const updatedFiles = [...(existingPlan.contextFiles || []), newFile];
                    next.set(recId, { ...existingPlan, contextFiles: updatedFiles });
                    return next;
                });
            } else {
                setError(response.error || 'Failed to upload context file');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to upload context file');
        } finally {
            setUploadingContextRecId(null);
        }
    };

    const handleRemoveContextFile = async (recId: string, fileId: string) => {
        if (removingContextFileId === fileId) return;
        setRemovingContextFileId(fileId);
        setError(null);
        try {
            const response = await deleteContextFileV3(recId, fileId);
            if (response.success) {
                setStrategyPlans(prev => {
                    const next = new Map(prev);
                    const existingPlan = next.get(recId);
                    if (!existingPlan || !existingPlan.contextFiles) return next;
                    const updatedFiles = existingPlan.contextFiles.filter((file: any) => file.id !== fileId);
                    next.set(recId, { ...existingPlan, contextFiles: updatedFiles });
                    return next;
                });
            } else {
                setError(response.error || 'Failed to remove context file');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to remove context file');
        } finally {
            setRemovingContextFileId(null);
        }
    };

    return {
        // State
        generationId,
        currentStep,
        recommendations,
        allRecommendations,
        isLoading,
        error,
        selectedIds,
        expandedSections,
        expandedRecId,
        contentMap,
        guideMap,
        kpis,
        stepCounts,
        dataMaturity,
        brandName,
        strategyPlans,
        uploadingContextRecId,
        removingContextFileId,
        isColdStart,

        // Filters
        filters: {
            status: statusFilter,
            priority: priorityFilter,
            effort: effortFilter,
            contentType: contentTypeFilter,
            availableContentTypes
        },
        setFilters: {
            setStatus: setStatusFilter,
            setPriority: setPriorityFilter,
            setEffort: setEffortFilter,
            setContentType: setContentTypeFilter
        },

        // Setters
        setCurrentStep,
        setRecommendations,
        setAllRecommendations,
        setSelectedIds,
        setExpandedSections,
        setExpandedRecId,
        setContentMap,
        setGuideMap,
        setStrategyPlans,
        setError,
        setIsLoading,

        // Actions
        handleNavigate,
        handleBrandSwitch,
        handleStatusChange,
        handleUploadContext,
        handleRemoveContextFile,

        // Manual Dashboard
        brands,
        brandsLoading,
        selectedBrandId,
        selectedBrand,
        selectBrand
    };
};
