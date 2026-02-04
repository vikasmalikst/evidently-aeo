import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck, IconLoader2, IconAlertTriangle } from '@tabler/icons-react';
import { submitBrandOnboarding, type BrandOnboardingData } from '../../../api/brandApi';

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
        <div className="max-w-2xl mx-auto text-center animate-in fade-in zoom-in duration-300">

            {!isSubmitting && !error && (
                <>
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <IconCheck size={40} stroke={3} />
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--text-headings)]">Ready to Import</h2>
                    <p className="text-[var(--text-caption)] mt-4 max-w-md mx-auto text-base">
                        You are about to import <strong>{data.brand_name}</strong> with:
                    </p>

                    <ul className="my-8 space-y-3 text-left max-w-sm mx-auto bg-gray-50 p-6 rounded-xl border border-[var(--border-default)]">
                        <li className="flex items-center gap-3 text-sm font-medium">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">C</span>
                            {data.competitors?.length || 0} Competitors
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium">
                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">Q</span>
                            Queries (Biased & Blind)
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium">
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">P</span>
                            {enrichment.brandProducts?.length || 0} Products
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium">
                            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs">S</span>
                            {enrichment.brandSynonyms?.length || 0} Synonyms
                        </li>
                    </ul>

                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800 mb-8 max-w-lg mx-auto">
                        <strong>Note:</strong> Data collection will NOT start automatically. You will need to trigger it manually from the Admin console or Brand Settings after import.
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
