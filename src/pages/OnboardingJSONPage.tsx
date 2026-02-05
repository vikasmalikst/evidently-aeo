import { useState, useEffect } from 'react';
import logo from '../assets/logo.png';
import { OnboardingLayout } from './OnboardingLayout';
import { useNavigate } from 'react-router-dom';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { IconUpload, IconBuildingStore, IconUsers, IconListCheck, IconTags, IconCheck, IconRotateClockwise } from '@tabler/icons-react';
import { generateSynonyms } from '../lib/onboardingUtils';

// Step Components (to be created)
import { UploadStep } from '../components/Onboarding/JSONSteps/UploadStep';
import { InitialAnalysisStep } from '../components/Onboarding/JSONSteps/InitialAnalysisStep';
import { ReviewBrandStep } from '../components/Onboarding/JSONSteps/ReviewBrandStep';
import { ReviewCompetitorsStep } from '../components/Onboarding/JSONSteps/ReviewCompetitorsStep';
import { ReviewQueriesStep } from '../components/Onboarding/JSONSteps/ReviewQueriesStep';
import { EnrichmentStep } from '../components/Onboarding/JSONSteps/EnrichmentStep';
import { CompletionStep } from '../components/Onboarding/JSONSteps/CompletionStep';

import type { BrandOnboardingData } from '../api/brandApi';

export type JSONOnboardingStep = 'upload' | 'initial-analysis' | 'brand' | 'competitors' | 'queries' | 'enrichment' | 'completion';

const STORAGE_KEY = 'json_onboarding_state';

interface SavedState {
    currentStep: JSONOnboardingStep;
    onboardingData: Partial<BrandOnboardingData>;
    enrichment: {
        brandSynonyms: string[];
        brandProducts: string[];
        competitorSynonyms: Record<string, string[]>;
        competitorProducts: Record<string, string[]>;
    }
}

export const OnboardingJSONPage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState<JSONOnboardingStep>('upload');
    const [onboardingData, setOnboardingData] = useState<Partial<BrandOnboardingData>>({});

    // Specific state for the "Enrichment" step which isn't in the JSON
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
                setCurrentStep(parsed.currentStep);
                setOnboardingData(parsed.onboardingData);
                setBrandSynonyms(parsed.enrichment.brandSynonyms || []);
                setBrandProducts(parsed.enrichment.brandProducts || []);
                setCompetitorSynonyms(parsed.enrichment.competitorSynonyms || {});
                setCompetitorProducts(parsed.enrichment.competitorProducts || {});
                setCompetitorProducts(parsed.enrichment.competitorProducts || {});
            } catch (e) {
                console.error('Failed to load saved onboarding state', e);
            }
        }
        setIsLoading(false);
    }, []);

    // Save state on change
    useEffect(() => {
        if (isLoading) return; // Don't save empty state while loading

        // Don't save if we are just at upload and nothing is loaded
        if (currentStep === 'upload' && Object.keys(onboardingData).length === 0) return;

        const stateToSave: SavedState = {
            currentStep,
            onboardingData,
            enrichment: {
                brandSynonyms,
                brandProducts,
                competitorSynonyms,
                competitorProducts
            }
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }, [currentStep, onboardingData, brandSynonyms, brandProducts, competitorSynonyms, competitorProducts, isLoading]);

    const handleClearCache = () => {
        if (confirm('Are you sure you want to clear your progress and start over?')) {
            localStorage.removeItem(STORAGE_KEY);
            // Reset all state
            setCurrentStep('upload');
            setOnboardingData({});
            setBrandSynonyms([]);
            setBrandProducts([]);
            setCompetitorSynonyms({});
        }
    };



    const handleJSONLoaded = (data: any) => {
        // Basic mapping from JSON to internal structure
        // We'll refine this in the UploadStep component, but storing raw/mapped data here
        setOnboardingData(data);

        // Auto-Enrich Synonyms
        if (data.company_profile) {
            const generated = generateSynonyms(
                data.company_profile.company_name,
                data.company_profile.website
            );
            setBrandSynonyms(generated);
        }

        if (Array.isArray(data.competitors)) {
            const compSynonyms: Record<string, string[]> = {};
            data.competitors.forEach((comp: any) => {
                if (comp.company_name) {
                    compSynonyms[comp.company_name] = generateSynonyms(
                        comp.company_name,
                        comp.domain // Assuming domain might be just "tui.co.uk" or full url
                    );
                }
            });
            setCompetitorSynonyms(compSynonyms);
        }

        setCurrentStep('initial-analysis');
    };

    const steps = [

        { id: 'brand', label: 'Brand', icon: IconBuildingStore },
        { id: 'competitors', label: 'Competitors', icon: IconUsers },
        { id: 'queries', label: 'Queries', icon: IconListCheck },
        { id: 'enrichment', label: 'Enrichment', icon: IconTags },
        { id: 'completion', label: 'Complete', icon: IconCheck },
    ];

    // If we are in 'initial-analysis', we treat it as part of the "Brand" step visually (Index 0)
    // or we could assume it's before brand. For now, let's make it look like "Brand" is active.
    const currentStepIndex = currentStep === 'initial-analysis' ? 0 : steps.findIndex(s => s.id === currentStep);

    if (isLoading) return null; // Or a spinner

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
                    {currentStep !== 'upload' && (
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
                {/* Progress Stepper */}
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

                {/* Step Content */}
                <div className="bg-white rounded-2xl border border-[var(--border-default)] shadow-sm p-8 min-h-[400px]">
                    {currentStep === 'upload' && (
                        <UploadStep onNext={handleJSONLoaded} />
                    )}
                    {currentStep === 'initial-analysis' && (
                        <InitialAnalysisStep
                            data={onboardingData}
                            updateData={setOnboardingData}
                            onNext={() => setCurrentStep('brand')}
                        />
                    )}
                    {currentStep === 'brand' && (
                        <ReviewBrandStep
                            data={onboardingData}
                            updateData={setOnboardingData}
                            onNext={() => setCurrentStep('competitors')}
                            onBack={() => setCurrentStep('upload')}
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
                            onNext={() => setCurrentStep('enrichment')}
                            onBack={() => setCurrentStep('competitors')}
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
                            // For context
                            brandName={onboardingData.brand_name || ''}
                            brandUrl={onboardingData.website_url || (onboardingData as any).company_profile?.website || ''}
                            competitors={onboardingData.competitors || []}
                            onNext={() => setCurrentStep('completion')}
                            onBack={() => setCurrentStep('queries')}
                        />
                    )}
                    {currentStep === 'completion' && (
                        <CompletionStep
                            data={onboardingData}
                            enrichment={{
                                brandSynonyms,
                                brandProducts,
                                competitorSynonyms,
                                competitorProducts
                            }}
                            onBack={() => setCurrentStep('enrichment')}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};
