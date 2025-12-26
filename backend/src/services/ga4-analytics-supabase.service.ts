/**
 * GA4 Analytics Service - Supabase Database Version
 * 
 * This is an alternative implementation that stores credentials
 * in Supabase instead of JSON files.
 * 
 * To use this version:
 * 1. Run the migration: supabase/migrations/20251218000000_create_ga4_tables.sql
 * 2. Replace the import in analytics.routes.ts:
 *    From: import { ga4AnalyticsService } from '../services/ga4-analytics.service';
 *    To:   import { ga4AnalyticsService } from '../services/ga4-analytics-supabase.service';
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { supabaseAdmin } from '../config/supabase';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface GA4Credential {
  brand_id: string;
  customer_id: string;
  property_id: string;
  service_account_key: any;
  configured_at: string;
}

/**
 * Save GA4 credentials for a brand
 */
export async function saveCredentials(
  brandId: string,
  customerId: string,
  propertyId: string,
  serviceAccountKey: any
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('brand_ga4_credentials')
    .upsert({
      brand_id: brandId,
      customer_id: customerId,
      property_id: propertyId,
      service_account_key: serviceAccountKey,
      configured_at: new Date().toISOString(),
    }, {
      onConflict: 'brand_id,customer_id'
    });

  if (error) {
    console.error('Error saving GA4 credentials:', error);
    throw new Error(`Failed to save GA4 credentials: ${error.message}`);
  }

  // Log to audit trail
  await supabaseAdmin.from('ga4_audit_log').insert({
    brand_id: brandId,
    customer_id: customerId,
    action: 'configure',
    details: { property_id: propertyId },
  });

  console.log(`✅ GA4 credentials saved for brand ${brandId}`);
}

/**
 * Get GA4 credentials for a brand
 */
export async function getCredentials(
  brandId: string,
  customerId: string
): Promise<GA4Credential | null> {
  const { data, error } = await supabaseAdmin
    .from('brand_ga4_credentials')
    .select('*')
    .eq('brand_id', brandId)
    .eq('customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching GA4 credentials:', error);
    throw new Error(`Failed to fetch GA4 credentials: ${error.message}`);
  }

  return data;
}

/**
 * Delete GA4 credentials for a brand
 */
export async function deleteCredentials(
  brandId: string,
  customerId: string
): Promise<void> {
  // Clear cache first
  await clearBrandCache(brandId, customerId);

  const { error } = await supabaseAdmin
    .from('brand_ga4_credentials')
    .delete()
    .eq('brand_id', brandId)
    .eq('customer_id', customerId);

  if (error) {
    console.error('Error deleting GA4 credentials:', error);
    throw new Error(`Failed to delete GA4 credentials: ${error.message}`);
  }

  // Log to audit trail
  await supabaseAdmin.from('ga4_audit_log').insert({
    brand_id: brandId,
    customer_id: customerId,
    action: 'delete',
  });

  console.log(`🗑️  GA4 credentials deleted for brand ${brandId}`);
}

/**
 * Get cached data
 */
async function getCachedData(
  brandId: string,
  customerId: string,
  cacheKey: string
): Promise<any | null> {
  const { data, error } = await supabaseAdmin
    .from('ga4_report_cache')
    .select('*')
    .eq('brand_id', brandId)
    .eq('customer_id', customerId)
    .eq('cache_key', cacheKey)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    console.log(`⏰ Cache expired for ${cacheKey}`);
    // Delete expired entry
    await supabaseAdmin
      .from('ga4_report_cache')
      .delete()
      .eq('id', data.id);
    return null;
  }

  console.log(`📦 Cache hit for ${cacheKey}`);
  return data.report_data;
}

/**
 * Set cached data
 */
async function setCachedData(
  brandId: string,
  customerId: string,
  cacheKey: string,
  data: any
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL);

  const { error } = await supabaseAdmin
    .from('ga4_report_cache')
    .upsert({
      brand_id: brandId,
      customer_id: customerId,
      cache_key: cacheKey,
      report_data: data,
      expires_at: expiresAt.toISOString(),
      cached_at: new Date().toISOString(),
    }, {
      onConflict: 'brand_id,customer_id,cache_key'
    });

  if (error) {
    console.error('Error caching data:', error);
    // Don't throw - caching failure shouldn't break the request
  } else {
    console.log(`💾 Cached data for ${cacheKey} (expires at ${expiresAt.toISOString()})`);
  }
}

/**
 * Clear all cache entries for a brand
 */
async function clearBrandCache(brandId: string, customerId: string): Promise<void> {
  await supabaseAdmin
    .from('ga4_report_cache')
    .delete()
    .eq('brand_id', brandId)
    .eq('customer_id', customerId);
}

/**
 * Clean up expired cache entries (call this periodically via cron)
 */
export async function cleanExpiredCache(): Promise<void> {
  const { error } = await supabaseAdmin
    .from('ga4_report_cache')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error cleaning expired cache:', error);
  } else {
    console.log('🧹 Cleaned expired GA4 cache entries');
  }
}

/**
 * Get analytics report from GA4
 */
