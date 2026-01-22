import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { SafeLogo } from '../Onboarding/common/SafeLogo';

interface Customer {
    id: string;
    email: string;
    name: string;
    slug: string;
    access_level?: string | null;
}

interface Brand {
    id: string;
    name: string;
    slug: string;
    customer_id: string;
    status?: string;
    homepage_url?: string | null;
    metadata?: {
        logo?: string;
        brand_logo?: string;
        [key: string]: any;
    };
}

interface AdminCustomerBrandSelectorProps {
    selectedCustomerId: string | null;
    selectedBrandId: string | null;
    onCustomerChange: (customerId: string | null) => void;
    onBrandChange: (brandId: string | null) => void;
}

export const AdminCustomerBrandSelector = ({
    selectedCustomerId,
    selectedBrandId,
    onCustomerChange,
    onBrandChange,
}: AdminCustomerBrandSelectorProps) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [loadingBrands, setLoadingBrands] = useState(false);

    // Load all customers on mount
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                setLoadingCustomers(true);
                const response = await apiClient.get<{ success: boolean; data: Customer[] }>('/admin/customers');

                if (response.success && response.data) {
                    // Sort by email for easier selection
                    const sortedCustomers = response.data.sort((a, b) =>
                        (a.email || '').localeCompare(b.email || '')
                    );
                    setCustomers(sortedCustomers);
                }
            } catch (error) {
                console.error('Failed to load customers:', error);
            } finally {
                setLoadingCustomers(false);
            }
        };

        fetchCustomers();
    }, []);

    // Load brands when customer is selected
    useEffect(() => {
        const fetchBrands = async () => {
            if (!selectedCustomerId) {
                setBrands([]);
                return;
            }

            try {
                setLoadingBrands(true);
                const response = await apiClient.get<{ success: boolean; data: Brand[] }>(
                    `/admin/customers/${selectedCustomerId}/brands`
                );

                if (response.success && response.data) {
                    setBrands(response.data);
                } else {
                    setBrands([]);
                }
            } catch (error) {
                console.error('Failed to load brands for customer:', error);
                setBrands([]);
            } finally {
                setLoadingBrands(false);
            }
        };

        fetchBrands();
    }, [selectedCustomerId]);

    const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const customerId = e.target.value || null;
        onCustomerChange(customerId);
        // Reset brand selection when customer changes
        onBrandChange(null);
    };

    const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const brandId = e.target.value || null;
        onBrandChange(brandId);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Admin: Select Customer & Brand</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Selector */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Customer
                    </label>
                    <select
                        value={selectedCustomerId || ''}
                        onChange={handleCustomerChange}
                        disabled={loadingCustomers}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    >
                        <option value="">Select a customer...</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.email} {customer.name ? `(${customer.name})` : ''}
                            </option>
                        ))}
                    </select>
                    {loadingCustomers && (
                        <p className="text-xs text-gray-500 mt-1">Loading customers...</p>
                    )}
                </div>

                {/* Brand Selector */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Brand
                    </label>
                    <select
                        value={selectedBrandId || ''}
                        onChange={handleBrandChange}
                        disabled={!selectedCustomerId || loadingBrands || brands.length === 0}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    >
                        <option value="">
                            {!selectedCustomerId
                                ? 'Select a customer first...'
                                : brands.length === 0 && !loadingBrands
                                    ? 'No brands found'
                                    : 'Select a brand...'}
                        </option>
                        {brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                                {brand.name} {brand.status ? `(${brand.status})` : ''}
                            </option>
                        ))}
                    </select>

                    {/* Brand Logo Preview */}
                    {selectedBrandId && brands.find(b => b.id === selectedBrandId) && (
                        <div className="mt-2 flex items-center gap-2">
                            <SafeLogo
                                src={brands.find(b => b.id === selectedBrandId)?.metadata?.logo || brands.find(b => b.id === selectedBrandId)?.metadata?.brand_logo}
                                domain={brands.find(b => b.id === selectedBrandId)?.homepage_url || undefined}
                                alt={brands.find(b => b.id === selectedBrandId)?.name || ''}
                                size={32}
                                className="w-8 h-8 rounded object-contain bg-white border border-gray-200"
                            />
                            <span className="text-xs text-gray-600">
                                {brands.find(b => b.id === selectedBrandId)?.name}
                            </span>
                        </div>
                    )}
                    {loadingBrands && (
                        <p className="text-xs text-gray-500 mt-1">Loading brands...</p>
                    )}
                    {selectedCustomerId && brands.length === 0 && !loadingBrands && (
                        <p className="text-xs text-amber-600 mt-1">No brands found for this customer</p>
                    )}
                </div>
            </div>
        </div>
    );
};
