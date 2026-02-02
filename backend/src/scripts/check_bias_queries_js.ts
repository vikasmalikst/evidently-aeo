
import { supabaseAdmin } from '../config/database';

async function checkBiasJS() {
    console.log('Fetching data...');

    // 0. Fetch brand names
    const { data: brandsData, error: brandsError } = await supabaseAdmin
        .from('brands')
        .select('id, name');

    if (brandsError) {
        console.error('Error fetching brands:', brandsError);
        return;
    }

    const brandNameMap = new Map<string, string>();
    brandsData.forEach(b => brandNameMap.set(b.id, b.name));

    // 1. Fetch all brand products
    const { data: brandProductsData, error: bpError } = await supabaseAdmin
        .from('brand_products')
        .select('brand_id, brand_synonyms, brand_products');

    if (bpError) {
        console.error('Error fetching brand_products:', bpError);
        return;
    }

    // Map brand_id -> terms (synonyms + products)
    const brandTermsMap = new Map<string, string[]>();
    brandProductsData.forEach(bp => {
        const terms = [
            ...(Array.isArray(bp.brand_synonyms) ? bp.brand_synonyms : []),
            ...(Array.isArray(bp.brand_products) ? bp.brand_products : [])
        ].filter(t => t && typeof t === 'string' && t.trim().length > 0);
        
        brandTermsMap.set(bp.brand_id, terms);
    });

    // 2. Fetch all generated queries (with pagination)
    let allQueries: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: queries, error: qError } = await supabaseAdmin
            .from('generated_queries')
            .select('id, query_text, brand_id')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (qError) {
            console.error('Error fetching generated_queries:', qError);
            return;
        }

        if (queries && queries.length > 0) {
            allQueries = allQueries.concat(queries);
            if (queries.length < pageSize) hasMore = false;
            page++;
        } else {
            hasMore = false;
        }
    }

    console.log(`Processing ${allQueries.length} queries against ${brandTermsMap.size} brands...`);

    // 3. Process
    const biasQueries: { text: string; matchedTerm: string; brandId: string; brandName: string }[] = [];

    allQueries.forEach(q => {
        const terms = brandTermsMap.get(q.brand_id);
        if (!terms || terms.length === 0) return; // 'blind' by default if no terms

        const queryTextLower = q.query_text.toLowerCase();
        
        // Find the matching term
        const matchedTerm = terms.find(term => queryTextLower.includes(term.toLowerCase()));

        if (matchedTerm) {
            biasQueries.push({
                text: q.query_text,
                matchedTerm: matchedTerm,
                brandId: q.brand_id,
                brandName: brandNameMap.get(q.brand_id) || 'Unknown Brand'
            });
        }
    });

    // 4. Output
    console.log(`\nFound ${biasQueries.length} biased queries:\n`);
    biasQueries.forEach((item, index) => {
        console.log(`${index + 1}. [Brand: "${item.brandName}"] [Matched: "${item.matchedTerm}"] ${item.text}`);
    });
}

checkBiasJS();
