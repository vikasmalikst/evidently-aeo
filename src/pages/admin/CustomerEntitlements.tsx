import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';

interface Customer {
    id: string;
    email: string;
    name: string;
    slug: string;
}

interface CustomerEntitlement {
    max_brands: number;
    max_queries: number;
    run_frequency: string;
    enabled_collectors: string[];
    enabled_countries: string[];
    collector_run_frequencies: Record<string, string>;
    seats: number;
    tier?: 'free' | 'paid_enterprise' | 'agency';
    schedule?: {
        start_date?: string;
        end_date?: string;
        time?: string;
        day_of_week?: number;
        day_of_month?: number;
    };
    features?: {
        measure?: boolean;
        analyze_citation_sources?: boolean;
        analyze_topics?: boolean;
        analyze_queries?: boolean;
        analyze_answers?: boolean;
        analyze_domain_readiness?: boolean;
        analyze_keywords?: boolean;
        recommendations?: boolean;
        executive_reporting?: boolean;
    };
}

const DEFAULT_ENTITLEMENTS: CustomerEntitlement = {
    max_brands: 1,
    max_queries: 5,
    run_frequency: 'weekly',
    enabled_collectors: ['ChatGPT', 'Google AI Mode', 'Perplexity'],
    enabled_countries: ['US'],
    collector_run_frequencies: {},
    seats: 1,
    tier: 'free',
    schedule: {
        start_date: '',
        end_date: '',
        time: '09:00',
        day_of_week: 1, // Monday
        day_of_month: 1,
    },
    features: {
        measure: true,
        analyze_citation_sources: true,
        analyze_topics: true,
        analyze_queries: true,
        analyze_answers: true,
        analyze_domain_readiness: true,
        analyze_keywords: true,
        recommendations: true,
        executive_reporting: true,
    },
};

const AVAILABLE_COLLECTORS = [
    'ChatGPT',
    'Perplexity',
    'Google AI Mode',
    'Gemini',
    'Claude',
    'Grok',
];

const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

