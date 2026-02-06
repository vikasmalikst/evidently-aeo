import { useState, useEffect } from 'react';
import { IconSparkles, IconSearch, IconWorld } from '@tabler/icons-react';

interface InitialAnalysisStepProps {
    data: any;
    updateData: (data: any) => void;
    onNext: () => void;
}

export const InitialAnalysisStep = ({ data, updateData, onNext }: InitialAnalysisStepProps) => {
    const [formData, setFormData] = useState({
        brand_name: data.brand_name || '',
        website_url: data.website_url || '',
        country: 'US', // Default to US
    });

    // Update local state when data changes (e.g. if back button used)
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            brand_name: data.brand_name || prev.brand_name,
            website_url: data.website_url || prev.website_url
        }));
    }, [data]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAnalyze = () => {
        updateData({
            ...data,
            brand_name: formData.brand_name,
            website_url: formData.website_url,
            // Store country if needed, though not in standard extraction yet
            country: formData.country
        });
        onNext();
    };

    return (
        <div className="max-w-2xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-2xl shadow-lg shadow-cyan-200 flex items-center justify-center mx-auto mb-6">
                    <IconSearch className="text-white" size={40} stroke={2.5} />
                </div>

                <h1 className="text-4xl font-black text-[var(--text-headings)] mb-4 tracking-tight">
                    Track Your Brand's <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">AI Visibility</span>
                </h1>

                <div className="bg-blue-50 inline-block px-4 py-1.5 rounded-full text-blue-700 font-medium text-sm">
                    See how your brand appears across ChatGPT, Perplexity, Claude, and more
                </div>
            </div>

            {/* Form Section */}
            <div className="space-y-6 bg-white p-2 rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Brand Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-headings)]">Brand Name</label>
                        <input
                            name="brand_name"
                            value={formData.brand_name}
                            onChange={handleChange}
                            placeholder="Enter your brand name"
                            className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all font-medium"
                        />
                    </div>

                    {/* Country */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-headings)]">Country</label>
                        <div className="relative">
                            <select
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                className="w-full pl-4 pr-10 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all font-medium appearance-none"
                            >
                                <option value="US">🇺🇸 US</option>
                                <option value="UK">🇬🇧 UK</option>
                                <option value="CA">🇨🇦 Canada</option>
                                <option value="AU">🇦🇺 Australia</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Website URL */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-[var(--text-headings)] flex items-center gap-2">
                        <IconWorld size={16} className="text-gray-400" /> Website URL
                    </label>
                    <input
                        name="website_url"
                        value={formData.website_url}
                        onChange={handleChange}
                        placeholder="e.g. brand.com"
                        className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all font-medium"
                    />
                </div>

                {/* Analyze Button */}
                <div className="pt-4 flex justify-end">
                    <button
                        onClick={handleAnalyze}
                        disabled={!formData.brand_name || !formData.website_url}
                        className="flex items-center gap-2 px-8 py-4 bg-[var(--accent-primary)] text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <IconSparkles size={20} />
                        Analyze Brand
                    </button>
                </div>
            </div>
        </div>
    );
};
