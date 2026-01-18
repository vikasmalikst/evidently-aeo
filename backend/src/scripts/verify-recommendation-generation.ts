
import { recommendationV3Service } from '../services/recommendations/recommendation-v3.service';
import { supabaseAdmin } from '../config/database';

// Mock context if needed, but we want to test the full flow including context gathering
// However, RecommendationV3Service.generateRecommendations() takes brandId and customerId and does all gathering.

async function verifyRecommendationGeneration() {
    console.log('🔍 Fetching a brand with Consolidated Analysis data...');

    // Find a brand that has analysis cache
    const { data: analysis, error } = await supabaseAdmin
        .from('consolidated_analysis_cache')
        .select(`
            collector_results!inner(brand_id)
        `)
        .limit(1);

    let brandId: string;

    if (analysis && analysis.length > 0) {
        const entry = analysis[0] as any;
        // Supabase returns nested object or array depending on relation type, handle both safely-ish
        brandId = Array.isArray(entry.collector_results)
            ? entry.collector_results[0].brand_id
            : entry.collector_results.brand_id;
        console.log(`✅ Found recent analysis for brand ID: ${brandId}`);
    } else {
        console.warn('⚠️ No consolidated analysis data found. Falling back to any brand.');
        const { data: brand } = await supabaseAdmin.from('brands').select('id').limit(1).single();
        brandId = brand?.id || '';
    }

    if (!brandId) {
        console.error('❌ Could not find any brand to test with.');
        process.exit(1);
    }

    // Fetch customer ID
    const { data: brand } = await supabaseAdmin.from('brands').select('name, customer_id').eq('id', brandId).single();
    if (!brand) throw new Error('Brand not found');

    const customerId = brand.customer_id;

    console.log(`🚀 Starting Recommendation Generation Verification for Brand: ${brand.name} (${brandId})`);

    // Force Normal Mode (Disable Cold Start) to test the main prompt
    process.env.RECS_V3_COLD_START_MODE = 'false';
    console.log('⚡ Forced RECS_V3_COLD_START_MODE = false');

    const recService = recommendationV3Service;

    try {
        // 1. Trigger Generation
        const result = await recService.generateRecommendations(brandId, customerId);

        if (!result.success) {
            console.error('❌ Generation Failed:', result.message);
            process.exit(1);
        }

        console.log(`✅ Generation Successful! Id: ${result.generationId}`);
        console.log(`\n📊 Generated ${result.recommendations.length} Recommendations:`);

        // 2. Inspect Recommendations for "Voice" and "Strategy"
        result.recommendations.forEach((rec, idx) => {
            console.log(`\n--- [Recommendation ${idx + 1}] ---`);
            console.log(`Action: ${rec.action}`);
            console.log(`Role: ${rec.strategicRole || 'Standard'}`);
            console.log(`KPI: ${rec.kpi}`);
            console.log(`Confidence: ${rec.confidence}`);
            console.log(`Reason: ${rec.reason}`); // This is where we look for "Voice of Customer" data

            // Check for quote/keyword usage heuristic (not perfect, but illustrative)
            if (rec.reason?.includes('"') || rec.reason?.includes("'")) {
                console.log(`   ✨ Possible Quote Usage Detected`);
            }
        });

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
    } finally {
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    verifyRecommendationGeneration();
}
