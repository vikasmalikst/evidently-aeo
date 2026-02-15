import { useState, useEffect, useCallback } from 'react';
import logo from '../../assets/logo.png';
import { useNavigate } from 'react-router-dom';
import {
    IconSearch, IconBuildingStore, IconUsers, IconListCheck,
    IconTags, IconCheck, IconRotateClockwise, IconBrain
} from '@tabler/icons-react';
import { generateSynonyms } from '../../lib/onboardingUtils';

// V2-specific steps
import { InputStep } from './InputStep';
import { ResearchStep } from './ResearchStep';
import { ApplyCollectorsStep } from './ApplyCollectorsStep';

// Reuse existing JSON onboarding review steps
import { ReviewBrandStep } from '../Onboarding/JSONSteps/ReviewBrandStep';
import { ReviewCompetitorsStep } from '../Onboarding/JSONSteps/ReviewCompetitorsStep';
import { ReviewQueriesStep } from '../Onboarding/JSONSteps/ReviewQueriesStep';
import { EnrichmentStep } from '../Onboarding/JSONSteps/EnrichmentStep';
import { CompletionStep } from '../Onboarding/JSONSteps/CompletionStep';

import type { BrandOnboardingData } from '../../api/brandApi';

export type OnboardingV2Step = 'input' | 'research' | 'brand' | 'competitors' | 'queries' | 'collectors' | 'enrichment' | 'completion';

const STORAGE_KEY = 'onboarding_v2_state';

interface SavedState {
    currentStep: OnboardingV2Step;
    inputData: { brandName: string; country: string; websiteUrl: string } | null;
    onboardingData: Partial<BrandOnboardingData>;
    aiModels: string[];
    enrichment: {
        brandSynonyms: string[];
        brandProducts: string[];
        competitorSynonyms: Record<string, string[]>;
        competitorProducts: Record<string, string[]>;
    };
}

