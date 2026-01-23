
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { useAdminStore } from '../../store/adminStore';

interface CollectionStatsRow {
    customerId: string;
    customerName: string;
    brandId: string;
    brandName: string;
    dataCollectionDate: string | null;
    totalQueries: number;
    queriesCompleted: number;
    queriesFailed: number;
    nextCollectorRun: string | null;
    dateScoreRun: string | null;
    queriesScored: number;
    llmResultsCollected: number;
    scoredResults: number;
}

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const CollectionStats = () => {
    const { selectedCustomerId, selectedBrandId } = useAdminStore();
    const [rows, setRows] = useState<CollectionStatsRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const queryParams = new URLSearchParams();
            if (selectedCustomerId) {
                queryParams.append('customer_id', selectedCustomerId);
            }
            if (selectedBrandId) {
                queryParams.append('brand_id', selectedBrandId);
            }

            const response = await apiClient.get<ApiResponse<CollectionStatsRow[]>>(
                `/admin/collection-stats?${queryParams.toString()}`
            );

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to fetch stats');
            }

            setRows(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [selectedCustomerId, selectedBrandId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Collection & Scoring Stats</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Overview of data collection runs and scoring progress per brand.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Brand
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Data Collection Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total Queries
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Completed
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Failed
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Next Run
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date Score Run
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Queries Scored
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    LLM Results
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Scored Results
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading && rows.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                                        Loading stats...
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                                        No data found.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={`${row.brandId}-${row.dataCollectionDate}`} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {row.customerName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            {row.brandName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(row.dataCollectionDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {row.totalQueries}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                            {row.queriesCompleted}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                            {row.queriesFailed}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(row.nextCollectorRun)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(row.dateScoreRun)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {row.queriesScored}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {row.llmResultsCollected}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                            {row.scoredResults}
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
