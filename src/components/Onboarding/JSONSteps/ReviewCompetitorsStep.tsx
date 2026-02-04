import { useState } from 'react';
import { IconTrash, IconPlus, IconWorld, IconBuildingStore } from '@tabler/icons-react';
import { SafeLogo } from '../common/SafeLogo';

interface ReviewCompetitorsStepProps {
    data: any;
    updateData: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export const ReviewCompetitorsStep = ({ data, updateData, onNext, onBack }: ReviewCompetitorsStepProps) => {
    const [competitors, setCompetitors] = useState<any[]>(data.competitors || []);
    const [newCompetitor, setNewCompetitor] = useState({ company_name: '', domain: '' });
    const [isAdding, setIsAdding] = useState(false);

    const handleRemove = (index: number) => {
        setCompetitors(prev => prev.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        if (newCompetitor.company_name && newCompetitor.domain) {
            setCompetitors(prev => [...prev, newCompetitor]);
            setNewCompetitor({ company_name: '', domain: '' });
            setIsAdding(false);
        }
    };

    const handleContinue = () => {
        updateData({ ...data, competitors });
        onNext();
    };

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-headings)]">Review Competitors</h2>
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
                            Add Competitor
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-h-[600px] overflow-y-auto p-1">
                {competitors.map((comp, index) => (
                    <div key={index} className="bg-white border border-[var(--border-default)] rounded-2xl p-6 flex flex-col items-center text-center relative group hover:border-[var(--accent-primary)]/30 hover:shadow-lg transition-all duration-300">

                        {/* Remove Button - Top Right */}
                        <button
                            onClick={() => handleRemove(index)}
                            className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Remove"
                        >
                            <IconTrash size={16} />
                        </button>

                        {/* Logo Section */}
                        <div className="w-16 h-16 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-4 p-2 overflow-hidden group-hover:scale-105 transition-transform">
                            {comp.domain ? (
                                <SafeLogo
                                    domain={comp.domain}
                                    alt={comp.company_name}
                                    size={48} // Substantial size
                                    className="object-contain"
                                />
                            ) : (
                                <IconBuildingStore className="text-gray-300" size={32} />
                            )}
                        </div>

                        {/* Info Section */}
                        <h3 className="font-bold text-[var(--text-headings)] text-base leading-tight mb-1 line-clamp-2" title={comp.company_name}>
                            {comp.company_name}
                        </h3>

                        <a
                            href={`https://${comp.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--text-caption)] hover:text-[var(--accent-primary)] hover:underline flex items-center justify-center gap-1 mb-3"
                        >
                            {comp.domain}
                        </a>

                        {comp.customer_segment && (
                            <div className="mt-auto px-2 py-1 bg-gray-50 rounded-md border border-gray-100 max-w-full">
                                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider truncate">
                                    {comp.customer_segment}
                                </p>
                            </div>
                        )}
                    </div>
                ))}

                {/* Add Card */}
                <button
                    onClick={() => setIsAdding(true)}
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/5 transition-all group min-h-[220px]"
                >
                    <div className="w-14 h-14 rounded-full bg-gray-50 group-hover:bg-white text-gray-400 group-hover:text-[var(--accent-primary)] flex items-center justify-center mb-3 transition-colors">
                        <IconPlus size={24} stroke={2.5} />
                    </div>
                    <span className="font-bold text-sm text-gray-500 group-hover:text-[var(--accent-primary)]">Add Competitor</span>
                </button>
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
                    className="px-10 py-3 bg-[var(--accent-primary)] text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                    Confirm ({competitors.length}) Competitors
                </button>
            </div>
        </div>
    );
};
