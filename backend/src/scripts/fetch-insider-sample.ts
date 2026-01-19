
import { supabaseAdmin } from '../config/database';

async function fetchSampleData(brandId: string) {
    // 1. Get IDs associated with this brand
    const { data: results } = await supabaseAdmin
        .from('collector_results')
        .select('id')
        .eq('brand_id', brandId)
        .limit(100);

    if (!results || results.length === 0) {
        console.log("No results found");
        return;
    }
    const ids = results.map(r => r.id);

    // 2. Query cache for non-empty keywords
    const { data, error } = await supabaseAdmin
        .from('consolidated_analysis_cache')
        .select('keywords, quotes, sentiment, products')
        .in('collector_result_id', ids)
        .not('keywords', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Filter for non-empty arrays locally if JSON filtering is tricky
    const validData = data?.filter(d => d.keywords && Array.isArray(d.keywords) && d.keywords.length > 0) || [];

    if (validData.length > 0) {
        const sample = validData[0];
        console.log('--- FOUND VALID DATA ---');
        console.log('Keywords:', JSON.stringify(sample.keywords?.slice(0, 3), null, 2));
        console.log('Quotes:', JSON.stringify(sample.quotes?.slice(0, 1), null, 2));
    } else {
        console.log('No records with keywords found in top 100 results.');
    }
}

fetchSampleData('583be119-67da-47bb-8a29-2950eb4da3ea');
