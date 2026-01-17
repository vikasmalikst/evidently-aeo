import { supabaseAdmin } from '../config/database';

export type ReportFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'custom';

export interface ReportSettings {
    id: string;
    brand_id: string;
    customer_id: string;
    frequency: ReportFrequency;
    day_of_week?: string;
    day_of_month?: number;
    month_in_quarter?: number;
    custom_interval?: number;
    start_date?: string;
    next_run_at?: string;
    last_run_at?: string;
    distribution_emails: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateReportSettingsInput {
    frequency: ReportFrequency;
    day_of_week?: string;
    day_of_month?: number;
    month_in_quarter?: number;
    custom_interval?: number;
    start_date?: string;
    distribution_emails: string[];
    is_active?: boolean;
}

export interface UpdateReportSettingsInput {
    frequency?: ReportFrequency;
    day_of_week?: string;
    day_of_month?: number;
    month_in_quarter?: number;
    custom_interval?: number;
    start_date?: string;
    distribution_emails?: string[];
    is_active?: boolean;
}

class ReportSettingsService {
    /**
     * Validate email address format
     */
    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate email list
     */
    private validateEmailList(emails: string[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!Array.isArray(emails)) {
            errors.push('Distribution emails must be an array');
            return { valid: false, errors };
        }

        if (emails.length === 0) {
            errors.push('At least one email address is required');
            return { valid: false, errors };
        }

        const invalidEmails = emails.filter(email => !this.validateEmail(email));
        if (invalidEmails.length > 0) {
            errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
            return { valid: false, errors };
        }

        // Check for duplicates
        const uniqueEmails = new Set(emails.map(e => e.toLowerCase()));
        if (uniqueEmails.size !== emails.length) {
            errors.push('Duplicate email addresses found');
            return { valid: false, errors };
        }

        return { valid: true, errors: [] };
    }

    /**
     * Validate frequency value
     */
    /**
     * Validate frequency value
     */
    private validateFrequency(frequency: string): boolean {
        const validFrequencies: ReportFrequency[] = ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'custom'];
        return validFrequencies.includes(frequency as ReportFrequency);
    }

    /**
     * Calculate the next run time based on frequency and settings
     */
    private calculateNextRunAt(
        frequency: ReportFrequency,
        settings: {
            day_of_week?: string;
            day_of_month?: number;
            month_in_quarter?: number;
            custom_interval?: number;
            start_date?: string;
        }
    ): string {
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setHours(9, 0, 0, 0); // Default to 9 AM

        switch (frequency) {
            case 'weekly': {
                const dayMap: { [key: string]: number } = {
                    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                    'Thursday': 4, 'Friday': 5, 'Saturday': 6
                };
                const targetDay = dayMap[settings.day_of_week || 'Monday'] || 1;
                const currentDay = now.getDay();
                let daysUntil = targetDay - currentDay;
                if (daysUntil <= 0) daysUntil += 7;
                nextRun.setDate(now.getDate() + daysUntil);
                break;
            }
            case 'bi-weekly': {
                const dayMap: { [key: string]: number } = {
                    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                    'Thursday': 4, 'Friday': 5, 'Saturday': 6
                };
                const targetDay = dayMap[settings.day_of_week || 'Monday'] || 1;
                const currentDay = now.getDay();
                let daysUntil = targetDay - currentDay;
                if (daysUntil <= 0) daysUntil += 14;
                else daysUntil += 7; // Basic bi-weekly logic, can be refined based on a reference date
                nextRun.setDate(now.getDate() + daysUntil);
                break;
            }
            case 'monthly': {
                const targetDate = settings.day_of_month || 1;
                if (now.getDate() >= targetDate) {
                    nextRun.setMonth(now.getMonth() + 1);
                }
                nextRun.setDate(targetDate);
                break;
            }
            case 'quarterly': {
                const targetMonthInQuarter = settings.month_in_quarter || 1; // 1, 2, or 3
                const targetDate = settings.day_of_month || 1;

                const currentMonth = now.getMonth(); // 0-11
                const currentQuarterStart = Math.floor(currentMonth / 3) * 3;
                let targetMonthIndex = currentQuarterStart + (targetMonthInQuarter - 1);

                // If target date in current quarter passed, move to next quarter
                if (targetMonthIndex < currentMonth || (targetMonthIndex === currentMonth && now.getDate() >= targetDate)) {
                    targetMonthIndex += 3;
                }

                nextRun.setMonth(targetMonthIndex);
                nextRun.setDate(targetDate);
                break;
            }
            case 'custom': {
                if (settings.start_date) {
                    const startDate = new Date(settings.start_date);
                    const interval = settings.custom_interval || 7;

                    if (startDate > now) {
                        return startDate.toISOString();
                    }

                    // Calculate next occurrence
                    const diffTime = Math.abs(now.getTime() - startDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const cycles = Math.ceil(diffDays / interval);
                    nextRun.setTime(startDate.getTime() + (cycles * interval * 24 * 60 * 60 * 1000));
                }
                break;
            }
        }

        return nextRun.toISOString();
    }

    /**
     * Get report settings for a brand
     */
    async getReportSettings(brandId: string, customerId: string): Promise<ReportSettings | null> {
        console.log(`📊 Fetching report settings for brand ${brandId}, customer ${customerId}`);

        const { data, error } = await supabaseAdmin
            .from('report_settings')
            .select('*')
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No settings found
                console.log('ℹ️  No report settings found');
                return null;
            }
            console.error('❌ Error fetching report settings:', error);
            throw new Error(`Failed to fetch report settings: ${error.message}`);
        }

