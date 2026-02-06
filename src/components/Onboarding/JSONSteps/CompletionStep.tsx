import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck, IconLoader2, IconAlertTriangle } from '@tabler/icons-react';
import { submitBrandOnboarding, type BrandOnboardingData } from '../../../api/brandApi';
import { SafeLogo } from '../common/SafeLogo';

interface CompletionStepProps {
    data: any;
    enrichment: {
        brandSynonyms: string[];
        brandProducts: string[];
        competitorSynonyms: Record<string, string[]>;
        competitorProducts: Record<string, string[]>;
    };
    onBack: () => void;
}

export const CompletionStep = ({ data, enrichment, onBack }: CompletionStepProps) => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate counts
    const getQueryCount = (promptsObj: any) => {
        if (!promptsObj) return 0;
        return Object.values(promptsObj).reduce((acc: number, val: any) => {
            return acc + (Array.isArray(val) ? val.length : 0);
        }, 0);
    };

    const biasedCount = getQueryCount(data.biased_prompts);
    const blindCount = getQueryCount(data.blind_prompts);
    const totalQueries = biasedCount + blindCount;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            // Map data to API format
            // Flatten prompts from the nested structure
            // Map data to API format
            // Extract Unique Topics (Categories) for aeo_topics payload
            // Stores full queries in metadata for the Admin Tool to process manually
            const uniqueCategories = new Set<string>();
            const biasedTopics: any[] = [];
            const blindTopics: any[] = [];

            // Helper to collect categories and build clean prompt lists for metadata
            const processPrompts = (sourcePrompts: any, targetArray: any[]) => {
                if (!sourcePrompts) return;
                Object.entries(sourcePrompts).forEach(([key, group]: [string, any]) => {
                    if (Array.isArray(group)) {
                        group.forEach((p: any) => {
                            if (p.category) uniqueCategories.add(p.category);
                            targetArray.push({
                                prompt: p.prompt,
                                topic: p.category
                            });
                        });
                    }
                });
            };

            processPrompts(data.biased_prompts, biasedTopics);
            processPrompts(data.blind_prompts, blindTopics);

            // Construct aeo_topics from unique categories
            const aeoTopics = Array.from(uniqueCategories).map(cat => ({
                label: cat,
                weight: 1,
                category: cat,
                source: 'manual_upload',
                type: 'topic'
            }));

            // Map Competitors with synonyms
            const mappedCompetitors = (data.competitors || []).map((comp: any) => ({
                name: comp.company_name,
                domain: comp.domain,
                customer_segment: comp.customer_segment, // Pass extra metadata if backend supports
                synonyms: enrichment.competitorSynonyms[comp.company_name] || []
            }));

            const payload: BrandOnboardingData = {
                brand_name: data.brand_name,
                website_url: data.website_url,
                industry: data.industry,
                description: data.description,
                competitors: mappedCompetitors,
                aeo_topics: aeoTopics,
                // Pass enrichment data for brand
                enrichment_data: {
                    brand: {
                        synonyms: enrichment.brandSynonyms,
                        products: enrichment.brandProducts
                    },
                    competitors: Object.entries(enrichment.competitorSynonyms).reduce((acc, [key, synonyms]) => {
                        acc[key] = {
                            synonyms: synonyms,
                            products: enrichment.competitorProducts[key] || []
                        };
                        return acc;
                    }, {} as Record<string, { synonyms: string[]; products: string[] }>)
                },
                // Metadata for context
                metadata: {
                    source: 'json_upload',
                    onboarding_date: new Date().toISOString(),
                    manual_collection_trigger_required: true, // Flag for backend to NOT auto-run yet
                    biased_prompts: biasedTopics,
                    blind_prompts: blindTopics,
                    // IMPORTANT: Pass combined queries here so backend inserts them into generated_queries table
                    prompts_with_topics: [...biasedTopics, ...blindTopics]
                }
            };

            const response = await submitBrandOnboarding(payload);

            if (response.success) {
                // Success! Redirect to setup or manage brands
                // We specifically want to go to a place where they can "Trigger" the collection
                // For now, let's go to Manage Brands with a success flag
                navigate('/settings/manage-brands?onboarding=success');
            } else {
                setError(response.error || 'Failed to submit onboarding data.');
            }

        } catch (err: any) {
            console.error('Submission failed', err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto text-center animate-in fade-in zoom-in duration-300">

            {!isSubmitting && !error && (
                <>
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <IconCheck size={40} stroke={3} />
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--text-headings)]">Ready to Import</h2>
                    <p className="text-[var(--text-caption)] mt-4 max-w-md mx-auto text-base">
                        You are about to import <strong>{data.brand_name}</strong>.
                    </p>

                    <div className="mt-8 mb-10 space-y-6">
                        {/* Competitors Section */}
                        <div className="bg-gray-50 border border-[var(--border-default)] rounded-xl p-6">
                            <h3 className="text-sm font-bold text-[var(--text-headings)] mb-4 text-left flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">C</span>
                                Tracking {data.competitors?.length || 0} Competitors
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {data.competitors?.map((comp: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                        <SafeLogo
                                            domain={comp.domain}
                                            alt={comp.company_name}
                                            className="w-8 h-8 rounded shrink-0 object-contain"
                                        />
                                        <span className="text-sm font-medium text-gray-700 truncate" title={comp.company_name}>
                                            {comp.company_name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Queries Section */}
                        <div className="bg-gray-50 border border-[var(--border-default)] rounded-xl p-6">
                            <h3 className="text-sm font-bold text-[var(--text-headings)] mb-4 text-left flex items-center gap-2">
                                <span className="bg-purple-100 text-purple-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">Q</span>
                                Tracking {totalQueries} Queries
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex-1 p-3 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                        <span className="text-sm text-gray-600">Branded Queries</span>
                                    </div>
                                    <span className="text-lg font-bold text-purple-700">{biasedCount}</span>
                                </div>
                                <div className="flex-1 p-3 bg-white rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm text-gray-600">Neutral Queries</span>
                                    </div>
                                    <span className="text-lg font-bold text-blue-700">{blindCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={onBack}
                            className="px-6 py-3 text-sm font-medium text-[var(--text-caption)] hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-10 py-3 bg-[var(--accent-primary)] text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-lg active:scale-95"
                        >
                            Confirm & Import
                        </button>
                    </div>
                </>
            )}

            {isSubmitting && (
                <div className="py-20">
                    <IconLoader2 size={64} className="animate-spin text-[var(--accent-primary)] mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-[var(--text-headings)]">Importing Data...</h3>
                    <p className="text-[var(--text-caption)] mt-2">Creating brand, competitors, and queries.</p>
                </div>
            )}

            {error && (
                <div className="py-10">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <IconAlertTriangle size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-red-700">Import Failed</h3>
                    <p className="text-red-600 mt-2 max-w-md mx-auto">{error}</p>

                    <button
                        onClick={() => { setError(null); setIsSubmitting(false); }}
                        className="mt-8 px-8 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
};
