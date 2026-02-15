import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    IconCheck, IconLoader2, IconAlertTriangle, IconChevronDown,
    IconChevronRight, IconPencil, IconTrash, IconX, IconPlus, IconExternalLink, IconListCheck
} from '@tabler/icons-react';
import { submitBrandOnboarding, type BrandOnboardingData } from '../../../api/brandApi';
import { SafeLogo } from '../common/SafeLogo';
import { AI_MODELS } from '../AIModelSelection';

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

interface EditableTopic {
    id: string;
    name: string;
    type: 'branded' | 'neutral';
    queries: string[];
}

export const CompletionStep = ({ data, enrichment, onBack }: CompletionStepProps) => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Editable State ---
    const [topics, setTopics] = useState<EditableTopic[]>([]);
    const [aiModels, setAiModels] = useState<string[]>([]);
    const [competitors, setCompetitors] = useState<any[]>([]);

    // UI state
    const [openTopicIds, setOpenTopicIds] = useState<Record<string, boolean>>({ 'branded-root': false, 'neutral-root': false });
    const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
    const [editingTopicName, setEditingTopicName] = useState('');
    const [editingQuery, setEditingQuery] = useState<{ topicId: string, idx: number } | null>(null);
    const [editingQueryText, setEditingQueryText] = useState('');
    const [newQueryTopicId, setNewQueryTopicId] = useState<string | null>(null);
    const [newQueryText, setNewQueryText] = useState('');

    // Load initial data into state
    useEffect(() => {
        const list: EditableTopic[] = [];

        // Helper to flatten nested prompts
        const processPrompts = (source: any, type: 'branded' | 'neutral') => {
            if (!source) return;
            Object.keys(source).forEach(key => {
                if (key === 'total_count') return;
                list.push({
                    id: `${type}-${key}`,
                    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    type,
                    queries: source[key].map((p: any) => p.prompt)
                });
            });
        };

        processPrompts(data.biased_prompts, 'branded');
        processPrompts(data.blind_prompts, 'neutral');

        setTopics(list);
        setAiModels(data.ai_models || []);
        setCompetitors(data.competitors || []);
    }, [data]);

    // --- Computed ---
    const counts = useMemo(() => {
        const branded = topics.filter(t => t.type === 'branded').reduce((sum, t) => sum + t.queries.length, 0);
        const neutral = topics.filter(t => t.type === 'neutral').reduce((sum, t) => sum + t.queries.length, 0);
        return { branded, neutral, total: branded + neutral };
    }, [topics]);

    // --- Actions ---
    const toggleTopic = (id: string) => setOpenTopicIds(prev => ({ ...prev, [id]: !prev[id] }));

    const deleteQuery = (topicId: string, idx: number) => {
        setTopics(prev => prev.map(t => t.id === topicId ? { ...t, queries: t.queries.filter((_, i) => i !== idx) } : t));
    };

    const saveEditQuery = () => {
        if (editingQuery && editingQueryText.trim()) {
            setTopics(prev => prev.map(t => {
                if (t.id === editingQuery.topicId) {
                    const newQueries = [...t.queries];
                    newQueries[editingQuery.idx] = editingQueryText.trim();
                    return { ...t, queries: newQueries };
                }
                return t;
            }));
            setEditingQuery(null);
        }
    };

    const addQuery = (topicId: string) => {
        if (newQueryText.trim()) {
            setTopics(prev => prev.map(t => t.id === topicId ? { ...t, queries: [...t.queries, newQueryText.trim()] } : t));
            setNewQueryText('');
            setNewQueryTopicId(null);
        }
    };

    const addTopic = (type: 'branded' | 'neutral') => {
        const name = prompt('Enter category name:');
        if (name) {
            const newId = `${type}-${Date.now()}`;
            setTopics(prev => [...prev, { id: newId, name, type, queries: [] }]);
            setOpenTopicIds(prev => ({ ...prev, [newId]: true }));
        }
    };

    const renameTopic = (id: string, currentName: string) => {
        const name = prompt('Rename category:', currentName);
        if (name && name !== currentName) {
            setTopics(prev => prev.map(t => t.id === id ? { ...t, name } : t));
        }
    };

    const removeModel = (id: string) => setAiModels(prev => prev.filter(m => m !== id));
    const removeCompetitor = (idx: number) => setCompetitors(prev => prev.filter((_, i) => i !== idx));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const uniqueCategories = new Set<string>();
            const biasedTopics: any[] = [];
            const blindTopics: any[] = [];

            topics.forEach(t => {
                uniqueCategories.add(t.name);
                const prompts = t.queries.map(q => ({ prompt: q, topic: t.name }));
                if (t.type === 'branded') biasedTopics.push(...prompts);
                else blindTopics.push(...prompts);
            });

            const aeoTopics = Array.from(uniqueCategories).map(cat => ({
                label: cat,
                weight: 1,
                category: cat,
                source: 'onboarding_v2',
                type: 'topic'
            }));

            const mappedCompetitors = competitors.map((comp: any) => ({
                name: comp.company_name,
                domain: comp.domain,
                synonyms: enrichment.competitorSynonyms[comp.company_name] || []
            }));

            const payload: BrandOnboardingData = {
                brand_name: data.brand_name,
                website_url: data.website_url,
                industry: data.industry,
                description: data.description,
                competitors: mappedCompetitors,
                aeo_topics: aeoTopics,
                ai_models: aiModels,
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
                metadata: {
                    source: 'onboarding_v2',
                    onboarding_date: new Date().toISOString(),
                    manual_collection_trigger_required: true,
                    biased_prompts: biasedTopics,
                    blind_prompts: blindTopics,
                    prompts_with_topics: [...biasedTopics, ...blindTopics]
                }
            };

            const response = await submitBrandOnboarding(payload);
            if (response.success) navigate('/settings/manage-brands?onboarding=success');
            else setError(response.error || 'Failed to submit onboarding data.');
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in zoom-in duration-300 pb-20">
            {!isSubmitting && !error && (
                <>
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-100 shadow-sm">
                            <IconCheck size={32} stroke={2} />
                        </div>
                        <h2 className="text-3xl font-bold text-[var(--text-headings)] tracking-tight">Ready to Import</h2>
                        <p className="text-[var(--text-caption)] mt-2">
                            Review and refine your data before tracking <strong>{data.brand_name}</strong>.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* Competitors Section */}
                        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-gray-100">
                            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <IconExternalLink size={16} className="text-cyan-500" />
                                    Tracking {competitors.length} Competitors
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {competitors.map((comp, idx) => (
                                        <div key={idx} className="group relative flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                                            <SafeLogo domain={comp.domain} alt={comp.company_name} className="w-8 h-8 rounded-lg shrink-0 object-contain bg-white shadow-sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-gray-900 truncate">{comp.company_name}</div>
                                                <div className="text-[10px] text-gray-500 truncate">{comp.domain}</div>
                                            </div>
                                            <button onClick={() => removeCompetitor(idx)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition-all">
                                                <IconTrash size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Queries Section (Tree View) */}
                        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-gray-100">
                            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <IconListCheck size={16} className="text-cyan-500" />
                                    Reviewing {counts.total} Queries
                                </h3>
                                <div className="flex gap-2">
                                    <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-bold rounded-md border border-cyan-100">
                                        {counts.branded} BRANDED
                                    </span>
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md border border-gray-200">
                                        {counts.neutral} NEUTRAL
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                                {['branded', 'neutral'].map(type => {
                                    const typeTopics = topics.filter(t => t.type === type);
                                    if (typeTopics.length === 0) return null;
                                    const typeRootId = `${type}-root`;
                                    const isTypeOpen = openTopicIds[typeRootId];

                                    return (
                                        <div key={type} className="border border-gray-100 rounded-xl bg-gray-50/30 overflow-hidden">
                                            <div className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                                                <button
                                                    onClick={() => toggleTopic(typeRootId)}
                                                    className="flex items-center gap-2 flex-1"
                                                >
                                                    {isTypeOpen ? <IconChevronDown size={18} className="text-gray-400" /> : <IconChevronRight size={18} className="text-gray-400" />}
                                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                                        {type} Queries ({typeTopics.reduce((s, t) => s + t.queries.length, 0)})
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => addTopic(type as 'branded' | 'neutral')}
                                                    className="p-1.5 text-gray-400 hover:text-cyan-500 rounded hover:bg-white transition-all flex items-center gap-1 text-[10px] font-bold"
                                                    title={`Add ${type} Category`}
                                                >
                                                    <IconPlus size={14} /> CATEGORY
                                                </button>
                                            </div>

                                            {isTypeOpen && (
                                                <div className="p-2 space-y-2">
                                                    {typeTopics.map(topic => (
                                                        <div key={topic.id} className="border border-gray-100 rounded-lg bg-white overflow-hidden ml-4 shadow-sm">
                                                            <div className="flex items-center justify-between p-3 bg-gray-50/50">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <button onClick={() => toggleTopic(topic.id)} className="p-1 hover:bg-white rounded">
                                                                        {openTopicIds[topic.id] ? <IconChevronDown size={14} className="text-gray-400" /> : <IconChevronRight size={14} className="text-gray-400" />}
                                                                    </button>
                                                                    <span className="text-sm font-bold text-gray-800">{topic.name}</span>
                                                                    <span className="text-[10px] text-gray-400 ml-1">({topic.queries.length})</span>
                                                                    <button onClick={() => renameTopic(topic.id, topic.name)} className="p-1 text-gray-300 hover:text-cyan-500 transition-colors">
                                                                        <IconPencil size={12} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => setNewQueryTopicId(topic.id)} className="p-1 text-gray-400 hover:text-cyan-500 rounded"><IconPlus size={14} /></button>
                                                                    <button onClick={() => setTopics(prev => prev.filter(t => t.id !== topic.id))} className="p-1 text-gray-400 hover:text-red-500 rounded"><IconTrash size={14} /></button>
                                                                </div>
                                                            </div>

                                                            {openTopicIds[topic.id] && (
                                                                <div className="p-1 space-y-1">
                                                                    {topic.queries.map((q, qIdx) => {
                                                                        const isEditing = editingQuery?.topicId === topic.id && editingQuery?.idx === qIdx;
                                                                        return (
                                                                            <div key={qIdx} className="group flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                                                                                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-cyan-200 shrink-0" />
                                                                                {isEditing ? (
                                                                                    <div className="flex-1 flex gap-2">
                                                                                        <input
                                                                                            value={editingQueryText}
                                                                                            onChange={e => setEditingQueryText(e.target.value)}
                                                                                            className="flex-1 px-2 py-1 text-sm border border-cyan-500 rounded bg-white outline-none"
                                                                                            autoFocus
                                                                                            onKeyDown={e => e.key === 'Enter' && saveEditQuery()}
                                                                                        />
                                                                                        <button onClick={saveEditQuery} className="text-green-600"><IconCheck size={16} /></button>
                                                                                        <button onClick={() => setEditingQuery(null)} className="text-gray-400"><IconX size={16} /></button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex-1 flex items-start justify-between min-w-0">
                                                                                        <p className="text-xs text-gray-700 leading-relaxed pr-8">{q}</p>
                                                                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 shrink-0">
                                                                                            <button onClick={() => { setEditingQuery({ topicId: topic.id, idx: qIdx }); setEditingQueryText(q); }} className="p-1 text-gray-400 hover:text-cyan-500"><IconPencil size={12} /></button>
                                                                                            <button onClick={() => deleteQuery(topic.id, qIdx)} className="p-1 text-gray-400 hover:text-red-500"><IconTrash size={12} /></button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {newQueryTopicId === topic.id && (
                                                                        <div className="flex gap-2 p-2">
                                                                            <input
                                                                                value={newQueryText}
                                                                                onChange={e => setNewQueryText(e.target.value)}
                                                                                className="flex-1 px-2 py-1 text-sm border rounded bg-white"
                                                                                placeholder="New query..."
                                                                                autoFocus
                                                                                onKeyDown={e => e.key === 'Enter' && addQuery(topic.id)}
                                                                            />
                                                                            <button onClick={() => addQuery(topic.id)} className="text-cyan-600"><IconCheck size={16} /></button>
                                                                            <button onClick={() => setNewQueryTopicId(null)} className="text-gray-400"><IconX size={16} /></button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Collectors Section */}
                        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden border-gray-100">
                            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <IconLoader2 size={16} className="text-cyan-500" />
                                    Enabled AI Data Collectors ({aiModels.length})
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="flex flex-wrap gap-4">
                                    {aiModels.map(modelId => {
                                        const modelInfo = AI_MODELS.find(m => m.id === modelId);
                                        return (
                                            <div key={modelId} className="group relative flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-cyan-200 transition-all shadow-sm">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 group-hover:bg-cyan-50 transition-colors overflow-hidden">
                                                    {modelInfo?.logo ? (
                                                        <div className="scale-75">
                                                            {typeof modelInfo.logo === 'string' ? (
                                                                <img src={modelInfo.logo} alt={modelId} className="w-full h-full object-contain" />
                                                            ) : (
                                                                modelInfo.logo
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <IconLoader2 size={20} className="text-gray-300" />
                                                    )}
                                                </div>
                                                <div className="pr-4">
                                                    <div className="text-xs font-bold text-gray-900">{modelInfo?.name || modelId}</div>
                                                    <div className="text-[10px] text-gray-500">{modelInfo?.provider || 'AI Provider'}</div>
                                                </div>
                                                <button onClick={() => removeModel(modelId)} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-white border shadow-sm rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-all">
                                                    <IconTrash size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center mt-12 pb-10">
                        <button onClick={onBack} className="px-8 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Back</button>
                        <button onClick={handleSubmit} className="px-12 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-100 active:scale-95 transition-all">
                            Confirm & Finalize Import
                        </button>
                    </div>
                </>
            )}

            {isSubmitting && (
                <div className="py-32 text-center">
                    <div className="relative w-20 h-20 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-cyan-100 rounded-2xl" />
                        <IconLoader2 size={40} className="absolute inset-0 m-auto animate-spin text-cyan-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Importing {data.brand_name}</h3>
                    <p className="text-gray-500 mt-2">Setting up your monitoring dashboard...</p>
                </div>
            )}

            {error && (
                <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100 transition-all scale-110">
                        <IconAlertTriangle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Import Failed</h2>
                    <p className="text-red-600 mt-2 max-w-sm mx-auto">{error}</p>
                    <button onClick={() => { setError(null); setIsSubmitting(false); }} className="mt-10 px-10 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all">Try Again</button>
                </div>
            )}
        </div>
    );
};
