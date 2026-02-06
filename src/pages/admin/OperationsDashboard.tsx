
import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { apiClient } from '../../lib/apiClient';
import { useAdminStore } from '../../store/adminStore';
import { useManualBrandDashboard } from '../../manual-dashboard';

interface OperationsData {
  id: number;
  brand_name: string;
  date: string;
  brightdata_snapshot_id: string | null;
  collector_type: string;
  raw_answer: boolean;
  openrouter_collection: boolean;
  citation_processed: boolean;
  metric_fact_created: boolean;
  brand_sentiment_processed: boolean;
  competitor_sentiment_processed: boolean;
}

const COLLECTOR_TYPES = [
    { id: 'all', name: 'All Types' },
    { id: 'google_search', name: 'GoogleAIO' },
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'claude', name: 'Claude' },
    { id: 'perplexity', name: 'Perplexity' },
    { id: 'gemini', name: 'Gemini' },
    { id: 'grok', name: 'Grok' },
];



export const OperationsDashboard = () => {
    const { selectedBrandId: hookSelectedBrandId, brands } = useManualBrandDashboard();
    const { selectedBrandId: adminSelectedBrandId } = useAdminStore();
    const effectiveBrandId = adminSelectedBrandId || hookSelectedBrandId;

    const [data, setData] = useState<OperationsData[]>([]);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(100);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // Filter State
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        collectorResultId: '',
        snapshotId: '',
        collectorType: 'all',
        brandId: ''
    });

    const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== 'all').length;

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: limit.toString() });
            
            // Prioritize local filter brand, fallback to global context
            const brandIdToUse = filters.brandId || effectiveBrandId;
            if (brandIdToUse) params.append('brand_id', brandIdToUse);

            if (filters.startDate) params.append('start_date', filters.startDate);
            if (filters.endDate) params.append('end_date', filters.endDate);
            if (filters.collectorResultId) params.append('collector_result_id', filters.collectorResultId);
            if (filters.snapshotId) params.append('snapshot_id', filters.snapshotId);
            if (filters.collectorType && filters.collectorType !== 'all') params.append('collector_type', filters.collectorType);

            const response = await apiClient.get<{ success: boolean; data: OperationsData[] }>(
                `/operations/dashboard?${params.toString()}`
            );

            if (response.success) {
                setData(response.data);
            }
        } catch (error) {
            console.error('Failed to load operations data:', error);
            alert('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [limit, effectiveBrandId]); // Initial load and context changes

    const handleApplyFilters = () => {
        loadData();
        setIsFilterOpen(false);
    };

    const handleClearFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            collectorResultId: '',
            snapshotId: '',
            collectorType: 'all',
            brandId: ''
        });
        // We reload with cleared filters immediately after state update? 
        // Better to just clear UI and let user click 'Apply' or auto-reload. 
        // Let's auto-reload for better UX.
        setTimeout(() => {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (effectiveBrandId) params.append('brand_id', effectiveBrandId);
            
            setLoading(true);
            apiClient.get(`/operations/dashboard?${params.toString()}`)
                .then((res: any) => setData(res.data))
                .finally(() => setLoading(false));
        }, 0);
        setIsFilterOpen(false);
    };

    const StatusIcon = ({ status }: { status: boolean }) => (
        status ? 
        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
        </span> : 
        <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </span>
    );

    const CollectorTypeBadge = ({ type }: { type: string }) => {
        const colors: Record<string, string> = {
            'google_search': 'bg-blue-100 text-blue-800 border-blue-200',
            'chatgpt': 'bg-purple-100 text-purple-800 border-purple-200',
            'perplexity': 'bg-indigo-100 text-indigo-800 border-indigo-200',
            'claude': 'bg-violet-100 text-violet-800 border-violet-200',
            'gemini': 'bg-teal-100 text-teal-800 border-teal-200',
            'grok': 'bg-orange-100 text-orange-800 border-orange-200',
            'default': 'bg-gray-100 text-gray-800 border-gray-200'
        };
        
        const colorClass = colors[type.toLowerCase()] || colors['default'];
        const displayName = type.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colorClass}`}>
                {displayName}
            </span>
        );
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">Monitor data collection and analysis pipelines</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => loadData()}
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Selected Context Banner */}
            {(effectiveBrandId || filters.brandId) && (
                <div className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 flex justify-between items-center">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-blue-900">
                            Showing results for: <strong className="font-semibold">{brands.find(b => b.id === (filters.brandId || effectiveBrandId))?.name || 'Selected Brand'}</strong>
                        </span>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[100px]">Date</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[90px]">Brand</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[70px]">Collector<br/>Result ID</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[110px]">Snapshot<br/>ID</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[100px]">LLM</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[80px]">Raw<br/>Answer</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[70px]">Analysis</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[80px]">Citation<br/>Category</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[80px]">Metric<br/>Fact</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[90px]">Brand<br/>Sentiment</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[90px]">Competitor<br/>Sentiment</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading && data.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-3 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
                                            <p className="text-gray-500 text-sm">Loading operations data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-3 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                            <p className="text-gray-500 text-sm font-medium">No results found</p>
                                            <p className="text-gray-400 text-xs mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={row.id} className={`hover:bg-indigo-50 transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                        <td className="px-2 py-3 text-[11px] text-gray-600 w-[100px]">
                                            {new Date(row.date).toLocaleString('en-US', { 
                                                month: '2-digit', 
                                                day: '2-digit', 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}
                                        </td>
                                        <td className="px-2 py-3 text-xs font-medium text-gray-900 w-[90px] whitespace-normal break-words">
                                            {row.brand_name}
                                        </td>
                                        <td className="px-2 py-3 text-[11px] text-gray-500 font-mono w-[70px]">
                                            {row.id}
                                        </td>
                                        <td className="px-2 py-3 text-[10px] text-gray-500 font-mono w-[110px] whitespace-normal break-all">
                                            {row.brightdata_snapshot_id ? row.brightdata_snapshot_id.substring(0, 12) + '...' : '-'}
                                        </td>
                                        <td className="px-2 py-3 w-[100px]">
                                            <CollectorTypeBadge type={row.collector_type} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[80px]">
                                            <StatusIcon status={row.raw_answer} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[70px]">
                                            <StatusIcon status={row.openrouter_collection} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[80px]">
                                            <StatusIcon status={row.citation_processed} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[80px]">
                                            <StatusIcon status={row.metric_fact_created} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[90px]">
                                            <StatusIcon status={row.brand_sentiment_processed} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[90px]">
                                            <StatusIcon status={row.competitor_sentiment_processed} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Filter Modal */}
            <Transition appear show={isFilterOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsFilterOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-5 flex justify-between items-center">
                                        Filter Operations Data
                                        <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 hover:text-gray-500">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </Dialog.Title>
                                    
                                    <div className="space-y-4">
                                        {/* Date Range */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={filters.startDate}
                                                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                                                    className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={filters.endDate}
                                                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                                                    className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Brand & Type */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
                                                <select
                                                    value={filters.brandId}
                                                    onChange={(e) => setFilters({...filters, brandId: e.target.value})}
                                                    className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                                >
                                                    <option value="">All Brands</option>
                                                    {brands.map(b => (
                                                        <option key={b.id} value={b.id}>{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">LLM / Collector</label>
                                                <select
                                                    value={filters.collectorType}
                                                    onChange={(e) => setFilters({...filters, collectorType: e.target.value})}
                                                    className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                                >
                                                    {COLLECTOR_TYPES.map(type => (
                                                        <option key={type.id} value={type.id}>{type.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Identifiers */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Collector Result ID</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 15246"
                                                value={filters.collectorResultId}
                                                onChange={(e) => setFilters({...filters, collectorResultId: e.target.value})}
                                                className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Snapshot ID</label>
                                            <input
                                                type="text"
                                                placeholder="Contains..."
                                                value={filters.snapshotId}
                                                onChange={(e) => setFilters({...filters, snapshotId: e.target.value})}
                                                className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Limit Results</label>
                                            <select
                                                value={limit}
                                                onChange={(e) => setLimit(Number(e.target.value))}
                                                className="w-full h-10 px-3 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                            >
                                                <option value={10}>10</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                                <option value={500}>500</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                            onClick={handleClearFilters}
                                        >
                                            Clear All
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex justify-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                            onClick={handleApplyFilters}
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};
