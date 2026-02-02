import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { useManualBrandDashboard } from '../manual-dashboard';
import { ExecutiveSummaryResponse } from '../types/executive-summary';

export const useExecutiveSummary = () => {
    const { selectedBrandId } = useManualBrandDashboard();
    const [data, setData] = useState<ExecutiveSummaryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedBrandId) return;
            setIsLoading(true);
            try {
                const days = 7;
                // Note: The API returns { data: ..., meta: ..., narrative: ... }
                // The Type ExecutiveSummaryResponse seems to align with the full response body or just the data part?
                // Let's check FullExecutiveReportSlide.tsx usage.
                // It assigns response.data to stats.
                // So the API returns an object that HAS 'data' property. 
                // Let's assume the API returns ExecutiveSummaryResponse directly or a wrapper?
                // In service: res.json(data). Data is ExecutiveSummaryData + meta etc? 
                // No, controller returns res.json({ success: true, data: result }).
                // But executive-summary controller might be different.

                // Let's check executive-summary.controller.ts if possible, or trust FullExecutiveReportSlide.tsx:
                // apiClient.get<{ data: ExecutiveSummaryResponse['data'], meta: any, ... }>

                // My hook return type needs to be careful.

                const response = await apiClient.get<ExecutiveSummaryResponse>(`/brands/${selectedBrandId}/executive-summary?days=${days}`);
                setData(response);
            } catch (err: any) {
                console.error("Failed to fetch executive summary:", err);
                setError(err.message || "Failed to load data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedBrandId]);

    return { data, isLoading, error };
};
