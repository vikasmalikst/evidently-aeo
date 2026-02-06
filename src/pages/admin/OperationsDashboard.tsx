
import React, { useState, useEffect } from 'react';
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
  sentiment_processed: boolean;
  brand_scored_process: boolean;
  competitor_scores_process: boolean;
}

export const OperationsDashboard = () => {
    const { selectedBrandId: hookSelectedBrandId, brands } = useManualBrandDashboard();
    const { selectedBrandId: adminSelectedBrandId } = useAdminStore();
    const effectiveBrandId = adminSelectedBrandId || hookSelectedBrandId;

    const [data, setData] = useState<OperationsData[]>([]);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(100);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (effectiveBrandId) {
                params.append('brand_id', effectiveBrandId);
            }

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
    }, [limit, effectiveBrandId]);

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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">Monitor data collection and analysis pipelines</p>
                </div>
                <div className="flex items-center space-x-3">
                    <select 
                        value={limit} 
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="border border-gray-300 rounded-lg px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value={50}>Last 50</option>
                        <option value={100}>Last 100</option>
                        <option value={500}>Last 500</option>
                    </select>
                    <button 
                        onClick={loadData}
                        disabled={loading}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {effectiveBrandId && (
                <div className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-blue-900">
                            Showing results for: <strong className="font-semibold">{brands.find(b => b.id === effectiveBrandId)?.name || 'Selected Brand'}</strong>
                        </span>
                    </div>
                </div>
            )}

            <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[100px]">Date</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[90px]">Brand</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[70px]">ID</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[110px]">Snapshot</th>
                                <th scope="col" className="px-2 py-3 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[100px]">Type</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[60px]">Raw</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[70px]">Analysis</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[70px]">Citation</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[75px]">Sentiment</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[70px]">Brand</th>
                                <th scope="col" className="px-2 py-3 text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider w-[85px]">Competitor</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
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
                                            <p className="text-gray-500 text-sm font-medium">No recent operations found</p>
                                            <p className="text-gray-400 text-xs mt-1">Try selecting a different brand or time range</p>
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
                                        <td className="px-2 py-3 text-center w-[60px]">
                                            <StatusIcon status={row.raw_answer} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[70px]">
                                            <StatusIcon status={row.openrouter_collection} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[70px]">
                                            <StatusIcon status={row.citation_processed} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[75px]">
                                            <StatusIcon status={row.sentiment_processed} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[70px]">
                                            <StatusIcon status={row.brand_scored_process} />
                                        </td>
                                        <td className="px-2 py-3 text-center w-[85px]">
                                            <StatusIcon status={row.competitor_scores_process} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {!loading && data.length > 0 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <p>Showing <strong className="text-gray-900">{data.length}</strong> operations</p>
                    <p className="text-xs">Last updated: {new Date().toLocaleTimeString()}</p>
                </div>
            )}
        </div>
    );
};
