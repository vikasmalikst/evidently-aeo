import { useManualBrandDashboard } from '../../manual-dashboard';
import { SafeLogo } from '../Onboarding/common/SafeLogo';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cacheManager } from '../../lib/cacheManager';
import { useNavigate, useLocation } from 'react-router-dom';

export const BrandSelector = () => {
    const { brands, selectedBrand, selectBrand, isLoading } = useManualBrandDashboard();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleBrandChange = (brandId: string) => {
        // Clear all cached data to force fresh fetches for the new brand
        cacheManager.clear();

        // Select the brand (updates localStorage and state)
        selectBrand(brandId);

        // Close the dropdown
        setIsOpen(false);

        // Navigate to current route to trigger remount without full page reload
        // This avoids authentication rate limiting from excessive page reloads
        const currentPath = location.pathname + location.search;
        navigate(currentPath, { replace: true });
        setTimeout(() => navigate(currentPath, { replace: false }), 10);
    };

    // Don't render if loading or no brands
    if (isLoading || brands.length === 0) {
        return null;
    }

    // If only one brand, show it but don't make it interactive
    const isSingleBrand = brands.length === 1;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => !isSingleBrand && setIsOpen(!isOpen)}
                disabled={isSingleBrand}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white hover:border-[#06b6d4] transition-colors ${isSingleBrand ? 'cursor-default' : 'cursor-pointer'
                    }`}
                aria-label="Select brand"
            >
                {selectedBrand && (
                    <SafeLogo
                        src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                        domain={selectedBrand.homepage_url || undefined}
                        alt={selectedBrand.name}
                        size={20}
                        className="w-5 h-5 rounded object-contain"
                    />
                )}
                <span className="text-[13px] font-medium text-[#1a1d29] max-w-[150px] truncate">
                    {selectedBrand?.name || 'Select Brand'}
                </span>
                {!isSingleBrand && (
                    <ChevronDown
                        size={16}
                        className={`text-[#64748b] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && !isSingleBrand && (
                <div className="absolute top-full right-0 mt-1 w-[240px] bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-50 py-1 max-h-[400px] overflow-y-auto">
                    {brands.map((brand) => {
                        const isSelected = brand.id === selectedBrand?.id;
                        return (
                            <button
                                key={brand.id}
                                onClick={() => handleBrandChange(brand.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f1f5f9] transition-colors ${isSelected ? 'bg-[#e0f2fe]' : ''
                                    }`}
                            >
                                <SafeLogo
                                    src={brand.metadata?.logo || brand.metadata?.brand_logo}
                                    domain={brand.homepage_url || undefined}
                                    alt={brand.name}
                                    size={24}
                                    className="w-6 h-6 rounded object-contain shrink-0"
                                />
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-[13px] font-medium text-[#1a1d29] truncate">
                                        {brand.name}
                                    </div>
                                    {brand.homepage_url && (
                                        <div className="text-[11px] text-[#64748b] truncate">
                                            {brand.homepage_url.replace(/^https?:\/\//, '')}
                                        </div>
                                    )}
                                </div>
                                {isSelected && (
                                    <div className="w-2 h-2 rounded-full bg-[#06b6d4] shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
