import { create } from 'zustand';
import { getDefaultDateRange } from '../pages/dashboard/utils';

// We need to access getDefaultRanges, but imports might be tricky if utils is inside pages
// For now, we'll replicate the simple getDefaultDateRange logic or import it if clean.
// Let's import it to be safe.

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

export const useDashboardStore = create<DashboardState>((set) => ({
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
}));
