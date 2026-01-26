/**
 * Centralized date utility to ensure consistent date ranges across the application.
 */

/**
 * Returns the default date range (last 7 days).
 * @returns { startDate: string, endDate: string }
 */
export const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6); // 7 days including today

    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
};

/**
 * Formats a date string for display (e.g., "Jan 21, 2026").
 * @param dateStr ISO date string
 */
export const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};
