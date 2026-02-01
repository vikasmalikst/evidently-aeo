
import { supabaseAdmin } from '../config/database';

async function updateQueryTags() {
    console.log('Fetching data for update...');

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

    // 2. Fetch all generated queries
    let allQueries: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    console.log('Fetching generated_queries...');
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

    console.log(`Processing ${allQueries.length} queries...`);

    // 3. Classify
    const biasIds: string[] = [];
    const blindIds: string[] = [];

    allQueries.forEach(q => {
        const terms = brandTermsMap.get(q.brand_id);
        let isBias = false;
        
        if (terms && terms.length > 0) {
            const queryTextLower = q.query_text.toLowerCase();
            // Check for exact match or substring? 
            // "contains any string found in brand_products"
            isBias = terms.some(term => queryTextLower.includes(term.toLowerCase()));
        }
        
        if (isBias) {
            biasIds.push(q.id);
        } else {
            blindIds.push(q.id);
        }
    });

    console.log(`Classification Results:`);
    console.log(`- Bias: ${biasIds.length}`);
    console.log(`- Blind: ${blindIds.length}`);

    // 4. Update
    async function updateBatch(ids: string[], tag: string) {
        const CHUNK_SIZE = 100; // Safe for URL length
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const { error } = await supabaseAdmin
                .from('generated_queries')
                .update({ query_tag: tag })
                .in('id', chunk);
            
            if (error) {
                console.error(`Error updating ${tag} batch ${i}:`, error);
            } else {
                process.stdout.write('.');
            }
        }
    }

    console.log('\nUpdating BIAS records...');
    await updateBatch(biasIds, 'bias');

    console.log('\nUpdating BLIND records...');
    await updateBatch(blindIds, 'blind');

    console.log('\n\n✅ Update complete.');
}

updateQueryTags();
