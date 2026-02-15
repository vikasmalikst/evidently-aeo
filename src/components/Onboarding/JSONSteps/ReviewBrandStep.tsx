import { useState } from 'react';
import { IconBuildingStore, IconWorld, IconListDetails, IconMapPin } from '@tabler/icons-react';
import { SafeLogo } from '../common/SafeLogo';

interface ReviewBrandStepProps {
    data: any;
    updateData: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
}

export const ReviewBrandStep = ({ data, updateData, onNext, onBack }: ReviewBrandStepProps) => {
    const [formData, setFormData] = useState({
        brand_name: data.brand_name || '',
        website_url: data.website_url || '',
        industry: data.industry || '',
        description: data.description || '',
        headquarters: data.company_profile?.headquarters?.city || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleContinue = () => {
        // Update the main state with edited values
        updateData({
            ...data,
            ...formData,
            // Preserve nested structure if needed by backend, 
            // but generally we flatten for easier API usage later
        });
        onNext();
    };

    return (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="mb-8 text-center">
                <div className="w-24 h-24 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-6 p-4">
                    {formData.website_url ? (
                        <SafeLogo
                            domain={formData.website_url}
                            alt={formData.brand_name}
                            size={64}
                            className="object-contain"
                        />
                    ) : (
                        <IconBuildingStore size={40} className="text-gray-300" />
                    )}
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-headings)]">Review Brand Information</h2>
                <p className="text-[var(--text-caption)] mt-1">
                    Verify the company details extracted from the report.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5 flex items-center gap-2">
                            <IconBuildingStore size={16} stroke={1.5} className="text-[var(--accent-primary)]" /> Brand Name
                        </label>
                        <input
                            name="brand_name"
                            value={formData.brand_name}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5 flex items-center gap-2">
                            <IconWorld size={16} stroke={1.5} className="text-[var(--accent-primary)]" /> Website URL
                        </label>
                        <input
                            name="website_url"
                            value={formData.website_url}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5 flex items-center gap-2">
                            <IconListDetails size={16} stroke={1.5} className="text-[var(--accent-primary)]" /> Industry
                        </label>
                        <input
                            name="industry"
                            value={formData.industry}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5 flex items-center gap-2">
                            <IconMapPin size={16} stroke={1.5} className="text-[var(--accent-primary)]" /> Headquarters (City)
                        </label>
                        <input
                            name="headquarters"
                            value={formData.headquarters}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5">
                        Description
                    </label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={10}
                        className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all resize-none text-sm leading-relaxed"
                    />
                </div>
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
                    className="px-8 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md active:scale-95"
                >
                    Confirm & Continue
                </button>
            </div>
        </div>
    );
};
