import { apiClient } from '../lib/apiClient';

export type ReportFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';

export interface ReportSettings {
    id: string;
    brand_id: string;
    customer_id: string;
    frequency: ReportFrequency;
    distribution_emails: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ReportSettingsInput {
    frequency: ReportFrequency;
    distribution_emails: string[];
    is_active?: boolean;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * Get report settings for a specific brand
 */
export async function getReportSettings(
    brandId: string,
    skipCache = false
): Promise<ApiResponse<ReportSettings | null>> {
    try {
        return await apiClient.request<ApiResponse<ReportSettings | null>>(
            `/report-settings/${brandId}`,
            {
                method: 'GET',
            },
            { requiresAuth: true }
        );
    } catch (error) {
        console.error('Error fetching report settings:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch report settings',
        };
    }
}

/**
 * Save (create or update) report settings for a brand
 */
export async function saveReportSettings(
    brandId: string,
    settings: ReportSettingsInput
): Promise<ApiResponse<ReportSettings>> {
    try {
        return await apiClient.request<ApiResponse<ReportSettings>>(
            `/report-settings/${brandId}`,
            {
                method: 'POST',
                body: JSON.stringify(settings),
            },
            { requiresAuth: true }
        );
    } catch (error) {
        console.error('Error saving report settings:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save report settings',
        };
    }
}

/**
 * Delete report settings for a brand
 */
export async function deleteReportSettings(
    brandId: string
): Promise<ApiResponse<void>> {
    try {
        return await apiClient.request<ApiResponse<void>>(
            `/report-settings/${brandId}`,
            {
                method: 'DELETE',
            },
            { requiresAuth: true }
        );
    } catch (error) {
        console.error('Error deleting report settings:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete report settings',
        };
    }
}

/**
 * Get all report settings for the current customer
 */
export async function getAllReportSettings(
    skipCache = false
): Promise<ApiResponse<ReportSettings[]>> {
    try {
        return await apiClient.request<ApiResponse<ReportSettings[]>>(
            `/report-settings`,
            {
                method: 'GET',
            },
            { requiresAuth: true }
        );
    } catch (error) {
        console.error('Error fetching all report settings:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch report settings',
        };
    }
}
