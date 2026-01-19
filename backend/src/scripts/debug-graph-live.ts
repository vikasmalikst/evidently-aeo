
import { supabaseAdmin } from '../config/database'; // Adjust path if needed
import { graphRecommendationService } from '../services/recommendations/graph-recommendation.service';

/*
  Debug Script for Graph Recommendation Engine
  Usage: npx ts-node src/scripts/debug-graph-live.ts
*/

const BRAND_ID = 'dc70b6e5-405a-4405-8377-99447d98b28b'; // Asics
const START_DATE = '2025-12-01'; // Look back a bit

async function runDebug() {
    console.log('🚀 Starting Live Graph Debug...');

    try {
        // 1. Fetch Competitors (Bypassed - using hardcoded for debug)
        const brandName = 'Asics';
        const competitorNames = ['Brooks', 'Nike', 'Hoka', 'Saucony', 'New Balance'];

        console.log(`Brand: ${brandName}`);
        console.log(`Competitors: ${competitorNames.join(', ')}`);

        /*
        const { data: brandData, error: brandError } = await supabaseAdmin
          .from('brands')
          .select('name, competitors')
          .eq('id', BRAND_ID)
          .single();
        
        if (brandError) throw brandError;
        const brandName = brandData.name;
        const competitorNames = (brandData.competitors || []).map((c: any) => c.domain || c.name); // Simplified
        */

        // 2. Fetch Analysis Data (Flattened Columns)
        const { data, error } = await supabaseAdmin
            .from('consolidated_analysis_cache')
            .select(`
                collector_result_id,
                products,
                sentiment,
                keywords,
                quotes,
                collector_results!inner(brand_id, created_at)
              `)
            .eq('collector_results.brand_id', BRAND_ID)
            .gte('collector_results.created_at', START_DATE)
            .order('created_at', { ascending: false, foreignTable: 'collector_results' })
            .limit(2000);

        if (error) throw error;
        if (!data || data.length === 0) {
            console.log('❌ No data found.');
            return;
        }
        console.log(`✅ Fetched ${data.length} analysis records.`);

        // 3. Build Graph
        // Need to extract competitor names properly from the analysis or use the static list
        // The service expects 'competitorNames' per result. 
        // In live data, 'competitorNames' is usually derived from the result or passed in. 
        // ContextBuilder passes map(c => c.name).
        // But honestly, the buildGraph uses 'competitorNames' passed in the input object.
        // Let's rely on what ContextBuilder does: it passes specific competitors relevant to that result?
        // OR is it "List of competitors we care about"?
        // In ContextBuilder: 
        // const graphInput = data.map(row => ({ ..., competitorNames: competitorNames }));
        // It passes the FULL LIST of competitors for EVERY row.

        // Let's emulate that.

        // We need to fetch the actual competitor list used in ContextBuilder.
        // Usually it's `competitors` from `getCompetitorMetrics`.
        // For this debug, we'll just use a hardcoded list or the one from brand settings.
        // Let's use a hardcoded list of known competitors for Asics to be safe, 
        // or use the string array I derived above.

        // Refine competitor names to be simple (e.g. "Brooks" not "brooksrunning.com")
        // Simple mock list for now if the DB list is complex.
        const hardcodedCompetitors = ['Brooks', 'Nike', 'Hoka', 'Saucony', 'New Balance'];

        const graphInput = data.map(row => ({
            id: row.collector_result_id,
            analysis: {
                products: row.products,
                sentiment: row.sentiment,
                keywords: row.keywords,
                quotes: row.quotes,
                citations: {}
            },
            competitorNames: hardcodedCompetitors
        }));

        console.log('Building Graph...');
        graphRecommendationService.buildGraph(brandName, graphInput);

        console.log('Running Algorithms...');
        graphRecommendationService.runAlgorithms();

        // 4. Query Insights
        console.log('\n🔍 Checking Opportunity Gaps...');
        for (const comp of hardcodedCompetitors) {
            const gaps = graphRecommendationService.getOpportunityGaps(comp);
            if (gaps.length > 0) {
                console.log(`\nFound Gaps for ${comp}:`);
                gaps.forEach(g => {
                    console.log(`- [Score ${g.score.toFixed(2)}] ${g.topic}`);
                    console.log(`  Context: ${g.context}`);
                    console.log(`  Evidence: ${g.evidence[0]}`);
                });
            } else {
                console.log(`No significant gaps for ${comp}`);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

runDebug();