        console.log('✅ Report settings fetched successfully');
        return data;
    }

    /**
     * Create report settings for a brand
     */
    async createReportSettings(
        brandId: string,
        customerId: string,
        settings: CreateReportSettingsInput
    ): Promise<ReportSettings> {
        console.log(`📝 Creating report settings for brand ${brandId}`);

        // Validate frequency
        if (!this.validateFrequency(settings.frequency)) {
            throw new Error(`Invalid frequency: ${settings.frequency}`);
        }

        // Validate email list
        const emailValidation = this.validateEmailList(settings.distribution_emails);
        if (!emailValidation.valid) {
            throw new Error(emailValidation.errors.join('; '));
        }

        // Verify brand exists and belongs to customer
        const { data: brand, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('id')
            .eq('id', brandId)
            .eq('customer_id', customerId)
            .single();

        if (brandError || !brand) {
            throw new Error('Brand not found or does not belong to customer');
        }

        // Calculate next run
        const next_run_at = this.calculateNextRunAt(settings.frequency, settings);

        const { data, error } = await supabaseAdmin
            .from('report_settings')
            .insert({
                brand_id: brandId,
                customer_id: customerId,
                frequency: settings.frequency,
                day_of_week: settings.day_of_week,
                day_of_month: settings.day_of_month,
                month_in_quarter: settings.month_in_quarter,
                custom_interval: settings.custom_interval,
                start_date: settings.start_date,
                next_run_at,
                distribution_emails: settings.distribution_emails,
                is_active: settings.is_active ?? true,
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating report settings:', error);
            throw new Error(`Failed to create report settings: ${error.message}`);
        }

        console.log('✅ Report settings created successfully');
        return data;
    }

    /**
     * Update report settings for a brand
     */
    async updateReportSettings(
        brandId: string,
        customerId: string,
        settings: UpdateReportSettingsInput
    ): Promise<ReportSettings> {
        console.log(`📝 Updating report settings for brand ${brandId}`);

        // Validate frequency if provided
        if (settings.frequency && !this.validateFrequency(settings.frequency)) {
            throw new Error(`Invalid frequency: ${settings.frequency}`);
        }

        // Check if settings exist
        const existing = await this.getReportSettings(brandId, customerId);
        if (!existing) {
            throw new Error('Report settings not found for this brand');
        }

        const updateData: any = {};
        if (settings.frequency !== undefined) updateData.frequency = settings.frequency;
        if (settings.day_of_week !== undefined) updateData.day_of_week = settings.day_of_week;
        if (settings.day_of_month !== undefined) updateData.day_of_month = settings.day_of_month;
        if (settings.month_in_quarter !== undefined) updateData.month_in_quarter = settings.month_in_quarter;
        if (settings.custom_interval !== undefined) updateData.custom_interval = settings.custom_interval;
        if (settings.start_date !== undefined) updateData.start_date = settings.start_date;
        if (settings.distribution_emails !== undefined) updateData.distribution_emails = settings.distribution_emails;
        if (settings.is_active !== undefined) updateData.is_active = settings.is_active;

        // Recalculate next run if scheduling params change
        if (settings.frequency || settings.day_of_week || settings.day_of_month || settings.month_in_quarter || settings.custom_interval || settings.start_date) {
            // Merge existing with new for complete context
            const mergedSettings = { ...existing, ...settings };
            updateData.next_run_at = this.calculateNextRunAt(mergedSettings.frequency, mergedSettings);
        }

        const { data, error } = await supabaseAdmin
            .from('report_settings')
            .update(updateData)
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .select()
            .single();

        if (error) {
            console.error('❌ Error updating report settings:', error);
            throw new Error(`Failed to update report settings: ${error.message}`);
        }

        console.log('✅ Report settings updated successfully');
        return data;
    }

    /**
     * Create or update report settings (upsert)
     */
    async saveReportSettings(
        brandId: string,
        customerId: string,
        settings: CreateReportSettingsInput
    ): Promise<ReportSettings> {
        const existing = await this.getReportSettings(brandId, customerId);

        if (existing) {
            return this.updateReportSettings(brandId, customerId, settings);
        } else {
            return this.createReportSettings(brandId, customerId, settings);
        }
    }

    /**
     * Delete report settings for a brand
     */
    async deleteReportSettings(brandId: string, customerId: string): Promise<void> {
        console.log(`🗑️  Deleting report settings for brand ${brandId}`);

        const { error } = await supabaseAdmin
            .from('report_settings')
            .delete()
            .eq('brand_id', brandId)
            .eq('customer_id', customerId);

        if (error) {
            console.error('❌ Error deleting report settings:', error);
            throw new Error(`Failed to delete report settings: ${error.message}`);
        }

        console.log('✅ Report settings deleted successfully');
    }

    /**
     * Get all report settings for a customer
     */
    async getCustomerReportSettings(customerId: string): Promise<ReportSettings[]> {
        console.log(`📊 Fetching all report settings for customer ${customerId}`);

        const { data, error } = await supabaseAdmin
            .from('report_settings')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error fetching customer report settings:', error);
            throw new Error(`Failed to fetch customer report settings: ${error.message}`);
        }

        console.log(`✅ Found ${data.length} report settings`);
        return data;
    }
}

export const reportSettingsService = new ReportSettingsService();
