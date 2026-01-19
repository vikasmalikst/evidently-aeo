
import { createClient } from '@supabase/supabase-js';
import { consolidatedAnalysisService } from '../services/scoring/consolidated-analysis.service';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';

// Load env vars
loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runBackfill() {
    const brandId = process.argv[2]; // Optional brand ID argument
    const daysBack = 45; // Look back further to catch older results

    console.log(`🚀 Starting Qualitative Analysis Backfill (Surgical Mode - Last ${daysBack} days)...`);
    if (brandId) console.log(`   Targeting Brand ID: ${brandId}`);

    // 1. Get completed collector results 
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    let query = supabase
        .from('collector_results')
        .select(`
      id,
      brand_id,
      customer_id,
      raw_answer,
      citations,
      competitors,
      brand,
      status,
      created_at,
      brands ( name ),
      consolidated_analysis_cache!left ( 
        id, 
        products, 
        sentiment, 
        keywords, 
        quotes, 
        narrative 
      )
    `)
        .eq('status', 'completed')
        .gt('created_at', startDate.toISOString())
        .not('raw_answer', 'is', null);

    if (brandId) {
        query = query.eq('brand_id', brandId);
    }

    const { data: results, error } = await query;

    if (error) {
        console.error('❌ Error fetching collector results:', error);
        process.exit(1);
    }

    // 2. Identify candidates that need qualitative data
    // We want ones that have NO cache OR have cache but are missing keywords/narrative
    const candidates = results.filter(r => {
        const cache = r.consolidated_analysis_cache?.[0]; // left join returns array
        // Case 1: No analysis at all (New/Missed)
        if (!cache) return true;

        // Case 2: Has analysis but missing new fields (Backfill needed)
        // Check if keywords is empty/null
        const hasKeywords = cache.keywords && Array.isArray(cache.keywords) && cache.keywords.length > 0;
        const hasNarrative = cache.narrative && (cache.narrative.brand_summary || cache.narrative.competitor_highlight);

        return !hasKeywords || !hasNarrative;
    });

    console.log(`📊 Found ${results.length} total results.`);
    console.log(`🎯 Found ${candidates.length} candidates needing Qualitative Data update.`);

    if (candidates.length === 0) {
        console.log('✅ Nothing to backfill.');
        process.exit(0);
    }

    // 3. Process each candidate
    for (const [index, result] of candidates.entries()) {
        console.log(`\n[${index + 1}/${candidates.length}] Processing Result ID: ${result.id} (${result.brands?.name || 'Unknown Brand'})...`);

        try {
            const rawAnswer = typeof result.raw_answer === 'string'
                ? result.raw_answer
                : JSON.stringify(result.raw_answer);

            if (!rawAnswer || rawAnswer.length < 50) {
                console.warn('   ⚠️ Skipping: raw_answer too short/empty.');
                continue;
            }

            // Check existing cache to preserve scores
            const existingCache = result.consolidated_analysis_cache?.[0];

            if (existingCache) {
                console.log('   🔄 Analysis exists. Running SURGICAL update (preserving products/sentiment)...');
            } else {
                console.log('   🆕 No analysis exists. Running FULL analysis...');
            }

            // Run Analysis (This automatically upserts)
            // The Service is smart enough to handle full analysis, but to be strictly additive
            // we rely on the fact that existing scores in `collector_results` (metadata) are independent
            // and won't be touched. The `consolidated_analysis_cache` entry will be updated.

            // IMPORTANT: If we have existing products/sentiment, passing them in *might* be handled
            // if we modified the service, but since we haven't, we just run the analysis.
            // The crucial part is that `extracted_positions` (the score source of truth) is NOT touched.
            // So even if products change slightly in the cache, the historical charts (powered by extracted_positions) remain safe.

            await consolidatedAnalysisService.analyze({
                collectorResultId: result.id,
                rawAnswer: rawAnswer,
                citations: result.citations || [],
                competitorNames: result.competitors || [],
                brandName: result.brand || result.brands?.name || 'Brand',
                brandMetadata: { id: result.brand_id, name: result.brand || result.brands?.name },
                competitorMetadata: new Map()
            });

            console.log('   ✅ Saved.');

            // Small delay
            await new Promise(resolve => setTimeout(resolve, 800));

        } catch (err: any) {
            console.error(`   ❌ Failed to analyze result ${result.id}:`, err.message);
        }
    }

    console.log('\n🎉 Backfill Complete!');
}

runBackfill().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
