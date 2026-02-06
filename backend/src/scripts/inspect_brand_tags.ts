import { supabaseAdmin } from '../config/database';
import { queryTaggingService } from '../services/query-tagging.service';

async function inspectBrand(brandId: string) {
    console.log(`🔍 Inspecting brand: ${brandId}`);

    // 1. Fetch brand details
    const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('name, metadata')
        .eq('id', brandId)
        .single();

    if (brandError) {
        console.error('❌ Error fetching brand:', brandError);
        return;
    }

    console.log(`\n🏢 Brand Name: ${brand.name}`);

    // 2. Fetch terms used for tagging
    const terms = await queryTaggingService.getBrandTerms(brandId, brand.name);
    console.log('\n🏷️ Brand Terms used for tagging:');
    console.log('- Name:', terms.brandName);
    console.log('- Synonyms:', terms.synonyms);
    console.log('- Products:', terms.products);

    // 3. Fetch queries and their tags
    console.log('\n❓ Queries and Tags:');
    const { data: queries, error: queriesError } = await supabaseAdmin
        .from('generated_queries')
        .select('query_text, query_tag')
        .eq('brand_id', brandId);

    if (queriesError) {
        console.error('❌ Error fetching queries:', queriesError);
        return;
    }

    if (!queries || queries.length === 0) {
        console.log('No queries found for this brand.');
    } else {
        queries.forEach(q => {
            console.log(`[${q.query_tag}] ${q.query_text}`);
        });

        const biasCount = queries.filter(q => q.query_tag === 'bias').length;
        const blindCount = queries.filter(q => q.query_tag === 'blind').length;
        console.log(`\nSummary: ${biasCount} bias, ${blindCount} blind (Total: ${queries.length})`);
    }
}

const BRAND_ID = 'a0fb0d8f-fbae-4c13-aae6-cd1dc169806d';
inspectBrand(BRAND_ID).catch(console.error);
