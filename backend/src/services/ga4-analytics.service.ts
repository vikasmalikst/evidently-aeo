import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as fs from 'fs/promises';
import * as path from 'path';

// File paths
const DATA_DIR = path.join(__dirname, '../data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'ga4-credentials.json');
const CACHE_FILE = path.join(DATA_DIR, 'ga4-cache.json');

/**
 * Ensure data directory exists
 */
async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface GA4Credential {
  brand_id: string;
  customer_id: string;
  property_id: string;
  service_account_key?: any; // Optional - can use gcloud auth instead
  auth_type?: 'service_account' | 'gcloud' | 'bearer_token'; // Authentication method
  bearer_token?: string; // For bearer token auth
  project_id?: string; // Required for gcloud auth
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
  await ensureDataDirectory();
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
  await ensureDataDirectory();
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Create BetaAnalyticsDataClient based on credential auth type
 */
function createAnalyticsClient(credential: GA4Credential): BetaAnalyticsDataClient {
  const authType = credential.auth_type || 'service_account';
  
  if (authType === 'gcloud') {
    // Use application-default credentials (gcloud auth application-default login)
    // Will automatically use GOOGLE_APPLICATION_CREDENTIALS env var or default credentials
    return new BetaAnalyticsDataClient({
      // No credentials provided - will use application default credentials
    });
  } else if (authType === 'bearer_token' && credential.bearer_token) {
    // Use bearer token authentication
    return new BetaAnalyticsDataClient({
      credentials: {
        getAccessToken: async () => {
          return { token: credential.bearer_token! };
        },
      },
    });
  } else {
    // Default: service account key
    if (!credential.service_account_key) {
      throw new Error('Service account key is required for service_account auth type');
    }
    
    // Ensure private key has proper newlines (fix escaped \n characters)
    let serviceAccountKey = { ...credential.service_account_key };
    if (serviceAccountKey.private_key && typeof serviceAccountKey.private_key === 'string') {
      // Replace escaped newlines with actual newlines
      if (serviceAccountKey.private_key.includes('\\n')) {
        serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
      }
      // Ensure private key ends with newline
      if (!serviceAccountKey.private_key.endsWith('\n')) {
        serviceAccountKey.private_key += '\n';
      }
    }
    
    return new BetaAnalyticsDataClient({
      credentials: serviceAccountKey,
    });
  }
}

/**
 * Save GA4 credentials for a brand
 */
export async function saveCredentials(
  brandId: string,
  customerId: string,
  propertyId: string,
  serviceAccountKey: any,
  authType: 'service_account' | 'gcloud' | 'bearer_token' = 'service_account',
  bearerToken?: string,
  projectId?: string
): Promise<void> {
  try {
    await ensureDataDirectory();
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
      auth_type: authType,
      bearer_token: bearerToken,
      project_id: projectId,
      configured_at: new Date().toISOString(),
    });
    
    await writeCredentials(file);
    console.log(`✅ GA4 credentials saved for brand ${brandId}`);
  } catch (error) {
    console.error('Error saving GA4 credentials:', error);
    throw new Error(`Failed to save credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
async function setCachedData(brandId: string, cacheKey: string, data: any, customExpiresAt?: Date): Promise<void> {
  const file = await readCache();
  const expiresAt = customExpiresAt || new Date(Date.now() + CACHE_TTL);
  
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
    
    // Create client based on auth type
    const analyticsDataClient = createAnalyticsClient(credential);
    
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
    
    const analyticsDataClient = createAnalyticsClient(credential);
    
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
    
    const analyticsDataClient = createAnalyticsClient(credential);
    
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
    const endDateStr = endDate || new Date().toISOString().split('T')[0];
    const startDateStr = startDate || new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    const analyticsDataClient = createAnalyticsClient(credential);
    
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
    await setCachedData(brandId, cacheKey, reportData);
    
    return { ...reportData, cached: false };
  } catch (error) {
    console.error('GA4 active users by city query failed:', error);
    throw new Error(`Failed to fetch active users by city: ${(error as Error).message}`);
  }
}

/**
 * Get real-time analytics report from GA4
 * Real-time reports show data from the last 30 minutes
 */
export async function getRealtimeReport(
  brandId: string,
  customerId: string,
  dimensions: string[] = [],
  metrics: string[] = ['activeUsers'],
  rowLimit: number = 10000
): Promise<any> {
  const cacheKey = `realtime:${dimensions.join(',')}:${metrics.join(',')}`;
  
  // Note: Real-time data changes frequently, so we use a shorter cache TTL (30 seconds)
  const realtimeCacheTTL = 30 * 1000; // 30 seconds
  
  // Check cache with shorter TTL for real-time data
  const file = await readCache();
  const now = new Date();
  const cached = file.cache.find(
    (c) => c.brand_id === brandId && c.cache_key === cacheKey
  );
  
  if (cached) {
    const cacheExpiry = new Date(cached.expires_at);
    // Check if cache is still valid (within real-time TTL)
    if (cacheExpiry > now) {
      console.log(`📦 Real-time cache hit for ${cacheKey}`);
      return {
        ...cached.data,
        cached: true,
        cachedAt: cached.expires_at,
      };
    }
  }
  
  // Get credentials
  const credential = await getCredentials(brandId, customerId);
  if (!credential) {
    throw new Error('GA4 not configured for this brand');
  }
  
  try {
    // Create client based on auth type
    const analyticsDataClient = createAnalyticsClient(credential);
    
    // Build dimensions and metrics arrays
    const dimensionList = dimensions.map(dim => ({ name: dim }));
    const metricsList = metrics.map(met => ({ name: met }));
    
    // Query GA4 Real-time API
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${credential.property_id}`,
      dimensions: dimensionList,
      metrics: metricsList,
      limit: rowLimit,
    });
    
    // Extract headers
    const headers = [
      ...(response.dimensionHeaders?.map(h => h.name || '') || []),
      ...(response.metricHeaders?.map(h => h.name || '') || [])
    ];
    
    // Extract rows (matching Python script format)
    const rows = response.rows?.map((row) => {
      const dimensionValues = row.dimensionValues?.map(dv => dv.value || '') || [];
      const metricValues = row.metricValues?.map(mv => mv.value || '0') || [];
      // Create flat array like Python script (dimensions + metrics combined)
      const flat = [...dimensionValues, ...metricValues];
      return {
        dimensions: dimensionValues,
        metrics: metricValues,
        flat, // Python script format: [dimension1, dimension2, metric1, metric2]
        // Also create a key-value object for easier access
        data: Object.fromEntries([
          ...dimensionValues.map((val, idx) => [dimensions[idx] || `dimension${idx}`, val]),
          ...metricValues.map((val, idx) => [metrics[idx] || `metric${idx}`, val])
        ])
      };
    }) || [];
    
    // Extract totals (convert to object format for easier access, matching Python script)
    const totalsArray = response.totals?.[0]?.metricValues?.map((mv, idx) => ({
      metric: metrics[idx] || `metric${idx}`,
      value: mv.value || '0', // Keep as string to match Python
    })) || [];
    
    // Also create totals as object (Python script style)
    const totals: Record<string, string> = {};
    totalsArray.forEach((t: any) => {
      totals[t.metric] = t.value;
    });
    
    // Extract row counts
    const rowCount = response.rowCount || 0;
    
    const reportData = {
      dimensions,
      metrics,
      headers,
      rows,
      totals: totalsArray, // Return as array for compatibility
      totalsObject: totals, // Also include as object (Python script style)
      rowCount,
      timestamp: new Date().toISOString(),
    };
    
    // Cache result with shorter TTL (30 seconds for real-time data)
    const expiresAt = new Date(Date.now() + realtimeCacheTTL);
    await setCachedData(brandId, cacheKey, reportData, expiresAt);
    
    return {
      ...reportData,
      cached: false,
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('GA4 real-time query failed:', error);
    throw new Error(`Failed to fetch real-time analytics data: ${(error as Error).message}`);
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
  getRealtimeReport,
};

