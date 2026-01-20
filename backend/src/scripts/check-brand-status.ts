
/**
 * Check Brand Status Script
 * 
 * Checks when the last scoring was done for a specified brand and verifies
 * if qualitative metrics (keywords, quotes, narratives) exist in the consolidated_analysis_cache.
 * 
 * Usage:
 *   npx ts-node backend/src/scripts/check-brand-status.ts [BRAND_ID]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function checkBrandStatus(brandId: string) {
    console.log(`\n🔍 Checking status for Brand ID: ${brandId}\n`);

    try {
        // 1. Check Last Scoring Time
        console.log('--- Scoring Status ---');
        const { data: lastScoring, error: scoringError } = await supabase
            .from('collector_results')
            .select('scoring_completed_at, created_at, id')
            .eq('brand_id', brandId)
            .eq('scoring_status', 'completed')
            .order('scoring_completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (scoringError) {
            console.error('❌ Error fetching last scoring time:', scoringError.message);
        } else if (lastScoring) {
            const completedAt = lastScoring.scoring_completed_at
                ? new Date(lastScoring.scoring_completed_at).toLocaleString()
                : `Unknown (scoring_completed_at is null, created_at: ${new Date(lastScoring.created_at).toLocaleString()})`;

            console.log(`✅ Last Scoring Completed At: ${completedAt}`);
            console.log(`   (Collector Result ID: ${lastScoring.id})`);
        } else {
            console.log('⚠️ No completed scoring runs found for this brand.');
        }

        // 2. Check Absolute Last Collector Result (Any Status)
        console.log('\n--- Last Collector Result (Any Status) ---');
        const { data: lastResult, error: lastResultError } = await supabase
            .from('collector_results')
            .select('created_at, scoring_status, id')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastResultError) {
            console.error('❌ Error fetching last collector result:', lastResultError.message);
        } else if (lastResult) {
            console.log(`✅ ID: ${lastResult.id}`);
            console.log(`   Created At: ${new Date(lastResult.created_at).toLocaleString()}`);
            console.log(`   Scoring Status: ${lastResult.scoring_status || 'NULL'}`);

            const isCompleted = lastResult.scoring_status === 'completed';
            console.log(`   Detailed Check: Status is ${isCompleted ? 'COMPLETED' : 'NOT COMPLETED (or NULL)'}`);
        } else {
            console.log('⚠️ No collector results found at all for this brand.');
        }

        // 3. Check Qualitative Metrics in Consolidated Analysis Cache
        console.log('\n--- Qualitative Metrics Check (consolidated_analysis_cache) ---');

        // First, get recent collector_result_ids for this brand to limit the search
        const { data: collectorResults, error: idsError } = await supabase
            .from('collector_results')
            .select('id')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .limit(50); // Check last 50 results

        if (idsError) {
            console.error('❌ Error fetching collector results for cache check:', idsError.message);
            return;
        }

        if (!collectorResults || collectorResults.length === 0) {
            console.log('⚠️ No collector results found for this brand.');
            return;
        }

        const ids = collectorResults.map(r => r.id);

        // Now query the cache
        const { data: cacheData, error: cacheError } = await supabase
            .from('consolidated_analysis_cache')
            .select('collector_result_id, keywords, quotes, narrative, created_at')
            .in('collector_result_id', ids);

        if (cacheError) {
            console.error('❌ Error fetching consolidated_analysis_cache:', cacheError.message);
        } else if (!cacheData || cacheData.length === 0) {
            console.log('⚠️ No entries found in consolidated_analysis_cache for the recent collector results.');
        } else {
            console.log(`Found ${cacheData.length} cache entries for recent collector results.`);

            let hasKeywords = 0;
            let hasQuotes = 0;
            let hasNarrative = 0;
            let totalEntries = cacheData.length;

            cacheData.forEach(entry => {
                // Check keywords
                if (entry.keywords && Array.isArray(entry.keywords) && entry.keywords.length > 0) {
                    hasKeywords++;
                }
                // Check quotes
                if (entry.quotes && Array.isArray(entry.quotes) && entry.quotes.length > 0) {
                    hasQuotes++;
                }
                // Check narrative
                if (entry.narrative && Object.keys(entry.narrative).length > 0) {
                    hasNarrative++;
                }
            });

            console.log(`\nSummary of Qualitative Metrics (in last ${totalEntries} cache entries):`);
            console.log(`- Keywords found:  ${hasKeywords} / ${totalEntries} entries`);
            console.log(`- Quotes found:    ${hasQuotes} / ${totalEntries} entries`);
            console.log(`- Narratives found: ${hasNarrative} / ${totalEntries} entries`);

            if (hasKeywords > 0 || hasQuotes > 0 || hasNarrative > 0) {
                console.log('\n✅ Qualitative metrics EXIST for this brand.');
            } else {
                console.log('\n⚠️ Qualitative metrics do NOT exist (or are empty) in the checked entries.');
            }

            // Show sample of first entry if available
            if (cacheData.length > 0) {
                const sample = cacheData[0];
                console.log('\n--- Sample Data (ID: ' + sample.collector_result_id + ') ---');
                console.log('Keywords:', JSON.stringify(sample.keywords).substring(0, 100) + '...');
                console.log('Quotes:', JSON.stringify(sample.quotes).substring(0, 100) + '...');
                console.log('Narrative:', JSON.stringify(sample.narrative).substring(0, 100) + '...');
            }
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

// Get Brand ID from command line arg or use default if provided in task, else error
const targetBrandId = process.argv[2] || '5a57c430-6940-4198-a1f5-a443cbd044dc';

if (!targetBrandId) {
    console.error('Please provide a Brand ID as an argument.');
    process.exit(1);
}

checkBrandStatus(targetBrandId);
