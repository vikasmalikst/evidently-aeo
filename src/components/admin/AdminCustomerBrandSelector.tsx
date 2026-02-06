import { startTransition, useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { getManagedPrompts } from '../../api/promptManagementApi';
import { getBrandById } from '../../api/brandApi';
import { getActiveCompetitors } from '../../api/competitorManagementApi';
import { SafeLogo } from '../Onboarding/common/SafeLogo';
import { IconDownload, IconLoader2 } from '@tabler/icons-react';

interface Customer {
    id: string;
    email: string;
    name: string;
    slug: string;
    access_level?: string | null;
}

interface Brand {
    id: string;
    name: string;
    slug: string;
    customer_id: string;
    status?: string;
    homepage_url?: string | null;
    metadata?: {
        logo?: string;
        brand_logo?: string;
        [key: string]: any;
    };
}

interface AdminCustomerBrandSelectorProps {
    selectedCustomerId: string | null;
    selectedBrandId: string | null;
    onCustomerChange: (customerId: string | null) => void;
    onBrandChange: (brandId: string | null) => void;
}

export const AdminCustomerBrandSelector = ({
    selectedCustomerId,
    selectedBrandId,
    onCustomerChange,
    onBrandChange,
}: AdminCustomerBrandSelectorProps) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    // Load all customers on mount
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                setLoadingCustomers(true);
                const response = await apiClient.get<{ success: boolean; data: Customer[] }>('/admin/customers');

                if (response.success && response.data) {
                    // Sort by email for easier selection
                    const sortedCustomers = response.data.sort((a, b) =>
                        (a.email || '').localeCompare(b.email || '')
                    );
                    setCustomers(sortedCustomers);
                }
            } catch (error) {
                console.error('Failed to load customers:', error);
            } finally {
                setLoadingCustomers(false);
            }
        };

        fetchCustomers();
    }, []);

    // Load brands when customer is selected
    useEffect(() => {
        const fetchBrands = async () => {
            if (!selectedCustomerId) {
                setBrands([]);
                setFetchError(null);
                return;
            }

            try {
                setLoadingBrands(true);
                setFetchError(null);
                const response = await apiClient.get<{ success: boolean; data: Brand[] }>(
                    `/admin/customers/${selectedCustomerId}/brands`
                );

                if (response.success && response.data) {
                    setBrands(response.data);
                } else {
                    setBrands([]);
                }
            } catch (error: any) {
                console.error('Failed to load brands for customer:', error);
                setBrands([]);
                setFetchError(error.message || 'Failed to fetch');
            } finally {
                setLoadingBrands(false);
            }
        };

        fetchBrands();
    }, [selectedCustomerId]);



    const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const customerId = e.target.value || null;
        onCustomerChange(customerId);
        // Reset brand selection when customer changes
        onBrandChange(null);
    };

    const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const brandId = e.target.value || null;
        onBrandChange(brandId);
    };

    const handleExportConfig = async () => {
        if (!selectedBrandId) return;

        try {
            setExporting(true);

            // 1. Fetch Brand Details
            const brandRes = await getBrandById(selectedBrandId);
            if (!brandRes.success || !brandRes.data) {
                throw new Error('Failed to fetch brand details');
            }
            const brand = brandRes.data;
            console.log('Export: Brand details:', brand);

            // 2. Fetch Prompts
            const promptsRes = await getManagedPrompts(selectedBrandId);
            console.log('Export: Prompts response:', promptsRes);
            const promptTopics = promptsRes.topics || [];
            console.log('Export: Prompt topics:', promptTopics);

            // 2b. Fetch Competitors
            let competitorsList: any[] = [];
            try {
                const competitorsRes = await getActiveCompetitors(selectedBrandId);
                console.log('Export: Competitors response:', competitorsRes);
                competitorsList = competitorsRes.competitors || [];
            } catch (err) {
                console.warn('Export: Failed to fetch competitors, falling back to metadata', err);
                competitorsList = brand.metadata?.competitors || [];
            }

            // 3. Construct JSON
            const exportData = {
                company_profile: {
                    company_name: brand.name,
                    website: brand.homepage_url,
                    industry: brand.industry || "Unknown",
                    founded: brand.metadata?.founded || "Not publicly available",
                    headquarters: brand.metadata?.headquarters || {
                        city: "Unknown",
                        country: "Unknown"
                    },
                    leadership: brand.metadata?.leadership || {
                        current_ceo: "Not publicly available",
                        founder: "Not publicly available"
                    },
                    company_size: brand.metadata?.company_size || "Not publicly available",
                    funding_status: brand.metadata?.funding_status || "Not publicly available",
                    description: brand.summary || brand.description || "No description available",
                    annual_customers: brand.metadata?.annual_customers || "Not publicly available",
                    key_certification: brand.metadata?.key_certification || "Not publicly available"
                },
                competitors: competitorsList.map((comp: any, index: number) => ({
                    rank: index + 1,
                    company_name: comp.name || comp,
                    domain: comp.domain || comp.url || "",
                    geographic_overlap: comp.geographic_overlap || "Unknown",
                    customer_segment: comp.customer_segment || "Unknown",
                    battle_frequency: comp.battle_frequency || "Unknown",
                    primary_differentiation: comp.primary_differentiation || "Unknown"
                })),
                biased_prompts: {
                    total_count: 0,
                    awareness_informational: [] as any[],
                    consideration_evaluation: [] as any[],
                    comparison_commercial: [] as any[],
                    decision_transactional: [] as any[]
                },
                blind_prompts: {
                    total_count: 0,
                    problem_awareness: [] as any[],
                    solution_education: [] as any[],
                    evaluation_consideration: [] as any[],
                    commercial_investigation: [] as any[],
                    decision_support: [] as any[]
                },
                research_quality_summary: brand.metadata?.research_quality_summary || {
                    total_competitors_identified: competitorsList.length,
                    geographic_relevance: "Unknown",
                    prompt_distribution: {
                        biased_percentage: 0,
                        neutral_percentage: 0,
                        total_prompts: 0
                    },
                    customer_journey_coverage: "Unknown",
                    data_confidence_level: "Unknown",
                    confidence_justification: "Generated from AEO Platform",
                    ranking_methodology: "Manual"
                },
                metadata: {
                    report_generated_date: new Date().toISOString().split('T')[0],
                    research_methodology: "AEO Platform Export",
                    primary_market: brand.metadata?.primary_market || "Unknown",
                    data_sources: brand.metadata?.data_sources || [],
                    web_references: brand.metadata?.web_references || []
                }
            };

            // Helper to map topic categories to JSON structure
            // Assuming backend categories might map loosely; default to 'blind' if unknown, but better heuristics needed?
            // "Biased" usually means brand name is in prompt. "Blind" means it isn't.
            // But JSON structure separates them by keys.
            // Let's iterate all prompts and try to guess or use existing category.

            let biasedCount = 0;
            let blindCount = 0;

            promptTopics.forEach(topic => {
                // Heuristic: If topic.category is generic or missing, try to infer from topic name
                // e.g., "Awareness - Brand" -> "Awareness"
                let inferredCategory = topic.category;
                if (!inferredCategory || inferredCategory === 'General') {
                    const nameLower = (topic.name || '').toLowerCase();
                    if (nameLower.includes('awareness') || nameLower.includes('problem')) inferredCategory = 'Awareness';
                    else if (nameLower.includes('consideration') || nameLower.includes('evaluation')) inferredCategory = 'Consideration';
                    else if (nameLower.includes('comparison') || nameLower.includes('commercial')) inferredCategory = 'Comparison';
                    else if (nameLower.includes('decision') || nameLower.includes('transactional')) inferredCategory = 'Decision';
                    else inferredCategory = 'General';
                }

                topic.prompts.forEach((prompt: any) => {
                    console.log('Export: Processing prompt:', prompt);
                    // Safe access to text properties - check multiple common variants
                    const promptText = prompt.text || prompt.query || prompt.queryText || prompt.prompt || '';
                    if (!promptText) {
                        console.warn('Export: Skipping prompt with no text', prompt);
                        return; // Skip if no text found
                    }

                    const brandName = (brand.name || '').toLowerCase();
                    const isBiased = promptText.toLowerCase().includes(brandName);

                    // JSON format expects specific category strings like "Awareness", "Problem", etc.
                    // We map our inferred/actual category to these specific display strings.
                    let displayCategory = inferredCategory;

                    const promptObj = {
                        id: 0, // Placeholder, set below
                        prompt: promptText,
                        category: displayCategory
                    };

                    if (isBiased) {
                        biasedCount++;
                        promptObj.id = biasedCount;

                        // Map category to specific bucket
                        if (['Awareness', 'Informational', 'Problem'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Awareness";
                            exportData.biased_prompts.awareness_informational.push(promptObj);
                        } else if (['Consideration', 'Evaluation'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Consideration";
                            exportData.biased_prompts.consideration_evaluation.push(promptObj);
                        } else if (['Comparison', 'Commercial'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Comparison";
                            exportData.biased_prompts.comparison_commercial.push(promptObj);
                        } else if (['Decision', 'Transactional', 'Support'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Decision";
                            exportData.biased_prompts.decision_transactional.push(promptObj);
                        } else {
                            // Default bucket
                            promptObj.category = "Awareness";
                            exportData.biased_prompts.awareness_informational.push(promptObj);
                        }
                    } else {
                        blindCount++;
                        promptObj.id = blindCount;

                        if (['Awareness', 'Problem'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Problem";
                            exportData.blind_prompts.problem_awareness.push(promptObj);
                        } else if (['Solution', 'Education'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Education";
                            exportData.blind_prompts.solution_education.push(promptObj);
                        } else if (['Evaluation', 'Consideration'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Evaluation";
                            exportData.blind_prompts.evaluation_consideration.push(promptObj);
                        } else if (['Commercial', 'Investigation'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Commercial";
                            exportData.blind_prompts.commercial_investigation.push(promptObj);
                        } else if (['Decision', 'Support', 'Transactional'].some(c => inferredCategory.includes(c))) {
                            promptObj.category = "Decision";
                            exportData.blind_prompts.decision_support.push(promptObj);
                        } else {
                            // Default bucket
                            promptObj.category = "Problem";
                            exportData.blind_prompts.problem_awareness.push(promptObj);
                        }
                    }
                });
            });

            exportData.biased_prompts.total_count = biasedCount;
            exportData.blind_prompts.total_count = blindCount;
            exportData.research_quality_summary.prompt_distribution.total_prompts = biasedCount + blindCount;

            // 4. Download File
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${brand.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_aeo_config.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export configuration. detailed error in console.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Admin: Select Customer & Brand</h3>
                {selectedBrandId && (
                    <button
                        onClick={handleExportConfig}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {exporting ? <IconLoader2 size={14} className="animate-spin" /> : <IconDownload size={14} />}
                        Export Config
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Selector */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Customer
                    </label>
                    <select
                        value={selectedCustomerId || ''}
                        onChange={handleCustomerChange}
                        disabled={loadingCustomers}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    >
                        <option value="">Select a customer...</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.email} {customer.name ? `(${customer.name})` : ''}
                            </option>
                        ))}
                    </select>
                    {loadingCustomers && (
                        <p className="text-xs text-gray-500 mt-1">Loading customers...</p>
                    )}
                </div>

                {/* Brand Selector */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Brand
                    </label>
                    <select
                        value={selectedBrandId || ''}
                        onChange={handleBrandChange}
                        disabled={!selectedCustomerId || loadingBrands || brands.length === 0}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    >
                        <option value="">
                            {!selectedCustomerId
                                ? 'Select a customer first...'
                                : fetchError
                                    ? `Error: ${fetchError}`
                                    : brands.length === 0 && !loadingBrands
                                        ? 'No brands found'
                                        : 'Select a brand...'}
                        </option>
                        {brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                                {brand.name} {brand.status ? `(${brand.status})` : ''}
                            </option>
                        ))}
                    </select>

                    {/* Brand Logo Preview */}
                    {selectedBrandId && brands.find(b => b.id === selectedBrandId) && (
                        <div className="mt-2 flex items-center gap-2">
                            <SafeLogo
                                src={brands.find(b => b.id === selectedBrandId)?.metadata?.logo || brands.find(b => b.id === selectedBrandId)?.metadata?.brand_logo}
                                domain={brands.find(b => b.id === selectedBrandId)?.homepage_url || undefined}
                                alt={brands.find(b => b.id === selectedBrandId)?.name || ''}
                                size={32}
                                className="w-8 h-8 rounded object-contain bg-white border border-gray-200"
                            />
                            <span className="text-xs text-gray-600">
                                {brands.find(b => b.id === selectedBrandId)?.name}
                            </span>
                        </div>
                    )}
                    {loadingBrands && (
                        <p className="text-xs text-gray-500 mt-1">Loading brands...</p>
                    )}
                    {selectedCustomerId && brands.length === 0 && !loadingBrands && (
                        <p className="text-xs text-amber-600 mt-1">No brands found for this customer</p>
                    )}
                </div>
            </div>
        </div>
    );
};
