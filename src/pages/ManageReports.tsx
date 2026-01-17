import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { getBrands, type BrandResponse } from '../api/brandApi';
import {
    getReportSettings,
    saveReportSettings,
    deleteReportSettings,
    type ReportFrequency,
    type ReportSettings,
} from '../api/reportSettingsApi';
import {
    IconMail,
    IconPlus,
    IconLoader2,
    IconAlertCircle,
    IconTrash,
    IconX,
    IconCheck,
    IconFileDownload,
    IconCalendar,
} from '@tabler/icons-react';

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string; description: string }[] = [
    { value: 'weekly', label: 'Weekly', description: 'Every Monday' },
    { value: 'bi-weekly', label: 'Bi-Weekly', description: 'Every other Monday' },
    { value: 'monthly', label: 'Monthly', description: 'First Monday of each month' },
    { value: 'quarterly', label: 'Quarterly', description: 'First Monday of each quarter' },
];

export const ManageReports = () => {
    const [brands, setBrands] = useState<BrandResponse[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState<string>('');
    const [settings, setSettings] = useState<ReportSettings | null>(null);
    const [frequency, setFrequency] = useState<ReportFrequency>('monthly');
    const [emails, setEmails] = useState<string[]>([]);
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState('');
    const [isActive, setIsActive] = useState(true);

    const [isLoadingBrands, setIsLoadingBrands] = useState(true);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Load brands on mount
    useEffect(() => {
        const loadBrands = async () => {
            setIsLoadingBrands(true);
            try {
                const response = await getBrands();
                if (response.success && response.data) {
                    const activeBrands = response.data.filter((b) => b.status === 'active');
                    setBrands(activeBrands);

                    // Auto-select first active brand or previously selected
                    const savedBrandId = localStorage.getItem('selectedBrandId');
                    const brandToSelect = activeBrands.find((b) => b.id === savedBrandId) || activeBrands[0];
                    if (brandToSelect) {
                        setSelectedBrandId(brandToSelect.id);
                    }
                } else {
                    setError(response.error || 'Failed to load brands');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load brands');
            } finally {
                setIsLoadingBrands(false);
            }
        };

        loadBrands();
    }, []);

    // Load settings when brand changes
    useEffect(() => {
        if (!selectedBrandId) return;

        const loadSettings = async () => {
            setIsLoadingSettings(true);
            setError(null);
            try {
                const response = await getReportSettings(selectedBrandId, true);
                if (response.success) {
                    const data = response.data;
                    setSettings(data || null);
                    if (data) {
                        setFrequency(data.frequency);
                        setEmails(data.distribution_emails);
                        setIsActive(data.is_active);
                    } else {
                        // Reset to defaults if no settings exist
                        setFrequency('monthly');
                        setEmails([]);
                        setIsActive(true);
                    }
                } else {
                    // No settings found is not an error, just means we're creating new ones
                    setSettings(null);
                    setFrequency('monthly');
                    setEmails([]);
                    setIsActive(true);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load settings');
            } finally {
                setIsLoadingSettings(false);
            }
        };

        loadSettings();
    }, [selectedBrandId]);

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleAddEmail = () => {
        const trimmedEmail = emailInput.trim().toLowerCase();

        if (!trimmedEmail) {
            setEmailError('Please enter an email address');
            return;
        }

        if (!validateEmail(trimmedEmail)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        if (emails.includes(trimmedEmail)) {
            setEmailError('This email is already in the list');
            return;
        }

        setEmails([...emails, trimmedEmail]);
        setEmailInput('');
        setEmailError('');
    };

    const handleRemoveEmail = (emailToRemove: string) => {
        setEmails(emails.filter((email) => email !== emailToRemove));
    };

    const handleSave = async () => {
        if (!selectedBrandId) {
            setError('Please select a brand');
            return;
        }

        if (emails.length === 0) {
            setError('Please add at least one email address to the distribution list');
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await saveReportSettings(selectedBrandId, {
                frequency,
                distribution_emails: emails,
                is_active: isActive,
            });

            if (response.success && response.data) {
                setSettings(response.data);
                setSuccessMessage('Report settings saved successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                setError(response.error || 'Failed to save settings');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedBrandId || !settings) return;

        if (!confirm('Are you sure you want to delete these report settings?')) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const response = await deleteReportSettings(selectedBrandId);
            if (response.success) {
                setSettings(null);
                setFrequency('monthly');
                setEmails([]);
                setIsActive(true);
                setSuccessMessage('Report settings deleted successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                setError(response.error || 'Failed to delete settings');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete settings');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedBrand = brands.find((b) => b.id === selectedBrandId);

    return (
        <Layout>
            <SettingsLayout>
                <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--text-headings)] tracking-tight">
                                Manage Reports
                            </h1>
                            <p className="text-sm text-[var(--text-caption)] mt-1">
                                Configure report generation frequency and email distribution lists
                            </p>
                        </div>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-3">
                            <IconCheck size={20} className="text-green-500 flex-shrink-0" />
                            <p className="font-medium">{successMessage}</p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                            <IconAlertCircle size={20} className="text-red-500 flex-shrink-0" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {isLoadingBrands ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
                            <IconLoader2 className="animate-spin text-[var(--accent-primary)]" size={48} />
                            <p className="text-[var(--text-caption)] font-medium">Loading brands...</p>
                        </div>
                    ) : brands.length === 0 ? (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-xl flex flex-col items-center gap-4 text-center">
                            <IconAlertCircle size={40} className="text-yellow-500" />
                            <div>
                                <h3 className="font-bold text-lg">No Active Brands</h3>
                                <p className="text-yellow-700/80 mt-1">
                                    Please add and activate at least one brand before configuring reports.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
                            <div className="p-6 space-y-6">
                                {/* Brand Selector */}
                                <div>
                                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                                        Select Brand
                                    </label>
                                    <select
                                        value={selectedBrandId}
                                        onChange={(e) => setSelectedBrandId(e.target.value)}
                                        className="w-full max-w-md px-4 py-2.5 bg-white border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
                                    >
                                        {brands.map((brand) => (
                                            <option key={brand.id} value={brand.id}>
                                                {brand.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-[var(--text-caption)] mt-2">
                                        Configure report settings for this brand
                                    </p>
                                </div>

                                {isLoadingSettings ? (
                                    <div className="flex items-center justify-center py-16">
                                        <IconLoader2 className="animate-spin text-[var(--accent-primary)]" size={32} />
                                    </div>
                                ) : (
                                    <>
                                        {/* Frequency Selection */}
                                        <div>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-headings)] mb-3">
                                                <IconCalendar size={18} />
                                                Report Frequency
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {FREQUENCY_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => setFrequency(option.value)}
                                                        className={`p-4 rounded-lg border-2 transition-all text-left ${frequency === option.value
                                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                                            : 'border-[var(--border-default)] hover:border-[var(--accent-primary)]/30'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-bold text-[var(--text-headings)]">{option.label}</p>
                                                                <p className="text-xs text-[var(--text-caption)] mt-1">
                                                                    {option.description}
                                                                </p>
                                                            </div>
                                                            {frequency === option.value && (
                                                                <IconCheck size={20} className="text-[var(--accent-primary)]" />
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Email Distribution List */}
                                        <div>
                                            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-headings)] mb-3">
                                                <IconMail size={18} />
                                                Email Distribution List
                                            </label>

                                            {/* Add Email Input */}
                                            <div className="flex gap-2 mb-4">
                                                <div className="flex-1">
                                                    <input
                                                        type="email"
                                                        value={emailInput}
                                                        onChange={(e) => {
                                                            setEmailInput(e.target.value);
                                                            setEmailError('');
                                                        }}
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddEmail();
                                                            }
                                                        }}
                                                        placeholder="Enter email address"
                                                        className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 transition-all ${emailError
                                                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                                            : 'border-[var(--border-default)] focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]'
                                                            }`}
                                                    />
                                                    {emailError && (
                                                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                            <IconAlertCircle size={14} />
                                                            {emailError}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handleAddEmail}
                                                    className="px-4 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-all font-medium flex items-center gap-2"
                                                >
                                                    <IconPlus size={18} />
                                                    Add
                                                </button>
                                            </div>

                                            {/* Email List */}
                                            {emails.length > 0 ? (
                                                <div className="space-y-2">
                                                    {emails.map((email) => (
                                                        <div
                                                            key={email}
                                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-[var(--border-default)]"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <IconMail size={16} className="text-[var(--text-caption)]" />
                                                                <span className="text-sm text-[var(--text-body)]">{email}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveEmail(email)}
                                                                className="p-1 hover:bg-red-100 rounded transition-colors text-red-600"
                                                                title="Remove email"
                                                            >
                                                                <IconX size={16} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <p className="text-xs text-[var(--text-caption)] mt-2">
                                                        {emails.length} {emails.length === 1 ? 'recipient' : 'recipients'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-[var(--border-default)]">
                                                    <IconMail size={32} className="text-[var(--text-caption)] opacity-30 mx-auto mb-3" />
                                                    <p className="text-sm text-[var(--text-caption)]">
                                                        No email addresses added yet
                                                    </p>
                                                    <p className="text-xs text-[var(--text-caption)] mt-1">
                                                        Add at least one email to receive reports
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Active Toggle */}
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                                            <button
                                                onClick={() => setIsActive(!isActive)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ring-offset-1 focus:ring-2 focus:ring-[var(--accent-primary)] ${isActive ? 'bg-green-500' : 'bg-gray-300'
                                                    }`}
                                            >
                                                <span
                                                    className={`${isActive ? 'translate-x-6' : 'translate-x-1'
                                                        } inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out`}
                                                />
                                            </button>
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--text-headings)]">
                                                    {isActive ? 'Reports Enabled' : 'Reports Disabled'}
                                                </p>
                                                <p className="text-xs text-[var(--text-caption)]">
                                                    {isActive
                                                        ? 'Reports will be generated and sent automatically'
                                                        : 'Reports will not be generated until enabled'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-default)]">
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving || emails.length === 0}
                                                className="px-6 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <IconLoader2 size={18} className="animate-spin" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconFileDownload size={18} />
                                                        {settings ? 'Update Settings' : 'Save Settings'}
                                                    </>
                                                )}
                                            </button>

                                            {settings && (
                                                <button
                                                    onClick={handleDelete}
                                                    disabled={isSaving}
                                                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <IconTrash size={18} />
                                                    Delete Settings
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </SettingsLayout>
        </Layout>
    );
};
