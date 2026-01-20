
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { GraphRecommendationService } from './services/recommendations/graph-recommendation.service';
import { NodeType } from './services/recommendations/graph-recommendation.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function debugGraph(brandId: string) {
    console.log(`[Debug] Fetching data for brand ${brandId}...`);

    // 1. Get brand info
    const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('name')
        .eq('id', brandId)
        .single();

    if (!brand) {
        console.error('Brand not found');
        return;
    }
    console.log(`[Debug] Brand: ${brand.name}`);

    // 2. Get competitors
    const { data: competitors } = await supabaseAdmin
        .from('competitors')
        .select('name')
        .eq('brand_id', brandId);

    const competitorNames = competitors?.map(c => c.name) || [];
    console.log(`[Debug] Competitors: ${competitorNames.join(', ')}`);

    // 4. Get cache data using JOIN (better for large datasets)
    const { data: cacheData, error: cacheError } = await supabaseAdmin
        .from('consolidated_analysis_cache')
        .select(`
            collector_result_id, 
            keywords, 
            sentiment, 
            products, 
            quotes,
            collector_results!inner(brand_id)
        `)
        .eq('collector_results.brand_id', brandId)
        .limit(100); // Limit for debugging

    if (cacheError) {
        console.error('[Debug] Cache Fetch Error:', cacheError);
        return;
    }

    if (!cacheData || cacheData.length === 0) {
        console.log('[Debug] No cache data found');
        return;
    }
    console.log(`[Debug] Found ${cacheData.length} cache entries`);

    // Check one entry
    console.log('[Debug] Sample entry:', JSON.stringify(cacheData[0], null, 2));

    // 5. Transform
    const graphResults = cacheData.map(row => ({
        id: row.collector_result_id,
        analysis: {
            products: row.products || {},
            citations: {}, // valid type
            sentiment: row.sentiment || {},
            keywords: row.keywords || [],
            quotes: row.quotes || []
        } as any,
        competitorNames
    }));

    // 6. Build Graph
    const graphService = new GraphRecommendationService();
    console.log('[Debug] Building graph...');

    graphService.buildGraph(brand.name, graphResults);

    // Check graph stats
    // We can't access private graph property, but runAlgorithms logs something
    console.log('[Debug] Running algorithms...');
    graphService.runAlgorithms();

    // 7. Get Data
    const data = graphService.getKeywordQuadrantData();
    console.log(`[Debug] Quadrant Data Length: ${data.length}`);

    if (data.length > 0) {
        console.log('[Debug] Top 5 keywords:', data.slice(0, 5));
    } else {
        console.log('[Debug] No keywords found in graph output');
    }
}

// Run with the provided brandId
const brandId = '583be119-67da-47bb-8a29-2950eb4da3ea';
debugGraph(brandId).catch(console.error);
