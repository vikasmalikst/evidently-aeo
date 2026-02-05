import { useState } from 'react';
import { IconTrash, IconPlus, IconBuildingStore, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { SafeLogo } from '../common/SafeLogo';
import { useToast } from '../../../hooks-landing/use-toast';

interface ReviewCompetitorsStepProps {
    data: any;
    updateData: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export const ReviewCompetitorsStep = ({ data, updateData, onNext, onBack }: ReviewCompetitorsStepProps) => {
    const { toast } = useToast();
    const [competitors, setCompetitors] = useState<any[]>(data.competitors || []);
    const [newCompetitor, setNewCompetitor] = useState({ company_name: '', domain: '' });
    const [isAdding, setIsAdding] = useState(false);

    // Edit State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValues, setEditValues] = useState({ company_name: '', domain: '' });

    const handleRemove = (index: number) => {
        if (confirm('Are you sure you want to remove this competitor?')) {
            const removedName = competitors[index].company_name || competitors[index].domain || 'Competitor';
            setCompetitors(prev => prev.filter((_, i) => i !== index));
            toast({
                title: "Competitor removed",
                description: `${removedName} has been removed from the list.`,
                duration: 5000,
            });
        }
    };

    const handleAdd = () => {
        if (newCompetitor.company_name && newCompetitor.domain) {
            setCompetitors(prev => [...prev, newCompetitor]);
            setNewCompetitor({ company_name: '', domain: '' });
            setIsAdding(false);
        }
    };

    const startEdit = (index: number) => {
        setEditingIndex(index);
        setEditValues({
            company_name: competitors[index].company_name || '',
            domain: competitors[index].domain || ''
        });
    };

    const cancelEdit = () => {
        setEditingIndex(null);
        setEditValues({ company_name: '', domain: '' });
    };

    const saveEdit = (index: number) => {
        setCompetitors(prev => {
            const newComps = [...prev];
            newComps[index] = {
                ...newComps[index],
                company_name: editValues.company_name,
                domain: editValues.domain
            };
            return newComps;
        });
        setEditingIndex(null);
    };

    const handleContinue = () => {
        updateData({ ...data, competitors });
        onNext();
    };

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <SafeLogo
                            domain={data.website_url}
                            alt={data.brand_name}
                            className="w-10 h-10 rounded-lg shadow-sm border border-gray-100 object-contain bg-white"
                        />
                        <h2 className="text-2xl font-bold text-[var(--text-headings)]">Review Competitors</h2>
                    </div>
                    <p className="text-[var(--text-caption)] mt-1">
                        We found <span className="font-bold text-[var(--text-headings)]">{competitors.length}</span> competitors. Verify or modify the list.
                    </p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 text-sm font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95"
                    >
                        <IconPlus size={18} /> Add Competitor
                    </button>
                )}
            </div>

            {/* Add New Competitor Form */}
            {isAdding && (
                <div className="mb-8 bg-gray-50 border border-[var(--accent-primary)]/20 p-6 rounded-2xl flex items-end gap-4 animate-in fade-in slide-in-from-top-2 shadow-inner">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-[var(--text-caption)] mb-1.5 uppercase tracking-wide">Name</label>
                        <input
                            value={newCompetitor.company_name}
                            onChange={e => setNewCompetitor(prev => ({ ...prev, company_name: e.target.value }))}
                            placeholder="e.g. Expedia"
                            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-[var(--text-caption)] mb-1.5 uppercase tracking-wide">Domain</label>
                        <input
                            value={newCompetitor.domain}
                            onChange={e => setNewCompetitor(prev => ({ ...prev, domain: e.target.value }))}
                            placeholder="e.g. expedia.com"
                            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!newCompetitor.company_name || !newCompetitor.domain}
                            className="px-6 py-2.5 text-sm font-bold bg-[var(--accent-primary)] text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all"
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}

            {/* List View */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {competitors.map((comp, index) => {
                    const isEditing = editingIndex === index;

                    return (
                        <div
                            key={index}
                            className={`flex items-center gap-4 bg-white border rounded-xl p-4 transition-all duration-200 ${isEditing
                                ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/10 shadow-md'
                                : 'border-[var(--border-default)] hover:border-gray-300 hover:shadow-sm'
                                }`}
                        >
                            {/* Logo */}
                            <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                {comp.domain ? (
                                    <SafeLogo
                                        domain={comp.domain}
                                        alt={comp.company_name}
                                        size={32}
                                        className="object-contain"
                                    />
                                ) : (
                                    <IconBuildingStore className="text-gray-300" size={24} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Name Field */}
                                <div>
                                    {isEditing ? (
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Name</label>
                                            <input
                                                value={editValues.company_name}
                                                onChange={e => setEditValues(prev => ({ ...prev, company_name: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--accent-primary)]"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="font-bold text-[var(--text-headings)] text-base">
                                                {comp.company_name}
                                            </h3>
                                            <span className="text-xs text-gray-400 font-medium">Competitor Name</span>
                                        </div>
                                    )}
                                </div>

                                {/* Domain Field */}
                                <div>
                                    {isEditing ? (
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Domain</label>
                                            <input
                                                value={editValues.domain}
                                                onChange={e => setEditValues(prev => ({ ...prev, domain: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[var(--accent-primary)]"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <a
                                                href={`https://${comp.domain}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-[var(--accent-primary)] hover:underline block truncate"
                                            >
                                                {comp.domain}
                                            </a>
                                            <span className="text-xs text-gray-400 font-medium">Domain URL</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => saveEdit(index)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                            title="Save"
                                        >
                                            <IconCheck size={18} />
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                            title="Cancel"
                                        >
                                            <IconX size={18} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => startEdit(index)}
                                            className="p-2 text-gray-400 hover:text-[var(--accent-primary)] hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <IconPencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleRemove(index)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove"
                                        >
                                            <IconTrash size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Empty State Help */}
                {competitors.length === 0 && !isAdding && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="mb-3 text-gray-300">
                            <IconBuildingStore size={48} className="mx-auto" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-500">No competitors found</h3>
                        <p className="text-gray-400 text-sm mb-4">Add your main competitors to compare performance.</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="text-[var(--accent-primary)] font-bold text-sm hover:underline"
                        >
                            Add First Competitor
                        </button>
                    </div>
                )}
            </div>

            <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
                <button
                    onClick={onBack}
                    className="px-6 py-2.5 text-sm font-medium text-[var(--text-caption)] hover:text-[var(--text-headings)] hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                >
                    Back
                </button>
                <button
                    onClick={handleContinue}
                    disabled={competitors.length === 0}
                    className="px-10 py-3 bg-[var(--accent-primary)] text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:shadow-none"
                >
                    Confirm ({competitors.length}) Competitors
                </button>
            </div>
        </div>
    );
};
