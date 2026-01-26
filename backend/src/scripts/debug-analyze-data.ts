
import { supabaseAdmin } from '../config/database';
import { GraphRecommendationService } from '../services/recommendations/graph-recommendation.service';

async function debugAnalyzeData() {
    console.log('--- Debugging Analyze Data ---');

    // 1. Get Brand ID
    const { data: brands, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .ilike('name', '%Insider%')
        .limit(10);

    if (brandError || !brands || brands.length === 0) {
        console.error('Could not find any brand matching Insider', brandError);
        return;
    }
    console.log('Found Brands:', brands);
    const brand = brands[0]; // Use the first one
    console.log(`Using Brand: ${brand.name} (${brand.id})`);

    // 2. Fetch Data (logic from context-builder.service.ts)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // 30 days lookback

    const { data: analysisData, error: analysisError } = await supabaseAdmin
        .from('consolidated_analysis_cache')
        .select(`
            collector_result_id,
            products,
            sentiment,
            keywords,
            quotes,
            collector_results!inner(brand_id, created_at)
          `)
        .eq('collector_results.brand_id', brand.id)
        .gte('collector_results.created_at', startDate.toISOString())
        .limit(200);

    if (analysisError) {
        console.error('Error fetching analysis:', analysisError);
        return;
    }

    if (!analysisData || analysisData.length === 0) {
        console.log('No consolidated analysis data found for the last 30 days.');
        return;
    }
    console.log(`Fetched ${analysisData.length} analysis records.`);

    // 3. Build Graph
    const graphService = new GraphRecommendationService();

    // Fetch competitors
    const { data: competitorData } = await supabaseAdmin
        .from('brand_competitors')
        .select('competitor_name')
        .eq('brand_id', brand.id);

    const competitorNames = competitorData?.map(c => c.competitor_name) || [];
    console.log('Competitors:', competitorNames);

    const graphInput = analysisData.map(row => ({
        id: row.collector_result_id,
        analysis: {
            products: row.products,
            sentiment: row.sentiment,
            keywords: row.keywords,
            quotes: row.quotes,
            citations: {} as any
        },
        competitorNames: competitorNames
    }));

    graphService.buildGraph(brand.name, graphInput);
    graphService.runAlgorithms();

    // 4. Get Data
    const quadrantData = graphService.getKeywordQuadrantData();
    console.log(`Generated ${quadrantData.length} quadrant data points.`);

    if (quadrantData.length > 0) {
        console.log('Sample Data:', JSON.stringify(quadrantData.slice(0, 3), null, 2));
    } else {
        console.log('Graph produced 0 quadrant data points.');
    }
}

debugAnalyzeData();
