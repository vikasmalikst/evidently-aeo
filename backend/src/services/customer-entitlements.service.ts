import { supabaseAdmin } from '../config/database';
import { DatabaseError } from '../types/auth';

export interface CustomerEntitlement {
  max_brands: number;
  max_queries: number;
  run_frequency: string;
  enabled_collectors: string[];
  enabled_countries: string[];
  collector_run_frequencies: Record<string, string>;
  seats: number;

  // New fields for enhanced entitlements management
  tier?: 'free' | 'paid_enterprise' | 'agency';

  // Scheduling configuration
  schedule?: {
    start_date?: string;
    end_date?: string;
    time?: string;
    day_of_week?: number; // 0-6 for Sunday-Saturday
    day_of_month?: number; // 1-31
  };

  // Feature flags
  features?: {
    measure?: boolean;
    analyze_citation_sources?: boolean;
    analyze_topics?: boolean;
    analyze_queries?: boolean;
    analyze_answers?: boolean;
    analyze_domain_readiness?: boolean;
    analyze_keywords?: boolean;
    recommendations?: boolean;
    executive_reporting?: boolean;
  };
}

export interface CustomerWithEntitlements {
  id: string;
  name: string;
  email: string;
  status: string;
  subscription_tier: string;
  settings: {
    entitlements?: CustomerEntitlement;
  };
  created_at: string;
  updated_at: string;
}

export class CustomerEntitlementsService {
  /**
   * Get all customers with their entitlements
   */
  async getAllCustomerEntitlements(): Promise<CustomerWithEntitlements[]> {
    try {
      const { data: customers, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError(`Failed to fetch customers: ${error.message}`);
      }

      return customers || [];
    } catch (error) {
      console.error('Error fetching customer entitlements:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch customer entitlements');
    }
  }

  /**
   * Get customer entitlements by customer ID
   */
  async getCustomerEntitlements(customerId: string): Promise<CustomerWithEntitlements | null> {
    try {
      const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new DatabaseError(`Failed to fetch customer: ${error.message}`);
      }

      return customer;
    } catch (error) {
      console.error('Error fetching customer entitlements:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch customer entitlements');
    }
  }

  /**
   * Update customer entitlements
   */
  async updateCustomerEntitlements(
    customerId: string,
    entitlements: CustomerEntitlement
  ): Promise<CustomerWithEntitlements> {
    try {
      // Get current customer settings
      const { data: currentCustomer, error: fetchError } = await supabaseAdmin
        .from('customers')
        .select('settings')
        .eq('id', customerId)
        .single();

      if (fetchError) {
        throw new DatabaseError(`Failed to fetch customer settings: ${fetchError.message}`);
      }

      // Merge entitlements with existing settings
      const currentSettings = currentCustomer.settings || {};
      const updatedSettings = {
        ...currentSettings,
        entitlements: entitlements
      };

      // Update customer with new entitlements
      const { data: updatedCustomer, error: updateError } = await supabaseAdmin
        .from('customers')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)
        .select()
        .single();

      if (updateError) {
        throw new DatabaseError(`Failed to update customer entitlements: ${updateError.message}`);
      }

      console.log(`✅ Updated entitlements for customer: ${customerId}`);
      return updatedCustomer;
    } catch (error) {
      console.error('Error updating customer entitlements:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to update customer entitlements');
    }
  }

  /**
   * Create default entitlements for a customer
   */
  async createCustomerEntitlements(
    customerId: string,
    entitlements?: Partial<CustomerEntitlement>
  ): Promise<CustomerWithEntitlements> {
    try {
      // Default entitlements
      const defaultEntitlements: CustomerEntitlement = {
        max_brands: 5,
        max_queries: 1000,
        run_frequency: 'daily',
        enabled_collectors: ['chatgpt', 'perplexity'],
        enabled_countries: ['US'],
        collector_run_frequencies: {},
        seats: 1,
        ...entitlements
      };

      return await this.updateCustomerEntitlements(customerId, defaultEntitlements);
    } catch (error) {
      console.error('Error creating customer entitlements:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to create customer entitlements');
    }
  }

  /**
   * Get customer entitlement value with fallback to default
   */
  getEntitlementValue<T>(
    customer: CustomerWithEntitlements,
    field: keyof CustomerEntitlement,
    defaultValue: T
  ): { value: T; isFromDB: boolean } {
    const entitlements = customer.settings?.entitlements;
    const dbValue = entitlements?.[field];

    return {
      value: dbValue !== undefined ? dbValue as T : defaultValue,
      isFromDB: dbValue !== undefined
    };
  }

  /**
   * Validate customer entitlements
   */
  validateEntitlements(entitlements: CustomerEntitlement): string[] {
    const errors: string[] = [];

    // Validate max_brands
    if (entitlements.max_brands < 1 || entitlements.max_brands > 1000) {
      errors.push('Max brands must be between 1 and 1000');
    }

    // Validate max_queries
    if (entitlements.max_queries < 1 || entitlements.max_queries > 1000000) {
      errors.push('Max queries must be between 1 and 1,000,000');
    }

    // Validate run_frequency
    const validFrequencies = ['daily', 'weekly', 'bi-weekly', 'monthly', 'custom'];
    if (!validFrequencies.includes(entitlements.run_frequency)) {
      errors.push(`Run frequency must be one of: ${validFrequencies.join(', ')}`);
    }

    // Validate seats (optional check - only if provided)
    if (entitlements.seats !== undefined && (entitlements.seats < 1 || entitlements.seats > 100)) {
      errors.push('Seats must be between 1 and 100');
    }

    // Validate enabled_collectors (optional check - only if provided)
    if (entitlements.enabled_collectors && Array.isArray(entitlements.enabled_collectors)) {
      const validCollectors = [
        'ChatGPT', 'Perplexity', 'Claude', 'Google AI Mode',
        'Google Gemini', 'Bing', 'DeepSeek', 'Baidu', 'Grok', 'Gemini'
      ];

      for (const collector of entitlements.enabled_collectors) {
        if (!validCollectors.includes(collector)) {
          errors.push(`Invalid collector: ${collector}. Valid options: ${validCollectors.join(', ')}`);
        }
      }
    }

    // Validate enabled_countries (basic check for 2-letter codes)
    if (entitlements.enabled_countries && Array.isArray(entitlements.enabled_countries)) {
      for (const country of entitlements.enabled_countries) {
        if (!/^[A-Z]{2}$/.test(country)) {
          errors.push(`Invalid country code: ${country}. Must be 2-letter ISO code (e.g., US, GB)`);
        }
      }
    }

    return errors;
  }

  /**
   * Get default entitlements
   */
  getDefaultEntitlements(): CustomerEntitlement {
    return {
      max_brands: 5,
      max_queries: 1000,
      run_frequency: 'daily',
      enabled_collectors: ['chatgpt', 'perplexity'],
      enabled_countries: ['US'],
      collector_run_frequencies: {},
      seats: 1
    };
  }
}

export const customerEntitlementsService = new CustomerEntitlementsService();