export async function getAnalyticsReport(
  brandId: string,
  customerId: string,
  metric: string = 'eventCount',
  dimension: string = 'date',
  days: number = 7
): Promise<any> {
  const cacheKey = `${metric}:${dimension}:${days}d`;

  // Check cache first
  const cached = await getCachedData(brandId, customerId, cacheKey);
  if (cached) {
    return {
      ...cached,
      cached: true,
      cachedAt: new Date().toISOString(),
    };
  }

  // Get credentials
  const credential = await getCredentials(brandId, customerId);
  if (!credential) {
    throw new Error('GA4 not configured for this brand');
  }

  // Query GA4 API
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: credential.service_account_key,
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${credential.property_id}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: dimension }],
      metrics: [{ name: metric }],
    });

    // Transform response
    const reportData = {
      metric,
      dimension,
      days,
      dateRange: { startDate, endDate },
      data: response.rows?.map((row) => ({
        [dimension]: row.dimensionValues?.[0]?.value,
        [metric]: parseInt(row.metricValues?.[0]?.value || '0'),
      })) || [],
      total: parseInt(response.totals?.[0]?.metricValues?.[0]?.value || '0'),
    };

    // Cache result
    await setCachedData(brandId, customerId, cacheKey, reportData);

    // Log access
    await supabaseAdmin.from('ga4_audit_log').insert({
      brand_id: brandId,
      customer_id: customerId,
      action: 'access',
      details: { endpoint: 'reports', metric, dimension, days },
    });

    return {
      ...reportData,
      cached: false,
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('GA4 query failed:', error);
    throw new Error(`Failed to fetch analytics data: ${(error as Error).message}`);
  }
}

/**
 * Get top events from GA4
 */
export async function getTopEvents(
  brandId: string,
  customerId: string,
  days: number = 7
): Promise<any> {
  const cacheKey = `topEvents:${days}d`;

  // Check cache
  const cached = await getCachedData(brandId, customerId, cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Get credentials
  const credential = await getCredentials(brandId, customerId);
  if (!credential) {
    throw new Error('GA4 not configured for this brand');
  }

  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: credential.service_account_key,
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${credential.property_id}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: 10,
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    });

    const events = response.rows?.map((row) => ({
      name: row.dimensionValues?.[0]?.value || 'unknown',
      count: parseInt(row.metricValues?.[0]?.value || '0'),
    })) || [];

    const total = events.reduce((sum, e) => sum + e.count, 0);

    const reportData = { events, total };

    // Cache result
    await setCachedData(brandId, customerId, cacheKey, reportData);

    return { ...reportData, cached: false };
  } catch (error) {
    console.error('GA4 top events query failed:', error);
    throw new Error(`Failed to fetch top events: ${(error as Error).message}`);
  }
}

/**
 * Get traffic sources from GA4
 */
export async function getTrafficSources(
  brandId: string,
  customerId: string,
  days: number = 7
): Promise<any> {
  const cacheKey = `trafficSources:${days}d`;

  // Check cache
  const cached = await getCachedData(brandId, customerId, cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Get credentials
  const credential = await getCredentials(brandId, customerId);
  if (!credential) {
    throw new Error('GA4 not configured for this brand');
  }

  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: credential.service_account_key,
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${credential.property_id}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    const totalSessions = parseInt(response.totals?.[0]?.metricValues?.[0]?.value || '0');

    const trafficSources = response.rows?.map((row) => {
      const sessions = parseInt(row.metricValues?.[0]?.value || '0');
      return {
        source: row.dimensionValues?.[0]?.value || 'unknown',
        sessions,
        percentage: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      };
    }) || [];

    const reportData = { trafficSources, totalSessions };

    // Cache result
    await setCachedData(brandId, customerId, cacheKey, reportData);

    return { ...reportData, cached: false };
  } catch (error) {
    console.error('GA4 traffic sources query failed:', error);
    throw new Error(`Failed to fetch traffic sources: ${(error as Error).message}`);
  }
}

/**
 * Get active users by city from GA4
 */
export async function getActiveUsersByCity(
  brandId: string,
  customerId: string,
  days: number = 7,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const cacheKey = `activeUsersByCity:${days}d:${startDate || 'auto'}:${endDate || 'today'}`;
  
  // Check cache
  const cached = await getCachedData(brandId, customerId, cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }
  
  // Get credentials
  const credential = await getCredentials(brandId, customerId);
  if (!credential) {
    throw new Error('GA4 not configured for this brand');
  }
  
  try {
    const endDateStr = endDate || new Date().toISOString().split('T')[0];
    const startDateStr = startDate || new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: credential.service_account_key,
    });
    
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${credential.property_id}`,
      dateRanges: [
        {
          startDate: startDateStr,
          endDate: endDateStr,
        },
      ],
      dimensions: [
        {
          name: 'city',
        },
      ],
      metrics: [
        {
          name: 'activeUsers',
        },
      ],
    });
    
    const cities = response.rows?.map((row) => ({
      city: row.dimensionValues?.[0]?.value || 'unknown',
      activeUsers: parseInt(row.metricValues?.[0]?.value || '0'),
    })) || [];
    
    const totalActiveUsers = parseInt(response.totals?.[0]?.metricValues?.[0]?.value || '0');
    
    const reportData = {
      cities,
      totalActiveUsers,
      dateRange: { startDate: startDateStr, endDate: endDateStr },
    };
    
    // Cache result
    await setCachedData(brandId, customerId, cacheKey, reportData);
    
    // Log access
    await supabaseAdmin.from('ga4_audit_log').insert({
      brand_id: brandId,
      customer_id: customerId,
      action: 'access',
      details: { endpoint: 'activeUsersByCity', days, startDate: startDateStr, endDate: endDateStr },
    });
    
    return { ...reportData, cached: false };
  } catch (error) {
    console.error('GA4 active users by city query failed:', error);
    throw new Error(`Failed to fetch active users by city: ${(error as Error).message}`);
  }
}

export const ga4AnalyticsService = {
  saveCredentials,
  getCredentials,
  deleteCredentials,
  getAnalyticsReport,
  getTopEvents,
  getTrafficSources,
  getActiveUsersByCity,
  cleanExpiredCache,
};

