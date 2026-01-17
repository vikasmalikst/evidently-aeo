import { supabaseAdmin } from '../config/database';

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

export interface CreateReportSettingsInput {
    frequency: ReportFrequency;
    distribution_emails: string[];
    is_active?: boolean;
}

export interface UpdateReportSettingsInput {
    frequency?: ReportFrequency;
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
    private validateFrequency(frequency: string): boolean {
        const validFrequencies: ReportFrequency[] = ['weekly', 'bi-weekly', 'monthly', 'quarterly'];
        return validFrequencies.includes(frequency as ReportFrequency);
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
            throw new Error(`Invalid frequency: ${settings.frequency}. Must be one of: weekly, bi-weekly, monthly, quarterly`);
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

        // Check if settings already exist
        const existing = await this.getReportSettings(brandId, customerId);
        if (existing) {
            throw new Error('Report settings already exist for this brand. Use update instead.');
        }

        const { data, error } = await supabaseAdmin
            .from('report_settings')
            .insert({
                brand_id: brandId,
                customer_id: customerId,
                frequency: settings.frequency,
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
            throw new Error(`Invalid frequency: ${settings.frequency}. Must be one of: weekly, bi-weekly, monthly, quarterly`);
        }

        // Validate email list if provided
        if (settings.distribution_emails) {
            const emailValidation = this.validateEmailList(settings.distribution_emails);
            if (!emailValidation.valid) {
                throw new Error(emailValidation.errors.join('; '));
            }
        }

        // Check if settings exist
        const existing = await this.getReportSettings(brandId, customerId);
        if (!existing) {
            throw new Error('Report settings not found for this brand');
        }

        const updateData: any = {};
        if (settings.frequency !== undefined) updateData.frequency = settings.frequency;
        if (settings.distribution_emails !== undefined) updateData.distribution_emails = settings.distribution_emails;
        if (settings.is_active !== undefined) updateData.is_active = settings.is_active;

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