export const CustomerEntitlements = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [entitlements, setEntitlements] = useState<CustomerEntitlement>(DEFAULT_ENTITLEMENTS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Load customers on mount
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const response = await apiClient.get<{ success: boolean; data: Customer[] }>('/admin/customers');
                if (response.success && response.data) {
                    setCustomers(response.data.sort((a, b) => a.email.localeCompare(b.email)));
                }
            } catch (error) {
                console.error('Failed to load customers:', error);
            }
        };
        fetchCustomers();
    }, []);

    // Load entitlements when customer changes
    useEffect(() => {
        if (!selectedCustomerId) {
            setEntitlements(DEFAULT_ENTITLEMENTS);
            return;
        }

        const fetchEntitlements = async () => {
            try {
                setLoading(true);
                const response = await apiClient.get<{
                    success: boolean;
                    data: { settings: { entitlements?: CustomerEntitlement } };
                }>(`/admin/customers/${selectedCustomerId}/entitlements`);

                if (response.success && response.data?.settings?.entitlements) {
                    // Merge with defaults to ensure all fields exist
                    setEntitlements({
                        ...DEFAULT_ENTITLEMENTS,
                        ...response.data.settings.entitlements,
                        schedule: {
                            ...DEFAULT_ENTITLEMENTS.schedule,
                            ...response.data.settings.entitlements.schedule,
                        },
                        features: {
                            ...DEFAULT_ENTITLEMENTS.features,
                            ...response.data.settings.entitlements.features,
                        },
                    });
                } else {
                    setEntitlements(DEFAULT_ENTITLEMENTS);
                }
            } catch (error) {
                console.error('Failed to load entitlements:', error);
                setEntitlements(DEFAULT_ENTITLEMENTS);
            } finally {
                setLoading(false);
            }
        };

        fetchEntitlements();
    }, [selectedCustomerId]);

    const handleSave = async () => {
        if (!selectedCustomerId) {
            setMessage({ type: 'error', text: 'Please select a customer first' });
            return;
        }

        try {
            setSaving(true);
            setMessage(null);

            const response = await apiClient.put<{ success: boolean; error?: string }>(
                `/admin/customers/${selectedCustomerId}/entitlements`,
                entitlements
            );

            if (response.success) {
                setMessage({ type: 'success', text: 'Entitlements saved successfully!' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: response.error || 'Failed to save entitlements' });
            }
        } catch (error) {
            console.error('Failed to save entitlements:', error);
            setMessage({ type: 'error', text: 'An error occurred while saving' });
        } finally {
            setSaving(false);
        }
    };

    const handleCollectorToggle = (collector: string) => {
        setEntitlements((prev) => ({
            ...prev,
            enabled_collectors: prev.enabled_collectors.includes(collector)
                ? prev.enabled_collectors.filter((c) => c !== collector)
                : [...prev.enabled_collectors, collector],
        }));
    };

    const handleFeatureToggle = (feature: keyof NonNullable<CustomerEntitlement['features']>) => {
        setEntitlements((prev) => ({
            ...prev,
            features: {
                ...prev.features,
                [feature]: !prev.features?.[feature],
            },
        }));
    };

    const showScheduleFields = () => {
        const freq = entitlements.run_frequency;
        return {
            showDates: true,
            showTime: true,
            showDayOfWeek: freq === 'weekly' || freq === 'bi-weekly',
            showDayOfMonth: freq === 'monthly',
        };
    };

    const scheduleFields = showScheduleFields();

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Customer Entitlements</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage customer tier, limits, collectors, and feature access
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/admin/scheduled-jobs')}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                    >
                        Scheduled Jobs
                    </button>
                    <button
                        onClick={() => navigate('/admin/data-collection-status')}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                    >
                        Data Collection
                    </button>
                </div>
            </div>

            {/* Customer Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Customer</label>
                <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Select a customer --</option>
                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {customer.email} ({customer.name})
                        </option>
                    ))}
                </select>
            </div>

            {/* Message Display */}
            {message && (
                <div
                    className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Entitlements Form */}
            {selectedCustomerId && (
                <div className="space-y-6">
                    {loading ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
                            Loading entitlements...
                        </div>
                    ) : (
                        <>
                            {/* Tier & Basic Settings */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-lg font-semibold mb-4">Basic Settings</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Tier
                                        </label>
                                        <select
                                            value={entitlements.tier || 'free'}
                                            onChange={(e) =>
                                                setEntitlements((prev) => ({
                                                    ...prev,
                                                    tier: e.target.value as 'free' | 'paid_enterprise' | 'agency',
                                                }))
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        >
                                            <option value="free">Free</option>
                                            <option value="paid_enterprise">Paid Enterprise</option>
                                            <option value="agency">Agency</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Number of Brands
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={entitlements.max_brands}
                                            onChange={(e) =>
                                                setEntitlements((prev) => ({
                                                    ...prev,
                                                    max_brands: parseInt(e.target.value) || 1,
                                                }))
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Queries per Brand
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10000"
                                            value={entitlements.max_queries}
                                            onChange={(e) =>
                                                setEntitlements((prev) => ({
                                                    ...prev,
                                                    max_queries: parseInt(e.target.value) || 5,
                                                }))
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Collectors */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-lg font-semibold mb-4">Enabled Collectors</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {AVAILABLE_COLLECTORS.map((collector) => (
                                        <label key={collector} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={entitlements.enabled_collectors.includes(collector)}
                                                onChange={() => handleCollectorToggle(collector)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{collector}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Collection Frequency */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-lg font-semibold mb-4">Collection Frequency</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Frequency
                                        </label>
                                        <select
                                            value={entitlements.run_frequency}
                                            onChange={(e) =>
                                                setEntitlements((prev) => ({
                                                    ...prev,
                                                    run_frequency: e.target.value,
                                                }))
                                            }
                                            className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="bi-weekly">Bi-weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>

                                    {/* Schedule Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {scheduleFields.showDates && (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Start Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={entitlements.schedule?.start_date || ''}
                                                        onChange={(e) =>
                                                            setEntitlements((prev) => ({
                                                                ...prev,
                                                                schedule: { ...prev.schedule, start_date: e.target.value },
                                                            }))
                                                        }
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        End Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={entitlements.schedule?.end_date || ''}
                                                        onChange={(e) =>
                                                            setEntitlements((prev) => ({
                                                                ...prev,
                                                                schedule: { ...prev.schedule, end_date: e.target.value },
                                                            }))
                                                        }
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {scheduleFields.showTime && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Time
                                                </label>
                                                <input
                                                    type="time"
                                                    value={entitlements.schedule?.time || '09:00'}
                                                    onChange={(e) =>
                                                        setEntitlements((prev) => ({
                                                            ...prev,
                                                            schedule: { ...prev.schedule, time: e.target.value },
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {scheduleFields.showDayOfWeek && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Day of Week
                                                </label>
                                                <select
                                                    value={entitlements.schedule?.day_of_week ?? 1}
                                                    onChange={(e) =>
                                                        setEntitlements((prev) => ({
                                                            ...prev,
                                                            schedule: {
                                                                ...prev.schedule,
                                                                day_of_week: parseInt(e.target.value),
                                                            },
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    {DAYS_OF_WEEK.map((day) => (
                                                        <option key={day.value} value={day.value}>
                                                            {day.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {scheduleFields.showDayOfMonth && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Day of Month
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={entitlements.schedule?.day_of_month ?? 1}
                                                    onChange={(e) =>
                                                        setEntitlements((prev) => ({
                                                            ...prev,
                                                            schedule: {
                                                                ...prev.schedule,
                                                                day_of_month: parseInt(e.target.value) || 1,
                                                            },
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-lg font-semibold mb-4">Enabled Features</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.measure ?? true}
                                            onChange={() => handleFeatureToggle('measure')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Measure</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.analyze_citation_sources ?? true}
                                            onChange={() => handleFeatureToggle('analyze_citation_sources')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Analyze - Citation Sources</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.analyze_topics ?? true}
                                            onChange={() => handleFeatureToggle('analyze_topics')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Analyze - Topics</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.analyze_queries ?? true}
                                            onChange={() => handleFeatureToggle('analyze_queries')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Analyze - Queries</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.analyze_answers ?? true}
                                            onChange={() => handleFeatureToggle('analyze_answers')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Analyze - Answers</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.analyze_domain_readiness ?? true}
                                            onChange={() => handleFeatureToggle('analyze_domain_readiness')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Analyze - Domain Readiness</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.analyze_keywords ?? true}
                                            onChange={() => handleFeatureToggle('analyze_keywords')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Analyze - Keywords</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.recommendations ?? true}
                                            onChange={() => handleFeatureToggle('recommendations')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Recommendations</span>
                                    </label>

                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={entitlements.features?.executive_reporting ?? true}
                                            onChange={() => handleFeatureToggle('executive_reporting')}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Executive Reporting</span>
                                    </label>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setEntitlements(DEFAULT_ENTITLEMENTS)}
                                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                >
                                    Reset to Defaults
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : 'Save Entitlements'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
