
import dotenv from 'dotenv';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BrandScoringService } from '../services/scoring/brand-scoring.orchestrator';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Load environment variables
// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// FORCE usage of optimized check (checking metric_facts instead of extracted_positions)
// This ensures that since we deleted metric_facts, the system sees them as "new" and re-processes them.
process.env.USE_OPTIMIZED_POSITION_CHECK = 'true';

// Parse command line arguments
function getArg(name: string): string | undefined {
    const arg = process.argv.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : undefined;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

// Initialize services
// We need to instantiate the orchestration service
// Note: Depending on DI setup, we might need to manually instantiate dependencies if they aren't exported
// For this script, we'll assume we can instantiate BrandScoringService or use its dependencies directly if needed.
// Looking at previous file reads, BrandScoringService seems to be the main entry point.
const brandScoringService = new BrandScoringService();

async function main() {
    const brandId = getArg('brandId');
    const customerId = getArg('customerId');
    const dateStr = getArg('date'); // YYYY-MM-DD
    const startDateStr = getArg('startDate');
    const endDateStr = getArg('endDate');
    const force = getArg('force') === 'true';
    const preserveDates = getArg('preserveDates') !== 'false'; // Default to true

    if (!brandId || !customerId) {
        console.error('Usage: ts-node src/scripts/run-backfill-scoring.ts --brandId=<uuid> --customerId=<uuid> --date=<YYYY-MM-DD> [--force=true] [--preserveDates=true]');
        process.exit(1);
    }

    let start: Date, end: Date;

    if (dateStr) {
        start = new Date(`${dateStr}T00:00:00Z`);
        end = new Date(`${dateStr}T23:59:59.999Z`);
    } else if (startDateStr && endDateStr) {
        start = new Date(`${startDateStr}T00:00:00Z`);
        end = new Date(`${endDateStr}T23:59:59.999Z`);
    } else {
        console.error('Must provide --date or --startDate/--endDate');
        process.exit(1);
    }

    console.log(`\n🔄 Starting Metrics Backfill for Brand: ${brandId}`);
    console.log(`   Customer: ${customerId}`);
    console.log(`📅 Target Period: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`🕒 Preserve Dates: ${preserveDates}`);

    // 1. Fetch relevant collector_results
    console.log('\n🔎 Finding collector results...');
    const { data: results, error: resultsError } = await supabase
        .from('collector_results')
        .select('id, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

    if (resultsError || !results) {
        console.error('Error fetching collector_results:', resultsError);
        process.exit(1);
    }

    console.log(`Found ${results.length} collector_results to re-process.`);

    if (results.length === 0) {
        console.log('Nothing to do.');
        process.exit(0);
    }

    if (!force) {
        console.log('⚠️  WARNING: This will DELETE existing metric_facts and citations for these results and re-calculate them.');
        console.log('   Run with --force=true to skip this prompt.');
        // In a real interactive shell we'd ask, but for automation we usually rely on the flag.
        // For safety, if not forced, we exit.
        console.error('Action aborted. Use --force=true to proceed.');
        process.exit(1);
    }

    const resultIds = results.map(r => r.id);

    // 2. Clean up existing data
    console.log('\n🗑️  Cleaning up existing data...');

    // Delete metric_facts (cascades to child tables)
    // We identify metric_facts by collector_result_id if possible, or join through something.
    // The metric_facts table usually has collector_result_id.
    const { error: deleteMetricsError, count: deletedMetrics } = await supabase
        .from('metric_facts')
        .delete({ count: 'exact' })
        .in('collector_result_id', resultIds);

    if (deleteMetricsError) {
        console.error('Error deleting metric_facts:', deleteMetricsError);
        process.exit(1);
    }
    console.log(`   - Deleted ${deletedMetrics} metric_facts rows`);

    // Delete citations
    // Citations also likely link to collector_result_id
    const { error: deleteCitationsError, count: deletedCitations } = await supabase
        .from('citations')
        .delete({ count: 'exact' })
        .in('collector_result_id', resultIds);

    if (deleteCitationsError) {
        console.error('Error deleting citations:', deleteCitationsError);
        process.exit(1);
    }
    console.log(`   - Deleted ${deletedCitations} citations rows`);

    // We deliberately do NOT delete/touch extracted_positions as per instructions.

    // 3. Reset scoring_status to ensure they are picked up
    console.log('\n🔄 Resetting scoring_status to "pending"...');
    const { error: resetError } = await supabase
        .from('collector_results')
        .update({ scoring_status: 'pending' })
        .in('id', resultIds);

    if (resetError) {
        console.error('Error resetting scoring_status:', resetError);
        process.exit(1);
    }
    console.log(`   - Reset scoring_status for ${resultIds.length} results`);

    // 4. Re-Process
    console.log('\n⚙️  Re-Scoring...');
    let errorCount = 0;

    // Actually, `scoreBrand` processes in batches. We can just call it once.
    console.log('   Triggering BrandScoringService.scoreBrand...');
    const scoringResult = await brandScoringService.scoreBrand({
        brandId,
        customerId,
        since: start.toISOString(), // Hint mostly used for efficient querying
        // We want to force re-processing even if looks "done"?
        // If the system thinks it's done, `scoreBrand` might return 0 processed.
        // If so, we might need to "uncomplete" the collector_results if there's a status column.
        // Checking `collector_results` table usually helps.
    });

    console.log(`   Scoring Output:`, scoringResult);

    if (preserveDates) {
        console.log('\n🕰️  Backdating timestamps...');
        // We iterate our target result IDs and fix the dates for their metrics
        // We don't know exactly which rows were created, but they are linked by collector_result_id

        for (const result of results) {
            const originalDate = result.created_at;

            // Update metric_facts
            const { error: updateMetricsError } = await supabase
                .from('metric_facts')
                .update({
                    processed_at: originalDate,
                    created_at: originalDate
                })
                .eq('collector_result_id', result.id);

            if (updateMetricsError) {
                console.error(`   Failed to backdate metric_facts for result ${result.id}:`, updateMetricsError.message);
                errorCount++;
            }

            // Update citations
            const { error: updateCitationsError } = await supabase
                .from('citations')
                .update({
                    created_at: originalDate
                })
                .eq('collector_result_id', result.id);

            if (updateCitationsError) {
                console.error(`   Failed to backdate citations for result ${result.id}:`, updateCitationsError.message);
            }
        }
        console.log(`   Backdating complete.`);
    }

    // 5. Log to History
    console.log('\n📝 Logging to backfill_history...');
    const details = {
        resultsFound: results.length,
        deletedMetrics,
        deletedCitations,
        scoringOutput: scoringResult,
        backdated: preserveDates,
        errorCount
    };

    const { error: historyError } = await supabase
        .from('backfill_history')
        .insert({
            brand_id: brandId,
            customer_id: customerId,
            target_start_date: start,
            target_end_date: end,
            status: errorCount > 0 ? 'completed_with_errors' : 'completed',
            details: details
        });

    if (historyError) {
        console.error('Failed to log to backfill_history:', historyError);
    } else {
        console.log('   Logged successfully.');
    }

    console.log('\n✅ Backfill Complete.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
