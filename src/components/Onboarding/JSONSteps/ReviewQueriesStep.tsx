import { useState, useMemo, useEffect } from 'react';
import {
    IconListCheck, IconEyeOff, IconEye, IconChevronDown,
    IconChevronRight, IconPencil, IconTrash, IconCheck, IconX, IconPlus
} from '@tabler/icons-react';

interface ReviewQueriesStepProps {
    data: any;
    updateData: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
}

// Flat structure for easier editing
interface EditableTopic {
    id: string; // original key
    name: string; // editable title
    type: 'biased' | 'blind';
    queries: string[];
}

export const ReviewQueriesStep = ({ data, updateData, onNext, onBack }: ReviewQueriesStepProps) => {
    const [topics, setTopics] = useState<EditableTopic[]>([]);
    const [openTopicIds, setOpenTopicIds] = useState<Record<string, boolean>>({});

    // Editing States
    const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
    const [editingTopicName, setEditingTopicName] = useState('');

    const [editingQuery, setEditingQuery] = useState<{ topicId: string, idx: number } | null>(null);
    const [editingQueryText, setEditingQueryText] = useState('');

    const [newQueryTopicId, setNewQueryTopicId] = useState<string | null>(null);
    const [newQueryText, setNewQueryText] = useState('');

    // Initial load: Flatten the nested JSON structure into editable state
    useEffect(() => {
        const list: EditableTopic[] = [];

        // Process Biased
        if (data.biased_prompts) {
            Object.keys(data.biased_prompts).forEach(key => {
                if (key === 'total_count') return;
                if (Array.isArray(data.biased_prompts[key])) {
                    list.push({
                        id: `biased-${key}`,
                        name: key.replace('_', ' & ').replace(/\b\w/g, l => l.toUpperCase()),
                        type: 'biased',
                        queries: data.biased_prompts[key].map((p: any) => p.prompt)
                    });
                }
            });
        }

        // Process Blind
        if (data.blind_prompts) {
            Object.keys(data.blind_prompts).forEach(key => {
                if (key === 'total_count') return;
                if (Array.isArray(data.blind_prompts[key])) {
                    list.push({
                        id: `blind-${key}`,
                        name: key.replace('_', ' & ').replace(/\b\w/g, l => l.toUpperCase()),
                        type: 'blind',
                        queries: data.blind_prompts[key].map((p: any) => p.prompt)
                    });
                }
            });
        }

        setTopics(list);

        // Auto-open first few
        const initialOpen: Record<string, boolean> = {};
        list.slice(0, 2).forEach(t => initialOpen[t.id] = true);
        setOpenTopicIds(initialOpen);

    }, []); // Run once on mount (ignoring data updates to prevent reset)

    const toggleTopic = (id: string) => {
        setOpenTopicIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const totalPrompts = useMemo(() => {
        return topics.reduce((sum, t) => sum + t.queries.length, 0);
    }, [topics]);

    const splitCounts = useMemo(() => {
        const biased = topics.filter(t => t.type === 'biased').reduce((sum, t) => sum + t.queries.length, 0);
        const blind = topics.filter(t => t.type === 'blind').reduce((sum, t) => sum + t.queries.length, 0);
        return { biased, blind };
    }, [topics]);

    // Topic Actions
    const startEditTopic = (t: EditableTopic) => {
        setEditingTopicId(t.id);
        setEditingTopicName(t.name);
    };

    const saveEditTopic = () => {
        if (editingTopicId && editingTopicName.trim()) {
            setTopics(prev => prev.map(t =>
                t.id === editingTopicId ? { ...t, name: editingTopicName.trim() } : t
            ));
            setEditingTopicId(null);
        }
    };

    const cancelEditTopic = () => setEditingTopicId(null);

    // Query Actions
    const startEditQuery = (topicId: string, idx: number, text: string) => {
        setEditingQuery({ topicId, idx });
        setEditingQueryText(text);
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

    const deleteQuery = (topicId: string, idx: number) => {
        if (confirm('Are you sure you want to delete this query?')) {
            setTopics(prev => prev.map(t => {
                if (t.id === topicId) {
                    return { ...t, queries: t.queries.filter((_, i) => i !== idx) };
                }
                return t;
            }));
        }
    };

    const addQuery = (topicId: string) => {
        if (newQueryText.trim()) {
            setTopics(prev => prev.map(t => {
                if (t.id === topicId) {
                    return { ...t, queries: [...t.queries, newQueryText.trim()] };
                }
                return t;
            }));
            setNewQueryText('');
            setNewQueryTopicId(null);
        }
    };

    const handleContinue = () => {
        // Re-structure data back to JSON format expected by backend/next steps
        // Note: We might be losing the original 'category' key mapping if we renamed topics,
        // but the CompletionStep uses the 'label' and 'category' from our structures.
        // We need to map our flat topics back to the expected biased_prompts/blind_prompts structure.

        const newBiased: Record<string, any[]> = {};
        const newBlind: Record<string, any[]> = {};

        topics.forEach(t => {
            // Reconstruct original key logic or just use title as key
            const key = t.id.replace('biased-', '').replace('blind-', '');
            const promptList = t.queries.map(q => ({ prompt: q, category: t.name }));

            if (t.type === 'biased') {
                newBiased[key] = promptList;
            } else {
                newBlind[key] = promptList;
            }
        });

        updateData({
            ...data,
            biased_prompts: newBiased,
            blind_prompts: newBlind
        });
        onNext();
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-headings)]">Review Queries</h2>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="px-3 py-1 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm font-medium text-purple-900">
                                <strong>{splitCounts.biased}</strong> Biased Queries
                            </span>
                        </div>
                        <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium text-blue-900">
                                <strong>{splitCounts.blind}</strong> Blind Queries
                            </span>
                        </div>
                        <span className="text-sm text-[var(--text-caption)] ml-2">
                            (Total: {totalPrompts})
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 pb-2">
                {topics.map((topic) => {
                    const isOpen = openTopicIds[topic.id];
                    const isBiased = topic.type === 'biased';
                    const isEditingThisTopic = editingTopicId === topic.id;

                    return (
                        <div key={topic.id} className="border border-[var(--border-default)] rounded-xl bg-white shadow-sm overflow-hidden">
                            {/* Topic Header */}
                            <div className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3 flex-1">
                                    <button onClick={() => toggleTopic(topic.id)} className="p-1 hover:bg-gray-200 rounded text-gray-400">
                                        {isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                                    </button>

                                    {isEditingThisTopic ? (
                                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                                            <input
                                                value={editingTopicName}
                                                onChange={e => setEditingTopicName(e.target.value)}
                                                className="w-full px-2 py-1 text-sm border border-[var(--accent-primary)] rounded bg-white focus:outline-none"
                                                autoFocus
                                                onKeyDown={e => e.key === 'Enter' && saveEditTopic()}
                                            />
                                            <button onClick={saveEditTopic} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                <IconCheck size={16} />
                                            </button>
                                            <button onClick={cancelEditTopic} className="p-1 text-red-500 hover:bg-red-100 rounded">
                                                <IconX size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 group">
                                            <h3
                                                className="font-bold text-sm text-[var(--text-headings)] cursor-pointer"
                                                onClick={() => toggleTopic(topic.id)}
                                            >
                                                {topic.name}
                                            </h3>
                                            <button
                                                onClick={() => startEditTopic(topic)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-[var(--accent-primary)] transition-all"
                                                title="Rename Category"
                                            >
                                                <IconPencil size={14} />
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${isBiased
                                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                    {isBiased ? 'Biased' : 'Blind'}
                                                </span>
                                                <span className="text-xs text-[var(--text-caption)]">• {topic.queries.length} queries</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 pl-4">
                                    {isBiased ? <IconEye size={18} className="text-purple-300" /> : <IconEyeOff size={18} className="text-blue-300" />}
                                </div>
                            </div>

                            {/* Queries List */}
                            {isOpen && (
                                <div className="p-2 border-t border-[var(--border-default)] bg-white">
                                    {topic.queries.map((query, idx) => {
                                        const isEditingThisQuery = editingQuery?.topicId === topic.id && editingQuery?.idx === idx;

                                        return (
                                            <div key={idx} className="group flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors">
                                                <div className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />

                                                {isEditingThisQuery ? (
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <input
                                                            value={editingQueryText}
                                                            onChange={e => setEditingQueryText(e.target.value)}
                                                            className="w-full px-2 py-1.5 text-sm border border-[var(--accent-primary)] rounded bg-white focus:outline-none"
                                                            autoFocus
                                                            onKeyDown={e => e.key === 'Enter' && saveEditQuery()}
                                                        />
                                                        <button onClick={saveEditQuery} className="p-1.5 text-green-600 hover:bg-green-100 rounded">
                                                            <IconCheck size={16} />
                                                        </button>
                                                        <button onClick={() => setEditingQuery(null)} className="p-1.5 text-red-500 hover:bg-red-100 rounded">
                                                            <IconX size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex items-start justify-between">
                                                        <p className="text-sm text-[var(--text-headings)] leading-relaxed py-0.5">{query}</p>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => startEditQuery(topic.id, idx, query)}
                                                                className="p-1.5 text-gray-400 hover:text-[var(--accent-primary)] hover:bg-blue-50 rounded"
                                                                title="Edit Query"
                                                            >
                                                                <IconPencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteQuery(topic.id, idx)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                                title="Delete Query"
                                                            >
                                                                <IconTrash size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add Query Row */}
                                    {newQueryTopicId === topic.id ? (
                                        <div className="flex items-center gap-2 p-2 pl-5 bg-blue-50/30 rounded mt-1">
                                            <input
                                                value={newQueryText}
                                                onChange={e => setNewQueryText(e.target.value)}
                                                placeholder="Enter new query..."
                                                className="flex-1 px-2 py-1.5 text-sm border border-blue-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                autoFocus
                                                onKeyDown={e => e.key === 'Enter' && addQuery(topic.id)}
                                            />
                                            <button
                                                onClick={() => addQuery(topic.id)}
                                                className="p-1.5 bg-[var(--accent-primary)] text-white rounded hover:opacity-90"
                                            >
                                                <IconCheck size={14} />
                                            </button>
                                            <button
                                                onClick={() => setNewQueryTopicId(null)}
                                                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                                            >
                                                <IconX size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setNewQueryTopicId(topic.id); setNewQueryText(''); }}
                                            className="w-full text-left p-2 pl-5 text-sm text-[var(--accent-primary)] font-medium hover:bg-blue-50 rounded mt-1 flex items-center gap-2 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <IconPlus size={14} /> Add Query
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100 mb-6">
                <button
                    onClick={onBack}
                    className="px-6 py-2.5 text-sm font-medium text-[var(--text-caption)] hover:text-[var(--text-headings)] hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                >
                    Back
                </button>
                <button
                    onClick={handleContinue}
                    className="px-8 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md active:scale-95"
                >
                    Confirm Queries ({totalPrompts})
                </button>
            </div>
        </div>
    );
};
