import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDefaultDateRange } from '../pages/dashboard/utils';

interface DashboardState {
    startDate: string;
    endDate: string;
    setStartDate: (date: string) => void;
    setEndDate: (date: string) => void;
    setDateRange: (start: string, end: string) => void;
    resetDateRange: () => void;
    llmFilters: string[];
    setLlmFilters: (filters: string[]) => void;
    queryTags: string[];
    setQueryTags: (tags: string[]) => void;
}

const defaultRange = getDefaultDateRange();

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set) => ({
            startDate: defaultRange.start,
            endDate: defaultRange.end,
            setStartDate: (startDate) => set({ startDate }),
            setEndDate: (endDate) => set({ endDate }),
            setDateRange: (startDate, endDate) => set({ startDate, endDate }),
            resetDateRange: () => {
                const freshDefault = getDefaultDateRange();
                set({ startDate: freshDefault.start, endDate: freshDefault.end });
            },
            llmFilters: [],
            setLlmFilters: (llmFilters) => set({ llmFilters }),
            queryTags: [],
            setQueryTags: (queryTags) => set({ queryTags })
        }),
        {
            name: 'evidently-dashboard-filters', // localStorage key
            partialize: (state) => ({
                startDate: state.startDate,
                endDate: state.endDate,
                queryTags: state.queryTags,
                // llmFilters excluded - session only
            }),
        }
    )
);
