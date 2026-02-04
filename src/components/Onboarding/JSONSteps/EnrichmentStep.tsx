import { useState } from 'react';
import { IconTags, IconBulb, IconAlertCircle } from '@tabler/icons-react';

// SimpleTagList component defined locally to avoid import issues
const SimpleTagList = ({ items, onItemsChange, placeholder, colorClass, bgClass }: any) => {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim() && !items.includes(newItem.trim())) {
            onItemsChange([...items, newItem.trim()]);
            setNewItem('');
        }
    };

    const handleRemove = (index: number) => {
        onItemsChange(items.filter((_: any, i: number) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="min-h-[60px] p-3 rounded-lg border border-[var(--border-default)] bg-gray-50/50 flex flex-wrap gap-2">
                {items.length === 0 && (
                    <span className="text-sm text-gray-400 italic">No items added yet.</span>
                )}
                {items.map((item: string, idx: number) => (
                    <span key={idx} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium ${bgClass} ${colorClass}`}>
                        {item}
                        <button onClick={() => handleRemove(idx)} className="hover:text-red-500 ml-1">×</button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm bg-white"
                />
                <button
                    onClick={handleAdd}
                    disabled={!newItem.trim()}
                    className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-headings)] border border-[var(--border-default)] rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
                >
                    Add
                </button>
            </div>
        </div>
    );
};


interface EnrichmentStepProps {
    brandSynonyms: string[];
    setBrandSynonyms: (v: string[]) => void;
    brandProducts: string[];
    setBrandProducts: (v: string[]) => void;
    competitorSynonyms: Record<string, string[]>;
    setCompetitorSynonyms: (v: Record<string, string[]>) => void;
    competitorProducts: Record<string, string[]>;
    setCompetitorProducts: (v: Record<string, string[]>) => void;

    brandName: string;
    competitors: any[];
    onNext: () => void;
    onBack: () => void;
}

export const EnrichmentStep = ({
    brandSynonyms, setBrandSynonyms,
    brandProducts, setBrandProducts,
    competitorSynonyms, setCompetitorSynonyms,
    competitorProducts, setCompetitorProducts,
    brandName, competitors,
    onNext, onBack
}: EnrichmentStepProps) => {

    const [activeTab, setActiveTab] = useState<'brand' | 'competitors'>('brand');
    const [selectedCompetitorIndex, setSelectedCompetitorIndex] = useState(0);

    const currentCompetitor = competitors[selectedCompetitorIndex];

    const handleCompetitorSynonymChange = (synonyms: string[]) => {
        setCompetitorSynonyms({
            ...competitorSynonyms,
            [currentCompetitor.company_name]: synonyms
        });
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-[var(--text-headings)]">Enrich Data</h2>
                <p className="text-[var(--text-caption)] mt-1">
                    Add missing Synonyms and Products to improve AI tracking accuracy.
                </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <IconAlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-800">
                    <strong>Why is this needed?</strong> The report JSON didn't contain explicit lists of products or brand aliases (e.g. "OTB" for On The Beach). Adding them here ensures we track all variations.
                </div>
            </div>

            <div className="flex border-b border-[var(--border-default)] mb-6">
                <button
                    onClick={() => setActiveTab('brand')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'brand'
                        ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'border-transparent text-[var(--text-caption)] hover:text-[var(--text-headings)]'
                        }`}
                >
                    Brand Details
                </button>
                <button
                    onClick={() => setActiveTab('competitors')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'competitors'
                        ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'border-transparent text-[var(--text-caption)] hover:text-[var(--text-headings)]'
                        }`}
                >
                    Competitor Aliases
                </button>
            </div>

            <div className="min-h-[300px]">
                {activeTab === 'brand' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-headings)] mb-2 flex items-center gap-2">
                                <IconTags size={16} /> Brand Synonyms / Aliases
                            </label>
                            <p className="text-xs text-[var(--text-caption)] mb-3">
                                Alternate names people use (e.g. "OTB", "OnTheBeach").
                            </p>
                            <SimpleTagList
                                items={brandSynonyms}
                                onItemsChange={setBrandSynonyms}
                                placeholder="Add synonym (e.g. OTB)..."
                                colorClass="text-blue-700"
                                bgClass="bg-blue-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--text-headings)] mb-2 flex items-center gap-2">
                                <IconBulb size={16} /> Key Products / Categories
                            </label>
                            <p className="text-xs text-[var(--text-caption)] mb-3">
                                Main offerings to track (e.g. "Beach Holidays", "All Inclusive").
                            </p>
                            <SimpleTagList
                                items={brandProducts}
                                onItemsChange={setBrandProducts}
                                placeholder="Add product (e.g. Package Holidays)..."
                                colorClass="text-green-700"
                                bgClass="bg-green-100"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row gap-6 animate-in fade-in">
                        {/* Competitor List Sidebar */}
                        <div className="w-full md:w-1/3 border-r border-[var(--border-default)] pr-4 max-h-[400px] overflow-y-auto">
                            {competitors.map((comp, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedCompetitorIndex(idx)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors ${idx === selectedCompetitorIndex
                                        ? 'bg-[var(--accent-primary)] text-white shadow-sm font-medium'
                                        : 'hover:bg-gray-100 text-[var(--text-headings)]'
                                        }`}
                                >
                                    {comp.company_name}
                                </button>
                            ))}
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 pl-2">
                            {currentCompetitor && (
                                <div>
                                    <h3 className="font-bold text-lg text-[var(--text-headings)] mb-1">
                                        {currentCompetitor.company_name}
                                    </h3>
                                    <p className="text-xs text-[var(--text-caption)] mb-6">
                                        {currentCompetitor.domain}
                                    </p>

                                    <label className="block text-sm font-bold text-[var(--text-headings)] mb-2">
                                        Synonyms / Aliases
                                    </label>
                                    <SimpleTagList
                                        items={competitorSynonyms[currentCompetitor.company_name] || []}
                                        onItemsChange={handleCompetitorSynonymChange}
                                        placeholder={`Add alias for ${currentCompetitor.company_name}...`}
                                        colorClass="text-purple-700"
                                        bgClass="bg-purple-100"
                                    />

                                    <div className="mt-6">
                                        <label className="block text-sm font-bold text-[var(--text-headings)] mb-2">
                                            Competitor Products
                                        </label>
                                        <SimpleTagList
                                            items={competitorProducts[currentCompetitor.company_name] || []}
                                            onItemsChange={(products: string[]) => {
                                                setCompetitorProducts({
                                                    ...competitorProducts,
                                                    [currentCompetitor.company_name]: products
                                                });
                                            }}
                                            placeholder={`Add product for ${currentCompetitor.company_name}...`}
                                            colorClass="text-orange-700"
                                            bgClass="bg-orange-100"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                <button
                    onClick={onBack}
                    className="px-6 py-2.5 text-sm font-medium text-[var(--text-caption)] hover:text-[var(--text-headings)] hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    className="px-8 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md active:scale-95"
                >
                    Review Summary
                </button>
            </div>
        </div>
    );
};
