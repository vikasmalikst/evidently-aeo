import { useMemo } from 'react';
import { useCachedData } from '../../../hooks/useCachedData';
import type { ApiResponse, DashboardPayload } from '../types';

export const usePreviousPeriodData = (
    currentStartDate: string | undefined,
    currentEndDate: string | undefined,
    brandId: string | null
) => {
    // Calculate previous date range
    const { prevStart, prevEnd } = useMemo(() => {
        if (!currentStartDate || !currentEndDate) return { prevStart: null, prevEnd: null };

        try {
            const start = new Date(currentStartDate);
            const end = new Date(currentEndDate);

            // Calculate duration in milliseconds
            const duration = end.getTime() - start.getTime();

            // Previous End = Current Start - 1 day
            const prevEndDateObj = new Date(start);
            prevEndDateObj.setDate(prevEndDateObj.getDate() - 1);

            // Previous Start = Previous End - Duration
            const prevStartDateObj = new Date(prevEndDateObj.getTime() - duration);

            return {
                prevStart: prevStartDateObj.toISOString().split('T')[0],
                prevEnd: prevEndDateObj.toISOString().split('T')[0]
            };
        } catch (e) {
            console.error('Error calculating previous period:', e);
            return { prevStart: null, prevEnd: null };
        }
    }, [currentStartDate, currentEndDate]);

    // Construct endpoint for previous period
    const endpoint = useMemo(() => {
        if (!brandId || !prevStart || !prevEnd) return null;

        const timezoneOffset = new Date().getTimezoneOffset();
        const params = new URLSearchParams({
            startDate: prevStart,
            endDate: prevEnd,
            timezoneOffset: timezoneOffset.toString(),
            skipCitations: 'true' // Optimization: We only need top-level scores/metrics
        });

        return `/brands/${brandId}/dashboard?${params.toString()}`;
    }, [brandId, prevStart, prevEnd]);

    // Fetch data
    const {
        data: response,
        loading,
        error
    } = useCachedData<ApiResponse<DashboardPayload>>(
        endpoint,
        {},
        { requiresAuth: true },
        {
            enabled: !!endpoint,
            refetchOnMount: false, // Don't aggressively refetch if cached
            staleTime: 5 * 60 * 1000 // Cache for 5 minutes
        }
    );

    return {
        previousData: response?.success ? response.data : null,
        loading,
        error,
        prevStart,
        prevEnd
    };
};
