import { globalSettingsService } from '../services/global-settings.service';
import { customerEntitlementsService } from '../services/customer-entitlements.service';

/**
 * Service Provider Resolution Utility
 * 
 * This utility helps resolve which provider to use for a specific service
 * based on global settings and customer entitlements.
 */

export interface ProviderResolutionResult {
  provider: string;
  isEnabled: boolean;
  source: 'global_settings' | 'customer_entitlements' | 'default';
  reason?: string;
}

export class ServiceProviderResolver {
  /**
   * Resolve which provider to use for a service
   * @param serviceName - The service name (e.g., 'brand_intel', 'trending_keywords')
   * @param customerId - Optional customer ID for customer-specific resolution
   * @param preferredProvider - Optional preferred provider override
   * @returns Provider resolution result
   */
  static async resolveServiceProvider(
    serviceName: string,
    customerId?: string,
    preferredProvider?: string
  ): Promise<ProviderResolutionResult> {
    try {
      // 1. Get global settings for the service
      const globalProviders = await globalSettingsService.getServiceProviders(serviceName);
      
      if (!globalProviders) {
        return {
          provider: 'default',
          isEnabled: false,
          source: 'default',
          reason: `No global settings found for service: ${serviceName}`
        };
      }

      // 2. If preferred provider is specified, check if it's enabled globally
      if (preferredProvider) {
        const isPreferredEnabled = await globalSettingsService.isProviderEnabled(
          serviceName, 
          preferredProvider
        );
        
        if (isPreferredEnabled) {
          return {
            provider: preferredProvider,
            isEnabled: true,
            source: 'global_settings',
            reason: `Preferred provider ${preferredProvider} is enabled globally`
          };
        } else {
          console.warn(`Preferred provider ${preferredProvider} is not enabled for service ${serviceName}`);
        }
      }

      // 3. Check customer entitlements if customerId is provided
      if (customerId) {
        const customer = await customerEntitlementsService.getCustomerEntitlements(customerId);
        
        if (customer?.settings?.entitlements) {
          // Customer-specific provider resolution logic could go here
          // For now, we'll use global settings but could extend this
          // to check customer-specific provider preferences
        }
      }

      // 4. Return default provider from global settings
      return {
        provider: globalProviders.default_provider,
        isEnabled: true,
        source: 'global_settings',
        reason: `Using default provider from global settings`
      };

    } catch (error) {
      console.error('Error resolving service provider:', error);
      return {
        provider: 'default',
        isEnabled: false,
        source: 'default',
        reason: `Error resolving provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all enabled providers for a service
   * @param serviceName - The service name
   * @returns Array of enabled provider codes
   */
  static async getEnabledProviders(serviceName: string): Promise<string[]> {
    try {
      const providers = await globalSettingsService.getServiceProviders(serviceName);
      return providers?.enabled_providers || [];
    } catch (error) {
      console.error('Error getting enabled providers:', error);
      return [];
    }
  }

  /**
   * Check if a specific provider is enabled for a service
   * @param serviceName - The service name
   * @param providerCode - The provider code to check
   * @returns True if provider is enabled
   */
  static async isProviderEnabled(serviceName: string, providerCode: string): Promise<boolean> {
    try {
      return await globalSettingsService.isProviderEnabled(serviceName, providerCode);
    } catch (error) {
      console.error('Error checking provider status:', error);
      return false;
    }
  }

  /**
   * Get provider configuration for a service
   * @param serviceName - The service name
   * @returns Provider configuration or null if not found
   */
  static async getProviderConfig(serviceName: string): Promise<{
    enabled_providers: string[];
    default_provider: string;
  } | null> {
    try {
      return await globalSettingsService.getServiceProviders(serviceName);
    } catch (error) {
      console.error('Error getting provider config:', error);
      return null;
    }
  }

  /**
   * Validate service-provider combination
   * @param serviceName - The service name
   * @param providerCode - The provider code
   * @returns Validation result
   */
  static async validateServiceProvider(
    serviceName: string, 
    providerCode: string
  ): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    try {
      const isEnabled = await this.isProviderEnabled(serviceName, providerCode);
      
      if (!isEnabled) {
        const enabledProviders = await this.getEnabledProviders(serviceName);
        return {
          isValid: false,
          reason: `Provider ${providerCode} is not enabled for service ${serviceName}. Enabled providers: ${enabledProviders.join(', ')}`
        };
      }

      return {
        isValid: true,
        reason: `Provider ${providerCode} is valid for service ${serviceName}`
      };
    } catch (error) {
      return {
        isValid: false,
        reason: `Error validating service-provider combination: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export convenience functions
export const resolveServiceProvider = ServiceProviderResolver.resolveServiceProvider;
export const getEnabledProviders = ServiceProviderResolver.getEnabledProviders;
export const isProviderEnabled = ServiceProviderResolver.isProviderEnabled;
export const getProviderConfig = ServiceProviderResolver.getProviderConfig;
export const validateServiceProvider = ServiceProviderResolver.validateServiceProvider;
