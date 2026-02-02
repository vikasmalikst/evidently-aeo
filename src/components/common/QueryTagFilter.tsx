
import React from 'react';
import { useDashboardStore } from '../../store/dashboardStore';

interface QueryTagFilterProps {
    className?: string;
    variant?: 'outline' | 'default';
}

export const QueryTagFilter: React.FC<QueryTagFilterProps> = ({ className, variant }) => {
    const { queryTags, setQueryTags } = useDashboardStore();

    const currentFilter = queryTags.length === 0 ? 'All' : queryTags[0] === 'bias' ? 'Bias' : 'Blind';

    const handleFilterChange = (tag: string) => {
        if (tag === 'All') {
            setQueryTags([]);
        } else {
            setQueryTags([tag.toLowerCase()]);
        }
    };

    return (
        <div className={`flex items-center space-x-2 bg-white rounded-lg border border-gray-200 p-1 ${className || ''}`}>
            {['All', 'Bias', 'Blind'].map((tag) => (
                <button
                    key={tag}
                    onClick={() => handleFilterChange(tag)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentFilter === tag
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                >
                    {tag}
                </button>
            ))}
        </div>
    );
};
