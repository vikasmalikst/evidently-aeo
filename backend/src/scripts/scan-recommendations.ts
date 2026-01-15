
import { supabaseAdmin } from '../config/database';

async function main() {
    console.log('Scanning all brands for recommendations...');
    const { data: brands, error } = await supabaseAdmin
        .from('brands')
        .select('id, name');

    if (error) {
        console.error('Error fetching brands:', error);
        return;
    }

    console.log(`Found ${brands?.length} brands.`);

    for (const brand of brands || []) {
        const { count, error: countError } = await supabaseAdmin
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brand.id);

        if (count && count > 0) {
            console.log(`✅ [${brand.name}] (ID: ${brand.id}) has ${count} recommendations.`);
        } else {
            // console.log(`[${brand.name}] has 0 recommendations.`);
        }
    }

    // Also check for orphaned recommendations
    const { count: orphanCount } = await supabaseAdmin
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .is('brand_id', null);

    console.log(`Orphaned recommendations (null brand_id): ${orphanCount}`);
}

main().catch(console.error);
