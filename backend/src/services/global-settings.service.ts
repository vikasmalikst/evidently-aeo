import { supabaseAdmin } from '../config/database';
import { DatabaseError } from '../types/auth';

export interface GlobalSetting {
  id: string;
  service_name: string;
  // Priority-based provider configuration (lowercase to match database)
  p1: string | null;
  p2: string | null;
  p3: string | null;
  p4: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  enabled_providers: string[];
  default_provider: string;
}

export interface GlobalSettingUpdate {
  p1?: string | null;
  p2?: string | null;
  p3?: string | null;
  p4?: string | null;
  metadata?: Record<string, any>;
}

export class GlobalSettingsService {
  /**
   * Get all global settings
   */
  async getGlobalSettings(): Promise<GlobalSetting[]> {
    try {
      const { data: settings, error } = await supabaseAdmin
        .from('global_settings')
        .select('*')
        .order('service_name', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to fetch global settings: ${error.message}`);
      }

      return settings || [];
    } catch (error) {
      console.error('Error fetching global settings:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch global settings');
    }
  }

  /**
   * Get global setting by service name
   */
  async getGlobalSetting(serviceName: string): Promise<GlobalSetting | null> {
    try {
      const { data: setting, error } = await supabaseAdmin
        .from('global_settings')
        .select('*')
        .eq('service_name', serviceName)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new DatabaseError(`Failed to fetch global setting: ${error.message}`);
      }

      return setting;
    } catch (error) {
      console.error('Error fetching global setting:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch global setting');
    }
  }

  /**
   * Update global setting
   */
  async updateGlobalSetting(
    serviceName: string, 
    updateData: GlobalSettingUpdate
  ): Promise<GlobalSetting> {
    try {
      const { data: updatedSetting, error } = await supabaseAdmin
        .from('global_settings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('service_name', serviceName)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to update global setting: ${error.message}`);
      }

      if (!updatedSetting) {
        throw new DatabaseError('Global setting not found');
      }

      console.log(`✅ Updated global setting for service: ${serviceName}`);
      return updatedSetting;
    } catch (error) {
      console.error('Error updating global setting:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to update global setting');
    }
  }

  /**
   * Create new global setting
   */
  async createGlobalSetting(settingData: {
    service_name: string;
    P1: string | null;
    P2: string | null;
    P3: string | null;
    P4: string | null;
    metadata?: Record<string, any>;
  }): Promise<GlobalSetting> {
    try {
      const { data: newSetting, error } = await supabaseAdmin
        .from('global_settings')
        .insert(settingData)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Failed to create global setting: ${error.message}`);
      }

      console.log(`✅ Created global setting for service: ${settingData.service_name}`);
      return newSetting;
    } catch (error) {
      console.error('Error creating global setting:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to create global setting');
    }
  }

  /**
   * Delete global setting
   */
  async deleteGlobalSetting(serviceName: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('global_settings')
        .delete()
        .eq('service_name', serviceName);

      if (error) {
        throw new DatabaseError(`Failed to delete global setting: ${error.message}`);
      }

      console.log(`✅ Deleted global setting for service: ${serviceName}`);
    } catch (error) {
      console.error('Error deleting global setting:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete global setting');
    }
  }

  /**
   * Get enabled providers for a specific service
   * Used by other services to determine which providers are available
   */
  async getServiceProviders(serviceName: string): Promise<{
    enabled_providers: string[];
    default_provider: string;
  } | null> {
    try {
      const setting = await this.getGlobalSetting(serviceName);
      
      if (!setting) {
        console.log(`⚠️ No global setting found for service: ${serviceName}`);
        return null;
      }

      return {
        enabled_providers: setting.enabled_providers,
        default_provider: setting.default_provider
      };
    } catch (error) {
      console.error('Error getting service providers:', error);
      return null;
    }
  }

  /**
   * Validate provider is enabled for a service
   */
  async isProviderEnabled(serviceName: string, providerCode: string): Promise<boolean> {
    try {
      const providers = await this.getServiceProviders(serviceName);
      return providers?.enabled_providers.includes(providerCode) || false;
    } catch (error) {
      console.error('Error checking provider status:', error);
      return false;
    }
  }
}

export const globalSettingsService = new GlobalSettingsService();