export const OnboardingV2Page = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState<OnboardingV2Step>('input');
    const [inputData, setInputData] = useState<{ brandName: string; country: string; websiteUrl: string } | null>(null);
    const [onboardingData, setOnboardingData] = useState<Partial<BrandOnboardingData>>({});
    const [aiModels, setAiModels] = useState<string[]>(['chatgpt', 'perplexity']); // Default models

    // Enrichment state
    const [brandSynonyms, setBrandSynonyms] = useState<string[]>([]);
    const [brandProducts, setBrandProducts] = useState<string[]>([]);
    const [competitorSynonyms, setCompetitorSynonyms] = useState<Record<string, string[]>>({});
    const [competitorProducts, setCompetitorProducts] = useState<Record<string, string[]>>({});

    // Load state on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed: SavedState = JSON.parse(saved);
                // Don't resume on the 'research' step — go back to input
                if (parsed.currentStep === 'research') {
                    setCurrentStep('input');
                    setInputData(parsed.inputData);
                } else {
                    setCurrentStep(parsed.currentStep);
                    setInputData(parsed.inputData);
                    setOnboardingData(parsed.onboardingData);
                    setAiModels(parsed.aiModels || ['chatgpt', 'perplexity']);
                    setBrandSynonyms(parsed.enrichment?.brandSynonyms || []);
                    setBrandProducts(parsed.enrichment?.brandProducts || []);
                    setCompetitorSynonyms(parsed.enrichment?.competitorSynonyms || {});
                    setCompetitorProducts(parsed.enrichment?.competitorProducts || {});
                }
            } catch (e) {
                console.error('Failed to load saved onboarding V2 state', e);
            }
        }
        setIsLoading(false);
    }, []);

    // Save state on change
    useEffect(() => {
        if (isLoading) return;
        if (currentStep === 'input' && !inputData) return;

        const stateToSave: SavedState = {
            currentStep,
            inputData,
            onboardingData,
            aiModels,
            enrichment: {
                brandSynonyms,
                brandProducts,
                competitorSynonyms,
                competitorProducts,
            },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }, [currentStep, inputData, onboardingData, brandSynonyms, brandProducts, competitorSynonyms, competitorProducts, isLoading]);

    const handleClearCache = () => {
        if (confirm('Are you sure you want to clear your progress and start over?')) {
            localStorage.removeItem(STORAGE_KEY);
            setCurrentStep('input');
            setInputData(null);
            setOnboardingData({});
            setBrandSynonyms([]);
            setBrandProducts([]);
            setCompetitorSynonyms({});
            setCompetitorProducts({});
        }
    };

    const handleInputSubmit = (data: { brandName: string; country: string; websiteUrl: string }) => {
        setInputData(data);
        setCurrentStep('research');
    };

    const handleResearchComplete = useCallback((data: any) => {
        // Map the research result to BrandOnboardingData shape
        const mapped: Partial<BrandOnboardingData> & Record<string, any> = {
            brand_name: data.brand_name || inputData?.brandName || '',
            website_url: data.website_url || inputData?.websiteUrl || '',
            industry: data.industry || '',
            description: data.description || '',
            // IMPORTANT: ReviewCompetitorsStep reads comp.company_name and comp.domain
            competitors: (data.competitors || []).map((c: any) => ({
                name: c.name,
                company_name: c.name,  // ReviewCompetitorsStep uses this key
                domain: c.domain,
                url: c.domain,
            })),
            metadata: data.metadata || {},
        };

        // Transform flat queries array into biased_prompts/blind_prompts nested format
        // that ReviewQueriesStep expects (it reads data.biased_prompts and data.blind_prompts)
        if (data.queries && Array.isArray(data.queries)) {
            const biasedPrompts: Record<string, any[]> = {};
            const blindPrompts: Record<string, any[]> = {};

            data.queries.forEach((q: any) => {
                const tag = q.query_tag || 'neutral';
                const category = q.category || 'General';
                // Normalize category key for grouping (lowercase, underscored)
                const categoryKey = category.toLowerCase().replace(/[\s\/&]+/g, '_');

                const promptObj = { prompt: q.prompt, category };

                if (tag === 'branded') {
                    if (!biasedPrompts[categoryKey]) biasedPrompts[categoryKey] = [];
                    biasedPrompts[categoryKey].push(promptObj);
                } else {
                    if (!blindPrompts[categoryKey]) blindPrompts[categoryKey] = [];
                    blindPrompts[categoryKey].push(promptObj);
                }
            });

            mapped.biased_prompts = biasedPrompts;
            mapped.blind_prompts = blindPrompts;

            // Also generate topics from query categories for enrichment
            const categoryMap = new Map<string, number>();
            data.queries.forEach((q: any) => {
                const cat = q.category || 'General';
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
            });

            mapped.aeo_topics = Array.from(categoryMap.entries()).map(([label, count]) => ({
                label,
                weight: count,
            }));
        }

        setOnboardingData(mapped);

        // Auto-generate synonyms
        if (mapped.brand_name) {
            const generated = generateSynonyms(mapped.brand_name, mapped.website_url || '');
            setBrandSynonyms(generated);
        }

        if (Array.isArray(mapped.competitors)) {
            const compSynonyms: Record<string, string[]> = {};
            mapped.competitors.forEach((comp: any) => {
                const name = typeof comp === 'string' ? comp : comp.name;
                if (name) {
                    compSynonyms[name] = generateSynonyms(name, comp.domain || '');
                }
            });
            setCompetitorSynonyms(compSynonyms);
        }

        setCurrentStep('brand');
    }, [inputData]);

    // specific effect to handle manual additions of competitors
    useEffect(() => {
        if (!onboardingData.competitors || !Array.isArray(onboardingData.competitors)) return;

        setCompetitorSynonyms(prev => {
            const next = { ...prev };
            let hasChanges = false;

            onboardingData.competitors!.forEach((comp: any) => {
                const name = comp.name || comp.company_name;
                // If this competitor doesn't have synonyms yet, generate them
                if (name && !next[name]) {
                    next[name] = generateSynonyms(name, comp.domain || '');
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });
    }, [onboardingData.competitors]);

    // Step definitions for the progress bar
    const steps = [
        { id: 'input', label: 'Input', icon: IconSearch },
        { id: 'brand', label: 'Brand', icon: IconBuildingStore },
        { id: 'competitors', label: 'Competitors', icon: IconUsers },
        { id: 'queries', label: 'Queries', icon: IconListCheck },
        { id: 'collectors', label: 'Collectors', icon: IconBrain },
        { id: 'enrichment', label: 'Enrichment', icon: IconTags },
        { id: 'completion', label: 'Complete', icon: IconCheck },
    ];

    // Map 'research' to 'input' step visually
    const currentStepIndex = currentStep === 'research'
        ? 0
        : steps.findIndex(s => s.id === currentStep);

    if (isLoading) return null;

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
            {/* Header */}
            <header className="h-16 border-b border-[var(--border-default)] bg-white px-8 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="EvidentlyAEO Logo" className="h-8 w-8 object-contain" />
                    <h1 className="text-xl font-bold text-[var(--text-headings)] tracking-tight">
                        EvidentlyAEO
                    </h1>
                    <div className="h-6 w-px bg-gray-200 mx-1"></div>
                    <span className="text-gray-500 font-medium">Brand Onboarding</span>
                </div>
                <div className="flex items-center gap-4">
                    {currentStep !== 'input' && (
                        <button
                            onClick={handleClearCache}
                            className="text-sm font-medium text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                        >
                            <IconRotateClockwise size={14} /> Start Over
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/measure')}
                        className="text-sm text-[var(--text-caption)] hover:text-[var(--text-headings)] transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto p-8">
                {/* Progress Stepper — hidden during research */}
                {currentStep !== 'research' && (
                    <div className="mb-12">
                        <div className="flex items-center justify-between relative">
                            {/* Connecting Line */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100 -z-10" />
                            <div
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[var(--accent-primary)] -z-10 transition-all duration-500"
                                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                            />

                            {steps.map((step, index) => {
                                const isActive = index === currentStepIndex;
                                const isCompleted = index < currentStepIndex;
                                const Icon = step.icon;

                                return (
                                    <div key={step.id} className="flex flex-col items-center gap-2 bg-[var(--bg-primary)] px-2">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive
                                                ? 'border-[var(--accent-primary)] bg-white text-[var(--accent-primary)] shadow-md scale-110'
                                                : isCompleted
                                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                                                    : 'border-gray-200 bg-white text-gray-300'
                                                }`}
                                        >
                                            <Icon size={18} />
                                        </div>
                                        <span className={`text-xs font-medium transition-colors duration-300 ${isActive ? 'text-[var(--text-headings)]' : 'text-[var(--text-caption)]'
                                            }`}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step Content */}
                <div className="bg-white rounded-2xl border border-[var(--border-default)] shadow-sm p-8 min-h-[400px]">
                    {currentStep === 'input' && (
                        <InputStep onSubmit={handleInputSubmit} />
                    )}
                    {currentStep === 'research' && inputData && (
                        <ResearchStep
                            brandName={inputData.brandName}
                            country={inputData.country}
                            websiteUrl={inputData.websiteUrl}
                            onComplete={handleResearchComplete}
                            onBack={() => setCurrentStep('input')}
                        />
                    )}
                    {currentStep === 'brand' && (
                        <ReviewBrandStep
                            data={onboardingData}
                            updateData={setOnboardingData}
                            onNext={() => setCurrentStep('competitors')}
                            onBack={() => setCurrentStep('input')}
                        />
                    )}
                    {currentStep === 'competitors' && (
                        <ReviewCompetitorsStep
                            data={onboardingData}
                            updateData={setOnboardingData}
                            onNext={() => setCurrentStep('queries')}
                            onBack={() => setCurrentStep('brand')}
                        />
                    )}
                    {currentStep === 'queries' && (
                        <ReviewQueriesStep
                            data={onboardingData}
                            updateData={setOnboardingData}
                            onNext={() => setCurrentStep('collectors')}
                            onBack={() => setCurrentStep('competitors')}
                        />
                    )}
                    {currentStep === 'collectors' && (
                        <ApplyCollectorsStep
                            data={onboardingData}
                            selectedModels={aiModels}
                            updateData={setOnboardingData}
                            onNext={() => setCurrentStep('enrichment')}
                            onBack={() => setCurrentStep('queries')}
                            onModelToggle={(modelId: string) => {
                                setAiModels(prev =>
                                    prev.includes(modelId)
                                        ? prev.filter(m => m !== modelId)
                                        : [...prev, modelId]
                                );
                            }}
                        />
                    )}
                    {currentStep === 'enrichment' && (
                        <EnrichmentStep
                            brandSynonyms={brandSynonyms}
                            setBrandSynonyms={setBrandSynonyms}
                            brandProducts={brandProducts}
                            setBrandProducts={setBrandProducts}
                            competitorSynonyms={competitorSynonyms}
                            setCompetitorSynonyms={setCompetitorSynonyms}
                            competitorProducts={competitorProducts}
                            setCompetitorProducts={setCompetitorProducts}
                            brandName={onboardingData.brand_name || ''}
                            brandUrl={onboardingData.website_url || ''}
                            competitors={onboardingData.competitors || []}
                            onNext={() => setCurrentStep('completion')}
                            onBack={() => setCurrentStep('collectors')}
                        />
                    )}
                    {currentStep === 'completion' && (
                        <CompletionStep
                            data={{
                                ...onboardingData,
                                ai_models: aiModels
                            }}
                            enrichment={{
                                brandSynonyms,
                                brandProducts,
                                competitorSynonyms,
                                competitorProducts,
                            }}
                            onBack={() => setCurrentStep('enrichment')}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};
