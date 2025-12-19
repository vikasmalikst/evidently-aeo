import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as fs from 'fs/promises';
import * as path from 'path';

// File paths
const CREDENTIALS_FILE = path.join(__dirname, '../data/ga4-credentials.json');
const CACHE_FILE = path.join(__dirname, '../data/ga4-cache.json');

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface GA4Credential {
  brand_id: string;
  customer_id: string;
  property_id: string;
  service_account_key: any;
  configured_at: string;
}

interface GA4Cache {
  brand_id: string;
  cache_key: string;
  data: any;
  expires_at: string;
}

interface CredentialsFile {
  credentials: GA4Credential[];
}

interface CacheFile {
  cache: GA4Cache[];
}

/**
 * Read credentials from JSON file
 */
async function readCredentials(): Promise<CredentialsFile> {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading credentials file:', error);
    return { credentials: [] };
  }
}

/**
 * Write credentials to JSON file
 */
async function writeCredentials(data: CredentialsFile): Promise<void> {
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Read cache from JSON file
 */
async function readCache(): Promise<CacheFile> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading cache file:', error);
    return { cache: [] };
  }
}

/**
 * Write cache to JSON file
 */
async function writeCache(data: CacheFile): Promise<void> {
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
  const file = await readCredentials();
  
  // Remove existing credentials for this brand
  file.credentials = file.credentials.filter(
    (c) => c.brand_id !== brandId || c.customer_id !== customerId
  );
  
  // Add new credentials
  file.credentials.push({
    brand_id: brandId,
    customer_id: customerId,
    property_id: propertyId,
    service_account_key: serviceAccountKey,
    configured_at: new Date().toISOString(),
  });
  
  await writeCredentials(file);
  console.log(`✅ GA4 credentials saved for brand ${brandId}`);
}

/**
 * Get GA4 credentials for a brand
 */
export async function getCredentials(
  brandId: string,
  customerId: string
): Promise<GA4Credential | null> {
  const file = await readCredentials();
  const credential = file.credentials.find(
    (c) => c.brand_id === brandId && c.customer_id === customerId
  );
  return credential || null;
}

/**
 * Delete GA4 credentials for a brand
 */
export async function deleteCredentials(
  brandId: string,
  customerId: string
): Promise<void> {
  const file = await readCredentials();
  file.credentials = file.credentials.filter(
    (c) => c.brand_id !== brandId || c.customer_id !== customerId
  );
  await writeCredentials(file);
  
  // Also clear cache for this brand
  await clearBrandCache(brandId);
  console.log(`🗑️  GA4 credentials deleted for brand ${brandId}`);
}

/**
 * Get cached data
 */
async function getCachedData(brandId: string, cacheKey: string): Promise<any | null> {
  const file = await readCache();
  const now = new Date();
  
  const cached = file.cache.find(
    (c) => c.brand_id === brandId && c.cache_key === cacheKey
  );
  
  if (!cached) {
    return null;
  }
  
  // Check if expired
  if (new Date(cached.expires_at) < now) {
    console.log(`⏰ Cache expired for ${cacheKey}`);
    return null;
  }
  
  console.log(`📦 Cache hit for ${cacheKey}`);
  return cached.data;
}

/**
 * Set cached data
 */
async function setCachedData(brandId: string, cacheKey: string, data: any): Promise<void> {
  const file = await readCache();
  const expiresAt = new Date(Date.now() + CACHE_TTL);
  
  // Remove existing cache entry
  file.cache = file.cache.filter(
    (c) => c.brand_id !== brandId || c.cache_key !== cacheKey
  );
  
  // Add new cache entry
  file.cache.push({
    brand_id: brandId,
    cache_key: cacheKey,
    data,
    expires_at: expiresAt.toISOString(),
  });
  
  await writeCache(file);
  console.log(`💾 Cached data for ${cacheKey} (expires at ${expiresAt.toISOString()})`);
}

/**
 * Clear all cache entries for a brand
 */
async function clearBrandCache(brandId: string): Promise<void> {
  const file = await readCache();
  file.cache = file.cache.filter((c) => c.brand_id !== brandId);
  await writeCache(file);
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
  const cached = await getCachedData(brandId, cacheKey);
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
    await setCachedData(brandId, cacheKey, reportData);
    
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
  const cached = await getCachedData(brandId, cacheKey);
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
    await setCachedData(brandId, cacheKey, reportData);
    
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
  const cached = await getCachedData(brandId, cacheKey);
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
    await setCachedData(brandId, cacheKey, reportData);
    
    return { ...reportData, cached: false };
  } catch (error) {
    console.error('GA4 traffic sources query failed:', error);
    throw new Error(`Failed to fetch traffic sources: ${(error as Error).message}`);
  }
}

export const ga4AnalyticsService = {
  saveCredentials,
  getCredentials,
  deleteCredentials,
  getAnalyticsReport,
  getTopEvents,
  getTrafficSources,
};

