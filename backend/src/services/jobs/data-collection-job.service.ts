/**
 * Data Collection Job Service
 * Executes data collection jobs using onboarding topics and queries
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../../utils/env-utils';
import { dataCollectionService, QueryExecutionRequest } from '../data-collection/data-collection.service';
import { brandProductEnrichmentService } from '../onboarding/brand-product-enrichment.service';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

export interface DataCollectionJobResult {
  queriesExecuted: number;
  collectorResults: number;
  successfulExecutions: number;
  failedExecutions: number;
  errors: Array<{ queryId?: string; error: string }>;
}

export class DataCollectionJobService {
  /**
   * Execute data collection for a brand using onboarding topics/queries
   */
  async executeDataCollection(
    brandId: string,
    customerId: string,
    options?: {
      collectors?: string[];
      locale?: string;
      country?: string;
      since?: string; // Only collect data for queries created after this timestamp
      suppressScoring?: boolean;
    }
  ): Promise<DataCollectionJobResult> {
    console.log(`\n🔍 Starting data collection for brand ${brandId} (customer: ${customerId})`);

    // Ensure enrichment exists before running job (Lazy Load)
    try {
      const hasEnrichment = await brandProductEnrichmentService.hasEnrichment(brandId);
      if (!hasEnrichment) {
        console.log(`[Job] ⚠️ Enrichment missing for brand ${brandId}. Running enrichment now...`);
        await brandProductEnrichmentService.enrichBrand(brandId, (msg) => console.log(`[Job-LazyEnrichment] ${msg}`));
      }
    } catch (err) {
      console.warn(`[Job] ⚠️ Lazy enrichment failed, proceeding anyway:`, err);
    }

    const result: DataCollectionJobResult = {
      queriesExecuted: 0,
      collectorResults: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      errors: [],
    };

    try {
      // Get active queries for this brand from onboarding
      // These are queries that were selected during onboarding and are still active
      
      // First, let's check what queries exist (for debugging)
      const { data: allQueries, error: allQueriesError } = await supabase
        .from('generated_queries')
        .select('id, query_text, topic, intent, locale, country, brand_id, customer_id, is_active')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId);

      console.log(`\n🔍 [DEBUG] Checking queries for brand ${brandId}, customer ${customerId}`);
      console.log(`   Total queries found (any status): ${allQueries?.length || 0}`);
      if (allQueries && allQueries.length > 0) {
        console.log(`   Sample query:`, {
          id: allQueries[0].id,
          brand_id: allQueries[0].brand_id,
          customer_id: allQueries[0].customer_id,
          is_active: allQueries[0].is_active,
          is_active_type: typeof allQueries[0].is_active,
          query_text: allQueries[0].query_text?.substring(0, 50),
        });
        const activeCount = allQueries.filter(q => q.is_active === true || q.is_active === 'true').length;
        const inactiveCount = allQueries.filter(q => q.is_active === false || q.is_active === 'false').length;
        console.log(`   Breakdown: ${activeCount} active, ${inactiveCount} inactive`);
      } else if (allQueriesError) {
        console.error(`   Error fetching all queries:`, allQueriesError);
      }

      // Now get only active queries
      // Try boolean true first, then fallback to string 'true' if needed
      let queryBuilder = supabase
        .from('generated_queries')
        .select('id, query_text, topic, intent, locale, country')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .eq('is_active', true);

      // If 'since' is provided, only get queries created after that time
      if (options?.since) {
        queryBuilder = queryBuilder.gt('created_at', options.since);
      }

      const { data: queries, error: queriesError } = await queryBuilder;

      if (queriesError) {
        console.error(`❌ [DEBUG] Query error:`, queriesError);
        throw new Error(`Failed to fetch queries: ${queriesError.message}`);
      }

      console.log(`   Active queries found: ${queries?.length || 0}`);

      // If no queries found with boolean true, try filtering manually (in case is_active is stored as string)
      if (!queries || queries.length === 0) {
        console.log(`⚠️ No active queries found with boolean is_active=true`);
        
        // Fallback: Filter manually if is_active might be stored as string
        if (allQueries && allQueries.length > 0) {
          const activeQueries = allQueries.filter(q => {
            const isActive = q.is_active;
            return isActive === true || isActive === 'true' || isActive === 1 || isActive === '1';
          });
          
          if (activeQueries.length > 0) {
            console.log(`   ✅ Found ${activeQueries.length} active queries using fallback filter`);
            console.log(`   ⚠️ Note: is_active appears to be stored as ${typeof activeQueries[0].is_active}, not boolean`);
            
            // Use the manually filtered queries
            const executionRequests: QueryExecutionRequest[] = activeQueries.map((query) => ({
              queryId: query.id,
              brandId,
              customerId,
              queryText: query.query_text,
              intent: query.intent || 'data_collection',
              locale: options?.locale || query.locale || 'en-US',
              country: options?.country || query.country || 'US',
              suppressScoring: options?.suppressScoring === true,
              collectors: options?.collectors || [
                'chatgpt',
                'google_aio',
                'perplexity',
                'claude',
                'deepseek',
                'baidu',
                'bing',
                'gemini',
              ],
            }));

            // Execute queries through data collection service
            const executionResults = await dataCollectionService.executeQueries(executionRequests);

            // Process results
            result.queriesExecuted = activeQueries.length;
            result.collectorResults = executionResults.length;
            result.successfulExecutions = executionResults.filter((r) => r.status === 'completed').length;
            result.failedExecutions = executionResults.filter((r) => r.status === 'failed').length;

            // Collect errors
            executionResults
              .filter((r) => r.status === 'failed' && r.error)
              .forEach((r) => {
                result.errors.push({
                  queryId: r.queryId,
                  error: r.error || 'Unknown error',
                });
              });

            console.log(`✅ Data collection completed (using fallback):`);
            console.log(`   ▶ Queries executed: ${result.queriesExecuted}`);
            console.log(`   ▶ Collector results: ${result.collectorResults}`);
            console.log(`   ▶ Successful: ${result.successfulExecutions}`);
            console.log(`   ▶ Failed: ${result.failedExecutions}`);

            return result;
          }
        }
        
        console.log(`   Checked: brand_id=${brandId}, customer_id=${customerId}, is_active=true`);
        if (allQueries && allQueries.length > 0) {
          const activeCount = allQueries.filter(q => q.is_active === true || q.is_active === 'true').length;
          const inactiveCount = allQueries.filter(q => q.is_active === false || q.is_active === 'false').length;
          console.log(`   Found ${allQueries.length} total queries: ${activeCount} active, ${inactiveCount} inactive`);
        }
        return result;
      }

      console.log(`📋 Found ${queries.length} active queries to execute`);

      // Prepare execution requests
      const executionRequests: QueryExecutionRequest[] = queries.map((query) => ({
        queryId: query.id,
        brandId,
        customerId,
        queryText: query.query_text,
        intent: query.intent || 'data_collection',
        locale: options?.locale || query.locale || 'en-US',
        country: options?.country || query.country || 'US',
        suppressScoring: options?.suppressScoring === true,
        collectors: options?.collectors || [
          'chatgpt',
          'google_aio',
          'perplexity',
          'claude',
          'grok',
          'bing_copilot',
          'gemini'
        ],
      }));

      // Execute queries through data collection service
      const executionResults = await dataCollectionService.executeQueries(executionRequests);

      // Process results
      result.queriesExecuted = queries.length;
      result.collectorResults = executionResults.length;
      result.successfulExecutions = executionResults.filter((r) => r.status === 'completed').length;
      result.failedExecutions = executionResults.filter((r) => r.status === 'failed').length;

      // Collect errors
      executionResults
        .filter((r) => r.status === 'failed' && r.error)
        .forEach((r) => {
          result.errors.push({
            queryId: r.queryId,
            error: r.error || 'Unknown error',
          });
        });

      console.log(`✅ Data collection completed:`);
      console.log(`   ▶ Queries executed: ${result.queriesExecuted}`);
      console.log(`   ▶ Collector results: ${result.collectorResults}`);
      console.log(`   ▶ Successful: ${result.successfulExecutions}`);
      console.log(`   ▶ Failed: ${result.failedExecutions}`);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Data collection failed for brand ${brandId}:`, errorMsg);
      result.errors.push({ error: errorMsg });
      throw error;
    }
  }

  /**
   * Get active topics and queries for a brand (from onboarding)
   */
  async getBrandTopicsAndQueries(
    brandId: string,
    customerId: string
  ): Promise<{
    topics: Array<{ name: string; queryCount: number }>;
    totalQueries: number;
  }> {
    const { data: queries, error } = await supabase
      .from('generated_queries')
      .select('topic')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch topics and queries: ${error.message}`);
    }

    // Group by topic
    const topicMap = new Map<string, number>();
    queries?.forEach((q) => {
      const topic = q.topic || 'Uncategorized';
      topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
    });

    const topics = Array.from(topicMap.entries()).map(([name, queryCount]) => ({
      name,
      queryCount,
    }));

    return {
      topics,
      totalQueries: queries?.length || 0,
    };
  }
}

export const dataCollectionJobService = new DataCollectionJobService();
