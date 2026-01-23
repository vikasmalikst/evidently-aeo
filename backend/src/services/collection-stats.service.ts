
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { customerEntitlementsService } from './customer-entitlements.service';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

export interface BrandCollectionStats {
    customerId: string;
    customerName: string;
    brandId: string;
    brandName: string;
    dataCollectionDate: string | null;
    totalQueries: number;
    queriesCompleted: number;
    queriesFailed: number;
    nextCollectorRun: string | null;
    dateScoreRun: string | null;
    queriesScored: number;
    llmResultsCollected: number;
    scoredResults: number;
}

export class CollectionStatsService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: 'public' },
        });
    }

    /**
     * Get collection stats for all brands (or filtered by customer/brand)
     */
    async getCollectionStats(filterCustomerId?: string, filterBrandId?: string): Promise<BrandCollectionStats[]> {
        try {
            // 1. Fetch Customers (for names and entitlement settings)
            let customerQuery = this.supabase
                .from('customers')
                .select('id, name, settings');

            if (filterCustomerId) {
                customerQuery = customerQuery.eq('id', filterCustomerId);
            }

            const { data: customers, error: customerError } = await customerQuery;
            if (customerError) throw new Error(`Error fetching customers: ${customerError.message}`);

            // Map customers for easy lookup
            const customerMap = new Map<string, { name: string; frequency: string }>();
            customers.forEach(c => {
                const ent = c.settings?.entitlements;
                const frequency = ent?.run_frequency || 'daily'; // Default to daily
                customerMap.set(c.id, { name: c.name, frequency });
            });

            // 2. Fetch Brands
            let brandQuery = this.supabase
                .from('brands')
                .select('id, name, customer_id')
                .eq('status', 'active'); // Only active brands? Assuming yes.

            if (filterCustomerId) {
                brandQuery = brandQuery.eq('customer_id', filterCustomerId);
            }

            if (filterBrandId) {
                brandQuery = brandQuery.eq('id', filterBrandId);
            }

            const { data: brands, error: brandError } = await brandQuery;
            if (brandError) throw new Error(`Error fetching brands: ${brandError.message}`);

            const stats: BrandCollectionStats[] = [];

            // 3. For each brand, calculate stats
            // Note: This could be optimized with complex SQL, but iterating is safer for logic complexity right now.
            // We limit to active brands, which shouldn't be too massive.

            // We can parallelize this in batches if needed.
            const BATCH_SIZE = 5;
            for (let i = 0; i < brands.length; i += BATCH_SIZE) {
                const batch = brands.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (brand) => {
                    return this.calculateBrandStats(brand, customerMap.get(brand.customer_id));
                });

                const batchResults = await Promise.all(batchPromises);
                stats.push(...batchResults);
            }

            return stats;
        } catch (error) {
            console.error('Error getting collection stats:', error);
            throw error;
        }
    }

    private async calculateBrandStats(
        brand: { id: string; name: string; customer_id: string },
        customerInfo?: { name: string; frequency: string }
    ): Promise<BrandCollectionStats> {
        const defaultStats: BrandCollectionStats = {
            customerId: brand.customer_id,
            customerName: customerInfo?.name || 'Unknown',
            brandId: brand.id,
            brandName: brand.name,
            dataCollectionDate: null,
            totalQueries: 0,
            queriesCompleted: 0,
            queriesFailed: 0,
            nextCollectorRun: null,
            dateScoreRun: null,
            queriesScored: 0, // Sent for scoring
            llmResultsCollected: 0,
            scoredResults: 0, // Completed scoring
        };

        try {
            // A. Find "Latest Run" date
            // Priority: Check query_executions executed_at first.
            const { data: lastExec } = await this.supabase
                .from('query_executions')
                .select('executed_at')
                .eq('brand_id', brand.id)
                .not('executed_at', 'is', null) // Only started/executed ones
                .order('executed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let lastRunDateStr: string | null = null;

            if (lastExec?.executed_at) {
                lastRunDateStr = lastExec.executed_at;
            } else {
                // Fallback to collector_results created_at if query_executions is empty/null
                const { data: lastResult } = await this.supabase
                    .from('collector_results')
                    .select('created_at')
                    .eq('brand_id', brand.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastResult?.created_at) {
                    lastRunDateStr = lastResult.created_at;
                }
            }

            if (!lastRunDateStr) {
                return defaultStats;
            }

            const lastRunDate = new Date(lastRunDateStr);
            defaultStats.dataCollectionDate = lastRunDateStr;

            // Calculate Next Run
            if (customerInfo?.frequency) {
                const freq = customerInfo.frequency;
                const nextDate = new Date(lastRunDate);
                if (freq === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (freq === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (freq === 'bi-weekly') nextDate.setDate(nextDate.getDate() + 14);
                else if (freq === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

                defaultStats.nextCollectorRun = nextDate.toISOString();
            }

            // Define "Run Window": items created within 12 hours of the last run date
            const windowStart = new Date(lastRunDate.getTime() - 12 * 60 * 60 * 1000).toISOString();

            // B. Get Query Stats for this run
            // queries: executed_at >= windowStart
            const { count: totalQueries } = await this.supabase
                .from('query_executions')
                .select('*', { count: 'exact', head: true })
                .eq('brand_id', brand.id)
                .gte('executed_at', windowStart); // Use executed_at

            defaultStats.totalQueries = totalQueries || 0;

            const { count: completedQueries } = await this.supabase
                .from('query_executions')
                .select('*', { count: 'exact', head: true })
                .eq('brand_id', brand.id)
                .gte('executed_at', windowStart)
                .eq('status', 'completed');

            defaultStats.queriesCompleted = completedQueries || 0;
            defaultStats.queriesFailed = (defaultStats.totalQueries - defaultStats.queriesCompleted);

            // C. Get Scoring Stats
            // Date Score Run: Max scoring_started_at in this window
            const { data: scoreRunDates } = await this.supabase
                .from('collector_results')
                .select('scoring_started_at')
                .eq('brand_id', brand.id)
                .gte('created_at', windowStart) // Correlation by creation time window
                .not('scoring_started_at', 'is', null)
                .order('scoring_started_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (scoreRunDates) {
                defaultStats.dateScoreRun = scoreRunDates.scoring_started_at;
            }

            // Queries Scored
            const { count: queriesScoredCount } = await this.supabase
                .from('collector_results')
                .select('*', { count: 'exact', head: true })
                .eq('brand_id', brand.id)
                .gte('created_at', windowStart)
                .not('scoring_status', 'is', null)
                .neq('scoring_status', 'pending'); // Exclude pending if you only want explicitly scored (processing/completed/error)
            // User asked: "Total number of queries that were sent for scoring" -> likely implies processed/processing

            defaultStats.queriesScored = queriesScoredCount || 0;

            // Scored results
            const { count: scoredResultsCount } = await this.supabase
                .from('collector_results')
                .select('*', { count: 'exact', head: true })
                .eq('brand_id', brand.id)
                .gte('created_at', windowStart)
                .eq('scoring_status', 'completed');

            defaultStats.scoredResults = scoredResultsCount || 0;

            // LLM Results collected
            const { count: llmResultsCount } = await this.supabase
                .from('consolidated_analysis_cache')
                .select('*, collector_results!inner(brand_id, created_at)', { count: 'exact', head: true })
                .eq('collector_results.brand_id', brand.id)
                .gte('collector_results.created_at', windowStart);

            defaultStats.llmResultsCollected = llmResultsCount || 0;

        } catch (err) {
            console.error(`Error calculating stats for brand ${brand.name}:`, err);
            // Return default/partial stats
        }

        return defaultStats;
    }
}

export const collectionStatsService = new CollectionStatsService();
