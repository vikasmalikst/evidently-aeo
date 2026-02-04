import { supabaseAdmin } from '../config/database';
import { queryTaggingService } from '../services/query-tagging.service';

async function retagBrand(brandId: string) {
    console.log(`🔄 Re-tagging queries for brand: ${brandId}...`);

    // 1. Fetch brand terms (now they exist in DB!)
    const terms = await queryTaggingService.getBrandTerms(brandId);
    console.log(`🏷️ Using terms: ${terms.brandName}, Synonyms: [${terms.synonyms.join(', ')}]`);

    // 2. Fetch queries
    const { data: queries, error: fetchError } = await supabaseAdmin
        .from('generated_queries')
        .select('id, query_text')
        .eq('brand_id', brandId);

    if (fetchError || !queries) {
        console.error('❌ Error fetching queries:', fetchError);
        return;
    }

    console.log(`📋 Found ${queries.length} queries. Re-calculating tags...`);

    // 3. Update tags
    let updateCount = 0;
    for (const query of queries) {
        const newTag = queryTaggingService.determineTag(query.query_text, terms);

        const { error: updateError } = await supabaseAdmin
            .from('generated_queries')
            .update({ query_tag: newTag })
            .eq('id', query.id);

        if (updateError) {
            console.error(`❌ Failed to update query ${query.id}:`, updateError);
        } else {
            updateCount++;
        }
    }

    console.log(`✅ Successfully re-tagged ${updateCount} queries!`);
}

// Get brand ID from command line or default to your specific one
const brandId = process.argv[2] || 'a0fb0d8f-fbae-4c13-aae6-cd1dc169806d';
retagBrand(brandId).catch(console.error);
