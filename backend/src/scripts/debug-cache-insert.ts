
/**
 * Debug Cache Insertion Script
 * 
 * Manually runs consolidatedAnalysisService.analyze on a specific collector result
 * and checks if the result is properly stored in consolidated_analysis_cache.
 * 
 * Usage:
 *   npx ts-node backend/src/scripts/debug-cache-insert.ts [COLLECTOR_RESULT_ID] [BRAND_ID]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { consolidatedAnalysisService } from '../services/scoring/consolidated-analysis.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function runDebug(collectorResultId: number, brandIdInput: string | undefined) {
    console.log(`\n🐞 Starting Debug for Collector Result ID: ${collectorResultId}\n`);

    // 1. Fetch Collector Result
    const { data: collectorResult, error: fetchError } = await supabase
        .from('collector_results')
        .select('*, brands(name, metadata)')
        .eq('id', collectorResultId)
        .single();

    if (fetchError || !collectorResult) {
        console.error('❌ Error fetching collector result:', fetchError?.message || 'Not found');
        return;
    }

    const brandId = collectorResult.brand_id;
    const brandName = collectorResult.brands?.name; // Joined via foreign key if available
    const customerId = collectorResult.customer_id;

    console.log(`   Brand ID: ${brandId}`);
    console.log(`   Brand Name: ${brandName}`);
    console.log(`   Customer ID: ${customerId}`);
    console.log(`   Raw Answer Length: ${collectorResult.raw_answer?.length || 0}`);

    // 2. Clear existing cache for this ID (to force fresh run)
    console.log('\n🧹 Clearing existing cache entry...');
    const { error: deleteError } = await supabase
        .from('consolidated_analysis_cache')
        .delete()
        .eq('collector_result_id', collectorResultId);

    if (deleteError) {
        console.warn('⚠️ Error clearing cache (might duplicate or fail silently later):', deleteError.message);
    } else {
        console.log('✅ Cache cleared.');
    }

    // 3. Prepare Options for Analyze
    // Simplified logic similar to consolidated-scoring.service.ts
    const competitors = Array.isArray(collectorResult.competitors) ? collectorResult.competitors : [];
    const competitorNames = competitors
        .map((c: any) => (typeof c === 'string' ? c : c.competitor_name))
        .filter((n: any) => n);

    let citations: string[] = [];
    if (Array.isArray(collectorResult.citations)) {
        citations = collectorResult.citations.map((c: any) => typeof c === 'string' ? c : c.url);
    }

    console.log(`\n🚀 Triggering consolidatedAnalysisService.analyze...`);
    console.log(`   Competitors: ${competitorNames.join(', ')}`);
    console.log(`   Citations: ${citations.length}`);

    try {
        const analysisResult = await consolidatedAnalysisService.analyze({
            brandName: brandName || 'Unknown Brand',
            brandMetadata: { customer_id: customerId, brand_id: brandId },
            brandProducts: undefined, // Skipping complex product enrichment for debug
            competitorNames: competitorNames,
            competitorMetadata: new Map(), // Empty for debug
            rawAnswer: collectorResult.raw_answer,
            citations: citations,
            collectorResultId: collectorResultId,
            customerId: customerId,
            brandId: brandId,
        });

        console.log('\n✅ Analyze returned successfully.');
        console.log('   Products found:', analysisResult.products?.brand?.length || 0);
        console.log('   Keywords found:', analysisResult.keywords?.length || 0);

    } catch (err) {
        console.error('❌ Analyze threw an error:', err);
        return;
    }

    // 4. Verify Cache Insertion
    console.log('\n🔍 Verifying Cache Insertion in DB...');

    // Wait a moment for async operations (though analyze should await store)
    await new Promise(r => setTimeout(r, 1000));

    const { data: cacheCheck, error: checkError } = await supabase
        .from('consolidated_analysis_cache')
        .select('*')
        .eq('collector_result_id', collectorResultId)
        .single();

    if (checkError) {
        console.error('❌ Cache verification failed (Query Error):', checkError.message);
        // It might be 'PGRST116' (The result contains 0 rows)
        if (checkError.code === 'PGRST116') {
            console.error('❌ FAIL: No row found in consolidated_analysis_cache!');
        }
    } else if (cacheCheck) {
        console.log('✅ SUCCESS: Cache entry found!');
        console.log('   ID:', cacheCheck.id);
        console.log('   Created At:', cacheCheck.created_at);
        console.log('   Keywords Present:', !!(cacheCheck.keywords && cacheCheck.keywords.length > 0));
        console.log('   Narrative Present:', !!cacheCheck.narrative);
    }
}

const targetId = process.argv[2] ? parseInt(process.argv[2]) : 10543; // Default to the pending ID we found earlier
const targetBrand = process.argv[3];

runDebug(targetId, targetBrand);
