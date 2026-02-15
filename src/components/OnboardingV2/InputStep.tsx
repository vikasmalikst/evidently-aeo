import { useState } from 'react';
import { IconSearch, IconWorld, IconMapPin, IconBuildingStore } from '@tabler/icons-react';

interface InputStepProps {
    onSubmit: (data: { brandName: string; country: string; websiteUrl: string }) => void;
}

const COUNTRIES = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
    'France', 'India', 'Japan', 'Brazil', 'Mexico', 'Spain', 'Italy',
    'Netherlands', 'Sweden', 'Singapore', 'South Korea', 'UAE',
    'South Africa', 'New Zealand', 'Ireland', 'Switzerland', 'Belgium',
    'Norway', 'Denmark', 'Finland', 'Austria', 'Portugal', 'Poland',
];

export const InputStep = ({ onSubmit }: InputStepProps) => {
    const [brandName, setBrandName] = useState('');
    const [country, setCountry] = useState('United States');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!brandName.trim()) newErrors.brandName = 'Brand name is required';
        if (!websiteUrl.trim()) {
            newErrors.websiteUrl = 'Website URL is required';
        } else if (!websiteUrl.match(/^https?:\/\/.+\..+/)) {
            newErrors.websiteUrl = 'Please enter a valid URL (e.g. https://example.com)';
        }
        if (!country) newErrors.country = 'Country is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit({ brandName: brandName.trim(), country, websiteUrl: websiteUrl.trim() });
        }
    };

    return (
        <div className="max-w-xl mx-auto">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-4 shadow-lg">
                    <IconSearch size={28} />
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-headings)] mb-2">
                    AI-Powered Brand Research
                </h2>
                <p className="text-[var(--text-caption)] max-w-md mx-auto">
                    Enter your brand details below. Our AI will research your brand, identify competitors, and generate relevant search queries.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Brand Name */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-headings)] mb-2">
                        <IconBuildingStore size={16} className="text-indigo-500" />
                        Brand Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={brandName}
                        onChange={(e) => { setBrandName(e.target.value); setErrors(prev => ({ ...prev, brandName: '' })); }}
                        placeholder="e.g. Magnet Kitchens"
                        className={`w-full px-4 py-3 rounded-lg border ${errors.brandName ? 'border-red-400 bg-red-50/50' : 'border-[var(--border-default)]'} bg-white text-[var(--text-body)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all`}
                    />
                    {errors.brandName && <p className="mt-1.5 text-sm text-red-500">{errors.brandName}</p>}
                </div>

                {/* Website URL */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-headings)] mb-2">
                        <IconWorld size={16} className="text-indigo-500" />
                        Website URL <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="url"
                        value={websiteUrl}
                        onChange={(e) => { setWebsiteUrl(e.target.value); setErrors(prev => ({ ...prev, websiteUrl: '' })); }}
                        placeholder="https://www.example.com"
                        className={`w-full px-4 py-3 rounded-lg border ${errors.websiteUrl ? 'border-red-400 bg-red-50/50' : 'border-[var(--border-default)]'} bg-white text-[var(--text-body)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all`}
                    />
                    {errors.websiteUrl && <p className="mt-1.5 text-sm text-red-500">{errors.websiteUrl}</p>}
                </div>

                {/* Country */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-headings)] mb-2">
                        <IconMapPin size={16} className="text-indigo-500" />
                        Primary Market <span className="text-red-400">*</span>
                    </label>
                    <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] bg-white text-[var(--text-body)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    >
                        {COUNTRIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    {errors.country && <p className="mt-1.5 text-sm text-red-500">{errors.country}</p>}
                </div>

                {/* Info Box */}
                <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-4 text-sm text-indigo-800">
                    <p className="font-medium mb-1">What happens next?</p>
                    <ul className="list-disc list-inside space-y-0.5 text-indigo-600 text-xs">
                        <li>AI will research your brand using live web data</li>
                        <li>Identify up to <strong>10 competitors</strong> in your market</li>
                        <li>Generate <strong>20 high-intent queries</strong> (10 branded, 10 neutral)</li>
                        <li>You'll review and refine everything before submitting</li>
                    </ul>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <IconSearch size={18} />
                    Start AI Research
                </button>
            </form>
        </div>
    );
};
