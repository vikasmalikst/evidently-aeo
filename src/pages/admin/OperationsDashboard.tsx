
import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { useAdminStore } from '../../store/adminStore';
import { useManualBrandDashboard } from '../../manual-dashboard';

interface OperationsData {
  id: number;
  brand_name: string;
  date: string;
  brightdata_snapshot_id: string | null;
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
        <span className="text-green-500 text-xl">✅</span> : 
        <span className="text-gray-300 text-xl">❌</span>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Operations Dashboard</h1>
                <div className="flex items-center space-x-4">
                    <select 
                        value={limit} 
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="border rounded px-3 py-2 bg-white"
                    >
                        <option value={50}>Last 50</option>
                        <option value={100}>Last 100</option>
                        <option value={500}>Last 500</option>
                    </select>
                    <button 
                        onClick={loadData}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {effectiveBrandId && (
                <div className="mb-4 bg-blue-50 p-3 rounded text-blue-800 border border-blue-200">
                    Showing results for: <strong>{brands.find(b => b.id === effectiveBrandId)?.name || 'Selected Brand'}</strong>
                </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Snapshot ID</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Raw Answer</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">OpenRouter</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Citation</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Brand Scored</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Competitor Scored</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-10 text-center text-gray-500">
                                        Loading operations data...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-10 text-center text-gray-500">
                                        No recent operations found.
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(row.date).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {row.brand_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {row.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {row.brightdata_snapshot_id || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <StatusIcon status={row.raw_answer} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <StatusIcon status={row.openrouter_collection} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <StatusIcon status={row.citation_processed} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <StatusIcon status={row.sentiment_processed} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <StatusIcon status={row.brand_scored_process} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <StatusIcon status={row.competitor_scores_process} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
