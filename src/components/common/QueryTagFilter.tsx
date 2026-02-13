
import React, { useState } from 'react';
import { useDashboardStore } from '../../store/dashboardStore';

interface QueryTagFilterProps {
    className?: string;
    variant?: 'outline' | 'default';
    value?: string[];
    onChange?: (tags: string[]) => void;
}



export const QueryTagFilter: React.FC<QueryTagFilterProps> = ({ className, variant, value, onChange }) => {
    const { queryTags: storeQueryTags, setQueryTags: setStoreQueryTags } = useDashboardStore();

    const queryTags = value !== undefined ? value : storeQueryTags;
    const setQueryTags = onChange || setStoreQueryTags;

    // Map internal tags to display labels
    // [] -> All
    // ['bias'] -> Branded Queries
    // ['blind'] -> Neutral Queries
    const currentFilter = queryTags.length === 0 ? 'All' : queryTags[0] === 'bias' ? 'Branded Queries' : 'Neutral Queries';

    const handleFilterChange = (label: string) => {
        if (label === 'All') {
            setQueryTags([]);
        } else if (label === 'Branded Queries') {
            setQueryTags(['bias']);
        } else if (label === 'Neutral Queries') {
            setQueryTags(['blind']);
        }
    };

    const tooltips: Record<string, string> = {
        'All': 'Show all queries combined.',
        'Branded Queries': 'Queries that include Brand names (e.g. "Adidas running shoes").',
        'Neutral Queries': 'Unbranded category queries (e.g. "best running shoes").'
    };

    const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);

    return (
        <div className={`flex items-center space-x-2 bg-white rounded-lg border border-gray-200 p-1 ${className || ''}`}>
            {['All', 'Branded Queries', 'Neutral Queries'].map((label) => (
                <div key={label} className="relative group">
                    <button
                        onClick={() => handleFilterChange(label)}
                        onMouseEnter={() => setHoveredFilter(label)}
                        onMouseLeave={() => setHoveredFilter(null)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentFilter === label
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        {label}
                    </button>
                    {/* Tooltip */}
                    {hoveredFilter === label && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 pointer-events-none text-center">
                            {tooltips[label]}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
